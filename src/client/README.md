# 客户端代码（src/client/）

> 代码开发位置：客户端 UI（浏览器侧，TSX）。对应契约见 [`docs/spec/api-contract.md`](../../docs/spec/api-contract.md)。

---

## 职责
1. 选区捕获（`document` mouseup / selectionchange → `getSelection().toString()`）。
2. 选区旁「随手抽屉」浮钮（收藏 / 追问）。
3. `shell.overlay` 浮窗：抽屉列表（列/删/多选）+ 追问输入 + 「是否加入上下文」开关 + 结果区。
4. 通过 `ctx.remote.stash.*` 调宿主。

## 依赖（inject）
- `slots`（`shell.overlay`）
- `remote`（`remote.stash`）
- `locale`（文案字典）
- （二期）`conversation.chat.assistant-actions` 收藏入口

## 关键实现要点
- 浮窗注册进 `shell.overlay`，`id` 自定（如 `stash`），容器 `pointer-events: auto`。
- 选区浮钮作为渐进增强：定位不精确时，浮窗内仍可手动输入追问兜底。
- 选区监听 / 浮窗 DOM 生命周期与 `ctx.effect` 对齐，卸载即清理。
- `includeContext=false` 时不从客户端传会话数据。

## 文件布局（待脚手架生成后落地）
```
src/client/
  index.tsx          # 客户端入口（apply / inject）
  selection.ts       # 选区捕获
  entryButton.tsx    # 选区浮钮
  overlayPanel.tsx   # shell.overlay 浮窗
  store.ts           # 客户端内存态
  locales.ts         # 中英文字典
```

## 参考实现（可借鉴）
- `@deepseek-ai/dsh-client-ui-message-feedback` —— 客户端插件 + slot 注册 + remote 调用 + locale 范式。
- super-injector 客户端 `client.js` —— 直接操作 DOM（createElement / appendChild）范式。
