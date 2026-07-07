import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from '@hono/node-server/serve-static';
import { getDb, getAllSentences, getRandomSentence, getSentenceById, createSentence, updateSentence, deleteSentence, getStats } from './db.js';
import { getCachedSentences, setCachedSentences, invalidateCache, getCacheStatus } from './cache.js';
import { getCategories } from './categories.js';
import { getSiteInfo } from './site.js';
import { authMiddleware, handleLogin, handleVerify, checkAuthSecurity } from './auth.js';
import { rateLimitMiddleware, getSecurityStatus, getClientDebugInfo } from './security.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = parseInt(process.env.PORT || '6689', 10);
const CACHE_SIZE = parseInt(process.env.CACHE_SIZE || '5000', 10);
// ---- Helper: map DB glean field to API content key ----
function mapSentence(s) {
  if (!s) return s;
  const { content, ...rest } = s;
  return { content: content || '', ...rest };
}


// ---- Startup security checks (may exit on insecure defaults) ----
checkAuthSecurity();

// Init DB on startup
getDb();
console.log('[DB] SQLite initialized');

const app = new Hono();

// ---- Security headers (applied to every response) ----
app.use('*', secureHeaders());

// ---- Global: ensure all JSON responses carry charset=utf-8 (mobile/iOS compat) ----
// Some strict clients (notably iOS Safari/WKWebView) render multibyte JSON as
// garbage when the response omits an explicit charset. Hono's c.json() emits a
// bare `application/json`, so we normalize any JSON content-type that lacks a
// charset. Matching by prefix (not exact equality) keeps this robust to casing
// and to future middleware that might tweak the header.
app.use('*', async (c, next) => {
  await next();
  const ct = c.res.headers.get('content-type');
  if (ct && ct.toLowerCase().startsWith('application/json') && !/charset=/i.test(ct)) {
    c.res.headers.set('content-type', 'application/json; charset=utf-8');
  }
});

app.use('*', compress());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ---- Rate limiting (all API routes, incl. public /api/random) ----
app.use('/api/*', rateLimitMiddleware());

// ---- Auth Middleware (protects all /api/* routes except public ones) ----
app.use('/api/*', authMiddleware());

// ---- Auth Routes (public) ----

// POST /api/auth/login — 登录
app.post('/api/auth/login', handleLogin);

// POST /api/auth/verify — 验证令牌（页面刷新时用）
app.post('/api/auth/verify', handleVerify);

// GET /api/whoami — 诊断：回显代理转发的头与解析出的真实 IP（默认关闭）
// 部署后临时开启 WHOAMI_ENABLED=true，从外网(如手机4G)访问一次以确认反代配置，
// 确认无误后请关闭。只暴露访问者自己的 IP，无敏感信息。
app.get('/api/whoami', (c) => {
  if (process.env.WHOAMI_ENABLED !== 'true') {
    return c.json({ code: 404, message: 'Not Found' }, 404);
  }
  return c.json({ code: 200, data: getClientDebugInfo(c) });
});

// ---- API Routes (all protected by authMiddleware) ----

// GET /api/random — 核心随机句子（公开，middleware已放行）
app.get('/api/random', async (c) => {
  const type = c.req.query('type');
  const format = c.req.query('format') || 'json';
  const cacheStatus = getCacheStatus();
  const redisOn = cacheStatus.enabled;

  // Try cache first
  let sentences = null;
  if (!type) {
    sentences = await getCachedSentences(null);
  } else {
    sentences = await getCachedSentences(type);
  }

  // Cache miss — fetch from DB
  if (sentences) {
    console.log(
      `[Cache] HIT  ${c.req.method} ${c.req.path}  type=${type || 'all'}  redis:enabled`
    );
  } else {
    if (redisOn) {
      console.log(
        `[Cache] MISS ${c.req.method} ${c.req.path}  type=${type || 'all'}  fetching from SQLite`
      );
    } else {
      console.log(
        `[SQLite] QUERY ${c.req.method} ${c.req.path}  type=${type || 'all'}  (Redis disabled)`
      );
    }

    const result = getAllSentences({ type, size: CACHE_SIZE });
    sentences = result.data;
    // Cache for next time
    await setCachedSentences(type || null, sentences);
  }

  if (!sentences || sentences.length === 0) {
    return c.json({ code: 404, message: '暂无句子数据，请先添加句子' }, 404);
  }

  const pick = sentences[Math.floor(Math.random() * sentences.length)];

  if (format === 'text') {
    c.header('Content-Type', 'text/plain; charset=utf-8');
    c.header('Cache-Control', 'no-cache');
    return c.body(pick.content); // text format keeps raw
  }

  const response = {
    id: pick.id,
    content: pick.content,
    type: pick.type,
    from: pick.from_source,
    from_who: pick.from_who,
    created_at: pick.created_at,
    length: pick.content.length,
  };
  return c.json(response);
});

