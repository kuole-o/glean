import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { serveStatic } from '@hono/node-server/serve-static';
import { getDb, getAllSentences, getRandomSentence, getSentenceById, createSentence, updateSentence, deleteSentence, getStats } from './db.js';
import { getCachedSentences, setCachedSentences, invalidateCache, getCacheStatus } from './cache.js';
import { getCategories } from './categories.js';
import { getSiteInfo } from './site.js';
import { authMiddleware, handleLogin, handleVerify } from './auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = parseInt(process.env.PORT || '6689', 10);
// ---- Helper: map DB hitokoto field to API content key ----
function mapSentence(s) {
  if (!s) return s;
  const { hitokoto, ...rest } = s;
  return { content: hitokoto || '', ...rest };
}


// Init DB on startup
getDb();
console.log('[DB] SQLite initialized');

const app = new Hono();

app.use('*', compress());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ---- Auth Middleware (protects all /api/* routes except public ones) ----
app.use('/api/*', authMiddleware());

// ---- Auth Routes (public) ----

// POST /api/auth/login — 登录
app.post('/api/auth/login', handleLogin);

// POST /api/auth/verify — 验证令牌（页面刷新时用）
app.post('/api/auth/verify', handleVerify);

// ---- API Routes (all protected by authMiddleware) ----

// GET /api/random — 核心随机一言（公开，middleware已放行）
app.get('/api/random', async (c) => {
  const type = c.req.query('type');
  const format = c.req.query('format') || 'json';

  // Try cache first
  let sentences = null;
  if (!type) {
    sentences = await getCachedSentences(null);
  } else {
    sentences = await getCachedSentences(type);
  }

  // Cache miss — fetch from DB
  if (!sentences) {
    const result = getAllSentences({ type, size: 99999 });
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
    return c.body(pick.hitokoto); // text format keeps raw
  }

  const response = {
    id: pick.id,
    content: pick.hitokoto,
    type: pick.type,
    from: pick.from_source,
    from_who: pick.from_who,
    created_at: pick.created_at,
    length: pick.hitokoto.length,
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

  const content = body.content || body.hitokoto;
  if (!content || !content.trim()) {
    return c.json({ code: 400, message: '句子内容不能为空' }, 400);
  }

  const sentence = createSentence({
    hitokoto: content.trim(),
    type: body.type || 'other',
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

  const contentVal = body.content ?? body.hitokoto;
  const updated = updateSentence(id, {
    hitokoto: contentVal?.trim(),
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
  return c.json({ code: 200, stats, cache: cacheStatus });
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
  console.log(`[Server] 🚀 拾句 running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] 📖 API: /api/random  |  Admin: /`);
  console.log(`[Server] 💾 Redis cache: DB ${getCacheStatus().db}`);
  console.log(`[Server] 🔐 Auth enabled (default: root / 666)`);
});
