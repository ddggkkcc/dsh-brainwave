# 脚本（scripts/）

> 构建与工具脚本开发位置。

---

## 计划脚本
- `build.sh` —— 探测 DSH_CHECKOUT → tsc 编译宿主端。
- `build:client` —— tsdown 编译客户端 bundle（产物 `lib/client.js`）。
- `pack` —— `npm pack` 产出 tgz。
- `release` —— `gh release create`（可选）。

## 生产线（由 AI 工具代跑，或手动）
```bash
# 脚手架已生成 package.json / tsconfig / build.sh
dev_scaffold_plugin   # 生成骨架
dev_build_plugin      # 构建打包（host + client）
dev_inject_plugin     # 运行时注入
dev_reload_package    # 热重载
dev_uninject_plugin   # 卸载
```

## 说明
- 当前为占位目录，脚本在 `dev_scaffold_plugin` 生成骨架后落地。

## 本地开发环境（2026-08-20 确认）

- DSH 运行时（`DSH_HOME`）：`~/.dsh`（profiles / sessions / storages / super-injector；启动 `dsh --profile web`，Web UI 默认 http://127.0.0.1:3080）
- DSH 源码仓库：<https://github.com/deepseek-ai/deepseek-harness>（**尚未 clone 到本地**；`build.sh` 编译宿主端依赖 `DSH_CHECKOUT` 指认源码目录）
