import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ---- Configuration ----
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'root';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '666';

// JWT secret: auto-generated random 32-byte hex, or override via env for persistence
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || '24h';

// ---- Password hashing ----
// salt is derived from JWT_SECRET so it's stable per deployment
const SALT = crypto.createHash('sha256').update('glean:salt:' + JWT_SECRET).digest('hex').slice(0, 32);

function hashPassword(password) {
  return crypto.scryptSync(password, SALT, 64).toString('hex');
}

// Compute the expected hash once at startup
const EXPECTED_PASSWORD_HASH = hashPassword(AUTH_PASSWORD);

// ---- Token management ----
export function generateToken() {
  const payload = {
    username: AUTH_USERNAME,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// ---- Auth middleware for Hono ----
export function authMiddleware() {
  return async (c, next) => {
    // Skip auth for public paths
    const url = c.req.path;
    if (
      url.startsWith('/api/auth/') ||
      url === '/api/random' ||
      url === '/api/site-info'
    ) {
      return await next();
    }

    // Static files are always accessible (login page UI must load)
    if (!url.startsWith('/api/')) {
      return await next();
    }

    // Check Authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ code: 401, message: '未登录，请先登录' }, 401, {
        'WWW-Authenticate': 'Bearer realm="glean admin"',
      });
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return c.json({ code: 401, message: '登录已过期，请重新登录' }, 401);
    }

    // Attach user info to request context
    c.set('user', decoded);
    await next();
  };
}

// ---- Login handler ----
export function handleLogin(c) {
  return c.req.json().then(({ username, password }) => {
    if (!username || !password) {
      return c.json({ code: 400, message: '请输入用户名和密码' }, 400);
    }

    // Constant-time comparison to prevent timing attacks
    const providedHash = hashPassword(password);
    if (
      username !== AUTH_USERNAME ||
      !crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(EXPECTED_PASSWORD_HASH))
    ) {
      return c.json({ code: 401, message: '用户名或密码错误' }, 401);
    }

    const token = generateToken();
    return c.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        username: AUTH_USERNAME,
        expiresIn: TOKEN_EXPIRY,
      },
    });
  }).catch(() => {
    return c.json({ code: 400, message: '无效的请求体' }, 400);
  });
}

// ---- Verify token (for page refresh) ----
export function handleVerify(c) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ code: 401, message: '未登录' }, 401);
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return c.json({ code: 401, message: '令牌无效或已过期' }, 401);
  }

  return c.json({
    code: 200,
    message: '令牌有效',
    data: {
      username: decoded.username,
      role: decoded.role,
    },
  });
}
