# dsh-brainwave（灵机一动）

> 工作包名暂定 `dsh-brainwave`，中文名「**灵机一动**」。

一个 DSH 插件：在使用 AI 对话时，随手把触发的关键词 / 片段存进「灵感库」，之后可以在页面浮窗里对一条或多条内容做**临时追问**（可选是否带入当前上下文），全程不打断当前对话、不开新页面。

---

## 这是什么

- **一句话**：把「此刻不想做 / 需要搜索但想稍后再做」的临时念头存起来，专注当前对话；需要时在页面浮窗里就地追问。
- **解决的问题**：用 AI 时经常遇到某个关键词、某段内容触发新灵感，或不理解需要搜索，但此刻不想分心，也不想重新开新页面。
- **形态**：DSH 插件（hybrid：宿主 remote + 存储 + LLM；客户端浮窗 UI + 文本选区捕获）。

---

## 目录地图（SDD 分区）

| 路径 | 用途 | 存放内容 |
|---|---|---|
| [`docs/vision/`](docs/vision/) | 项目愿景与原始想法 | 你的原始想法（不压缩）、使用场景 |
| [`docs/requirements/`](docs/requirements/) | 需求规范 | 功能需求 FR / 非功能需求 NFR / 验收标准 |
| [`docs/spec/`](docs/spec/) | 技术规范（SDD 核心，spec 即契约） | 可行性评估、架构、API 契约、数据模型 |
| [`docs/plan/`](docs/plan/) | 规划与执行 | 里程碑、代办 backlog、决策记录 ADR |
| [`docs/issues/`](docs/issues/) | 问题与风险 | 当前待处理问题、风险与对策 |
| [`src/host/`](src/host/) | 代码：宿主端 | remote + storage + LLM 追问（TypeScript） |
| [`src/client/`](src/client/) | 代码：客户端 | shell.overlay 浮窗 + 选区捕获（TSX） |
| [`tests/`](tests/) | 测试 | 契约测试 / 回归 |
| [`scripts/`](scripts/) | 构建与工具 | build / pack / release 脚本 |

---

## 快速导航

### 先从想法开始
- [`docs/vision/idea.md`](docs/vision/idea.md) — 你的原始想法（完整，未压缩）
- [`docs/vision/scenarios.md`](docs/vision/scenarios.md) — 使用场景

### 需求
- [`docs/requirements/requirements.md`](docs/requirements/requirements.md)

### 技术规范（可行性结论都在这里）
- [`docs/spec/feasibility.md`](docs/spec/feasibility.md) — **可行性评估（结论：完全可行）**
- [`docs/spec/architecture.md`](docs/spec/architecture.md) — 架构设计与机制映射
- [`docs/spec/api-contract.md`](docs/spec/api-contract.md) — 宿主 remote API + 客户端槽位契约
- [`docs/spec/data-model.md`](docs/spec/data-model.md) — 存储数据模型

### 执行
- [`docs/plan/roadmap.md`](docs/plan/roadmap.md) — 里程碑
- [`docs/plan/backlog.md`](docs/plan/backlog.md) — 代办清单
- [`docs/plan/decisions.md`](docs/plan/decisions.md) — 决策记录

### 待决与风险
- [`docs/issues/open-questions.md`](docs/issues/open-questions.md) — **当前需要处理的问题**
- [`docs/issues/risks.md`](docs/issues/risks.md) — 风险

---

## 当前状态

- [ ] 阶段：**规范阶段**（SDD 立项，尚未开始写代码）
- [ ] 下一步：确认 [`open-questions.md`](docs/issues/open-questions.md) 中的关键待决项（尤其「上下文来源」与「临时追问深度」），随后生成插件骨架进入 MVP。

---

## SDD 工作流

本项目采用 **Spec-Driven Development（规范驱动开发）**：

1. **愿景**（`docs/vision/`）：想清楚「为什么做、给谁用、什么场景」。
2. **需求**（`docs/requirements/`）：把想法翻译成可验证的 FR/NFR。
3. **规范**（`docs/spec/`）：可行性 + 架构 + 契约 + 数据模型，**先定契约再写代码**。
4. **规划**（`docs/plan/`）：里程碑切分、代办拆解、关键决策留痕。
5. **实现**（`src/`）：严格按 `api-contract.md` / `data-model.md` 编码。
6. **验证**（`tests/`）：按需求验收标准回归。

> 原则：**spec 即契约** —— 任何实现都先回到 `docs/spec/` 更新契约，再动代码；想法变更从 `docs/vision/` 开始层层下放，不直接跳改代码。
