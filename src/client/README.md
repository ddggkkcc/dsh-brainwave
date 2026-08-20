# 客户端代码（src/client/）

> 代码开发位置：客户端 UI（浏览器侧，TSX）。对应契约见 [`docs/spec/api-contract.md`](../../docs/spec/api-contract.md)。

---

## 职责
1. 选区捕获（`document` mouseup / selectionchange → `getSelection().toString()`，`scroll` 收起）。
2. 选区旁 Notion 式菜单（「加入抽屉」/「追问」），自动避让视口边缘，输入框/可编辑区不触发。
3. `shell.overlay` 浮窗：抽屉标签墙（圆角标签，单选/多选，追问选中/删除选中）+ 追问输入 + 「是否加入上下文」开关 + 结果区。
4. 通过 `ctx.remote.stash.*` 调宿主。

## 依赖（inject）
- `slots`（`shell.overlay`）
- `remote` —— 命名空间经 `ctx.remote.$mount(STASH_REMOTE)` 自挂载（见下）
- （二期）`locale` 文案字典、`conversation.chat.assistant-actions` 收藏入口

## 关键实现要点（2026-08-20 实测）
- 浮窗注册进 `shell.overlay`，`id` 自定（`stash`），容器 `pointer-events: auto`。
- **命名空间自挂载 + 双 fiber**：客户端 remote 命名空间只能经 `ctx.remote.$mount(贡献)` 安装（贡献强制 strict codec，src-json 会被 api-gateway 拒绝），安装后在根 scope 提供 `remote.stash` 服务；而访问 `ctx.remote.stash` 属性要求本 fiber 的 inject 声明该服务。同 fiber 既挂载又声明 = 死锁（apply 要等服务，服务来自 apply 里的挂载），且不声明直接访问会报 `cannot get property "remote.stash" without inject`。解法（官方 message-feedback 同款）：外层 fiber 只 `$mount`（inject: `['remote', 'slots']`——`slots` 仅为过注入器骨架校验），UI 放 `ctx.inject(['remote.stash','slots'], ui => …)` 子 fiber，等服务就绪后自动运行。因此 `remote.ts` 手写了与 typert-generator 产物同构的贡献（zod schema + module augmentation）。
- **方法名避坑**：不得与客户端 `RemoteNamespaceService` 的实例/原型成员重名——运行时该类自带内部方法 `remove(kind, method, token)`（卸载贡献用），`stash/remove` 直接报 `client api: method "stash/remove" conflicts with its namespace service`。删除统一叫 `delete`（官方 message-feedback 同用 `@Remote('delete')`）。
- 选区监听 / 浮窗 DOM 生命周期与 `ctx.effect` 对齐，卸载即清理。
- `includeContext=false` 时不从客户端传会话数据。
- MVP 文案硬编码中文；主题硬编码深色中性风（范围纪律：二期适配）。

## 文件布局（已落地）
```
src/client/
  index.ts        # 客户端入口（双 fiber：外层 $mount 贡献 + 内层注册 shell.overlay）
  remote.ts       # stash 命名空间贡献（strict codec schema + TypertRemoteNamespaceMap 类型）
  StashOverlay.tsx# 选区菜单（Notion 式）+ 标签墙抽屉（开合/收藏/删除/追问/多选）
  selection.ts    # M1 按需拆分
  entryButton.tsx # M1 按需拆分
  store.ts        # M1 按需拆分
  locales.ts      # M1 按需拆分
```

## 参考实现（可借鉴）
- `@deepseek-ai/dsh-client-ui-message-feedback` —— 客户端插件 + slot 注册 + remote 调用 + locale 范式。
- super-injector 客户端 `client.js` —— 直接操作 DOM（createElement / appendChild）范式。
