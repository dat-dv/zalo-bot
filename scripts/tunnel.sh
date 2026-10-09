#!/usr/bin/env bash

# ==============================================================================
# Script: Cloudflare Tunnel & Auto Set Zalo Webhook
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$PROJECT_ROOT/.cloudflared.pid"

# Lệnh dừng tunnel nếu gọi: ./scripts/tunnel.sh stop
if [ "$1" = "stop" ]; then
  echo "🛑 Đang kiểm tra và dừng các tiến trình Cloudflare Tunnel..."
  if [ -f "$PID_FILE" ]; then
    SAVED_PID=$(cat "$PID_FILE")
    if kill -0 "$SAVED_PID" 2>/dev/null; then
      kill "$SAVED_PID" 2>/dev/null || true
      echo "✅ Đã dừng tunnel theo PID ($SAVED_PID)."
    fi
    rm -f "$PID_FILE"
  fi
  # Dọn dẹp thêm các tiến trình cloudflared tunnel còn sót lại nếu có
  pkill -f "cloudflared tunnel" 2>/dev/null || true
  echo "👋 Đã dọn dẹp xong toàn bộ tunnel."
  exit 0
fi

# Chế độ chạy: nếu có tham số 'bg' hoặc '--bg' thì chạy ngầm (detached daemon)
BACKGROUND_MODE=false
PORT_ARG=""
for arg in "$@"; do
  if [ "$arg" = "bg" ] || [ "$arg" = "--bg" ]; then
    BACKGROUND_MODE=true
  elif [[ "$arg" =~ ^[0-9]+$ ]]; then
    PORT_ARG="$arg"
  fi
done

# Hàm nạp file .env an toàn
load_env() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      line="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      if [[ "$line" =~ ^#.* ]] || [ -z "$line" ]; then
        continue
      fi
      if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
        local key="${BASH_REMATCH[1]}"
        local val="${BASH_REMATCH[2]}"
        val="$(echo "$val" | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')"
        if [ -z "${!key:-}" ]; then
          export "$key=$val"
        fi
      fi
    done < "$env_file"
  fi
}

load_env "$PROJECT_ROOT/.env.local"
load_env "$PROJECT_ROOT/.env"

GATEWAY_PORT="${NGINX_PORT:-${GATEWAY_PORT:-3000}}"
BE_PORT="${BE_PORT:-3005}"
FE_PORT="${FE_PORT:-5173}"
BOT_TOKEN="${ZALO_BOT_TOKEN:-${BOT_TOKEN:-}}"
SECRET_TOKEN="${ZALO_WEBHOOK_SECRET_TOKEN:-${SECRET_TOKEN:-}}"
WEBHOOK_PATH="${WEBHOOK_PATH:-/webhook}"

if [ -n "$PORT_ARG" ]; then
  PORT="$PORT_ARG"
elif curl -s -o /dev/null --connect-timeout 1 "http://127.0.0.1:${GATEWAY_PORT}" 2>/dev/null; then
  PORT="$GATEWAY_PORT"
  GATEWAY_MODE=true
elif curl -s -o /dev/null --connect-timeout 1 "http://127.0.0.1:${BE_PORT}" 2>/dev/null; then
  PORT="$BE_PORT"
  GATEWAY_MODE=false
else
  PORT="${GATEWAY_PORT}"
  GATEWAY_MODE=true
fi

echo "================================================================="
echo "🤖 KHỞI ĐỘNG CLOUDFLARE TUNNEL CHO ZALO BOT"
echo "================================================================="
echo "👉 Target Local : http://127.0.0.1:$PORT"
if [ "$PORT" = "$GATEWAY_PORT" ]; then
  echo "👉 Kiến trúc    : Nginx Gateway (Proxy /api sang $BE_PORT, còn lại sang $FE_PORT)"
else
  echo "👉 Kiến trúc    : Trực tiếp Backend API ($PORT)"
fi
echo "👉 Webhook Path : $WEBHOOK_PATH"
[ "$BACKGROUND_MODE" = "true" ] && echo "👉 Chế độ       : Chạy ngầm (Background Daemon)" || echo "👉 Chế độ       : Giữ Terminal (Foreground Session)"

