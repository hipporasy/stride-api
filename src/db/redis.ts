import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

// Adapts ioredis to the redis v4 interface expected by connect-redis v8
export const redisStoreClient = {
  get: (key: string) => redis.get(key),
  set: (key: string, value: string, options?: { EX?: number }) => {
    if (options?.EX) return redis.set(key, value, 'EX', options.EX);
    return redis.set(key, value);
  },
  expire: (key: string, ttl: number) => redis.expire(key, ttl),
  del: (key: string | string[]) =>
    Array.isArray(key) ? redis.del(...key) : redis.del(key),
  mget: (...keys: string[]) => redis.mget(keys),
  keys: (pattern: string) => redis.keys(pattern),
};
