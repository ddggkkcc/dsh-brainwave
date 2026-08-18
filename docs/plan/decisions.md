# 决策记录（ADR）

> 记录「为什么这样选」，避免日后反复纠结。状态：提议 / 已接受 / 已否决 / 待决。

---

## ADR-001 插件形态 = hybrid
- **状态**：已接受（暂定）
- **背景**：需求同时需要宿主能力（存储 + LLM 追问）与客户端 UI（浮窗 + 选区）。
- **决策**：采用 hybrid 形态（宿主 remote + storage + LLM；客户端 UI 面板 + 选区监听）。
- **理由**：`dev_scaffold_plugin` 的 hybrid/ui-panel 形态即为此设计，注入即 host+UI 双生效、可热重载、卸载即净。
- **备选**：纯 ui-panel + HTTP 自建后端（可行但绕过了 remote 机制，不如 hybrid 贴合）。

## ADR-002 浮窗用 `shell.overlay`，不用 `root`
- **状态**：已接受
- **决策**：客户端浮窗注册进 `shell.overlay`（list 槽位，附加式、click-through）。
- **理由**：官方文档明确警告 `root` 是单槽位、注册即遮蔽整帧；`shell.overlay` 才是「飘在应用之上的自有表面」的正确席位。
- **注意**：`shell.overlay` 是 root 作用域，拿不到 `useSession`，故「上下文」走宿主侧解析（见 ADR-003）。

## ADR-003 上下文来源 = 宿主侧解析（推荐）
- **状态**：待决（推荐 A）
- **候选**：
  - A. 宿主侧解析：`ask(includeContext=true)` 时宿主读 `session`/`session-query` 拼入 messages。
  - B. 会话作用域隐形组件：在 session 作用域槽位挂组件，用 `useSession()` 灌进共享 store。
  - C. MVP 退而求其次：上下文 = 选中文本 + 手动追加。
- **倾向**：先 C 落地 MVP，再上 A；B 兜底。

## ADR-004 追问后端 = 一次性 `llm.stream`（MVP）
- **状态**：已接受（MVP）
- **决策**：宿主 `ctx.llm.stream({ provider, model, system, messages, ... })` 跑无工具一次性问答。
- **理由**：快、满足「临时追问」语义；完整 agent turn 复杂度高一个量级，放 M3。
- **证据**：super-injector 的 daemon-loop 示例即此 API。

## ADR-005 存储 = storage-domain（推荐）
- **状态**：待决
- **决策**：`storage-domain`（`defineDomain`+`domainTable`，zod 校验，`message-feedback` 同款）优先；MVP 若要更快可用 `storage` JSON。
- **理由**：持久可靠 + schema 校验 + 生命周期管理。

## ADR-006 抽屉为「跨会话全局抽屉」
- **状态**：已接受（暂定）
- **决策**：条目不绑定单会话（`source` 仅存 id 文本，弱关联）。
- **理由**：符合「稍后再做、跨对话统一处理」的意图。

## ADR-007 命名 = 随手抽屉 · Stash（dsh-stash）
- **状态**：已接受
- **决策**：插件名「随手抽屉」（英文 **Stash**），存储地叫「抽屉」，包名 `dsh-stash`。
- **理由**：用户认可「抽屉」的中性容器隐喻（不强调「灵感」，覆盖查阅信息 / 调用文件 / 陌生关键词 / 灵感内容等各类暂存）；「随手」点出低打扰、不打断心流。
- **英文名**：Stash，取 `git stash` 之意——暂存一边、不打断心流、稍后再取，对开发者直观。
- **演化**：由「灵机一动」改名而来；「灵感库」统一改称「抽屉」；包名 `dsh-brainwave` → `dsh-handy-drawer` → `dsh-stash`。
