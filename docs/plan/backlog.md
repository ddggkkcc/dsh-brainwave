# 代办清单（Backlog）

> 勾选状态 = 已完成。按里程碑分组，优先级 P0 最高。

---

## 当前聚焦（M0）

- [x] 【P0】拍板 `open-questions.md` 全部待决（2026-08-20：上下文语义 / 一次性问答 / storage-domain / 全局抽屉）
- [x] 【P0】确定存储方案 = `storage-domain`（2026-08-20 已拍板）
- [ ] 【P1】`dev_scaffold_plugin` 生成 hybrid 骨架
- [ ] 【P1】宿主端：`stash` remote 空壳（list/save/remove/ask）
- [ ] 【P1】宿主端：storage 接入（抽屉条目落盘）
- [ ] 【P1】客户端：`shell.overlay` 浮窗空壳
- [ ] 【P1】客户端：选区捕获原型（mouseup/selectionchange → 浮钮）
- [ ] 【P1】构建 + 注入 + 热重载 + 卸载自检

---

## M1 — MVP

- [ ] 选区浮钮「收藏」→ `save` → 持久化
- [ ] 抽屉列表渲染 + 删除
- [ ] 浮窗追问：单条 / 多条选择 + 自定义问题输入
- [ ] 宿主读当前会话最近 N 条消息（最小版，带截断）+「是否加入上下文」开关（两模式均不写主对话）
- [ ] 宿主 `ask`：`ctx.llm.stream` 一次性答案回传
- [ ] `ask` 模型路由解析（复用当前会话模型配置或默认，R3）
- [ ] 常驻入口按钮（随时打开抽屉）+ 收藏轻反馈 + 空状态 / 追问中状态
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
- [ ] 设置页（默认开关 / 命名自定义）

---

## 通用规范（每条任务都适用）

- 资源注册挂 `ctx.effect`；peerDeps 范围声明；client 单独构建。
- 改契约先改 `api-contract.md` / `data-model.md`。
