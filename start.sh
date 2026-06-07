#!/bin/sh

set -eu

PORT="${PORT:-13920}"

pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$pids" ]; then
  echo "$pids" | xargs kill -TERM
fi

exec node server.js
