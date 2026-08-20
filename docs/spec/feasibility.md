# 可行性评估

> 本文档由一次基于真实 DSH 环境源码 / 插件的评估沉淀而来，作为「随手抽屉」立项的技术可行性依据。
> 评估时间：2026-08。DSH 版本：0.1.x（rc）。

---

## 结论：完全可行，且这套环境几乎是为它准备的

「随手抽屉」的每个需求都能映射到已存在的 DSH 原生机制上，**不需要改框架、不需要 hack**。唯一要自研的是「选区捕获」这一段 DOM 交互，其余全是「组装现成积木」。

---

## 需求 → 机制映射

| 你的需求 | 落地机制（已核实） | 难度 |
|---|---|---|
| 选中文字/词组 → 存进抽屉 | 客户端插件挂 `document` 级 `mouseup`/`selectionchange` 监听，`window.getSelection().toString()` 取文本；选区旁浮出 Notion 式菜单，点「加入抽屉」存入宿主 | 中（唯一自研段） |
| 抽屉持久化 | 宿主用 `@deepseek-ai/dsh-storage-domain`（`defineDomain`/`domainTable`，schema 校验落盘，`message-feedback` 官方插件同款）或更简单的 `storage` JSON 服务 | 低 |
| 页面小窗口（浮窗 UI） | 客户端 `ctx.slots.inject("shell.overlay", ...)` —— 官方文档明确写着：「frame-wide floating layer, additive, click-through」，就是给自定义浮层预留的槽位 | 低 |
| 从抽屉选 1~N 条叠加追问 | 浮窗里多选条目 + 选中文本，组装成一段 query 文本 | 低 |
| 追问是否加入上下文 | 加开关；上下文来源二选一/三选一（见下） | 中 |
| 追问并回传答案 | 宿主注册自己的 remote 命名空间（`message-feedback` 的 `remote.messageFeedback` 是现成范式），`ask({query, context})` 里直接 `ctx.llm.stream({ provider, model, system, messages, ... })` 跑一条独立查询，答案流式/一次性回传浮窗 | 中 |

---

## 三条最值得注意的设计点（待拍板）

### 1. 选区捕获是 DOM 层交互，不是「槽位」API
官方槽位里没有「选中文本」这一概念——它得靠你监听 `document` 选区事件、判断选区是否落在对话内容容器内、再在选区旁弹一个 Notion 式小菜单（加入抽屉 / 追问）。
- **可行**：注入器自己的 UI 已经在直接操作 `document.body`/`createElement`，说明客户端插件有完整 DOM 权限。
- **注意**：对话 DOM 结构变化时的鲁棒性；建议用 `getSelection()` 的纯文本 + 容器归属判断，而不是依赖具体 class 名。

### 2. `shell.overlay` 是 `root` 作用域，拿不到当前会话数据
浮窗槽位只给 `useSessions`/`useWorkspaces`，**没有** `useSession`/`useProjection`。「是否加入上下文」里「上下文」从哪来，有三条路：
- **A. 宿主侧解析（推荐）**：宿主插件在进程里，有 `session`/`session-query` 服务，`ask(includeContext=true)` 时由宿主读当前会话消息，客户端不用碰会话数据。
- **B. 会话作用域隐形组件**：客户端在某个 `session` 作用域槽位（如 `conversation.session.header.actions`）挂一个隐形组件，用 `useSession()` 把当前上下文灌进共享 store，浮窗再读。
- **C. MVP 先退而求其次**：上下文 = 你选中的那段文字本身 + 用户手动追加，先不做「整段对话自动带入」。

### 3. 「临时追问」有两条深度路线
- **MVP（推荐先做）**：宿主直接 `ctx.llm.stream()` 跑一次无工具的一次性问答（super-injector 的 daemon-loop 示例就是这个 API，30 行能跑通）。快、简单、满足「临时追问」语义。
- **进阶**：走完整 agent turn（带工具 / 子代理），语义更完整但复杂度高一个量级，需碰 agent-loop 机制，建议二期。
- **外部先例**：Claude Code 的 `/btw` 即「单轮、无工具、浮层就地显示、不进主对话历史」的侧问通道——与 MVP 形态同构（ADR-008）。用户 2026-08-20 已拍板：MVP 走一次性问答。

