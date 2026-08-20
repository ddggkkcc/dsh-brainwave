# 脚本（scripts/）

> 构建与工具脚本开发位置。

---

## 已落地脚本
- `build.sh` —— 探测 **DSH 运行时安装**（`DSH_RUNTIME` 环境变量 → `dsh` 命令 → nvm 常见路径）→ junction 链接宿主依赖到运行时包 → `tsc` 编译 `src/host/` → `lib/host/`（tsc 二进制取自 checkout `DSH_CHECKOUT`，默认 `~/dsh-harness`）。客户端另走 `npm run build:client`。
- `tsdown.config.ts`（仓库根）—— 客户端 bundle：`src/client/index.ts` → `lib/client.js`，`window.__ModuleLoader__.load` 注册，react/cordis/client-runtime 等不打包（运行时由应用模块注册表解析）。

## 依赖链接铁律：必须连运行时安装，不连 checkout
- `@Remote` 装饰器把方法 marker 写进 `dsh-typert-protocol` 的**模块级 WeakMap**（非 `Symbol.for`），
  插件若连另一份协议拷贝（如 checkout rc.8 vs 运行时 rc.6），宿主 gateway 用运行时实例
  读不到任何方法 → 所有 remote 调用报 `invocation-unavailable`（现象：抽屉一开就「请求失败，请重试」）。
- 因此 `build.sh` 的 junction 指向**运行中 app 的那份包文件**（同文件 → 同模块实例），
  checkout 仅用于构建期工具（tsc）。历史教训记录于 2026-08-20：连 checkout 曾导致 remote 全挂。
- 客户端同理：client bundle 不打包 `@deepseek-ai/*`，运行时由应用模块注册表解析（天然同实例）。

## 构建生产线（2026-08-20 实测）
```bash
npm install           # 仅装 devDeps（typescript/tsdown/@types/node）；peer 已标 optional，不碰 @deepseek-ai/*
bash scripts/build.sh # 宿主编译（junction 会被重建，npm install 后须重跑）
npm run build:client  # 客户端 bundle
```

## 注入 / 卸载（super-injector HTTP API，DSH 运行中即可）
```bash
curl -s http://127.0.0.1:3080/super-injector/api/list
curl -s -X POST http://127.0.0.1:3080/super-injector/api/inject \
  -H 'content-type: application/json' -d '{"dir":"~/project/dsh-stash"}'
curl -s -X POST http://127.0.0.1:3080/super-injector/api/uninstall \
  -H 'content-type: application/json' -d '{"match":"dsh-stash"}'
```
`dev_*` 同名工具在 DSH 对话里也可用；HTTP API 是同一实现，适合脚本化。

## 已知坑
- **super-injector 卸载 junction 删除失败（macOS）**：uninject 用 `rmdir` 删 junction，对 POSIX symlink-to-dir 报 `ENOTDIR`，残留死链接（entry 已卸载、patch disabled、registry 已清，功能上无影响；残留需手动 `rm`）。修复点：super-injector 卸载逻辑改用 `lstat`+`unlink`。
- `npm install` 会修剪 node_modules 里的 junction，之后必须重跑 `build.sh` 重建。

## 本地开发环境（2026-08-20 确认）
- DSH 运行时（`DSH_HOME`）：`~/.dsh`（profiles / sessions / storages / super-injector；启动 `dsh --profile web`，Web UI 默认 http://127.0.0.1:3080）
- DSH 源码 checkout：`~/dsh-harness`（2026-08-20 clone + `pnpm install` + `pnpm build:lib:host`，各包 `lib/` 已产出）
- 运行时已安装包（build.sh 的 junction 源，**必须与运行中 app 同一份**）：`~/.nvm/versions/node/v24.18.0/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/`
