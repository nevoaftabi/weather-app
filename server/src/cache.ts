import { redis } from "./redis";

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // bad cache entry, delete it so it doesn't keep breaking
    await redis.del(key);
    return null;
  } 
}

export async function cacheSetJson<T>(key: string, value: T, ttlSeconds: number) {
  // Set value with TTL
  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
}
