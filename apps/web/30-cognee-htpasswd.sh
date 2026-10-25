#!/bin/sh
# Writes what nginx needs for remote access to the Cognee memory server:
# - /etc/nginx/cognee.locations (included by nginx.conf): /cognee/ API proxy on the main domain;
# - /etc/nginx/conf.d/zz-cognee-ui.conf: a server for COGNEE_UI_HOST with the Cognee UI at / and
#   the Cognee API at /api/ (one origin, so the UI's login cookie and CORS just work); /cognee on
#   the main domain then redirects there. The UI cannot run under /cognee/ (no basePath).
# Closed by default: without COGNEE_PROXY_USER and COGNEE_PROXY_PASSWORD everything answers 404.
# With both, HTTP Basic Auth sits on top of Cognee's own login, and self sign-up
# (/api/v1/auth/register) stays blocked so nobody can spend the LLM key on their own datasets.
set -eu

LOCATIONS=/etc/nginx/cognee.locations
HTPASSWD=/etc/nginx/cognee.htpasswd
UI_SERVER=/etc/nginx/conf.d/zz-cognee-ui.conf
UI_HOST="${COGNEE_UI_HOST:-}"

: > "$UI_SERVER"

if [ -z "${COGNEE_PROXY_USER:-}" ] || [ -z "${COGNEE_PROXY_PASSWORD:-}" ]; then
  printf 'location /cognee/ {\n  return 404;\n}\n' > "$LOCATIONS"
  echo "30-cognee-htpasswd: /cognee/ disabled (COGNEE_PROXY_USER/COGNEE_PROXY_PASSWORD not set)"
  exit 0
fi

case "$UI_HOST" in
  *[!a-zA-Z0-9.-]*) echo "30-cognee-htpasswd: COGNEE_UI_HOST must be a bare host name" >&2; exit 1 ;;
esac

case "$COGNEE_PROXY_USER" in
  *:*) echo "30-cognee-htpasswd: COGNEE_PROXY_USER must not contain ':'" >&2; exit 1 ;;
esac

umask 077
printf '%s:{PLAIN}%s\n' "$COGNEE_PROXY_USER" "$COGNEE_PROXY_PASSWORD" > "$HTPASSWD"
chown nginx:nginx "$HTPASSWD" 2>/dev/null || true

if [ -n "$UI_HOST" ]; then
  # /cognee and /cognee/ open the UI on its own host; /cognee/api/... stays the API.
  cat > "$LOCATIONS" <<NGINX
location = /cognee {
  return 302 https://$UI_HOST/;
}

location = /cognee/ {
  return 302 https://$UI_HOST/;
}

NGINX
else
  : > "$LOCATIONS"
fi

cat >> "$LOCATIONS" <<'NGINX'
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

[ -n "$UI_HOST" ] || exit 0

cat > "$UI_SERVER" <<'NGINX'
server {
  listen 80;
  server_name __UI_HOST__;
  absolute_redirect off;
  port_in_redirect off;

  auth_basic "Cognee";
  auth_basic_user_file /etc/nginx/cognee.htpasswd;
  # Resolved per request through Docker DNS, so the web still starts while cognee is down.
  resolver 127.0.0.11 valid=30s ipv6=off;

  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  location = /api/v1/auth/register {
    return 403;
  }

  location /api/ {
    set $cognee_api http://cognee:8000;
    proxy_pass $cognee_api;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    client_max_body_size 20m;
  }

  location = /health {
    set $cognee_api http://cognee:8000;
    proxy_pass $cognee_api;
  }

  location / {
    set $cognee_ui http://cognee-ui:3000;
    proxy_pass $cognee_ui;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
NGINX
sed -i "s/__UI_HOST__/$UI_HOST/" "$UI_SERVER"
echo "30-cognee-htpasswd: Cognee UI enabled at $UI_HOST"
