#!/bin/sh
# Writes the /cognee/ locations nginx includes (see nginx.conf). Remote access to the Cognee memory
# server is closed by default: without COGNEE_PROXY_USER and COGNEE_PROXY_PASSWORD it answers 404.
# With both, it sits behind HTTP Basic Auth on top of Cognee's own login, and self sign-up
# (/api/v1/auth/register) stays blocked so nobody can spend the LLM key on their own datasets.
set -eu

LOCATIONS=/etc/nginx/cognee.locations
HTPASSWD=/etc/nginx/cognee.htpasswd

if [ -z "${COGNEE_PROXY_USER:-}" ] || [ -z "${COGNEE_PROXY_PASSWORD:-}" ]; then
  printf 'location /cognee/ {\n  return 404;\n}\n' > "$LOCATIONS"
  echo "30-cognee-htpasswd: /cognee/ disabled (COGNEE_PROXY_USER/COGNEE_PROXY_PASSWORD not set)"
  exit 0
fi

case "$COGNEE_PROXY_USER" in
  *:*) echo "30-cognee-htpasswd: COGNEE_PROXY_USER must not contain ':'" >&2; exit 1 ;;
esac

umask 077
printf '%s:{PLAIN}%s\n' "$COGNEE_PROXY_USER" "$COGNEE_PROXY_PASSWORD" > "$HTPASSWD"
chown nginx:nginx "$HTPASSWD" 2>/dev/null || true

cat > "$LOCATIONS" <<'NGINX'
location = /cognee/api/v1/auth/register {
  return 403;
}

location /cognee/ {
  auth_basic "Cognee";
  auth_basic_user_file /etc/nginx/cognee.htpasswd;
  # Resolved per request through Docker DNS, so the web still starts while cognee is down.
  resolver 127.0.0.11 valid=30s ipv6=off;
  set $cognee_upstream http://cognee:8000;
  rewrite ^/cognee/(.*)$ /$1 break;
  proxy_pass $cognee_upstream;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Prefix /cognee;
  # Building the graph of a chat day can take minutes.
  proxy_read_timeout 600s;
  proxy_send_timeout 600s;
  client_max_body_size 20m;
}
NGINX
echo "30-cognee-htpasswd: /cognee/ enabled behind Basic Auth"
