#!/bin/bash
# 双击启动「谱间」练习室（本地开发服务器）
cd "$(dirname "$0")" || exit 1

# 优先用系统 Node；没有就回退到 DSH 内置 Node
if ! command -v node >/dev/null 2>&1; then
  export PATH="$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "没有找到 Node.js，请先安装 Node 18+。"
  read -r -p "按回车退出…"
  exit 1
fi

(sleep 1.2; open "http://127.0.0.1:5180" >/dev/null 2>&1) &
exec node scripts/dev.mjs
