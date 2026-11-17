# syntax=docker/dockerfile:1

# Postgres 16 on Alpine (the image the data volume was created with, so collation stays the same
# and nothing needs a REINDEX) plus pgvector, for the embeddings of the long-term chat memory.
# The official pgvector image is Debian (glibc), whose en_US.utf8 sorts text differently.
FROM postgres:16-alpine AS pgvector-build
ARG PGVECTOR_VERSION=0.8.1
# `with_llvm=no`: no JIT bitcode, so no clang matching the server's LLVM is needed (JIT gains
# nothing on a few thousand rows). `OPTFLAGS=""`: portable, the image may run on another CPU.
RUN apk add --no-cache --virtual .build-deps build-base git && \
    git clone --depth 1 --branch "v${PGVECTOR_VERSION}" https://github.com/pgvector/pgvector.git /tmp/pgvector && \
    cd /tmp/pgvector && \
    make with_llvm=no OPTFLAGS="" && \
    make with_llvm=no install DESTDIR=/tmp/pgvector-install

FROM postgres:16-alpine
COPY --from=pgvector-build /tmp/pgvector-install/usr/local/ /usr/local/
