# Qdrant 控制台

一个直连 Qdrant REST API 的向量集合管理台。界面全中文，简洁大气，专注于集合管理，并为后续的教程、数据集等模块预留了入口。

官方 Web UI 信息密集、样式朴素；本项目用一套"冷色仪表台"视觉语言重做，招牌元素是贯穿全站的**相似度热力刻度**（近/相似 = 暖金，远 = 冷蓝），在相似度分数、ANN 召回、图谱连边上一致复用。

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS v4（CSS-first 设计 token）
- TanStack Query（数据获取与缓存）
- React Router（路由）
- Radix Dialog（无障碍弹窗）
- react-force-graph-2d（相似度图谱，按需加载）
- 字体：Space Grotesk / IBM Plex Sans / IBM Plex Mono（通过 Google Fonts 加载）

无需后端：浏览器直接调用 Qdrant REST API。

## 前置条件

- 一个可访问的 Qdrant 实例（默认 `http://localhost:6333`）。
- Qdrant 默认已开启 CORS，浏览器可直连；若自定义配置关闭了 CORS，请重新开启。

## 启动

```bash
npm install
npm run dev        # 开发服务器，默认 http://localhost:5714
```

构建与预览：

```bash
npm run build      # 产物输出到 dist/
npm run preview    # 本地预览构建产物
```

## 连接配置

- 默认连接 `http://localhost:6333`。
- 点击左下角"连接设置"可修改**服务地址**与**API Key**（可选），并"测试连接"。
- 配置保存在浏览器 `localStorage`，可随时切换到远程实例。

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
src/
  lib/          qdrant.ts（REST 客户端）、config.ts（连接配置）、format.ts（格式化与热力配色）
  hooks/        useQdrant.ts（查询/变更 hooks）、useConnection.ts（探活）
  components/
    layout/     Sidebar、SettingsDialog
    ui/         Button、Dialog、Toast、fields、primitives、heat、JsonView、icons…
  pages/
    CollectionsPage.tsx          集合列表
    CollectionDetailPage.tsx     详情外壳与标签导航
    tabs/                        Points / Optimizations / Memory / Recall / Snapshots / Graph
    dialogs/                     创建集合、上传快照
```

## 说明与后续

- **ANN Recall** 为客户端测算：对样本逐个发起精确与近似检索并对比，样本量越大越准、越慢。
- **Memory** 的字节数来自 Qdrant 遥测，字段随版本略有差异；若某版本未上报，会给出相应提示。
- 侧栏中的**教程**、**数据集**为后续规划入口，当前为锁定占位。
