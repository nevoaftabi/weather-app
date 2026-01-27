import { Router } from "express";
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

function normalizeCity(city: string) {
  return city.trim().toLowerCase();
}
function normalizeState(state: string) {
  return state.trim().toLowerCase();
}

function makeKey(city: string, state: string, country: string, units: Units) {
  return `wx:${normalizeCity(city)},${normalizeState(state)},${country}:${units}`;
}

router.get("/weather", async (req, res) => {
  const city = String(req.query.city ?? "");
  const state = String(req.query.state ?? "");
  const units = (String(req.query.units ?? "metric").toLowerCase() as Units) || "metric";
  const country = "us";

  if (!city || !state || (units !== "metric" && units !== "imperial")) {
    return res.status(400).json({ error: "Bad request" });
  }

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