// GET /api/sentences — 句子列表（分页+搜索）
app.get('/api/sentences', (c) => {
  const type = c.req.query('type');
  const keyword = c.req.query('keyword');
  const page = parseInt(c.req.query('page') || '1', 10);
  const size = parseInt(c.req.query('size') || '20', 10);

  const result = getAllSentences({ type, keyword, page, size });
  const mapped = { ...result, data: result.data.map(mapSentence) };
  return c.json({ code: 200, ...mapped });
});

// GET /api/sentences/:id — 单条句子详情
app.get('/api/sentences/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const sentence = getSentenceById(id);
  if (!sentence) return c.json({ code: 404, message: '未找到该句子' }, 404);
  return c.json({ code: 200, data: mapSentence(sentence) });
});

// POST /api/sentences — 新增句子
app.post('/api/sentences', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ code: 400, message: '无效的 JSON 请求体' }, 400);
  }

  const content = body.content;
  if (!content || !content.trim()) {
    return c.json({ code: 400, message: '句子内容不能为空' }, 400);
  }

  // Default to a real configured category (prefer 其他) so it isn't orphaned
  // from the filter / tag colors.
  const cats = getCategories();
  const defaultType = cats.includes('其他') ? '其他' : (cats[0] || '其他');

  const sentence = createSentence({
    content: content.trim(),
    type: body.type || defaultType,
    from_source: body.from_source || '',
    from_who: body.from_who || '',
  });

  // Invalidate cache
  await invalidateCache();

  return c.json({ code: 200, message: '添加成功', data: mapSentence(sentence) });
});

// PUT /api/sentences/:id — 编辑句子
app.put('/api/sentences/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ code: 400, message: '无效的 JSON 请求体' }, 400);
  }

  const contentVal = body.content;
  // If content is provided, it must not be blank (mirrors POST validation).
  if (contentVal !== undefined && !String(contentVal).trim()) {
    return c.json({ code: 400, message: '句子内容不能为空' }, 400);
  }
  const updated = updateSentence(id, {
    content: contentVal !== undefined ? String(contentVal).trim() : undefined,
    type: body.type,
    from_source: body.from_source,
    from_who: body.from_who,
  });

  if (!updated) return c.json({ code: 404, message: '未找到该句子' }, 404);

  // Invalidate cache
  await invalidateCache();

  return c.json({ code: 200, message: '更新成功', data: mapSentence(updated) });
});

// DELETE /api/sentences/:id — 删除句子
app.delete('/api/sentences/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const deleted = deleteSentence(id);

  if (!deleted) return c.json({ code: 404, message: '未找到该句子' }, 404);

  // Invalidate cache
  await invalidateCache();

  return c.json({ code: 200, message: '删除成功' });
});

// GET /api/stats — 统计信息
app.get('/api/stats', (c) => {
  const stats = getStats();
  const cacheStatus = getCacheStatus();
  return c.json({ code: 200, stats, cache: cacheStatus, security: getSecurityStatus() });
});

// GET /api/categories — 分类列表
app.get('/api/categories', (c) => {
  return c.json({ code: 200, data: getCategories() });
});

// GET /api/site-info — 站点配置（公开）
app.get('/api/site-info', (c) => {
  return c.json({ code: 200, data: getSiteInfo() });
});

// ---- Static files (Web UI) ----
app.use('/*', serveStatic({
  root: PUBLIC_DIR,
}));

// Fallback to index.html for SPA-style routing
app.get('*', (c) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    c.header('Content-Type', 'text/html; charset=utf-8');
    return c.body(fs.readFileSync(indexPath, 'utf-8'));
  }
  return c.text('404 Not Found', 404);
});

// ---- Start ----
serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  const sec = getSecurityStatus();
  console.log(`[Server] 🚀 拾句 running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] 📖 API: /api/random  |  Admin: /`);
  console.log(`[Server] 💾 Redis cache: DB ${getCacheStatus().db}`);
  console.log(`[Server] 🔐 Auth enabled  |  brute-force lockout: ${sec.loginLockout.enabled ? `on (${sec.loginLockout.maxFails} fails / ${sec.loginLockout.window}s)` : 'off'}`);
  console.log(`[Server] 🚦 Rate limit: ${sec.rateLimit.enabled ? `${sec.rateLimit.max} req / ${sec.rateLimit.window}s per IP` : 'off'}  |  trust proxy: ${sec.trustProxy}`);
});
