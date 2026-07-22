# Qdrant 控制台

经 **BFF 安全代理** 访问 Qdrant 的向量集合管理台。界面全中文，简洁大气，专注于集合管理，并为后续的教程、数据集等模块预留了入口。

官方 Web UI 信息密集、样式朴素；本项目用一套「冷色仪表台」视觉语言重做，招牌元素是贯穿全站的**相似度热力刻度**（近/相似 = 暖金，远 = 冷蓝），在相似度分数、ANN 召回、图谱连边上一致复用。

## 技术栈

- React 19 + TypeScript + Vite
- Hono BFF（登录、Session、Qdrant / Embedding 代理）
- Tailwind CSS v4（CSS-first 设计 token）
- TanStack Query（数据获取与缓存）
- React Router（路由）
- Radix Dialog（无障碍弹窗）
- react-force-graph-2d（相似度图谱，按需加载）
- 字体：Space Grotesk / IBM Plex Sans / IBM Plex Mono（通过 Google Fonts 加载）

浏览器不直连 Qdrant / Embedding，密钥与真实地址保存在服务端。

## 认证与权限

控制台通过 **BFF 登录** 区分角色：

| 账号（默认） | 密码 | 角色 |
|-------------|------|------|
| `admin` | `admin123` | 管理员：全部读写 |
| `viewer` | `viewer123` | 只读：浏览与检索 |

首次使用请运行 `npm run init:users` 生成 `server/users.json`（已 gitignore）。

## 前置条件

- Node.js 18+
- 一个可访问的 Qdrant 实例（默认 `http://localhost:6333`，由 BFF 连接）
- 开发时需**同时**启动 BFF 与前端（见下方「启动」）

## 快速开始

```bash
npm install
npm run init:users          # 首次：生成用户文件
cp .env.example .env        # 可选：改 Qdrant / Embedding 地址与 Key

npm run dev:full            # 同时起 BFF + 前端（推荐）
```

浏览器打开 **http://localhost:5714**，使用 `admin` / `admin123` 登录。

> **注意**：不要只运行 `npm run dev`。仅启动前端时 `/api` 无法连通，登录会失败。务必使用 `npm run dev:full`，或在两个终端分别运行 `npm run server` 与 `npm run dev`。

### 分终端启动（可选）

```bash
npm run server       # BFF  http://localhost:8787
npm run dev          # 前端 http://localhost:5714
```

### 生产构建与启动

```bash
npm run build
npm run start        # 同时提供 dist 静态资源与 /api
```

### Docker 一键启动（Qdrant + 控制台）

将 **Qdrant 与控制台** 打包进**同一个容器**，Embedding 仍由外部服务提供（默认指向宿主机 `8765`）。

```bash
# 构建并后台启动（只需这一条命令）
docker compose up -d --build
# 或
npm run docker:up
```

浏览器打开 **http://localhost:8787**，使用 `admin` / `admin123` 登录。

容器内架构：

```
同一容器
├── Qdrant      :6333  （向量库，数据卷 /data/qdrant）
└── 控制台 BFF  :8787  （前端 + API，用户卷 /data/config）
         ↓
    外部 Embedding（宿主机或另一容器，EMBED_URL 配置）
```

常用操作：

```bash
# 停止
docker compose down

# 查看日志
docker compose logs -f

# 容器内改密码
docker compose exec qdrant-ui node scripts/set-password.mjs admin 你的新密码
```

环境变量（可在项目根目录建 `.env` 供 compose 读取）：

| 变量 | 说明 | 默认 |
|------|------|------|
| `SESSION_SECRET` | Session 签名 | 占位值（生产务必修改） |
| `EMBED_URL` | 外部 Embedding 地址 | `http://host.docker.internal:8765` |
| `EMBED_API_KEY` | Embedding Key | 空 |

> 向量服务需在宿主机运行 `npm run mock:embed` 或你的真实 Embedding 服务；容器会通过 `host.docker.internal` 访问宿主机。

> Qdrant 仅在容器内部监听 `:6333`，**不映射到宿主机**，避免与本机已有 Qdrant 容器冲突。只需访问 **http://localhost:8787** 即可。

#### 端口被占用（Bind for 0.0.0.0:6333 / 8787 failed）

若报 `port is already allocated`：

```bash
# 先停掉可能残留的容器
docker compose down

# 查看谁占用了 8787
lsof -i :8787
```

