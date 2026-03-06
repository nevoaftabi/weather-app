import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { z } from "zod";

import { WeatherApi, Units } from "./services/weatherApi";
import { HttpError } from "./HttpError";
import { env } from "./config/env";
import { connectRedis } from "./redis";

import { pool } from "./db";
import { newRefreshToken, sha256 } from "./tokens";
import { sendFeedbackEmail, sendLoginNotificationEmail, sendPasswordResetEmail, sendVerificationEmail } from "./services/verificationEmail";

const app = express();
const weatherApi = new WeatherApi();

app.set("trust proxy", 1);

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
  email_verified: boolean;
  last_ip: string | null;
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

type VerifyEmailBody = {
  email?: unknown;
  code?: unknown;
};

type RequestPasswordResetBody = {
  email?: unknown;
};

type ResetPasswordBody = {
  email?: unknown;
  code?: unknown;
  newPassword?: unknown;
};

type ChangeEmailBody = {
  newEmail?: unknown;
  currentPassword?: unknown;
};

type FeedbackBody = {
  subject?: unknown;
  body?: unknown;
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

const verifyEmailSchema = z.object({
  email: z.preprocess(
    (raw) => String(raw ?? "").trim().toLowerCase(),
    z.string().min(1, "email is required.")
  ),
  code: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z.string().regex(/^\d{6}$/, "Verification code must be 6 digits.")
  ),
});

const requestPasswordResetSchema = z.object({
  email: z.preprocess(
    (raw) => String(raw ?? "").trim().toLowerCase(),
    z.string().min(1, "email is required.")
  ),
});

const resetPasswordSchema = z.object({
  email: z.preprocess(
    (raw) => String(raw ?? "").trim().toLowerCase(),
    z.string().min(1, "email is required.")
  ),
  code: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z.string().regex(/^\d{6}$/, "Verification code must be 6 digits.")
  ),
  newPassword: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter.")
      .regex(/[a-z]/, "Password must contain at least 1 lowercase letter.")
      .regex(/[0-9]/, "Password must contain at least 1 number.")
  ),
});

const changeEmailSchema = z.object({
  newEmail: z.preprocess(
    (raw) => String(raw ?? "").trim().toLowerCase(),
    z.string().email("Enter a valid email.")
  ),
  currentPassword: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z.string().min(1, "Current password is required.")
  ),
});

const feedbackSchema = z.object({
  subject: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z.string().min(1, "Subject is required.").max(120, "Subject is too long.")
  ),
  body: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z.string().min(1, "Body is required.").max(5000, "Body is too long.")
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

function normalizeIPv4(raw: string): string | null {
  const ip = raw.trim();
  const unmapped = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const parts = unmapped.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums.join(".");
}

function isPublicIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);

  if (a === 10) return false;
  if (a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 0) return false;
  if (a >= 224) return false; // multicast/reserved
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmark range

  return true;
}

function firstPublicIPv4(rawHeader: string | undefined): string | null {
  if (!rawHeader) return null;
  const candidates = rawHeader.split(",").map((v) => v.trim()).filter(Boolean);

  for (const candidate of candidates) {
    const ip = normalizeIPv4(candidate);
    if (ip && isPublicIPv4(ip)) return ip;
  }
  return null;
}

function clientPublicIPv4(req: Request): string | null {
  const fromForwarded = firstPublicIPv4(req.header("x-forwarded-for") ?? undefined);
  if (fromForwarded) return fromForwarded;

  const fromCf = firstPublicIPv4(req.header("cf-connecting-ip") ?? undefined);
  if (fromCf) return fromCf;

  const fromRealIp = firstPublicIPv4(req.header("x-real-ip") ?? undefined);
  if (fromRealIp) return fromRealIp;

  const direct = normalizeIPv4(req.ip ?? "");
  if (direct && isPublicIPv4(direct)) return direct;

  const remote = normalizeIPv4(req.socket.remoteAddress ?? "");
  if (remote && isPublicIPv4(remote)) return remote;

  return null;
}

function clientObservedIp(req: Request): string | null {
  return req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? req.ip ?? req.socket.remoteAddress ?? null;
}

function newVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function createAndSendEmailVerification(userId: string, email: string): Promise<void> {
  const code = newVerificationCode();
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + env.VERIFICATION_CODE_TTL_MINUTES * 60 * 1000);

  await pool.query(
    "delete from email_verification_codes where user_id = $1 and consumed_at is null",
    [userId]
  );

  await pool.query(
    `insert into email_verification_codes (user_id, code_hash, expires_at)
     values ($1, $2, $3)`,
    [userId, codeHash, expiresAt]
  );

  await sendVerificationEmail(email, code);
}

async function createAndSendPasswordResetCode(userId: string, email: string): Promise<void> {
  const code = newVerificationCode();
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + env.VERIFICATION_CODE_TTL_MINUTES * 60 * 1000);

  await pool.query(
    "delete from password_reset_codes where user_id = $1 and consumed_at is null",
    [userId]
  );

  await pool.query(
    `insert into password_reset_codes (user_id, code_hash, expires_at)
     values ($1, $2, $3)`,
    [userId, codeHash, expiresAt]
  );

  await sendPasswordResetEmail(email, code);
}

