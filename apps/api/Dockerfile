# syntax=docker/dockerfile:1

# Stage 1: Tesseract OCR language data downloader (cached independently)
FROM alpine:3.21 AS tessdata-downloader
RUN --mount=type=cache,target=/var/cache/apk \
    apk add curl && \
    mkdir -p /tessdata && \
    curl -fsSL https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/vie.traineddata -o /tessdata/vie.traineddata && \
    curl -fsSL https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata -o /tessdata/eng.traineddata

# Stage 2: Whisper C++ server builder (pinned version for deterministic caching)
FROM alpine:3.21 AS whisper-builder
RUN --mount=type=cache,target=/var/cache/apk \
    apk add cmake curl g++ git make wget
WORKDIR /opt
ARG WHISPER_CPP_VERSION=v1.7.4
RUN git clone --depth 1 --branch ${WHISPER_CPP_VERSION} https://github.com/ggml-org/whisper.cpp.git && \
    cmake -S whisper.cpp -B whisper.cpp/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF && \
    cmake --build whisper.cpp/build --target whisper-server -j"$(nproc)" && \
    whisper.cpp/models/download-ggml-model.sh base whisper.cpp/models

# Stage 3: Node.js API builder
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

# Stage 4: Production runner
FROM node:22-alpine AS runner
WORKDIR /app
RUN --mount=type=cache,target=/var/cache/apk \
    apk add curl ffmpeg libgomp libstdc++

ENV NODE_ENV=production
EXPOSE 3000

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=whisper-builder /opt/whisper.cpp/build/bin/whisper-server /usr/local/bin/whisper-server
COPY --from=whisper-builder /opt/whisper.cpp/models/ggml-base.bin /opt/whisper/models/ggml-base.bin
COPY --from=tessdata-downloader /tessdata /app/assets/tessdata
COPY apps/api/scripts/start-with-whisper.sh /usr/local/bin/start-with-whisper.sh
RUN chmod +x /usr/local/bin/start-with-whisper.sh

CMD ["/usr/local/bin/start-with-whisper.sh"]