然后重新 `docker compose up -d`。若 8787 也被占用，可在 `docker-compose.yml` 改为 `"8788:8787"`，浏览器访问 http://localhost:8788。

#### 构建时 `deb.debian.org` / DNS 解析失败

报错类似 `Temporary failure resolving 'deb.debian.org'`、`ca-certificates has no installation candidate`，是 **Docker 构建容器内 DNS 不通**（Ubuntu 服务器上较常见）。

请先 **拉取最新代码**（新版 Dockerfile 已去掉 `apt-get`，改为从 `qdrant/qdrant` 镜像复制二进制）：

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

若仍失败，在宿主机配置 Docker DNS（`/etc/docker/daemon.json`）后 `systemctl restart docker`：

```json
{
  "dns": ["114.114.114.114", "8.8.8.8"]
}
```

先单独测试能否拉取镜像：

```bash
docker pull qdrant/qdrant:v1.18.3
docker pull docker.1ms.run/library/node:22-bookworm-slim
```

#### Docker 构建失败（拉取镜像 EOF / timeout / 401）

报错类似 `auth.docker.io ... i/o timeout` 或 `failed to resolve source metadata for docker.io/...`，是 **访问 Docker Hub 网络不通**（国内较常见）。

项目**默认已改用国内镜像站**拉取 Node 基础镜像（`docker.m.daocloud.io`），请先拉取最新代码后重试：

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

**先单独测试能否拉到基础镜像：**

```bash
docker pull qdrant/qdrant:v1.18.3
docker pull docker.m.daocloud.io/library/node:22-bookworm-slim
# 或 NODE_IMAGE=docker.1ms.run/library/node:22-bookworm-slim
```

若上面成功，再执行 `docker compose up -d --build`。

**若 DaoCloud 也超时**，在项目 `.env` 里换其他镜像站后重试：

```bash
# 任选其一
NODE_IMAGE=docker.1ms.run/library/node:22-bookworm-slim
# NODE_IMAGE=dockerproxy.com/library/node:22-bookworm-slim
```

```bash
docker compose build --no-cache
docker compose up -d
```

**可选：配置 Docker Desktop 镜像加速**

Settings → Docker Engine → 加入 `registry-mirrors` 后 Apply：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io"
  ]
}
```

**说明**：Qdrant 从 `qdrant/qdrant` 镜像复制，构建阶段不再 `apt-get`；`npm` 默认走 `npmmirror.com`。默认固定为 `v1.18.3`（可复现构建），**不建议**用 `latest` 标签；如需升级可在 `.env` 设置 `QDRANT_IMAGE=qdrant/qdrant:v1.18.3` 后重新 `docker compose build --no-cache`。

#### 构建时 `npm ci` 失败或长时间卡住

报错类似 `npm error Exit handler never called!`，或日志停在 `npm ci attempt 1...` **很久不动**，多为 **Docker 构建网络访问 npm 源慢/不通**（`npm ci` 默认几乎不输出进度，看起来像卡死）。

```bash
git pull origin main
DOCKER_BUILDKIT=1 docker compose build --no-cache --progress=plain
```

构建时会打印 `registry ok 200` 和包下载日志；若 npmmirror 不通会自动回退 `registry.npmjs.org`。

若仍卡住，在 `.env` **直接指定** npm 源后重试：

```bash
# 任选其一（哪个 curl 通就用哪个）
NPM_REGISTRY=https://registry.npmjs.org
# NPM_REGISTRY=https://registry.npmmirror.com
```

```bash
docker compose build --no-cache --progress=plain
```

Linux 服务器还可单独测试：

```bash
curl -I https://registry.npmmirror.com
curl -I https://registry.npmjs.org
```

> macOS 上 Docker Desktop 对 `network: host` 支持有限；若卡住超过 5 分钟，优先换 `NPM_REGISTRY=https://registry.npmjs.org`。

#### 容器状态一直 Restarting

先查看日志定位原因：

```bash
docker compose logs --tail 80
# 或
docker logs qdrant-ui --tail 80
```

常见原因与处理：

