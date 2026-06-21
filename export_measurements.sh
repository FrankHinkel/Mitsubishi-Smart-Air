#!/usr/bin/env sh
set -eu

HOST="${HOST:-192.168.178.10}"
PORT="${PORT:-13920}"
API_KEY="${REST_API_KEY:-}"
OUTPUT="${1:-measurements-export.json}"
FROM="${FROM:-2026-06-01T00:00:00Z}"
TO="${TO:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
TEMPERATURE_KIND="${TEMPERATURE_KIND:-all}"
LIMIT="${LIMIT:-500000}"
OFFSET="${OFFSET:-0}"
DEVICE_PATH="${DEVICE_PATH:-/api/devices/measurements}"

if [ -z "$API_KEY" ]; then
  echo "REST_API_KEY is required." >&2
  exit 1
fi

URL="http://${HOST}:${PORT}${DEVICE_PATH}?from=${FROM}&to=${TO}&temperatureKind=${TEMPERATURE_KIND}&limit=${LIMIT}&offset=${OFFSET}"

curl -sS \
  -H "x-api-key: ${API_KEY}" \
  "$URL" \
  -o "$OUTPUT"

echo "Saved export to $OUTPUT"
