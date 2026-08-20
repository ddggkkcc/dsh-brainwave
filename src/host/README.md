# 宿主端代码（src/host/）

> 代码开发位置：宿主插件（Node 侧）。对应契约见 [`docs/spec/api-contract.md`](../../docs/spec/api-contract.md) 与 [`data-model.md`](../../docs/spec/data-model.md)。

---

## 职责
1. 注册 remote 命名空间 `stash`（`list` / `save` / `delete` / `ask`）。
2. 抽屉条目持久化（`storage-domain`）。
3. `ask` 调用 `ctx.llm.stream` 跑一次性追问；可选读取当前会话最近消息作为上下文。

## 依赖（inject）
- `storageDomain` —— M0 已接入
- `llm` —— M1 已接入 `ctx.llm.stream` + 会话路由/默认路由
- `sessions` —— `includeContext=true` 时读取最近活动会话
- `session-query` —— 预留给跨进程/持久会话精确查询

## 关键实现要点（2026-08-20 实测）
- 服务继承 `TypertRemoteService`（`super(ctx, 'stash')`）→ 网关 **source-mode 运行时发现**（`typertRemote` binding + `@Remote` 标记），外部插件**不需要** typert-generator 的 face 文件。
- **同模块实例铁律**：`@Remote` marker 写在 `dsh-typert-protocol` 模块级 WeakMap，本插件的 `@deepseek-ai/*` 必须与运行中 app 解析到同一份文件，否则 gateway 发现 0 个方法、所有调用 `invocation-unavailable`（2026-08-20 踩坑，现象：抽屉一开就「请求失败，请重试」）。**落地**：`src/host/runtime.ts` 用 `createRequire(import.meta.url).resolve()`（CJS 默认 realpath）解出运行中 app 真实路径再 `import()`；`cordis` / `typert-protocol` / `storage-domain` 一律从 `runtime.ts` 导入，禁止直接裸 import（ADR-009）。
- 所有资源注册挂 `ctx.effect`（域随插件卸载 close）。
- peerDependencies 范围声明（`@deepseek-ai/* >=0.0.1-rc <2`、`zod ^4.4`），且标 `peerDependenciesMeta.optional`（npm 不代装——注册表上的 @deepseek-ai/* 是另一条版本线，本地 junction 才正确）。
- 导入使用 `@deepseek-ai/cordis`（harness 约定名；Context 的 storageDomain 等扩展都在这个模块名上）。
- `save` 拒绝空白 `text`；`delete` 幂等；`ask` 不加上下文时绝不读会话；追问结果不写入主会话。
- 返回统一 `{ ok, value } / { ok:false, error:{code,message} }` 信封，错误码见契约。

## 参考实现（可借鉴，不重复造轮子）
- `@deepseek-ai/dsh-message-feedback`（宿主端）—— storage-domain + Typert Remote 注册范式。
- super-injector README 的 daemon-loop 示例—— `ctx.llm.stream` 用法（M1）。

## 文件布局（已落地）
```
src/host/
  index.ts        # 插件入口 + StashService（list/save/delete/ask）
  runtime.ts      # peer 依赖真实路径解析（createRequire().resolve() + import）
  storage.ts      # 抽屉条目持久化（zod schema + defineDomain）
  types.ts        # wire 类型（信封契约，与 src/client/remote.ts schema 同步）
  remote.ts       # M1 按需拆分（remote 命名空间独立成文件）
  ask.ts          # M1：LLM 追问
```
