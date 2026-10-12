# syntax=docker/dockerfile:1

# Stage 1: Node.js API builder
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN --mount=type=cache,target=/root/.npm npm ci

COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN npm run build --workspace @zalobot/contracts && npm run build --workspace @zalobot/api

# Stage 2: Production runner
FROM node:22-alpine AS runner
WORKDIR /app
RUN --mount=type=cache,target=/var/cache/apk \
    apk add curl

ENV NODE_ENV=production
EXPOSE 3000

COPY package.json package-lock.json ./
COPY CHANGELOG.md* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/apps/api/dist apps/api/dist

CMD ["node", "apps/api/dist/main.js"]
