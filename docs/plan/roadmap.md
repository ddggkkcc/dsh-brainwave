# 里程碑（Roadmap）

> 依据 [`feasibility.md`](../spec/feasibility.md) 的分期建议切分。
> 每个里程碑列「目标 / 交付物 / 验收 / 依赖」。

---

## M0 — 立项与骨架（当前）
**目标**：确定规范与待决项，生成可运行的插件骨架。

- [ ] 确认 [`open-questions.md`](../issues/open-questions.md) 三个待决项
- [ ] `dev_scaffold_plugin` 生成 **hybrid** 骨架
- [ ] 宿主端：remote 命名空间 `stash` 空壳 + storage 接入
- [ ] 客户端：`shell.overlay` 浮窗空壳 + 选区捕获原型
- [ ] 构建 / 注入 / 热重载 / 卸载链路自检通过

**交付物**：可注入的插件骨架，host+UI 双生效。
**验收**：`dev_inject_plugin` 后浮窗可开合、无残留；`dev_uninject_plugin` 干净。

---

## M1 — MVP（核心闭环）
**目标**：跑通「选中 → 存 → 追问 → 回答案」最小闭环。

- [ ] FR-1 选区收藏（浮钮 + 持久化）
- [ ] FR-2 抽屉列表 / 删除
- [ ] FR-3 追问（选 1 条或多条 + 自定义问题 + 一次性 `llm.stream` 答案）
- [ ] 「是否加入上下文」开关（MVP 先做「选中文本 + 手动追加」，宿主整段上下文后置）

**交付物**：满足 [`requirements.md`](../requirements/requirements.md) 的 MVP 验收 AC-1~AC-5。
**验收**：场景 A、B、C、D 基本可走通；不写进主对话（不加上下文时）。

---

## M2 — 上下文与体验（二期）
**目标**：补齐「整段对话上下文」与追问体验。

- [ ] 宿主侧解析当前会话消息（`session` / `session-query`），`includeContext=true` 时拼入 `messages`
- [ ] 追问改流式返回（可选）
- [ ] 消息级入口：`conversation.chat.assistant-actions`「收藏此条」
- [ ] 抽屉：打标签 / 去重 / 按会话归档（数据模型 v1）

**交付物**：完整上下文开关 + 更顺滑的收藏/追问体验。
**验收**：场景 C 的「加入上下文」生效且可控。

---

## M3 — 增强（三期，可选）
**目标**：进阶能力，按需排期。

- [ ] 追问升级为完整 agent turn（带工具 / 子代理）
- [ ] 抽屉全局搜索 / 多会话共享
- [ ] 快捷键触发收藏 / 追问
- [ ] 设置页（默认开关、命名自定义）

---

## 里程碑依赖关系

```
M0（骨架） ──► M1（MVP） ──► M2（上下文） ──► M3（增强）
                    ▲
             依赖 open-questions 待决项（M0 内确认）
```
