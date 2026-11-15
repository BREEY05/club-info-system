#!/usr/bin/env bash
# 社团信息化管理系统 · macOS / Linux 启动脚本
set -e
cd "$(dirname "$0")"

export PORT="${PORT:-3000}"
export HOST="${HOST:-127.0.0.1}"

command -v node >/dev/null 2>&1 || { echo "[ERROR] 未检测到 Node.js（需要 22.18+）"; exit 1; }

PNPM=""
if command -v pnpm >/dev/null 2>&1; then
  PNPM="pnpm"
elif command -v corepack >/dev/null 2>&1; then
  PNPM="corepack pnpm"
else
  echo "[ERROR] 未检测到 pnpm，请先执行：npm i -g pnpm"
  exit 1
fi

[ -d node_modules ] || { echo "[1/2] 安装依赖..."; $PNPM install; }
if [ ! -f apps/web/dist/index.html ]; then
  echo "[2/2] 构建前端..."
  $PNPM --filter @cims/shared build
  $PNPM --filter @cims/web build
fi

echo "============================================================"
echo "  社团信息化管理系统"
echo "  排课表：http://127.0.0.1:${PORT}/"
echo "  刷题：  http://127.0.0.1:${PORT}/practice"
echo "  数据：  $(pwd)/data/club.db"
echo "  退出：  Ctrl+C"
echo "============================================================"

exec node apps/server/src/index.ts
