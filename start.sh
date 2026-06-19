#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-13920}"
HOST="${HOST:-127.0.0.1}"

if command -v lsof >/dev/null 2>&1; then
  pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -TERM
  fi
fi

echo "Starting Smart Air at http://$HOST:$PORT"
exec env HOST="$HOST" PORT="$PORT" node server.js
