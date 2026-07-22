ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm-slim
ARG QDRANT_IMAGE=qdrant/qdrant:v1.13.5

FROM ${QDRANT_IMAGE} AS qdrant

FROM ${NODE_IMAGE} AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
  && npm ci

COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runner

WORKDIR /app

# 从官方 Qdrant 镜像复制二进制，避免构建时 apt-get / wget（内网 DNS 不通时常见失败）
COPY --from=qdrant /qdrant /app/qdrant

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh /app/qdrant/qdrant

ENV NODE_ENV=production \
    PORT=8787 \
    QDRANT_URL=http://127.0.0.1:6333 \
    QDRANT_DATA=/data/qdrant \
    USERS_FILE=/data/config/users.json

EXPOSE 8787 6333

VOLUME ["/data/qdrant", "/data/config"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]