app.post("/auth/register", async (req: Request<{}, {}, RegisterBody>, res: Response) => {
  const { email, password } = parseOrBadRequest(credentialsSchema, req.body);
  const ipAddress = clientPublicIPv4(req);

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query<Pick<UserRow, "id" | "email" | "token_version" | "email_verified">>(
    "insert into users (email, password_hash, email_verified, last_ip) values ($1, $2, false, $3) returning id, email, token_version, email_verified",
    [email, passwordHash, ipAddress]
  );

  const u = result.rows[0];
  try {
    await createAndSendEmailVerification(u.id, u.email);
  } catch (err) {
    console.error("Failed to send verification email:", err);
    return res.status(502).json({ error: "Could not send verification email. Please try again." });
  }

  res.status(201).json({
    id: u.id,
    email: u.email,
    message: "Registration successful. Check your email for a verification code.",
  });
});

app.post("/auth/verify-email", async (req: Request<{}, {}, VerifyEmailBody>, res: Response) => {
  const { email, code } = parseOrBadRequest(verifyEmailSchema, req.body);

  const userRes = await pool.query<Pick<UserRow, "id" | "email_verified">>(
    "select id, email_verified from users where email = $1",
    [email]
  );

  const user = userRes.rows[0];
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  if (user.email_verified) {
    return res.status(200).json({ message: "Email already verified." });
  }

  const codeRes = await pool.query<{
    id: string;
    code_hash: string;
    expires_at: Date;
    consumed_at: Date | null;
  }>(
    `select id, code_hash, expires_at, consumed_at
     from email_verification_codes
     where user_id = $1
     order by created_at desc
     limit 1`,
    [user.id]
  );

  const latestCode = codeRes.rows[0];
  if (!latestCode) {
    return res.status(400).json({ error: "Verification code not found." });
  }

  if (latestCode.consumed_at) {
    return res.status(400).json({ error: "Verification code has already been used." });
  }

  if (new Date(latestCode.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "Verification code has expired." });
  }

  if (sha256(code) !== latestCode.code_hash) {
    return res.status(400).json({ error: "Invalid verification code." });
  }

  await pool.query("begin");
  try {
    await pool.query("update users set email_verified = true where id = $1", [user.id]);
    await pool.query(
      "update email_verification_codes set consumed_at = now() where id = $1",
      [latestCode.id]
    );
    await pool.query("commit");
  } catch {
    await pool.query("rollback");
    return res.status(500).json({ error: "Server error" });
  }

  return res.status(200).json({ message: "Email verified successfully." });
});

app.post("/auth/request-password-reset", async (req: Request<{}, {}, RequestPasswordResetBody>, res: Response) => {
  const { email } = parseOrBadRequest(requestPasswordResetSchema, req.body);

  const userRes = await pool.query<Pick<UserRow, "id" | "email">>(
    "select id, email from users where email = $1",
    [email]
  );

  const user = userRes.rows[0];
  if (user) {
    try {
      await createAndSendPasswordResetCode(user.id, user.email);
    } catch (err) {
      console.error("Failed to send password reset email:", err);
      return res.status(502).json({ error: "Could not send password reset email. Please try again." });
    }
  }

  return res.status(200).json({
    message: "If that account exists, we sent a password reset code.",
  });
});

app.post("/auth/reset-password", async (req: Request<{}, {}, ResetPasswordBody>, res: Response) => {
  const { email, code, newPassword } = parseOrBadRequest(resetPasswordSchema, req.body);

  const userRes = await pool.query<Pick<UserRow, "id">>(
    "select id from users where email = $1",
    [email]
  );

  const user = userRes.rows[0];
  if (!user) {
    return res.status(400).json({ error: "Invalid email or code." });
  }

  const codeRes = await pool.query<{
    id: string;
    code_hash: string;
    expires_at: Date;
    consumed_at: Date | null;
  }>(
    `select id, code_hash, expires_at, consumed_at
     from password_reset_codes
     where user_id = $1
     order by created_at desc
     limit 1`,
    [user.id]
  );

  const latestCode = codeRes.rows[0];
  if (!latestCode || latestCode.consumed_at || new Date(latestCode.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "Invalid email or code." });
  }

  if (sha256(code) !== latestCode.code_hash) {
    return res.status(400).json({ error: "Invalid email or code." });
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  await pool.query("begin");
  try {
    await pool.query(
      "update users set password_hash = $2, token_version = token_version + 1 where id = $1",
      [user.id, newHash]
    );
    await pool.query(
      "update password_reset_codes set consumed_at = now() where id = $1",
      [latestCode.id]
    );
    await pool.query(
      "update refresh_sessions set revoked_at = now() where user_id = $1 and revoked_at is null",
      [user.id]
    );
    await pool.query("commit");
  } catch {
    await pool.query("rollback");
    return res.status(500).json({ error: "Server error" });
  }

  return res.status(200).json({ message: "Password reset successful. Please log in." });
});

