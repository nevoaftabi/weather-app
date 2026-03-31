import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { z } from "zod";

import { WeatherApi, Units } from "./services/weatherApi";
import { HttpError } from "./HttpError";
import { env } from "./config/env";
import { connectRedis } from "./redis";
import { sendFeedbackEmail } from "./services/verificationEmail";

const app = express();
const weatherApi = new WeatherApi();

app.set("trust proxy", 1);

const corsOrigins = Array.from(
  new Set(
    [
      ...env.CLIENT_ORIGINS.split(","),
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]
      .map((origin) => origin.trim())
      .filter(Boolean)
  )
);

app.use(express.json());
app.use(
  cors({
    origin: corsOrigins,
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

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ message: "Weather API is running" });
});

const weatherQuerySchema = z.object({
  city: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z.string().min(1, "city is required.")
  ),
  state: z.preprocess(
    (raw) => String(raw ?? "").trim().toUpperCase(),
    z.string().regex(/^[A-Z]{2}$/, "state must be a 2-letter code (e.g., TX).")
  ),
  units: z.preprocess(
    (raw) => String(raw ?? "metric").trim().toLowerCase(),
    z.enum(["metric", "imperial"], {
      error: "Invalid units. Use 'metric' or 'imperial'.",
    })
  ),
});

const feedbackSchema = z.object({
  email: z.preprocess(
    (raw) => String(raw ?? "").trim().toLowerCase(),
    z.string().email("Enter a valid email.")
  ),
  subject: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z.string().min(1, "Subject is required.").max(120, "Subject is too long.")
  ),
  body: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z.string().min(1, "Body is required.").max(5000, "Body is too long.")
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

app.get("/api/weather", async (req: Request, res: Response) => {
  try {
    const { city, state, units } = parseOrBadRequest(weatherQuerySchema, req.query) as {
      city: string;
      state: string;
      units: Units;
    };

    const data = await weatherApi.getWeather(env.WEATHER_API_KEY, city, state, units);
    return res.json(data);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/feedback", async (req: Request, res: Response) => {
  try {
    const { email, subject, body } = parseOrBadRequest(feedbackSchema, req.body);
    await sendFeedbackEmail(email, subject, body);
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
  await ensureInitialized();
  app.listen(Number(env.PORT), () => {
    console.log(`Listening on port ${env.PORT}`);
  });
}

export { app };
export default app;

let initPromise: Promise<void> | null = null;
function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await connectRedis();
      } catch (err) {
        console.error("Redis init warning:", err);
      }
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

if (typeof require !== "undefined" && require.main === module) {
  start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
