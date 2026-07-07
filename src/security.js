import { getConnInfo } from '@hono/node-server/conninfo';

// ============================================================================
// Security: client-IP resolution, rate limiting, and login brute-force lockout.
// All tunables are env-driven so nothing is hardcoded for a public deployment.
// ============================================================================

function envInt(name, def) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : def;
}

function envBool(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  return v === 'true' || v === '1';
}

// ---- Trust proxy / real client IP resolution ----
// Behind a reverse proxy (Lucky on the router, Nginx/Caddy on the NAS), the TCP
// socket the app sees is the proxy's LAN address, not the real visitor. Rate
// limiting and brute-force lockout are meaningless unless we recover the real
// client IP — but we must ONLY trust forwarded headers when the immediate hop
// is a proxy we actually trust, otherwise any visitor can spoof the header to
// bypass limits.
//
// TRUSTED_PROXY_IPS: comma-separated list of proxy IPs / CIDRs (e.g.
//   "192.168.1.1,127.0.0.1,172.16.0.0/12"). When the direct socket peer is in
//   this set, we read the forwarded headers; otherwise we use the socket IP as-is.
// TRUST_PROXY=true (legacy/simple): trust forwarded headers regardless of peer.
const TRUST_PROXY = envBool('TRUST_PROXY', false);
const TRUSTED_PROXY_IPS = (process.env.TRUSTED_PROXY_IPS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// Normalize IPv4-mapped IPv6 (::ffff:192.168.1.1) down to plain IPv4.
function normalizeIp(ip) {
  if (!ip) return ip;
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return m ? m[1] : ip;
}

// Minimal IPv4 CIDR / exact match. IPv6 is matched exactly (no range) — enough
// for a home NAS where the trusted proxy is a fixed LAN IPv4.
function ipMatches(ip, ruleRaw) {
  const rule = ruleRaw.trim();
  if (!rule) return false;
  if (!rule.includes('/')) return ip === rule;
  const [base, bitsStr] = rule.split('/');
  const bits = parseInt(bitsStr, 10);
  const toInt = (s) => {
    const p = s.split('.');
    if (p.length !== 4) return null;
    return ((+p[0] << 24) | (+p[1] << 16) | (+p[2] << 8) | +p[3]) >>> 0;
  };
  const a = toInt(ip), b = toInt(base);
  if (a === null || b === null || !(bits >= 0 && bits <= 32)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}

function isTrustedProxy(ip) {
  const norm = normalizeIp(ip);
  return TRUSTED_PROXY_IPS.some(rule => ipMatches(norm, rule));
}

// Return the raw socket peer IP (the direct TCP connection), before any header.
function getSocketIp(c) {
  try {
    return normalizeIp(getConnInfo(c).remote.address) || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function getClientIp(c) {
  const socketIp = getSocketIp(c);
  const peerTrusted = TRUST_PROXY || isTrustedProxy(socketIp);
  if (!peerTrusted) {
    // Direct connection (or an untrusted peer) — never trust forwarded headers.
    return socketIp;
  }

  // Peer is a trusted proxy. Prefer X-Real-IP (single value, set by the proxy).
  const xreal = c.req.header('x-real-ip');
  if (xreal && xreal.trim()) return normalizeIp(xreal.trim());

  // Otherwise parse X-Forwarded-For = "client, proxy1, proxy2, <trusted>".
  // Walk from the RIGHT, skipping hops we trust, and take the first untrusted
  // address — that's the real client. Taking the leftmost is spoofable because
  // a client can prepend a fake value.
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const chain = xff.split(',').map(s => normalizeIp(s.trim())).filter(Boolean);
    for (let i = chain.length - 1; i >= 0; i--) {
      if (!isTrustedProxy(chain[i])) return chain[i];
    }
    // All hops were trusted proxies — fall back to the leftmost entry.
    if (chain.length) return chain[0];
  }

  // Trusted peer but no usable forwarded header — use the socket IP.
  return socketIp;
}

// ============================================================================
// Generic fixed-window rate limiter (in-memory).
// Suitable for a single-process self-hosted service. For multi-instance, this
// would need Redis — out of scope for the NAS use case.
// ============================================================================
function createRateLimiter({ windowMs, max, enabled, keyPrefix = '' }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Periodic sweep so the Map doesn't grow unbounded from one-off IPs.
  if (enabled && windowMs > 0) {
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [k, v] of hits) {
        if (v.resetAt <= now) hits.delete(k);
      }
    }, Math.max(windowMs, 30_000));
    timer.unref?.();
  }

  return function check(key) {
    if (!enabled) return { limited: false };
    const now = Date.now();
    const k = keyPrefix + key;
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    entry.count++;
    const remaining = Math.max(0, max - entry.count);
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { limited: entry.count > max, remaining, retryAfter, limit: max };
  };
}

