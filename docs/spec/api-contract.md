# API 契约（spec 即契约）

> 实现前先定契约。代码必须严格遵循本文签名；改动先回这里。

---

## 1. 宿主 remote 命名空间：`stash`

宿主通过 Typert Remote 暴露 `remote.stash`，方法如下（返回统一 `{ ok: true, value }` / `{ ok: false, error: { code, message } }` 信封）。

```ts
// —— 抽屉条目 ——
interface StashItem {
  id: string          // uuid
  text: string        // 收藏的文本/词组（非空）
  source?: string     // 来源：当前会话 id / 'selection' / 备注（可选）
  tags?: string[]     // 二期
  createdAt: number   // epoch ms
  updatedAt: number   // epoch ms，>= createdAt（与 data-model.md 对齐）
}

// —— 追问 ——
interface AskRequest {
  query: string            // 组装好的追问文本（选中内容 + 可选自定义问题）
  includeContext: boolean  // 是否加入当前对话上下文
  sessionId?: string       // 可选；未提供时宿主选择最近活动会话
}
interface AskResult {
  answer: string           // 一次性返回答案（MVP）
  // 二期可改为流式：answer 分段 + done 标志
}
```

### 方法签名

```ts
list():   Promise<Envelope<StashItem[]>>
save(input: { text: string; source?: string }): Promise<Envelope<StashItem>>
delete(input: { id: string }): Promise<Envelope<null>>
ask(input: AskRequest): Promise<Envelope<AskResult>>
```

> 命名约定：方法名不得与客户端 `RemoteNamespaceService` 的实例/原型成员冲突（如 `remove` 会触发
> `client api: method "stash/remove" conflicts with its namespace service`），删除统一用 `delete`
> （官方 message-feedback 同用 `@Remote('delete')`）。

### 约束
- `save`：`text.trim()` 非空才允许；返回完整条目。
- `delete`：幂等（不存在的 id 返回成功）。
- `ask`：`query` 非空；`includeContext=false` 时**绝不**读会话；MVP 用 `ctx.llm.stream` 一次性汇总答案。
- 所有方法失败都要返回结构化 `error.code`（客户端据此展示友好提示）。
- 宿主侧 `@deepseek-ai/*` 运行时依赖（cordis / typert-protocol / storage-domain）必须经 `src/host/runtime.ts` 导入（`createRequire().resolve()` 取真实路径），保证 `@Remote` 标记与宿主 gateway 落在**同一模块实例**；否则 `stash/*` 端点会被 gateway 判为 `invocation-unavailable`，客户端表现为「请求失败，请重试」。

---

## 2. 客户端槽位注册

### 2.1 浮窗主界面（必选）
```ts
ctx.slots.inject("shell.overlay", () => ctx.slots.register({
  name: "shell.overlay",
  id: "stash",           // 自定 id，不占用官方 id
  order: 100,
}, OverlayPanel))             // React 组件
```
- 组件内实现：抽屉标签墙（圆角标签流式排列，点击标签单选/多选，选中后可「追问选中 / 删除选中」）、追问输入、是否加上下文开关、结果区。
- 层默认 click-through，浮窗容器需 `pointer-events: auto`。

### 2.2 消息级入口（可选，二期）
```ts
ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
  name: "conversation.chat.assistant-actions",
  id: "stash-collect",   // 自定 id
  order: 100,
}, CollectAction))           // 单条「收藏此条」按钮
```

### 2.3 选区捕获（无槽位，纯 DOM）
- 监听 `document` 的 `mouseup` / `selectionchange`，以及 `scroll`（滚动即收起菜单）。
- `const sel = window.getSelection(); const text = sel?.toString().trim()`。
- 判定 `sel` 是否落在对话内容容器内（用容器归属判断，不依赖具体 class）；同时排除 `input` / `textarea` / `[contenteditable]` 内的选区。
- 非空时在选区附近渲染 **Notion 式选区菜单**：「加入抽屉」/「追问」，自动避让视口边缘（上方放不下则放选区下方）。

---

## 3. 客户端内部 store（内存态）

```ts
interface SelectionMenu {
  x: number                  // 菜单中心 x（viewport 坐标）
  y: number                  // 菜单锚点 y
  placement: 'top' | 'bottom'
  text: string               // 选区文本
}

interface ClientState {
  items: StashItem[]             // 抽屉缓存（标签墙数据源）
  menu: SelectionMenu | null     // 选区菜单状态（Notion 式）
  query: string                  // 追问输入
  includeContext: boolean        // 是否加上下文开关
  askState: 'idle' | 'pending' | 'done' | 'error'
  lastAnswer: string | null
  selectedIds: Set<string>       // 抽屉标签选中集合（单选/多选）
}
```

---

## 4. 错误码约定

| code | 含义 | 客户端提示 |
|---|---|---|
| `text-blank` | 收藏内容为空 | 「请先选中文字」 |
| `query-blank` | 追问内容为空 | 「请输入或选中要追问的内容」 |
| `llm-error` | LLM 调用失败 | 展示宿主返回的 message |
| `storage-error` | 持久化失败 | 「抽屉保存失败」 |
| `transport` | 远程调用失败 | 「请求失败，请重试」 |

---

## 5. 变更流程

- 任何签名变化 → 先改本文件 → 同步 [`data-model.md`](data-model.md)（若涉及数据）→ 再改代码与测试。
- 契约测试应覆盖：`save` 空文本拒绝、`delete` 幂等、`ask` 不加上下文不读会话。
