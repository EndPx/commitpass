#!/usr/bin/env bash
set -euo pipefail
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  NODE_BIN="$HOME/.cache/commitpass-node/node-v24.18.0-linux-x64/bin/node"
fi
if [[ ! -x "$NODE_BIN" ]]; then
  echo "Install Node.js 24 in WSL/Linux before running HyperIndex." >&2
  exit 1
fi
export PATH="$(dirname "$NODE_BIN"):$PATH"
if [[ -n "${ENVIO_LOCAL_PID_FILE:-}" ]]; then echo $$ > "$ENVIO_LOCAL_PID_FILE"; fi
exec "$NODE_BIN" node_modules/envio/bin.mjs "$@"
