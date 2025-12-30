import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { getWeather, Units } from './services/weatherApi';
import { HttpError } from "./HttpError";
import { env } from './config/env';

const app = express();
app.use(cors({ origin: "http://127.0.0.1:5500" }));

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
  console.log(`${req.method} - ${req.url}`);
  next();
});

function parseUnits(raw: unknown): Units {
  const u = String(raw ?? "metric").trim().toLowerCase();
  if (u === "metric" || u === "imperial") return u;
  throw new HttpError(400, "Invalid units. Use 'metric' or 'imperial'.");
}

function requireString(raw: unknown, fieldName: string): string {
  const v = String(raw ?? "").trim();
  if (!v) throw new HttpError(400, `${fieldName} is required.`);
  return v;
}

function parseState(raw: unknown): string {
  const state = requireString(raw, "state").toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) {
    throw new HttpError(400, "state must be a 2-letter code (e.g., TX).");
  }
  return state;
}

app.get("/api/weather", async (req: Request, res: Response) => {
  try {
    const city = requireString(req.query.city, "city");
    const state = parseState(req.query.state);
    const units = parseUnits(req.query.units);

    const data = await getWeather(env.WEATHER_API_KEY, city, state, units);
    return res.json(data);
  } 
  catch (err) {
    if(err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }

    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(env.PORT, () => {
  console.log(`Listening on port ${env.PORT}`);
});
