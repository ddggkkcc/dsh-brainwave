# 宿主端代码（src/host/）

> 代码开发位置：宿主插件（Node 侧）。对应契约见 [`docs/spec/api-contract.md`](../../docs/spec/api-contract.md) 与 [`data-model.md`](../../docs/spec/data-model.md)。

---

## 职责
1. 注册 remote 命名空间 `stash`（`list` / `save` / `remove` / `ask`）。
2. 抽屉条目持久化（`storage-domain`）。
3. `ask` 调用 `ctx.llm.stream` 跑一次性追问（二期：读会话上下文）。

## 依赖（inject）
- `typert`（或 Typert Remote 机制）
- `storageDomain`（或 `storage`）
- `llm`
- （二期）`session` / `session-query`

## 关键实现要点
- 所有资源注册挂 `ctx.effect`。
- peerDependencies 范围声明（`@deepseek-ai/* >=0.0.1-rc <2`、`cordis >=4.0.0-rc <5`）。
- `save` 拒绝空白 `text`；`remove` 幂等；`ask` 不加上下文时绝不读会话。
- 返回统一 `{ ok, value } / { ok:false, error:{code,message} }` 信封，错误码见契约。

## 参考实现（可借鉴，不重复造轮子）
- `@deepseek-ai/dsh-message-feedback`（宿主端）—— storage-domain + Typert Remote 注册范式。
- super-injector README 的 daemon-loop 示例—— `ctx.llm.stream` 用法。

## 文件布局（待脚手架生成后落地）
```
src/host/
  index.ts        # 插件入口（name / inject / apply）
  remote.ts       # stash remote 命名空间
  storage.ts      # 抽屉条目持久化
  ask.ts          # LLM 追问
```
