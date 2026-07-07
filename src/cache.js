import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_DB = parseInt(process.env.REDIS_DB || '1', 10);
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '60', 10); // 60s default

let redis = null;
let redisEnabled = true;

function getRedis() {
  if (redis) return redis;
  if (!redisEnabled) return null;

  try {
    redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD || undefined,
      db: REDIS_DB,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('[Cache] Redis unavailable after 3 retries, disabling cache');
          redisEnabled = false;
          redis = null;
          return null; // stop retrying
        }
        return Math.min(times * 200, 1000);
      },
      maxRetriesPerRequest: 1,
    });

    redis.on('error', (err) => {
      console.warn(`[Cache] Redis error: ${err.message}, disabling cache`);
      redisEnabled = false;
      redis = null;
    });

    return redis;
  } catch (err) {
    console.warn(`[Cache] Failed to connect Redis: ${err.message}, running without cache`);
    redisEnabled = false;
    return null;
  }
}

/**
 * Get cached list of all sentences (for random pick).
 * Cache key includes type filter.
 */
export async function getCachedSentences(type) {
  const client = getRedis();
  if (!client) return null;

  const key = type ? `glean:list:${type}` : 'glean:list:all';
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Cache the full list of sentences for random pick.
 */
export async function setCachedSentences(type, data) {
  const client = getRedis();
  if (!client) return;

  const key = type ? `glean:list:${type}` : 'glean:list:all';
  try {
    await client.setex(key, CACHE_TTL, JSON.stringify(data));
  } catch {
    // silently fail
  }
}

/**
 * Invalidate all glean cache keys (on CRUD operations).
 */
export async function invalidateCache() {
  const client = getRedis();
  if (!client) return;

  try {
    // Scan for all glean:* keys and delete them
    let cursor = '0';
    do {
      const result = await client.scan(cursor, 'MATCH', 'glean:*', 'COUNT', 50);
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
    console.log('[Cache] Invalidated all glean cache keys');
  } catch {
    // silently fail
  }
}

/**
 * Get cache status info
 */
export function getCacheStatus() {
  return {
    enabled: redisEnabled,
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: REDIS_DB,
    ttl: CACHE_TTL,
  };
}
