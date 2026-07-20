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

#### Docker 构建失败（拉取镜像 EOF / timeout）

报错类似 `auth.docker.io ... i/o timeout` 或 `failed to resolve source metadata for docker.io/...`，是 **访问 Docker Hub 网络不通**（国内较常见）。

项目**默认已改用国内镜像站**拉取 Node 基础镜像（`docker.m.daocloud.io`），请先拉取最新代码后重试：

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

**先单独测试能否拉到基础镜像：**

```bash
docker pull docker.m.daocloud.io/library/node:22-bookworm-slim
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

**说明**：Dockerfile 从 GitHub 下载 Qdrant 二进制，不依赖 `qdrant/qdrant` 镜像；构建阶段 `npm` 默认走 `npmmirror.com`。

## 连接配置

在项目根目录复制并编辑 `.env`（模板见 `.env.example`）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `QDRANT_URL` | Qdrant 地址 | `http://127.0.0.1:6333` |
| `QDRANT_API_KEY` | Qdrant API Key（可选） | 空 |
| `EMBED_URL` | Embedding 服务地址 | `http://127.0.0.1:8765` |
| `EMBED_API_KEY` | Embedding API Key（可选） | 空 |
| `SESSION_SECRET` | Session 签名密钥 | 开发用占位值 |

- 修改 `.env` 后需**重启 BFF** 才生效。
- 向量相关功能（入库、以图搜图）需配置可用的 Embedding 服务；本地开发可运行 `npm run mock:embed`（默认 `8765` 端口）。

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
- 生产环境请同时修改 `.env` 中的 `SESSION_SECRET` 为随机长字符串。

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