| 日志关键词 | 原因 | 处理 |
|-----------|------|------|
| `exec format error` / `无法运行` | 镜像 CPU 架构与机器不匹配（如在 Mac ARM 导出镜像，在 x86 Linux 上运行） | **在新机器上** `git pull` 后执行 `docker compose build --no-cache && docker compose up -d`，不要直接 `docker load` 跨架构镜像 |
| `libunwind` / `cannot open shared object` | 旧版镜像缺少 Qdrant 运行时库 | `git pull` 拉最新代码后重新构建 |
| `No CA certificates were loaded` | 镜像缺少系统 CA 证书（Qdrant 1.18+） | `git pull` 后 `docker compose build --no-cache` 重建 |
| `Qdrant 进程异常退出` | 数据卷损坏或权限问题 | `docker compose down` 后加 `-v` 清空卷重试（会删向量数据） |
| `port is already allocated` | 8787 被占用 | 改端口映射或释放占用进程 |

推荐在新电脑上**始终本地构建**，不要复用其他架构机器导出的 `.tar` 镜像：

```bash
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose logs -f    # 确认出现「Qdrant 已就绪」「BFF 运行于」
```

#### 分发给其他项目 / 机器使用

当前 README 的 `docker compose up -d --build` 适合**在本机克隆仓库后构建**。若要给其他同事、服务器或业务项目使用，常用有三种方式：

**方式 1：对方克隆仓库后构建（适合会改代码的团队）**

```bash
git clone https://github.com/cxb1998/qdrantUI.git
cd qdrantUI
cp .env.example .env    # 修改 SESSION_SECRET、EMBED_URL 等
docker compose up -d --build
```

对方只需 Docker，无需安装 Node.js。首次启动容器会自动生成默认账号；生产环境请尽快改密。

**方式 2：导出镜像文件（适合内网离线交付）**

在你这台机器上构建并导出：

```bash
docker compose build
docker save webui-qdrant-ui:latest -o qdrant-ui.tar
```

将 `qdrant-ui.tar`、`docker-compose.yml`、`.env.example` 发给对方。对方导入并启动：

```bash
docker load -i qdrant-ui.tar
cp .env.example .env    # 按需修改
# 将 docker-compose.yml 中 build: 改为 image: webui-qdrant-ui:latest 后：
docker compose up -d
```

> 若对方 `compose` 仍使用 `build:`，需把 `docker-compose.yml` 里的 `build` 段改为 `image: webui-qdrant-ui:latest`，否则会重新构建。

**方式 3：推送到镜像仓库（适合长期维护、多机部署）**

```bash
# 构建并打标签（示例：GitHub Container Registry）
docker compose build
docker tag webui-qdrant-ui:latest ghcr.io/cxb1998/qdrant-ui:latest
docker push ghcr.io/cxb1998/qdrant-ui:latest
```

其他机器拉取后，在 `docker-compose.yml` 使用 `image: ghcr.io/cxb1998/qdrant-ui:latest` 替代 `build:`，再 `docker compose up -d`。

**对方还需要准备什么**

| 项目 | 说明 |
|------|------|
| **Embedding 服务** | 不在镜像内；需另起 `npm run mock:embed` 或真实向量 API，并配置 `EMBED_URL` |
| **环境变量** | 至少修改 `SESSION_SECRET`；HTTPS 前置代理时设 `COOKIE_SECURE=true` |
| **数据持久化** | Qdrant 数据在卷 `qdrant_data`，账号在 `app_config`；`docker compose down` 不删卷 |
| **Linux 访问宿主机 Embedding** | `host.docker.internal` 在 Linux 需 compose 中 `extra_hosts`（已配置）；也可直接把 `EMBED_URL` 写成内网 IP |

**集成到其他项目时**

- 可将本仓库的 `docker-compose.yml` 片段合并进业务项目的 compose，或单独起一个 `qdrant-ui` 服务。
- 向量数据与控制台账号随 Docker 卷保存，与镜像版本独立；升级镜像时一般只需 `docker compose pull && docker compose up -d`（若已发布到仓库）。

## 连接配置

在项目根目录复制并编辑 `.env`（模板见 `.env.example`）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `QDRANT_URL` | Qdrant 地址 | `http://127.0.0.1:6333` |
| `QDRANT_API_KEY` | Qdrant API Key（可选） | 空 |
| `EMBED_URL` | Embedding 服务地址 | `http://127.0.0.1:8765` |
| `EMBED_API_KEY` | Embedding API Key（可选） | 空 |
| `SESSION_SECRET` | Session 签名密钥（见下方说明） | 开发用占位值 |
| `COOKIE_SECURE` | 是否给登录 Cookie 加 `Secure` 标志 | `false`（HTTPS 前置代理后改为 `true`） |

