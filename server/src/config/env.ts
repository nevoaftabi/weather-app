import dotenv from "dotenv";
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function envOr(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function intOr(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : fallback;
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  PORT: requireEnv("PORT"),
  WEATHER_API_KEY: requireEnv("WEATHER_API_KEY"),
  REDIS_URL: requireEnv("REDIS_URL"),
  WEATHER_TTL_SECONDS: intOr("WEATHER_TTL_SECONDS", 600),
  ACCESS_SECRET: requireEnv("ACCESS_SECRET"),
  REFRESH_SECRET: requireEnv("REFRESH_SECRET"),
  ACCESS_EXPIRES: requireEnv("ACCESS_EXPIRES"),
  REFRESH_DAYS: requireEnv("REFRESH_DAYS"),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  NODE_ENV: requireEnv("NODE_ENV")
};
