import { createClient } from "redis";
import { env } from "./config/env";

export const redis = env.REDIS_URL
  ? createClient({
      url: env.REDIS_URL,
    })
  : null;

if (redis) {
  redis.on("error", (err) => {
    console.error("Redis error:", err);
  });
}

export async function connectRedis() {
  if (!redis) {
    return;
  }

  if (!redis.isOpen) {
    await redis.connect();
  }
}
