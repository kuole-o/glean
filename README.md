# 拾句 · Glean

> **拾取散落的好句。** — *Glean: to collect information in small amounts and often with difficulty.*

[![Docker](https://img.shields.io/badge/docker-ready-2496ed?logo=docker)](https://www.docker.com/)
[![Node](https://img.shields.io/badge/node-20-339933?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

拾句是一个轻量的句子管理服务，提供 **随机句子 API** 和 **Web 管理界面**，让你可以随时收藏、管理、消费自己喜爱的句子。

---

## 项目由来

「拾句」—— 拾取散落的好句。**Glean**，意为从各处精心收集有价值的信息碎片。

项目灵感来自 [一言 (Hitokoto)](https://hitokoto.cn)。一言的创意很好，但内容质量参差不齐——偶尔会遇到画风过于中二或不知所云的句子。拾句的初衷很简单：**建设私人文案摘选库**

## 功能特性

- 🎯 **随机句子 API** — 支持 JSON 和纯文本 (`format=text`) 两种格式
- 📂 **完整 CRUD** — 新增、编辑、删除、查询句子
- 🔍 **搜索与分类** — 按内容、出处、作者搜索，按分类筛选
- 🖥 **Web 管理界面** — 暗色主题，无需额外工具，浏览器打开即可管理
- ⚡ **Redis 缓存** — 可选 Redis 加速，支持 DB 隔离
- 🐳 **Docker 容器化** — 一键部署，开箱即用
- 🗄️ **SQLite 持久化** — 零配置本地数据库，ACID 事务保障

## 快速开始

### 使用 Docker

```bash
# 1. 克隆仓库
git clone https://github.com/kuole-o/glean.git
cd glean

# 2. 构建并启动
docker compose up -d

# 3. 打开管理界面
# http://localhost:37292
```

### 手动启动

```bash
# 需要 Node.js 20+
npm install
npm start
# 服务运行在 http://localhost:6689
```

## API 文档

### 随机句子

```
GET /api/random
```

**参数：**

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `format` | `json` / `text` | 返回格式 | `json` |
| `type` | `string` | 按分类筛选（逗号分隔多个） | 不筛选 |

**示例：**

```bash
# JSON 格式（默认）
curl http://localhost:37292/api/random

# 纯文本格式
curl "http://localhost:37292/api/random?format=text"

# 按分类筛选
curl "http://localhost:37292/api/random?type=原创"

# 纯文本 + 分类
curl "http://localhost:37292/api/random?type=文学&format=text"
```

**JSON 响应：**

```json
{
  "id": 2,
  "content": "生活就像骑绿道，上坡累成狗，下坡爽翻天。",
  "type": "原创",
  "from": "骑行日记",
  "from_who": "郭乐",
  "created_at": "2026-07-07 02:05:39",
  "length": 20
}
```

### 句子管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/sentences` | 句子列表（分页 + 搜索 + 分类筛选） |
| `GET` | `/api/sentences/:id` | 单条句子详情 |
| `POST` | `/api/sentences` | 新增句子 |
| `PUT` | `/api/sentences/:id` | 编辑句子 |
| `DELETE` | `/api/sentences/:id` | 删除句子 |
| `GET` | `/api/stats` | 统计信息 |

**列表参数：** `page`、`size`、`keyword`、`type`

### 新增句子示例

```bash
curl -X POST http://localhost:37292/api/sentences \
  -H "Content-Type: application/json" \
  -d '{
    "hitokoto": "生活就像骑绿道，上坡累成狗，下坡爽翻天。",
    "type": "原创",
    "from_source": "骑行日记",
    "from_who": "郭乐"
  }'
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `6689` | 服务端口 |
| `DATA_DIR` | `./data` | SQLite 数据库目录 |
| `CATEGORIES` | `原创,动画,漫画,游戏,文学,网络,影视,诗词,哲学,抖机灵,其他` | 分类列表，逗号分隔 |
| `CORS_ORIGIN` | `*` | CORS 允许的 API 请求域名 |
| `SITE_COPYRIGHT` | `true` | 版权展示开关，`true` 展示 / `false` 隐藏 |
| `SITE_AUTHOR` | — | 站长/作者名称，不配置或留空则不展示 |
| `SITE_ICP` | — | 网站备案号，不配置则不展示 |
| `SITE_YEAR` | — | 建站年份，不配置则只显示当前年份 |
| `REDIS_HOST` | `127.0.0.1` | Redis 地址（不设置则不启用缓存） |
| `REDIS_PORT` | `6379` | Redis 端口 |
| `REDIS_PASSWORD` | — | Redis 密码 |
| `REDIS_DB` | `1` | Redis 数据库编号 |
| `CACHE_TTL` | `60` | 缓存有效期（秒） |

## 部署

### Docker Compose（推荐）

参考：[compose.example.yaml](https://github.com/kuole-o/glean/blob/main/compose.example.yaml)

### 数据持久化

SQLite 数据库文件存储在 `./data/glean.db`，通过 Docker volume 挂载到容器内 `/app/data` 目录。删除容器后重新挂载同一目录即可恢复数据。

## 技术栈

- **后端：** Node.js 20 + [Hono.js](https://hono.dev/) — 轻量、高性能 Web 框架
- **数据库：** SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)) — 零配置，ACID 保障
- **缓存：** Redis ([ioredis](https://github.com/redis/ioredis)) — 可选加速
- **前端：** 原生 HTML/CSS/JS — 无构建工具，零依赖
- **容器：** Docker — 多阶段构建，镜像约 100MB

## 版本记录

### v1.0 (2026-07-06)

- 初始版本发布
- 随机句子 API（JSON / 纯文本双格式）
- 句子 CRUD 管理
- Web 管理界面
- Redis 缓存支持
- Docker 容器化部署

## License

[MIT](LICENSE)
