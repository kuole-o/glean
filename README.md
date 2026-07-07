# 拾句 · Glean

> **拾取散落的好句。** — *Glean: to collect information in small amounts and often with difficulty.*

[![Docker](https://img.shields.io/badge/docker-ready-2496ed?logo=docker)](https://www.docker.com/)
[![Node](https://img.shields.io/badge/node-20-339933?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

拾句是一个轻量的句子管理服务，提供 **随机句子 API** 和 **Web 管理界面**，让你可以随时收藏、管理、消费自己喜爱的句子。

---

## 项目由来

「拾句」—— 拾取散落的好句。**Glean**，意为从各处精心收集有价值的信息碎片。

项目灵感来自市面上常见的「随机一句」服务。这类服务创意很好，但公共内容质量参差不齐——偶尔会遇到画风过于中二或不知所云的句子。拾句的初衷很简单：**建设私人文案摘选库**

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
npm install                       # 安装后端依赖
npm run build                     # 构建前端到 public/（首次或前端有改动时必须执行）
AUTH_PASSWORD=你的密码 npm start   # 服务运行在 http://localhost:6689

# 或一步到位：构建 + 启动
AUTH_PASSWORD=你的密码 npm run build:start
```

> 说明：前端构建产物 `public/` 不纳入版本控制，由 `npm run build` 生成；Docker 部署会在镜像内自动构建，无需手动执行。默认密码为 `666`，服务仍可启动但会打印安全告警，建议通过 `AUTH_PASSWORD` 设置一个强密码（详见下方环境变量）。

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
    "content": "生活就像骑绿道，上坡累成狗，下坡爽翻天。",
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
| `CACHE_SIZE` | `5000` | 随机句子缓存最大条数，超出部分不进入随机池 |
| `CACHE_TTL` | `60` | 缓存有效期（秒） |

### 安全相关（公网部署建议配置）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AUTH_USERNAME` | `root` | 管理后台用户名 |
| `AUTH_PASSWORD` | `666` | 管理后台密码。使用默认值时服务仍会启动，但会打印安全告警，公网部署务必设置强密码 |
| `JWT_SECRET` | 随机生成 | 令牌签名密钥。不设置则每次重启失效所有登录，公网务必固定 |
| `TOKEN_EXPIRY` | `24h` | 登录令牌有效期 |
| `TRUST_PROXY` | `false` | 简单模式：无条件信任 `X-Forwarded-For` / `X-Real-IP`。仅在你确信 glean 端口不暴露、只有反代能访问时使用 |
| `TRUSTED_PROXY_IPS` | — | **推荐**：可信反代 IP/网段列表（逗号分隔，如 `192.168.1.1,172.16.0.0/12`）。仅当直连来源在此列表内才采信转发头，可防局域网内伪造。反代部署必填 |
| `WHOAMI_ENABLED` | `false` | 诊断开关。设为 `true` 时开放 `GET /api/whoami` 回显代理转发的头与解析出的真实 IP，用于确认反代配置；确认后请关闭 |
| `RATE_LIMIT_ENABLED` | `true` | 是否启用全局接口限流（含随机文案接口） |
| `RATE_LIMIT_WINDOW` | `60` | 限流时间窗口（秒） |
| `RATE_LIMIT_MAX` | `120` | 单个 IP 在窗口内的最大请求数，超出返回 429 |
| `LOGIN_LOCKOUT_ENABLED` | `true` | 是否启用登录暴力破解锁定 |
| `LOGIN_MAX_FAILS` | `5` | 登录连续失败次数达到此值后锁定该 IP |
| `LOGIN_LOCKOUT_WINDOW` | `900` | 锁定时长（秒），默认 15 分钟 |

## 部署

### Docker Compose（推荐）

参考：[compose.example.yaml](https://github.com/kuole-o/glean/blob/main/compose.example.yaml)

### 数据持久化

SQLite 数据库文件存储在 `./data/glean.db`，通过 Docker volume 挂载到容器内 `/app/data` 目录。删除容器后重新挂载同一目录即可恢复数据。

## 技术栈

- **后端：** Node.js 20 + [Hono.js](https://hono.dev/) — 轻量、高性能 Web 框架
- **数据库：** SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)) — 零配置，ACID 保障
- **缓存：** Redis ([ioredis](https://github.com/redis/ioredis)) — 可选加速
- **前端：** Vue 3 + Vite — 单页应用，构建工具自动化打包
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
