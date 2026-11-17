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

# Stage 2: Runtime dependencies of the API and contracts only. Debian (glibc), not Alpine: the
# ONNX runtime of the local embedding model ships glibc binaries only.
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY --from=manifests /src/ ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace @zalobot/api --workspace @zalobot/contracts && \
    mkdir -p /app/apps/api/node_modules

# Stage 3: Node.js API builder
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=manifests /src/ ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace @zalobot/api --workspace @zalobot/contracts

COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN npm run build --workspace @zalobot/contracts && npm run build --workspace @zalobot/api

# Stage 4: Tesseract language data. The same files tesseract.js downloads on its own (jsdelivr,
# `4.0.0_best_int`, the LSTM-only variant it defaults to), baked in so a fresh container never
# fetches them from the CDN on its first OCR. Cached across builds: they change rarely.
FROM node:22-alpine AS tessdata
WORKDIR /tessdata
RUN --mount=type=cache,target=/tessdata-cache \
    for lang in vie eng; do \
      if [ ! -s "/tessdata-cache/${lang}.traineddata" ]; then \
        wget -qO- "https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz" \
          | gunzip > "/tessdata-cache/${lang}.traineddata"; \
      fi; \
      cp "/tessdata-cache/${lang}.traineddata" "/tessdata/${lang}.traineddata"; \
    done

# Stage 5: Embedding model of the long-term memory (multilingual MiniLM, ONNX, 8-bit), loaded once
# here and baked in, so the API never downloads it and memory works offline. Keep the name equal
# to DEFAULT_EMBEDDING_MODEL in apps/api/src/config/configuration.ts. Cached across builds.
FROM prod-deps AS embedding-model
ARG EMBEDDING_MODEL=Xenova/paraphrase-multilingual-MiniLM-L12-v2
RUN --mount=type=cache,target=/models-cache <<'EOF'
node -e '
const { pipeline, env } = require("@huggingface/transformers");
env.cacheDir = "/models-cache";
pipeline("feature-extraction", process.env.EMBEDDING_MODEL, { dtype: "q8" })
  .then((extract) => extract(["xin chào"], { pooling: "mean", normalize: true }))
  .then((output) => {
    if (output.dims[1] !== 384) throw new Error("unexpected embedding size " + output.dims[1]);
  })
  .catch((err) => { console.error(err); process.exit(1); });
'
cp -r /models-cache /models
EOF

# Stage 6: Production runner
FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl tzdata && \
    mkdir -p /app/data

ARG BE_PORT=3005
ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh
ENV BE_PORT=${BE_PORT}
# OcrService reads vie/eng from here instead of downloading into the working directory.
ENV OCR_TESSDATA_DIR=/app/tessdata
# LocalEmbedder reads the baked model from here (outside the ./data mount).
ENV EMBEDDING_MODEL_DIR=/app/models
# glibc keeps one heap per thread by default; with the ONNX threads of the embedder that left the
# API at 2.4 GB. Two heaps cut the memory left after a backfill by ~40% (see local-embedder.ts).
ENV MALLOC_ARENA_MAX=2
EXPOSE ${BE_PORT}

COPY --from=tessdata /tessdata /app/tessdata
COPY --from=embedding-model /models /app/models

# Workspace manifests so Node resolves the @zalobot/* packages at runtime.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/apps/api/dist apps/api/dist

CMD ["node", "apps/api/dist/main.js"]
