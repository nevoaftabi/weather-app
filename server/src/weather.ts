import { Router } from "express";
import { z } from "zod";
import { cacheGetJson, cacheSetJson } from "./cache";

type Units = "metric" | "imperial";

type WeatherPayload = {
  location: string;
  temp: number;
  feelsLike: number;
  condition: string;
  icon: string;
  wind: number;
};

const router = Router();

function makeKey(city: string, state: string, country: string, units: Units) {
  return `wx:${city},${state},${country}:${units}`.toLowerCase();
}

const weatherQuerySchema = z.object({
  city: z.preprocess(
    (raw) => String(raw ?? "").trim(),
    z.string().min(1, "city is required")
  ),
  state: z.preprocess(
    (raw) => String(raw ?? "").trim().toUpperCase(),
    z.string().regex(/^[A-Z]{2}$/, "state must be a 2-letter code (e.g., TX)")
  ),
  units: z.preprocess(
    (raw) => String(raw ?? "metric").trim().toLowerCase(),
    z.enum(["metric", "imperial"])
  ),
});

router.get("/weather", async (req, res) => {
  const parsed = weatherQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Bad request" });
  }

  const { city, state, units } = parsed.data as { city: string; state: string; units: Units };
  const country = "us";

  const ttl = Number(process.env.WEATHER_TTL_SECONDS ?? 600);
  const key = makeKey(city, state, country, units);

  try {
    const cached = await cacheGetJson<WeatherPayload>(key);
    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    const payload: WeatherPayload = await fetchFromOpenWeather(city, state, units);

    // 3) Store in Redis with TTL
    await cacheSetJson(key, payload, ttl);

    return res.status(200).json({ ...payload, cached: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

async function fetchFromOpenWeather(city: string, state: string, units: Units): Promise<WeatherPayload> {
  throw new Error("Implement using your existing OpenWeather fetch logic");
}

export default router;