app.post("/auth/login", async (req: Request<{}, {}, LoginBody>, res: Response) => {
  const { email, password } = parseOrBadRequest(credentialsSchema, req.body);
  const ipAddress = clientPublicIPv4(req);
  const observedIp = clientObservedIp(req);

  const userRes = await pool.query<UserRow>(
    "select id, email, password_hash, token_version, email_verified from users where email = $1",
    [email]
  );

  const user = userRes.rows[0];
  if (!user) return res.sendStatus(401);
  if (!user.email_verified) return res.status(403).json({ error: "Please verify your email before logging in." });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.sendStatus(401);

  await pool.query("update users set last_ip = $2 where id = $1", [user.id, ipAddress]);

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
    [user.id, refreshHash, expiresAt, req.get("user-agent") ?? null, ipAddress]
  );

  try {
    await sendLoginNotificationEmail(user.email, ipAddress, observedIp);
  } catch (err) {
    // Login should still succeed if notification email fails.
    console.error("Failed to send login notification email:", err);
  }

  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, ipAddress });
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

app.post("/auth/logout", requireAuth, async (req: Request, res: Response) => {
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

app.post("/auth/change-email", requireAuth, async (req: Request<{}, {}, ChangeEmailBody>, res: Response) => {
  const { newEmail, currentPassword } = parseOrBadRequest(changeEmailSchema, req.body);

  const userId = (req as AuthedRequest).user.sub;

  const userRes = await pool.query<Pick<UserRow, "id" | "email" | "password_hash">>(
    "select id, email, password_hash from users where id = $1",
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: "User not found." });

  if (user.email === newEmail) {
    return res.status(400).json({ error: "New email must be different from current email." });
  }

  const passwordOk = await bcrypt.compare(currentPassword, user.password_hash);
  if (!passwordOk) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  const existingRes = await pool.query<{ id: string }>(
    "select id from users where email = $1 and id <> $2",
    [newEmail, userId]
  );
  if (existingRes.rows[0]) {
    return res.status(409).json({ error: "That email is already in use." });
  }

  await pool.query("begin");
  try {
    await pool.query(
      "update users set email = $2, email_verified = false, token_version = token_version + 1 where id = $1",
      [userId, newEmail]
    );
    await pool.query(
      "update refresh_sessions set revoked_at = now() where user_id = $1 and revoked_at is null",
      [userId]
    );
    await pool.query("commit");
  } catch {
    await pool.query("rollback");
    return res.status(500).json({ error: "Server error" });
  }

  try {
    await createAndSendEmailVerification(userId, newEmail);
  } catch (err) {
    console.error("Failed to send verification email:", err);
    return res.status(502).json({ error: "Email changed but verification email could not be sent. Try again." });
  }

  return res.status(200).json({
    message: "Email changed. Verify your new email before logging in again.",
    newEmail,
  });
});

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
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

  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    typeof (payload as AccessTokenClaims).tokenVersion !== "number"
  ) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const claims = payload as AccessTokenClaims;
  const userRes = await pool.query<UserPublicRow>(
    "select id, email, token_version from users where id = $1 and token_version = $2",
    [claims.sub, claims.tokenVersion]
  );

  const user = userRes.rows[0];
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  (req as AuthedRequest).user = {
    ...claims,
    email: user.email,
    tokenVersion: user.token_version,
  };
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

async function ensureEmailVerificationTables() {
  await pool.query(`
    alter table users
    add column if not exists email_verified boolean not null default false
  `);

  await pool.query(`
    alter table users
    add column if not exists last_ip text
  `);

  await pool.query(`
    create table if not exists email_verification_codes (
      id bigserial primary key,
      user_id uuid not null references users(id) on delete cascade,
      code_hash text not null,
      expires_at timestamptz not null,
      consumed_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create index if not exists idx_email_verification_codes_user_id_created_at
    on email_verification_codes (user_id, created_at desc)
  `);
}

async function ensurePasswordResetTables() {
  await pool.query(`
    create table if not exists password_reset_codes (
      id bigserial primary key,
      user_id uuid not null references users(id) on delete cascade,
      code_hash text not null,
      expires_at timestamptz not null,
      consumed_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create index if not exists idx_password_reset_codes_user_id_created_at
    on password_reset_codes (user_id, created_at desc)
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

app.post("/api/feedback", requireAuth, async (req: Request<{}, {}, FeedbackBody>, res: Response) => {
  try {
    const { subject, body } = parseOrBadRequest(feedbackSchema, req.body);
    const fromEmail = (req as AuthedRequest).user.email;

    await sendFeedbackEmail(fromEmail, subject, body);
    return res.status(200).json({ message: "Feedback sent. Thank you." });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

export async function start() {
  await ensureEmailVerificationTables();
  await ensurePasswordResetTables();
  await ensureWeatherHistoryTable();
  await connectRedis();
  app.listen(Number(env.PORT), () => {
    console.log(`Listening on port ${env.PORT}`);
  });
}

export { app };

if (require.main === module) {
  start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
