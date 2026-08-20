# 架构设计

> 依据 [`feasibility.md`](feasibility.md) 的机制映射，落到模块与数据流。
> 形态：**hybrid**（宿主端 + 客户端）。

---

## 总体架构（双端）

```
┌────────────────────────── 浏览器（客户端，client bundle）──────────────────────────┐
│                                                                                  │
│  [选区捕获层]  document mouseup/selectionchange → getSelection().toString()      │
│        │                                                                         │
│        ▼                                                                         │
│  [选区菜单]  选区旁 Notion 式菜单（加入抽屉 / 追问）                                │
│        │                                                                         │
│        ▼                                                                         │
│  [浮窗 UI]  ctx.slots.inject("shell.overlay")                                     │
│        │    - 标签墙（圆角标签，单选/多选，追问选中/删除选中）                  │
│        │    - 临时追问（问题输入 + 是否加上下文开关）                               │
│        ▼                                                                         │
│  ctx.remote.stash.{list, save, delete, ask}   ◀──── 远程调用                 │
└──────────────────────────────┬───────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────── 宿主（host，Node）───────────┐
│                                                                                  │
│  [remote 命名空间]  stash（TypertRemoteService）                               │
│        │  list / save / delete / ask                                             │
│        ├──► [存储]  storageDomain（抽屉条目持久化）                                │
│        ├──► [会话]  session / session-query（可选上下文，二期）                     │
│        └──► [LLM]   ctx.llm.stream({...})  ← 临时追问后端                          │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 模块划分

### 宿主端（`src/host/`）
| 模块 | 职责 | 依赖 |
|---|---|---|
| `runtime` | 解析 `@deepseek-ai/*` 到运行中 app 的真实路径再 import（保证与 gateway 同模块实例） | `node:module`、`node:url` |
| `remote` | 注册 `stash` remote 命名空间，暴露 `list/save/delete/ask` | `runtime`、`storageDomain`、`llm` |
| `storage` | 抽屉条目持久化（schema 校验） | `runtime`、`zod` |
| `ask` | 组装 prompt，调用 `ctx.llm.stream` 并回传答案 | `llm` |
| （二期）`context` | 读取当前会话消息作为追问上下文 | `session` / `session-query` |

### 客户端（`src/client/`）
| 模块 | 职责 | 依赖 |
|---|---|---|
| `remote` | `stash` 命名空间 remote 贡献 + strict codec schema（与宿主 types 同步） | `typert-protocol`、`zod` |
| `StashOverlay` | 选区菜单（Notion 式）+ `shell.overlay` 标签墙抽屉（单选/多选/追问选中/删除选中） | `slots`、`remote` |

---

## 关键数据流

### 流 1：收藏（存）
1. 用户选区 → 选区捕获层得到文本。
2. 选区菜单「加入抽屉」→ `remote.stash.save({ text, source })`。
3. 宿主 `storage` 落盘 → 返回条目。
4. 客户端刷新标签墙 → 轻量 toast「已收藏」。

### 流 2：追问（问）
1. 入口：选区菜单「追问」或抽屉内选中标签后点「追问选中」→ 组装 `query`。
2. 用户勾选「是否加入上下文」→ 传入 `includeContext` 标志。
3. 客户端 `remote.stash.ask({ query, includeContext })`。
4. 宿主：若 `includeContext` 且实现上下文 → 读会话消息拼进 `messages`；否则只用 `query`。
5. 宿主 `ctx.llm.stream({...})` 跑一次性问答 → 答案（一次性或流式）回传客户端。
6. 客户端浮窗渲染答案。

---

## 机制映射速查

| 关注点 | 方案 |
|---|---|
| 浮窗 | `ctx.slots.inject("shell.overlay", ...)`，`id` 自定，`order` 排位 |
| 消息级入口（可选） | `conversation.chat.assistant-actions`（「收藏此条」按钮） |
| 选区 | 客户端 `document` 监听（无官方槽位，纯 DOM），选区旁渲染 Notion 式菜单（加入抽屉 / 追问） |
| 持久化 | 宿主 `storage-domain`（或 `storage` JSON） |
| 远程 | 宿主自注册 remote 命名空间 `stash` |
| 追问后端 | 宿主 `ctx.llm.stream` |
| 上下文（二期） | 宿主 `session`/`session-query` 或客户端 session 作用域组件 |
| 资源清理 | 全部注册走 `ctx.effect` |

---

## 设计约束（铁律，来自注入器实测）

1. 资源注册必须挂 `ctx.effect`（工具/路由/监听），保证热重载/卸载干净。
2. peerDependencies 范围声明，不硬编码版本。
3. client bundle 单独构建（tsdown → `lib/client.js`）。
4. 选区监听与浮窗 UI 的生命周期与 `ctx.effect` 对齐（卸载即清理 DOM）。
5. 外部插件 peer 依赖（cordis / typert-protocol / storage-domain）**禁止直接裸 import**：宿主端统一经 `src/host/runtime.ts` 的 `createRequire().resolve()` 取真实路径再 import，确保 `@Remote` 标记与 gateway 同模块实例（详见 ADR-009）。
