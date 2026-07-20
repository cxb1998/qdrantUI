ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm-slim

FROM ${NODE_IMAGE} AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
  && npm ci

COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runner

ARG QDRANT_VERSION=1.13.5
ARG TARGETARCH

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates wget tar \
  && rm -rf /var/lib/apt/lists/* \
  && case "$TARGETARCH" in \
       amd64) QDRANT_PKG=qdrant-x86_64-unknown-linux-gnu ;; \
       arm64) QDRANT_PKG=qdrant-aarch64-unknown-linux-musl ;; \
       *) echo "unsupported arch: $TARGETARCH" && exit 1 ;; \
     esac \
  && wget -q "https://github.com/qdrant/qdrant/releases/download/v${QDRANT_VERSION}/${QDRANT_PKG}.tar.gz" -O /tmp/qdrant.tar.gz \
  && mkdir -p /app/qdrant \
  && tar -xzf /tmp/qdrant.tar.gz -C /app/qdrant \
  && rm /tmp/qdrant.tar.gz \
  && chmod +x /app/qdrant/qdrant

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production \
    PORT=8787 \
    QDRANT_URL=http://127.0.0.1:6333 \
    QDRANT_DATA=/data/qdrant \
    USERS_FILE=/data/config/users.json

EXPOSE 8787 6333

VOLUME ["/data/qdrant", "/data/config"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8787/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
