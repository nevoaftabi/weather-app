import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";

import { WeatherApi, Units } from "./services/weatherApi";
import { HttpError } from "./HttpError";
import { env } from "./config/env";
import { connectRedis } from "./redis";

import { pool } from "./db";
import { newRefreshToken, sha256 } from "./tokens";

const app = express();
const weatherApi = new WeatherApi();

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: ["http://127.0.0.1:5173", "http://localhost:5173"],
    credentials: true,
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Too many requests. Try again later." });
  },
});

app.use(apiLimiter);

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[ROUTER] ${req.method} ${req.url}`);
  next();
});

const ACCESS_SECRET = env.ACCESS_SECRET;
const ACCESS_EXPIRES: jwt.SignOptions["expiresIn"] = "10m";
const REFRESH_DAYS = 14;

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  token_version: number;
};

type UserPublicRow = {
  id: string;
  email: string;
  token_version: number;
};

type RefreshSessionRow = {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
};

type RegisterBody = {
  email?: unknown;
  password?: unknown;
};

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

type AccessTokenClaims = jwt.JwtPayload & {
  sub: string;
  email: string;
  tokenVersion: number;
};

type AuthedRequest = Request & {
  user: AccessTokenClaims;
};

function signAccessToken(user: UserPublicRow): string {
  return jwt.sign(
    { sub: user.id, email: user.email, tokenVersion: user.token_version },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  const isProd = env.NODE_ENV === "production";

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProd,        // requires https in prod
    sameSite: "lax",       // if API+client are on different domains in prod, you may need "none" + secure true
    path: "/auth/refresh", // cookie only sent to refresh endpoint
  });
}

const credentialsSchema = z.object({
  email: z.preprocess(
    (raw) => String(raw ?? "").trim().toLowerCase(),
    z.string().min(1, "email is required.")
  ),
  password: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z.string().min(1, "password is required.")
  ),
});

const weatherQuerySchema = z.object({
  city: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z.string().min(1, "city is required.")
  ),
  state: z.preprocess(
    (raw) => String(raw ?? "").trim().toUpperCase(),
    z
      .string()
      .regex(/^[A-Z]{2}$/, "state must be a 2-letter code (e.g., TX).")
  ),
  units: z.preprocess(
    (raw) => String(raw ?? "metric").trim().toLowerCase(),
    z.enum(["metric", "imperial"], {
      error: "Invalid units. Use 'metric' or 'imperial'.",
    })
  ),
});

function parseOrBadRequest<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Bad request";
    throw new HttpError(400, message);
  }
  return parsed.data;
}

app.post("/auth/register", async (req: Request<{}, {}, RegisterBody>, res: Response) => {
  const { email, password } = parseOrBadRequest(credentialsSchema, req.body);

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query<Pick<UserRow, "id" | "email" | "token_version">>(
    "insert into users (email, password_hash) values ($1, $2) returning id, email, token_version",
    [email, passwordHash]
  );

  const u = result.rows[0];
  res.status(201).json({ id: u.id, email: u.email });
});

app.post("/auth/login", async (req: Request<{}, {}, LoginBody>, res: Response) => {
  const { email, password } = parseOrBadRequest(credentialsSchema, req.body);

  const userRes = await pool.query<UserRow>(
    "select id, email, password_hash, token_version from users where email = $1",
    [email]
  );

  const user = userRes.rows[0];
  if (!user) return res.sendStatus(401);

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.sendStatus(401);

  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    token_version: user.token_version,
  });

  const refreshToken = newRefreshToken();
  const refreshHash = sha256(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `insert into refresh_sessions (user_id, refresh_token_hash, expires_at, user_agent, ip)
     values ($1, $2, $3, $4, $5)`,
    [user.id, refreshHash, expiresAt, req.get("user-agent") ?? null, req.ip]
  );

  setRefreshCookie(res, refreshToken);
  res.json({ accessToken });
});

app.post("/auth/refresh", async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token as string | undefined;
  if (!token) return res.sendStatus(401);

  const tokenHash = sha256(token);

  const sessRes = await pool.query<RefreshSessionRow>(
    `select id, user_id, expires_at, revoked_at
     from refresh_sessions
     where refresh_token_hash = $1`,
    [tokenHash]
  );

  const sess = sessRes.rows[0];
  if (!sess) return res.sendStatus(401);
  if (sess.revoked_at) return res.sendStatus(401);
  if (new Date(sess.expires_at).getTime() < Date.now()) return res.sendStatus(401);

  const userRes = await pool.query<UserPublicRow>(
    "select id, email, token_version from users where id = $1",
    [sess.user_id]
  );

  const user = userRes.rows[0];
  if (!user) return res.sendStatus(401);

  // rotate refresh token
  const rotatedToken = newRefreshToken();
  const rotatedHash = sha256(rotatedToken);
  const rotatedExpiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

  await pool.query("begin");
  try {
    await pool.query(
      `update refresh_sessions
       set revoked_at = now(), replaced_by_hash = $2
       where id = $1`,
      [sess.id, rotatedHash]
    );

    await pool.query(
      `insert into refresh_sessions (user_id, refresh_token_hash, expires_at, user_agent, ip)
       values ($1, $2, $3, $4, $5)`,
      [user.id, rotatedHash, rotatedExpiresAt, req.get("user-agent") ?? null, req.ip]
    );

    await pool.query("commit");
  } catch {
    await pool.query("rollback");
    return res.sendStatus(500);
  }

  setRefreshCookie(res, rotatedToken);

  const accessToken = signAccessToken(user);
  res.json({ accessToken });
});

app.post("/auth/logout", async (req: Request, res: Response) => {
  const token = req.cookies?.refresh_token as string | undefined;

  if (token) {
    await pool.query(
      "update refresh_sessions set revoked_at = now() where refresh_token_hash = $1",
      [sha256(token)]
    );
  }

  res.clearCookie("refresh_token", { path: "/auth/refresh" });
  res.sendStatus(204);
});

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.header("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, ACCESS_SECRET);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (typeof payload === "string" || typeof payload.sub !== "string") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  (req as AuthedRequest).user = payload as AccessTokenClaims;
  next();
}

async function ensureWeatherHistoryTable() {
  await pool.query(`
    create table if not exists weather_history (
      id bigserial primary key,
      user_id uuid not null references users(id) on delete cascade,
      result jsonb not null,
      requested_at timestamptz not null default now()
    )
  `);
}

app.get("/api/weather", requireAuth, async (req: Request, res: Response) => {
  try {
    const { city, state, units } = parseOrBadRequest(weatherQuerySchema, req.query) as {
      city: string;
      state: string;
      units: Units;
    };

    const data = await weatherApi.getWeather(env.WEATHER_API_KEY, city, state, units);

    await pool.query(
      "insert into weather_history (user_id, result) values ($1, $2::jsonb)",
      [(req as AuthedRequest).user.sub, JSON.stringify(data)]
    );

    return res.json(data);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/weather/history", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query<{
      id: string;
      requested_at: Date;
      result: unknown;
    }>(
      `select id, requested_at, result
       from weather_history
       where user_id = $1
       order by requested_at desc
       limit 100`,
      [(req as AuthedRequest).user.sub]
    );

    return res.json(
      result.rows.map((row) => ({
        id: row.id,
        requestedAt: row.requested_at,
        result: row.result,
      }))
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

async function start() {
  await ensureWeatherHistoryTable();
  await connectRedis();
  app.listen(Number(env.PORT), () => {
    console.log(`Listening on port ${env.PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
