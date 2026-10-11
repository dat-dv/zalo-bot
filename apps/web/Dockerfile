# syntax=docker/dockerfile:1

# Stage 1: Static Web Builder
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN --mount=type=cache,target=/root/.npm npm ci

COPY apps/web apps/web
COPY packages/contracts packages/contracts
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace @zalobot/contracts && npm run build --workspace @zalobot/web

# Stage 2: Nginx Web Runner
FROM nginx:1.27-alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/apps/web/out /usr/share/nginx/html
EXPOSE 80
