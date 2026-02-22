#!/usr/bin/env bash
set -e

ROOT="/home/u146190565/domains/wanbitha.com.br/public_html"
NODE_BIN="$HOME/.local/node/bin/node"

cd "$ROOT"

if [ ! -x "$NODE_BIN" ]; then
  echo "[start] node runtime not found at $NODE_BIN"
  exit 1
fi

if [ -f .server.pid ]; then
  OLD_PID="$(cat .server.pid 2>/dev/null || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
fi

pkill -f "node.*server.js" 2>/dev/null || true

nohup "$NODE_BIN" --env-file=.env server.js >> server.out.log 2>> server.err.log &
NEW_PID=$!
echo "$NEW_PID" > .server.pid

sleep 2

if kill -0 "$NEW_PID" 2>/dev/null; then
  echo "[start] server up pid=$NEW_PID"
else
  echo "[start] server failed"
  exit 1
fi
