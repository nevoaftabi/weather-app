export type Units = "metric" | "imperial";
import { HttpError } from "../HttpError";

export type GeoResult = {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
};

export type WeatherApiResponse = {
  main: {
    temp: number;
    feels_like: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
};

export type WeatherShape = {
  location: string;
  temp: number;
  feelsLike: number;
  condition: string;
  icon: string;
  wind: number;
};

// ----- Cache (TTL) -----
export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<WeatherShape>>();

const { WEATHER_API_KEY } = process.env;

export function cacheGet(key: string): WeatherShape | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

export function cacheSet(key: string, value: WeatherShape, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}
 
export async function getWeather(apiKey: string, city: string, state: string, units: string): Promise<WeatherShape> {
  const cacheKey = `wx:${city},${state},us:${units}`;
  const cached = cacheGet(cacheKey);

  if (cached) return cached; 

  const geoUrl =
    `https://api.openweathermap.org/geo/1.0/direct` +
    `?q=${encodeURIComponent(city)},${encodeURIComponent(state)},US` +
    `&limit=1&appid=${apiKey}`;

  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) {
    throw new HttpError(502, "Geocode failed");
  }

  const geo = (await geoRes.json()) as GeoResult[];
  if (!Array.isArray(geo) || geo.length === 0) {
    throw new HttpError(404, "Location not found");
  }

  const { lat, lon, name } = geo[0];
  const stateName = geo[0].state ?? state;

  const weatherUrl =
    `https://api.openweathermap.org/data/2.5/weather` +
    `?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`;

  const weatherRes = await fetch(weatherUrl);
  if (!weatherRes.ok) {
    throw new HttpError(502, "Weather fetch failed");
  }

  const weather = (await weatherRes.json()) as WeatherApiResponse;

  const weatherShape: WeatherShape = {
    location: `${name}, ${stateName}`,
    temp: weather.main.temp,
    feelsLike: weather.main.feels_like,
    condition: weather.weather?.[0]?.description ?? "",
    icon: weather.weather?.[0]?.icon ?? "",
    wind: weather.wind.speed,
  };

  cacheSet(cacheKey, weatherShape, 10 * 60 * 1000);
  return weatherShape;
}