export type Units = "metric" | "imperial";

import { HttpError } from "../HttpError";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type WeatherShape = {
  location: string;     // human-readable (e.g., "Miami, Florida")
  temp: number;
  feelsLike: number;
  condition: string;
  icon: string;
  wind: number;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;    // absolute timestamp (ms since epoch)
};

// In your file, `location` is the CACHE KEY (e.g., "wx:miami,fl,us:metric")
type PersistedWeather = WeatherShape & {
  key: string;        // cache key like "wx:miami,fl,us:metric"
  expiresAt: number;  // absolute timestamp
};

type GeoResult = {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
};

type WeatherApiResponse = {
  main: { temp: number; feels_like: number };
  weather: Array<{ description: string; icon: string }>;
  wind: { speed: number };
};

export class WeatherApi {
  private cache = new Map<string, CacheEntry<WeatherShape>>();
  private initialized = false;
  private initError: string | null = null;

  // data.json in project root (where you run `node` from)
  private filePath = path.join(process.cwd(), "data.json");

  // Prevent writing on every request (optional, but helpful)
  private saveTimer: NodeJS.Timeout | null = null;

  getInitError() {
    return this.initError;
  }

  private cacheGet(key: string): WeatherShape | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  private cacheSet(key: string, value: WeatherShape, ttlMs: number): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.scheduleSave(); // persist after updates
  }

  private scheduleSave(delayMs = 250) {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        await this.saveCacheToFile();
      } catch (e) {
        // Don't crash if file write fails. Just log it.
        console.error("Failed to persist cache to data.json:", e);
      }
    }, delayMs);
  }

private async saveCacheToFile() {
  const items: PersistedWeather[] = [];

  for (const [cacheKey, entry] of this.cache.entries()) {
    items.push({
      key: cacheKey,
      ...entry.value,          // keeps human-readable location
      expiresAt: entry.expiresAt,
    });
  }

  await writeFile(this.filePath, JSON.stringify(items, null, 2), "utf8");
}

  async init() {
    if (this.initialized) return;

    try {
      const text = await readFile(this.filePath, "utf8");
      const items = JSON.parse(text) as PersistedWeather[];
      if (!Array.isArray(items)) {
        this.initError = "Cache file invalid (expected an array).";
        this.initialized = true;
        return;
      }

      const now = Date.now();

      for (const item of items) {
        if (!item?.key || typeof item.expiresAt !== "number") continue;
        if (item.expiresAt <= now) continue;

        const { key, expiresAt, ...value } = item;
        this.cache.set(key, { value, expiresAt });
      }
      this.initError = null;
      this.initialized = true;
    } catch (error: any) {
      // Missing file: ok, start empty cache
      if (error?.code === "ENOENT") {
        this.initError = null;
        this.initialized = true;
        return;
      }

      // Other issues: don't crash, mark degraded
      console.error("Failed to load data.json:", error);
      this.initError = "Failed to load cache file (data.json).";
      this.initialized = true;
    }
  }

  async getWeather(apiKey: string, city: string, state: string, units: Units): Promise<WeatherShape> {
    // ensure cache is loaded at least once (safe if called multiple times)
    await this.init();

    // if you want to block service when cache file is corrupt/unreadable (except missing),
    // your route can call getInitError() and return 503. We won't throw here.

    const cacheKey = `wx:${city},${state},us:${units}`.toLowerCase();
    const cached = this.cacheGet(cacheKey);

    if (cached) {
      console.log("Returning cached value");
      return cached;
    }

    console.log("Making a request");

    const geoUrl =
      `https://api.openweathermap.org/geo/1.0/direct` +
      `?q=${encodeURIComponent(city)},${encodeURIComponent(state)},US` +
      `&limit=1&appid=${apiKey}`;

    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new HttpError(502, "Geocode failed");

    const geo = (await geoRes.json()) as GeoResult[];
    if (!Array.isArray(geo) || geo.length === 0) throw new HttpError(404, "Location not found");

    const { lat, lon, name } = geo[0];
    const stateName = geo[0].state ?? state;

    const weatherUrl =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`;

    const weatherRes = await fetch(weatherUrl);
    if (!weatherRes.ok) throw new HttpError(502, "Weather fetch failed");

    const weather = (await weatherRes.json()) as WeatherApiResponse;

    const weatherShape: WeatherShape = {
      location: `${name}, ${stateName}`,
      temp: weather.main.temp,
      feelsLike: weather.main.feels_like,
      condition: weather.weather?.[0]?.description ?? "",
      icon: weather.weather?.[0]?.icon ?? "",
      wind: weather.wind.speed,
    };

    this.cacheSet(cacheKey, weatherShape, 10 * 60 * 1000);
    return weatherShape;
  }
}
