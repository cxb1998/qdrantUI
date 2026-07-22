#!/bin/bash
set -euo pipefail

QDRANT_DATA="${QDRANT_DATA:-/data/qdrant}"
USERS_FILE="${USERS_FILE:-/data/config/users.json}"

mkdir -p "$QDRANT_DATA" "$(dirname "$USERS_FILE")"

qdrant_ready() {
  node -e "fetch('http://127.0.0.1:6333/readyz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
}

echo "启动 Qdrant（存储: $QDRANT_DATA）..."
export QDRANT__STORAGE__STORAGE_PATH="$QDRANT_DATA"
export QDRANT__SERVICE__HTTP_PORT=6333
export QDRANT__SERVICE__GRPC_PORT=6334
/app/qdrant/qdrant &
QDRANT_PID=$!

cleanup() {
  if kill -0 "$QDRANT_PID" 2>/dev/null; then
    kill "$QDRANT_PID" 2>/dev/null || true
    wait "$QDRANT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT TERM INT

echo "等待 Qdrant 就绪..."
for _ in $(seq 1 60); do
  if qdrant_ready 2>/dev/null; then
    echo "Qdrant 已就绪"
    break
  fi
  if ! kill -0 "$QDRANT_PID" 2>/dev/null; then
    echo "Qdrant 进程异常退出"
    exit 1
  fi
  sleep 1
done

if ! qdrant_ready 2>/dev/null; then
  echo "Qdrant 启动超时"
  exit 1
fi

export QDRANT_URL="${QDRANT_URL:-http://127.0.0.1:6333}"
export USERS_FILE
export NODE_ENV=production
export PORT="${PORT:-8787}"

if [ ! -f "$USERS_FILE" ]; then
  echo "首次启动，生成默认用户（admin/admin123, viewer/viewer123）..."
  node scripts/init-users.mjs
fi

echo "启动控制台（http://0.0.0.0:${PORT}）..."
exec ./node_modules/.bin/tsx server/index.ts
