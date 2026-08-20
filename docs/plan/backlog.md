# 代办清单（Backlog）

> 勾选状态 = 已完成。按里程碑分组，优先级 P0 最高。

---

## 当前聚焦（M0）

- [x] 【P0】拍板 `open-questions.md` 全部待决（2026-08-20：上下文语义 / 一次性问答 / storage-domain / 全局抽屉）
- [x] 【P0】确定存储方案 = `storage-domain`（2026-08-20 已拍板）
- [x] 【P1】hybrid 骨架（手写，同 `dev_scaffold_plugin` 产物形态）
- [x] 【P1】宿主端：`stash` remote 空壳（list/save/delete/ask）
- [x] 【P1】宿主端：storage 接入（抽屉条目落盘）
- [x] 【P1】客户端：`shell.overlay` 浮窗空壳
- [x] 【P1】客户端：选区捕获原型（mouseup/selectionchange → Notion 式选区菜单，2026-08-20 UI 改版）
- [x] 【P1】构建 + 注入 + 卸载自检（super-injector HTTP API 实测）
- [x] 【P0】宿主 peer 依赖真实路径解析修复（`src/host/runtime.ts`，解决 @Remote marker 模块同一性，2026-08-20）
- [ ] 【P1】浏览器目检：标签墙开合 + 选区菜单收藏/追问走通（remote 调用链宿主侧已验，待浏览器目检）

---

## M1 — MVP

- [x] 选区菜单「加入抽屉」→ `save` → 持久化（2026-08-20 UI 改版）
- [x] 抽屉标签墙渲染 + 单选/多选 + 删除选中（2026-08-20 UI 改版）
- [ ] 浮窗追问：单条 / 多条选择 + 自定义问题合并（当前：单条追问 + 追问选中已通；自定义问题与选中合并待接）
- [x] 宿主读当前活动会话最近消息（最多 24 条 / 24000 字符）+「是否加入上下文」开关（两模式均不写主对话）
- [x] 宿主 `ask`：`ctx.llm.stream` 一次性答案回传
- [x] `ask` 模型路由解析（优先当前会话 `request/header`，否则默认模型）
- [x] 常驻入口按钮（随时打开抽屉）+ 收藏轻反馈 + 空状态 / 追问中状态（2026-08-20 UI 改版）
- [ ] 点击面板外空白处最小化抽屉（2026-08-20 用户反馈追加）
- [ ] 错误码与提示（text-blank / query-blank / llm-error …）
- [ ] 验收 AC-1 ~ AC-5 回归

---

## M2 — 上下文与体验

- [ ] 宿主读取当前会话消息（`session`/`session-query`）
- [ ] `includeContext=true` 拼入 `messages`
- [ ] 追问流式返回（可选）
- [ ] `conversation.chat.assistant-actions` 收藏入口
- [ ] 数据模型 v1：tags / 归档 / 软删除

---

## M3 — 增强（待排期）

- [ ] 完整 agent turn 追问
- [ ] 抽屉全局搜索 / 多会话共享
- [ ] 快捷键收藏 / 追问
- [ ] 右键菜单「收藏到抽屉」（2026-08-20 用户提问：当前不支持，记入待办）
- [ ] 设置页（默认开关 / 命名自定义）

---

## 通用规范（每条任务都适用）

- 资源注册挂 `ctx.effect`；peerDeps 范围声明；client 单独构建。
- 改契约先改 `api-contract.md` / `data-model.md`。
