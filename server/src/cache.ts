import { redis } from "./redis";

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  if (!redis) {
    return null;
  }

  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    // cache errors should never fail API responses
    try {
      await redis.del(key);
    } catch {
      // no-op
    }
    return null;
  }
}

export async function cacheSetJson<T>(key: string, value: T, ttlSeconds: number) {
  if (!redis) {
    return;
  }

  try {
    // Set value with TTL
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // cache errors should never fail API responses
  }
}