if [ -z "$BOT_TOKEN" ]; then
  echo ""
  echo "❌ Lỗi: Không tìm thấy ZALO_BOT_TOKEN trong file .env"
  exit 1
fi

# Kiểm tra local server
LOCAL_ALIVE=false
TARGET_HOST="127.0.0.1"
if curl -s -o /dev/null --connect-timeout 2 "http://127.0.0.1:${PORT}" 2>/dev/null; then
  LOCAL_ALIVE=true
  TARGET_HOST="127.0.0.1"
elif curl -s -o /dev/null --connect-timeout 2 "http://localhost:${PORT}" 2>/dev/null; then
  LOCAL_ALIVE=true
  TARGET_HOST="localhost"
fi

if [ "$LOCAL_ALIVE" = "false" ]; then
  echo ""
  echo "⚠️  LƯU Ý: Chưa phát hiện server phản hồi tại http://127.0.0.1:${PORT}"
  if [ "$PORT" = "$GATEWAY_PORT" ]; then
    echo "👉 Hãy đảm bảo Docker Nginx đã chạy ('npm run docker:local') và app dev đã chạy ('npm run dev')!"
  else
    echo "👉 Hãy đảm bảo Backend đã chạy tại port $PORT ('npm run dev')!"
  fi
  echo ""
else
  echo "✅ Đã kết nối thử tới local server (Target: http://${TARGET_HOST}:${PORT})"
fi

# Tự động chọn binary cloudflared
if command -v cloudflared >/dev/null 2>&1; then
  CLOUDFLARED_BIN="cloudflared"
else
  CLOUDFLARED_BIN="npx --yes cloudflared"
fi

# Dọn dẹp tunnel cũ nếu có file PID trước đó
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  kill -0 "$OLD_PID" 2>/dev/null && kill "$OLD_PID" 2>/dev/null || true
  rm -f "$PID_FILE"
fi

LOG_FILE=$(mktemp -t cf_tunnel.XXXXXX.log)
CF_PID=""

cleanup() {
  echo ""
  echo "🛑 Đang dừng Cloudflare Tunnel (PID: ${CF_PID})..."
  if [ -n "$CF_PID" ] && kill -0 "$CF_PID" 2>/dev/null; then
    kill "$CF_PID" 2>/dev/null || true
  fi
  rm -f "$LOG_FILE" "$PID_FILE"
  echo "👋 Đã ngắt kết nối an toàn."
  exit 0
}

# QUAN TRỌNG: Chỉ trap SIGINT (Ctrl+C) và SIGTERM, KHÔNG trap EXIT để không bị tự tắt
trap cleanup INT TERM

# Khởi chạy Cloudflare Tunnel với cờ --config /dev/null để bỏ qua file config.yml cũ ở ~/.cloudflared
echo "🚀 Đang khởi chạy Cloudflare Tunnel..."
$CLOUDFLARED_BIN tunnel --config /dev/null --url "http://${TARGET_HOST}:${PORT}" > "$LOG_FILE" 2>&1 &
CF_PID=$!
echo "$CF_PID" > "$PID_FILE"

# Quét log tìm URL trycloudflare.com
echo "⏳ Đang lấy URL công khai từ Cloudflare..."
TUNNEL_URL=""
for i in {1..30}; do
  if ! kill -0 "$CF_PID" 2>/dev/null; then
    echo "❌ Tiến trình Cloudflare tunnel đã dừng đột ngột! Log:"
    cat "$LOG_FILE"
    exit 1
  fi

  TUNNEL_URL=$(grep -oE "https://[a-zA-Z0-9.-]+\.trycloudflare\.com" "$LOG_FILE" 2>/dev/null | head -n 1)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "❌ Không tìm thấy URL Cloudflare sau 30 giây. Xem log:"
  cat "$LOG_FILE"
  exit 1
fi

FULL_WEBHOOK_URL="${TUNNEL_URL}${WEBHOOK_PATH}"
echo "✅ Đã tạo Tunnel thành công: ${TUNNEL_URL}"
echo "🌐 URL Webhook hoàn chỉnh : ${FULL_WEBHOOK_URL}"

