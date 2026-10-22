# syntax=docker/dockerfile:1

# Stage 1: Dependency manifests with the auto-bumped version zeroed,
# so the npm ci layers below stay cached when only the version changes.
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

# Stage 2: Runtime dependencies of the API and contracts only
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY --from=manifests /src/ ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace @zalobot/api --workspace @zalobot/contracts && \
    mkdir -p /app/apps/api/node_modules

# Stage 3: Node.js API builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=manifests /src/ ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace @zalobot/api --workspace @zalobot/contracts

COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN npm run build --workspace @zalobot/contracts && npm run build --workspace @zalobot/api

# Stage 4: Production runner
FROM node:22-alpine AS runner
WORKDIR /app
RUN --mount=type=cache,target=/var/cache/apk \
    apk add curl tzdata && \
    mkdir -p /app/data

ARG BE_PORT=3005
ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh
ENV BE_PORT=${BE_PORT}
EXPOSE ${BE_PORT}

# Workspace manifests so Node resolves the @zalobot/* packages at runtime.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/apps/api/dist apps/api/dist

CMD ["node", "apps/api/dist/main.js"]