---

## 建议形态与 MVP 分期

- **形态 = hybrid**（宿主 remote + 存储 + LLM；客户端 UI 面板 + 选区监听）。
  `dev_scaffold_plugin` 的 `hybrid`/`ui-panel` 形态为此设计，注入即 host+UI 双生效、可热重载、卸载即净。
- **MVP**：选区 → 存抽屉 → 浮窗列出/删除 → 选 1 条或多条 → 浮窗内追问 → 宿主 `llm.stream` 回答案（上下文先做「选中文本 + 手动开关」，宿主解析整段会话做二期）。
- **二期**：整段对话上下文开关、抽屉打标签/去重/按会话归档、追问改走完整 agent。

---

## 关键证据（已在真实环境核实）

### 客户端插件机制
- 客户端插件通过 `window.__ModuleLoader__.load({ id, factory })` 注册，`factory` 返回 `{ apply, inject }`；`apply(ctx)` 拿到客户端上下文。
- 核心服务：`ctx.slots`（槽位注入）、`ctx.remote`（调用宿主）、`ctx.locale`、`ctx.effect`、`ctx.on`。
- 槽位系统文档集中在 `@deepseek-ai/dsh-cordis-client-runner`（内置全量 `CLIENT_SLOT_API`）。

### 关键槽位（均已核实存在）
- `shell.overlay` —— 帧级浮层，`list` 槽位，附加式、默认 click-through，**官方明确推荐用于「飘在整个应用之上的自有表面」**。
- `root` —— 单槽位，官方文档警告「DO NOT register here」，应改用 `shell.overlay`。
- `conversation.chat.assistant-actions` —— 单条已定稿 assistant 消息的动作条（可挂「收藏此条」）。
- `conversation.chat.node`（keyed）/ `conversation.session.header.actions` / `conversation.input.dock` 等。

### 远程调用机制（客户端 → 宿主）
- 客户端通过 `ctx.remote.<namespace>.<method>` 调用宿主服务。
- 宿主插件可**自注册 remote 命名空间**：参考 `@deepseek-ai/dsh-message-feedback`，它用 `@deepseek-ai/dsh-typert-protocol` 的 `Remote` / `TypertRemoteService` 暴露 `remote.messageFeedback`。
- 当前已挂载的 remote 示例：`remote.commands`、`remote.goals`、`remote.messageFeedback`、`remote.pluginInventory`、`remote.dynamicCordisRunner`。

### 持久化
- `@deepseek-ai/dsh-storage-domain` 提供 `defineDomain` / `domainTable`，配合 zod schema 做落盘校验（`message-feedback` 官方同款）。
- 另有更简单的 `storage`（`dsh-storage-json`）JSON 服务可选。

### LLM 直调（追问后端）
- `@deepseek-ai/dsh-llm` 暴露 `LlmRuntime`，公开方法 `stream(options)`；`options` 含 `provider / model / system / messages / reasoningEffort / maxTokens`。
- 消息构造：`createUserMessage`、`createAssistantMessage`、`ReasoningEffortId` 等导出（`super-injector` README 的 daemon-loop 示例即此用法）。

### 构建 / 注入闭环
- `dev_scaffold_plugin`（四种形态）→ `dev_build_plugin` → `dev_inject_plugin` → `dev_reload_package` → `dev_uninject_plugin`。
- 规范铁律：资源注册必须挂 `ctx.effect`；peerDependencies 用范围声明；client bundle 单独构建（tsdown → `lib/client.js`）。

---

## 待决项确认状态（2026-08-20 已全部拍板）

1. **「上下文」来源** → 宿主解析（加入分支，M1 最小版：最近 N 条 + 截断）；两种模式均不写主对话。
2. **「临时追问」深度** → MVP 一次性无工具问答；完整 agent turn 放 M3。
3. **命名** → 「随手抽屉」，存储地叫「抽屉」。

> 完整决议见 [`docs/issues/open-questions.md`](../issues/open-questions.md) 与 ADR-003/004/005/006/008。