# Cập nhật ZALO_WEBHOOK_URL, APP_URL, WEB_ORIGIN trong .env
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  update_env_var() {
    local k="$1"
    local v="$2"
    if grep -q "^${k}=" "$ENV_FILE"; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^${k}=.*|${k}=${v}|" "$ENV_FILE"
      else
        sed -i "s|^${k}=.*|${k}=${v}|" "$ENV_FILE"
      fi
    fi
  }

  update_env_var "ZALO_WEBHOOK_URL" "$FULL_WEBHOOK_URL"
  if [ "$GATEWAY_MODE" = "true" ]; then
    update_env_var "APP_URL" "$TUNNEL_URL"
    update_env_var "WEB_ORIGIN" "$TUNNEL_URL"
    update_env_var "NEXT_PUBLIC_API_URL" "$TUNNEL_URL"
    echo "📝 Đã tự động cập nhật ZALO_WEBHOOK_URL, APP_URL, WEB_ORIGIN, NEXT_PUBLIC_API_URL trong .env -> $TUNNEL_URL"
  else
    echo "📝 Đã tự động cập nhật ZALO_WEBHOOK_URL trong .env -> $FULL_WEBHOOK_URL"
  fi
fi

# Chờ tunnel thông mạng và trả về HTTP 200
echo ""
echo "⏳ Đang kiểm tra kết nối từ Internet tới tunnel..."
TUNNEL_READY=false
for i in {1..20}; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 -m 5 "${FULL_WEBHOOK_URL}" 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    TUNNEL_READY=true
    echo "✅ Tunnel đã thông mạng Internet và trả về HTTP 200 OK!"
    break
  fi
  echo "   [Thử $i/20] Đang chờ định tuyến (Mã phản hồi: ${HTTP_STATUS}). Thử lại sau 1s..."
  sleep 1
done

# Gọi Zalo setWebhook
echo ""
echo "📡 Đang gửi request setWebhook lên Zalo Bot API..."

if [ -n "$SECRET_TOKEN" ]; then
  PAYLOAD=$(cat <<EOF
{
  "url": "${FULL_WEBHOOK_URL}",
  "secret_token": "${SECRET_TOKEN}"
}
EOF
)
else
  PAYLOAD=$(cat <<EOF
{
  "url": "${FULL_WEBHOOK_URL}"
}
EOF
)
fi

SET_RESULT=$(curl -s -X POST "https://bot-api.zaloplatforms.com/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "👉 Phản hồi setWebhook từ Zalo API:"
echo "$SET_RESULT"

# Kiểm tra với testWebhook
echo ""
echo "🧪 Đang kiểm tra xác thực từ máy chủ Zalo (testWebhook)..."
sleep 1
TEST_RESULT=$(curl -s "https://bot-api.zaloplatforms.com/bot${BOT_TOKEN}/testWebhook")
echo "👉 Phản hồi testWebhook từ Zalo:"
echo "$TEST_RESULT"

echo ""
echo "================================================================="
echo "🎉 HOÀN TẤT CẤU HÌNH WEBHOOK THÀNH CÔNG!"
echo "🌐 Tunnel URL : $TUNNEL_URL"
echo "📚 Swagger API: $TUNNEL_URL/api/docs"
echo "📍 Webhook URL: $FULL_WEBHOOK_URL"
echo "🔒 Secret     : ${SECRET_TOKEN:-<trống>}"
echo "================================================================="

if [ "$BACKGROUND_MODE" = "true" ]; then
  # Tách tiến trình cha ra để terminal có thể dùng tiếp
  disown "$CF_PID" 2>/dev/null || true
  echo "⚡ Tunnel đang chạy NGẦM độc lập (PID: $CF_PID)."
  echo "💡 Khi muốn dừng, chạy lệnh: npm run tunnel:stop"
  echo "================================================================="
  exit 0
else
  echo "💡 GIỮ TERMINAL NÀY MỞ ĐỂ DUY TRÌ KẾT NỐI TUNNEL (PID: $CF_PID)."
  echo "💡 Nhấn Ctrl + C để dừng tunnel bất cứ lúc nào."
  echo "================================================================="
  echo ""
  # Giữ process cha chờ process con để duy trì session
  wait "$CF_PID"
fi
