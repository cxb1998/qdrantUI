ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm-slim
ARG QDRANT_IMAGE=qdrant/qdrant:v1.18.3
ARG NPM_REGISTRY=https://registry.npmmirror.com

FROM ${QDRANT_IMAGE} AS qdrant

FROM ${NODE_IMAGE} AS builder
ARG NPM_REGISTRY

WORKDIR /app

# builder 阶段同样需要 CA 证书，否则 npm 拉包可能异常失败
COPY --from=qdrant /etc/ssl/certs /etc/ssl/certs

COPY package.json package-lock.json ./
RUN set -eux; \
  npm config set registry "${NPM_REGISTRY}"; \
  npm config set fetch-retries 5; \
  npm config set fetch-retry-mintimeout 20000; \
  npm config set fetch-retry-maxtimeout 120000; \
  npm config set fetch-timeout 600000; \
  npm config set maxsockets 5; \
  for i in 1 2 3; do \
    echo "npm ci attempt ${i}..."; \
    npm ci --no-audit --no-fund && break; \
    if [ "${i}" -eq 3 ]; then exit 1; fi; \
    echo "npm ci failed, retry in 5s..."; \
    sleep 5; \
  done

COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runner

WORKDIR /app

# 从官方 Qdrant 镜像复制二进制，避免构建时 apt-get / wget（内网 DNS 不通时常见失败）
COPY --from=qdrant /qdrant /app/qdrant
# node:slim 不含 libunwind 等 Qdrant 运行时依赖，从官方镜像一并复制（无需 apt-get）
COPY --from=qdrant /lib/ /qdrant-lib/
RUN mkdir -p /lib/aarch64-linux-gnu /lib/x86_64-linux-gnu \
  && cp -n /qdrant-lib/aarch64-linux-gnu/libunwind*.so* /lib/aarch64-linux-gnu/ 2>/dev/null || true \
  && cp -n /qdrant-lib/x86_64-linux-gnu/libunwind*.so* /lib/x86_64-linux-gnu/ 2>/dev/null || true \
  && cp -n /qdrant-lib/aarch64-linux-gnu/liblzma.so* /lib/aarch64-linux-gnu/ 2>/dev/null || true \
  && cp -n /qdrant-lib/x86_64-linux-gnu/liblzma.so* /lib/x86_64-linux-gnu/ 2>/dev/null || true \
  && rm -rf /qdrant-lib
# Qdrant 1.18+ 启动时需系统 CA 证书（telemetry / inference HTTP 客户端），node:slim 默认没有
COPY --from=qdrant /etc/ssl/certs /etc/ssl/certs

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
