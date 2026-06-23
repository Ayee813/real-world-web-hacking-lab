#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"
TUNNEL_LOG="$ROOT/.tunnel.log"

cleanup() {
  echo ""
  echo "Stopping services..."
  kill "$BACKEND_PID" "$FRONTEND_PID" "$TUNNEL_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" "$TUNNEL_PID" 2>/dev/null
  rm -f "$TUNNEL_LOG"
  echo "Done."
  exit 0
}
trap cleanup INT TERM

echo "Starting backend..."
cd "$ROOT/backend" && npm run dev &
BACKEND_PID=$!

echo "Starting frontend..."
cd "$ROOT/frontend" && npm run dev &
FRONTEND_PID=$!

echo "Waiting for frontend to be ready..."
for i in $(seq 1 30); do
  curl -s http://localhost:5173 > /dev/null 2>&1 && break
  sleep 1
done

echo "Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:5173 > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

echo "Waiting for public URL..."
PUBLIC_URL=""
for i in $(seq 1 30); do
  PUBLIC_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  [ -n "$PUBLIC_URL" ] && break
  sleep 1
done

echo ""
echo "============================================"
echo "  Local Frontend : http://localhost:5173"
echo "  Local Backend  : http://localhost:3001"
if [ -n "$PUBLIC_URL" ]; then
  echo "  Public URL     : $PUBLIC_URL"
else
  echo "  Public URL     : (check .tunnel.log)"
fi
echo "============================================"
echo ""
echo "Press Ctrl+C to stop everything."

wait "$BACKEND_PID" "$FRONTEND_PID" "$TUNNEL_PID"