- 修改 `.env` 后需**重启 BFF** 才生效。
- 向量相关功能（入库、以图搜图）需配置可用的 Embedding 服务；本地开发可运行 `npm run mock:embed`（默认 `8765` 端口）。

## SESSION_SECRET 说明

`SESSION_SECRET` 是 **登录 Session 的签名密钥**。用户登录后，BFF 会签发 `qdrant_session` Cookie，其中包含用户名、角色、过期时间等信息；服务端用 `SESSION_SECRET` 对 Cookie 做 HMAC 签名，防止被篡改或伪造。

**与用户密码无关**：账号密码存在 `server/users.json`；`SESSION_SECRET` 只保护「已登录状态」是否可信。

### 当前默认值

| 场景 | 默认值 |
|------|--------|
| `.env.example` / 未正确配置时 | `请改为随机长字符串`（占位，勿用于生产） |
| 代码 fallback（无 `.env`） | `dev-change-me-in-production` |
| Docker Compose | `please-change-me-in-production` |

本地开发可用占位值；**对外部署前必须改成随机长字符串**。

### 如何生成

```bash
openssl rand -base64 32
```

或使用 Node.js：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

写入 `.env`：

```bash
SESSION_SECRET=这里粘贴生成的随机字符串
```

Docker 部署时在项目根目录 `.env` 中配置即可（`docker compose` 会读取）；修改后执行 `docker compose up -d` 重启容器。

### 注意事项

- **修改后**：所有已登录用户 Cookie 失效，需重新登录。
- **多实例**：若多台 BFF 共用同一套登录，必须使用**相同**的 `SESSION_SECRET`。
- **与 HTTPS**：本地 HTTP 访问时保持 `COOKIE_SECURE=false`；前面有 Nginx 等 HTTPS 反向代理时，设为 `COOKIE_SECURE=true`。

## 修改密码

账号密码保存在 `server/users.json`（bcrypt 哈希，无明文）。**控制台内暂无改密页面**，请在服务器上用命令行修改：

```bash
# 修改 admin 密码
npm run set-password -- admin 你的新密码

# 修改 viewer 密码
npm run set-password -- viewer 你的新密码
```

改完后**无需重启 BFF**，下次登录使用新密码即可。

其他说明：

- 仅首次部署、尚无用户文件时，运行 `npm run init:users` 生成默认账号。
- 若 `users.json` 已存在，`init:users` 会拒绝覆盖；改密请用 `set-password`，不要删文件重来（除非有意重置全部账号）。

## 功能

### 集合管理（列表）

- 表格展示每个集合的状态、点数、维度·距离、分段数。
- 行操作：**刷新**（重取该集合信息）、**删除**（二次确认）。
- 顶部：按名称**搜索**、**创建集合**（维度 / 距离 / 磁盘存储选项）、**上传快照**（从 `.snapshot` 文件恢复为集合）。
- 点击任意集合进入详情。

### 集合详情

以标签页组织，仅保留最常用的六项：

| 标签 | 说明 |
| --- | --- |
| **Points** | 分页浏览点，按 ID 精确查询或用 JSON Filter 过滤，可展开 payload 与向量 |
| **Optimizations** | 查看优化器 / HNSW 配置与优化状态，可在线调整并下发 |
| **Memory** | 基于 `/telemetry` 展示向量与 Payload 的存储占用、分片明细 |
| **ANN Recall** | 对采样点做精确检索 vs 近似检索，测量 Top-K 召回率与提速倍数 |
| **Snapshots** | 创建 / 下载 / 删除快照，或上传快照恢复到当前集合 |
| **Graph** | 从一个点出发展开最近邻，连边按相似度着色，点击节点继续扩展 |

## 目录结构

```
server/         BFF：登录、Session、Qdrant / Embed 代理、RBAC
src/
  lib/          qdrant.ts、embed.ts、config.ts、format.ts …
  hooks/        useQdrant.ts、useAuth.tsx、useConnection.ts …
  components/
    layout/     Sidebar、SettingsDialog
    ui/         Button、Dialog、Toast、fields …
  pages/        集合列表、详情与各标签页
scripts/        init-users、set-password、mock-embed-server
```

## 说明与后续

- **ANN Recall** 为客户端测算：对样本逐个发起精确与近似检索并对比，样本量越大越准、越慢。
- **Memory** 的字节数来自 Qdrant 遥测，字段随版本略有差异；若某版本未上报，会给出相应提示。
- 侧栏中的**教程**、**数据集**为后续规划入口，当前为锁定占位。
