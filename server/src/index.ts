import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { getWeather } from './services/weatherApi';
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

app.get("/api/weather", async (req: Request, res: Response) => {
  try {
    const city = String(req.query.city ?? "").toLowerCase().trim();
    const state = String(req.query.state ?? "").toLowerCase().trim();
    const units = String(req.query.units ?? "").toLowerCase().trim();

    if (!city || !state) {
      return res.status(400).json({ error: "Provide city and state" });
    }

    if(units !== 'metric' && units !== 'imperial') {
      return res.status(400).json({ error: "Invalid units. Use 'metric' or 'imperial'."});
    }

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