// ---- Public API (e.g. /api/random) rate limiter ----
const apiLimiter = createRateLimiter({
  enabled: envBool('RATE_LIMIT_ENABLED', true),
  windowMs: envInt('RATE_LIMIT_WINDOW', 60) * 1000,
  max: envInt('RATE_LIMIT_MAX', 120),
  keyPrefix: 'api:',
});

export function rateLimitMiddleware() {
  return async (c, next) => {
    const ip = getClientIp(c);
    const res = apiLimiter(ip);
    if (res.limited) {
      c.header('Retry-After', String(res.retryAfter));
      return c.json(
        { code: 429, message: '请求过于频繁，请稍后再试' },
        429
      );
    }
    if (res.limit !== undefined) {
      c.header('X-RateLimit-Limit', String(res.limit));
      c.header('X-RateLimit-Remaining', String(res.remaining));
    }
    return await next();
  };
}

// ============================================================================
// Login brute-force protection: lock out an IP after N failed attempts.
// ============================================================================
const LOGIN_ENABLED = envBool('LOGIN_LOCKOUT_ENABLED', true);
const LOGIN_MAX_FAILS = envInt('LOGIN_MAX_FAILS', 5);
const LOGIN_LOCKOUT_SECONDS = envInt('LOGIN_LOCKOUT_WINDOW', 900); // 15 min

const loginFails = new Map(); // ip -> { count, lockedUntil }

{
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of loginFails) {
      if ((v.lockedUntil || 0) <= now && !v.count) loginFails.delete(k);
    }
  }, 60_000);
  timer.unref?.();
}

// Returns { locked, retryAfter } — call BEFORE checking credentials.
export function checkLoginLock(ip) {
  if (!LOGIN_ENABLED) return { locked: false };
  const entry = loginFails.get(ip);
  if (!entry) return { locked: false };
  const now = Date.now();
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { locked: true, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return { locked: false };
}

export function recordLoginFailure(ip) {
  if (!LOGIN_ENABLED) return;
  const now = Date.now();
  let entry = loginFails.get(ip);
  if (!entry || (entry.lockedUntil && entry.lockedUntil <= now)) {
    entry = { count: 0, lockedUntil: 0 };
  }
  entry.count++;
  if (entry.count >= LOGIN_MAX_FAILS) {
    entry.lockedUntil = now + LOGIN_LOCKOUT_SECONDS * 1000;
    entry.count = 0; // reset counter; lock now governs
  }
  loginFails.set(ip, entry);
}

export function recordLoginSuccess(ip) {
  loginFails.delete(ip);
}

export function getSecurityStatus() {
  return {
    trustProxy: TRUST_PROXY,
    trustedProxyIps: TRUSTED_PROXY_IPS,
    rateLimit: {
      enabled: envBool('RATE_LIMIT_ENABLED', true),
      window: envInt('RATE_LIMIT_WINDOW', 60),
      max: envInt('RATE_LIMIT_MAX', 120),
    },
    loginLockout: {
      enabled: LOGIN_ENABLED,
      maxFails: LOGIN_MAX_FAILS,
      window: LOGIN_LOCKOUT_SECONDS,
    },
  };
}

// Diagnostic: shows exactly what the proxy forwarded vs. what we resolved.
// Used by the optional /api/whoami endpoint to confirm the proxy setup.
export function getClientDebugInfo(c) {
  const socketIp = getSocketIp(c);
  return {
    resolvedClientIp: getClientIp(c),
    socketPeerIp: socketIp,
    socketPeerTrusted: TRUST_PROXY || isTrustedProxy(socketIp),
    headers: {
      'x-forwarded-for': c.req.header('x-forwarded-for') || null,
      'x-real-ip': c.req.header('x-real-ip') || null,
      'x-forwarded-host': c.req.header('x-forwarded-host') || null,
      'forwarded': c.req.header('forwarded') || null,
    },
    config: {
      TRUST_PROXY,
      TRUSTED_PROXY_IPS,
    },
  };
}
