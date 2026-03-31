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
  REDIS_URL: process.env.REDIS_URL ?? "",
  WEATHER_TTL_SECONDS: intOr("WEATHER_TTL_SECONDS", 600),
  NODE_ENV: envOr("NODE_ENV", "development"),
  GMAIL_USER: requireEnv("GMAIL_USER"),
  GMAIL_APP_PASSWORD: requireEnv("GMAIL_APP_PASSWORD"),
  MAIL_FROM: envOr("MAIL_FROM", requireEnv("GMAIL_USER")),
  VERIFICATION_CODE_TTL_MINUTES: intOr("VERIFICATION_CODE_TTL_MINUTES", 15),
  CLIENT_ORIGINS: envOr("CLIENT_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"),
};
