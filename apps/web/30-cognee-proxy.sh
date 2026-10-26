#!/bin/sh
# Writes what nginx needs for remote access to the Cognee memory server:
# - /etc/nginx/cognee.locations (included by nginx.conf): on the main domain, /cognee and /cognee/
#   redirect to the UI host and /cognee/api/... proxies the Cognee API;
# - /etc/nginx/conf.d/zz-cognee-ui.conf: a server for COGNEE_UI_HOST (also the default server of
#   port 8081, published as COGNEE_UI_PORT) with the Cognee UI at / and the Cognee API at /api/,
#   one origin so the UI's login cookie and CORS just work. The UI cannot run under /cognee/
#   (no basePath).
# Closed by default: without COGNEE_UI_HOST everything answers 404. Access is protected by
# Cognee's own login only; self sign-up (/api/v1/auth/register) stays blocked so nobody can create
# an account and spend the LLM key on their own datasets.
set -eu

LOCATIONS=/etc/nginx/cognee.locations
UI_SERVER=/etc/nginx/conf.d/zz-cognee-ui.conf
UI_HOST="${COGNEE_UI_HOST:-}"

: > "$UI_SERVER"

if [ -z "$UI_HOST" ]; then
  printf 'location /cognee/ {\n  return 404;\n}\n' > "$LOCATIONS"
  echo "30-cognee-proxy: Cognee access disabled (COGNEE_UI_HOST not set)"
  exit 0
fi

case "$UI_HOST" in
  *[!a-zA-Z0-9.-]*) echo "30-cognee-proxy: COGNEE_UI_HOST must be a bare host name" >&2; exit 1 ;;
esac

cat > "$LOCATIONS" <<NGINX
location = /cognee {
  return 302 https://$UI_HOST/;
}

location = /cognee/ {
  return 302 https://$UI_HOST/;
}

NGINX

cat >> "$LOCATIONS" <<'NGINX'
location = /cognee/api/v1/auth/register {
  return 403;
}

location /cognee/ {
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

cat > "$UI_SERVER" <<'NGINX'
server {
  # Port 80: the UI host routed to the web like the main domain. Port 8081 (published as
  # COGNEE_UI_PORT, 3006): a tunnel pointed straight at the UI, whatever Host it sends.
  listen 80;
  listen 8081 default_server;
  server_name __UI_HOST__;
  absolute_redirect off;
  port_in_redirect off;

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
    # A location with its own proxy_set_header inherits none from the server, so every header
    # is repeated. Next.js rejects Server Actions unless the forwarded host matches the browser
    # origin (otherwise it sees cognee-ui:3000 and answers 500).
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
NGINX
sed -i "s/__UI_HOST__/$UI_HOST/" "$UI_SERVER"
echo "30-cognee-proxy: Cognee UI at $UI_HOST, API at /cognee/api/"
