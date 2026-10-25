# syntax=docker/dockerfile:1

# Stage 1: Dependency manifests with the auto-bumped version zeroed,
# so the npm ci layer below stays cached when only the version changes.
FROM node:22-alpine AS manifests
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN <<'EOF'
node -e '
const fs = require("fs");
const workspaces = ["", "apps/api", "apps/web", "packages/contracts"];
for (const dir of workspaces) {
  const file = dir ? dir + "/package.json" : "package.json";
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  pkg.version = "0.0.0";
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
}
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
lock.version = "0.0.0";
for (const dir of workspaces) {
  if (lock.packages[dir]) lock.packages[dir].version = "0.0.0";
}
fs.writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
'
EOF

# Stage 2: Static Web Builder
FROM node:22-alpine AS builder

WORKDIR /app
COPY --from=manifests /src/ ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace @zalobot/web --workspace @zalobot/contracts

COPY apps/web apps/web
COPY packages/contracts packages/contracts
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace @zalobot/contracts && npm run build --workspace @zalobot/web

# Stage 3: Nginx Web Runner
FROM nginx:1.27-alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY --chmod=755 apps/web/30-cognee-htpasswd.sh /docker-entrypoint.d/30-cognee-htpasswd.sh
COPY --from=builder /app/apps/web/out /usr/share/nginx/html
EXPOSE 80
