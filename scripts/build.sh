#!/bin/bash
# dsh-stash 宿主端构建：src/host/ → lib/host/（使用 dsh checkout 的 tsc）。
# 依赖链接指向 DSH 运行时安装（默认经 `dsh` 命令探测）——铁律：
#   本插件的 @deepseek-ai/* 必须与运行中 app 解析到同一份文件（同模块实例）。
#   typert 的 @Remote 装饰器把方法 marker 写进协议模块的模块级 WeakMap，
#   若插件连的是另一份拷贝（如 checkout rc.8 vs 运行时 rc.6），宿主 gateway
#   用运行时实例读不到任何方法 → 所有调用报 invocation-unavailable。
# 客户端 bundle 另见：npm run build:client（tsdown → lib/client.js）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# DSH_RUNTIME 探测：环境变量 → `dsh` 命令 → 常见 nvm 路径。
RUNTIME="${DSH_RUNTIME:-}"
if [ -z "$RUNTIME" ]; then
  if command -v dsh >/dev/null 2>&1; then
    BIN="$(realpath "$(command -v dsh)")"
    # 真实文件 <pkg>/lib/bin.js → 包根 <pkg>；
    # 未解析的 bin 链接 <prefix>/bin/dsh → <prefix>/lib/node_modules/@deepseek-ai/dsh。
    for candidate in "$(dirname "$(dirname "$BIN")")" \
      "$(dirname "$(dirname "$BIN")")/lib/node_modules/@deepseek-ai/dsh"; do
      if [ -d "$candidate/node_modules/@deepseek-ai" ]; then RUNTIME="$candidate"; break; fi
    done
  fi
fi
if [ -z "$RUNTIME" ]; then
  for candidate in \
    "$HOME/.nvm/versions/node/$(node -p 'process.versions.node' 2>/dev/null)/lib/node_modules/@deepseek-ai/dsh" \
    "$HOME/.nvm/current/lib/node_modules/@deepseek-ai/dsh"; do
    if [ -d "$candidate/node_modules/@deepseek-ai" ]; then RUNTIME="$candidate"; break; fi
  done
fi
if [ -z "$RUNTIME" ] || [ ! -d "$RUNTIME/node_modules/@deepseek-ai" ]; then
  echo "build: cannot locate the dsh runtime install (set DSH_RUNTIME)" >&2
  exit 1
fi

# DSH_CHECKOUT 只用于 tsc 二进制（构建期工具，与运行时实例无关）。
CHECKOUT="${DSH_CHECKOUT:-}"
if [ -z "$CHECKOUT" ]; then
  for candidate in "$HOME/dsh-harness" "$HOME/dsh" "$HOME/.dsh/dsh-harness"; do
    if [ -d "$candidate/packages" ]; then CHECKOUT="$candidate"; break; fi
  done
fi
if [ -z "$CHECKOUT" ] || [ ! -d "$CHECKOUT/packages" ]; then
  echo "build: cannot locate the dsh checkout for tsc (set DSH_CHECKOUT)" >&2
  exit 1
fi

TSC="$CHECKOUT/node_modules/.bin/tsc"
if [ ! -x "$TSC" ] && [ ! -f "$TSC.cmd" ]; then
  echo "build: tsc not found at $TSC" >&2
  exit 1
fi

# 链接运行时安装里的包到本仓库 node_modules（junction/symlink，gitignored）。
link_pkg() {
  local target="$RUNTIME/$2"
  if [ ! -e "$target" ]; then
    echo "build: runtime dependency missing: $target" >&2
    exit 1
  fi
  node -e "
    const fs = require('fs');
    const path = require('path');
    const link = path.resolve(process.argv[1]);
    const target = path.resolve(process.argv[2]);
    fs.rmSync(link, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  " "node_modules/$1" "$target"
}

echo "=== Linking build dependencies (runtime: $RUNTIME) ==="
mkdir -p node_modules/@deepseek-ai

# 宿主代码直接 import 的包（与运行中 app 同一份文件 → 同模块实例）
link_pkg @deepseek-ai/cordis node_modules/@deepseek-ai/cordis
link_pkg @deepseek-ai/dsh-storage-domain node_modules/@deepseek-ai/dsh-storage-domain
link_pkg @deepseek-ai/dsh-llm node_modules/@deepseek-ai/dsh-llm
link_pkg @deepseek-ai/dsh-typert-protocol node_modules/@deepseek-ai/dsh-typert-protocol

# d.ts 传递链（skipLibCheck 仍需解析）：
#   storage-domain → dsh-storage → dsh-invariants → schemastery
#   cordis → cosmokit
link_pkg @deepseek-ai/dsh-storage node_modules/@deepseek-ai/dsh-storage
link_pkg @deepseek-ai/dsh-invariants node_modules/@deepseek-ai/dsh-invariants
link_pkg @deepseek-ai/schemastery node_modules/@deepseek-ai/schemastery
link_pkg @deepseek-ai/cosmokit node_modules/@deepseek-ai/cosmokit

# 编译类型 + 运行时 peer（与 app 同一实例）
link_pkg @types/node node_modules/@types/node
link_pkg @standard-schema/spec node_modules/@standard-schema/spec
link_pkg zod node_modules/zod

echo "=== Compiling src/host → lib/host ==="
"$TSC" -p tsconfig.json
echo "=== Build complete ==="
