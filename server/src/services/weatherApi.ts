import { HttpError } from "../HttpError";
import { cacheGetJson, cacheSetJson } from "../cache";
import { env } from "../config/env";

export type Units = "metric" | "imperial";

type WeatherShape = {
  location: string;
  temp: number;
  feelsLike: number;
  condition: string;
  icon: string;
  wind: number;
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
  private makeKey(city: string, state: string, units: Units) {
    return `wx:${city},${state},us:${units}`.toLowerCase();
  }

  async getWeather(
    apiKey: string,
    city: string,
    state: string,
    units: Units
  ): Promise<WeatherShape> {
    const cacheKey = this.makeKey(city, state, units);

    // 1) Redis cache
    const cached = await cacheGetJson<WeatherShape>(cacheKey);
    if (cached) return cached;

    // 2) Fetch geo
    const geoUrl =
      `https://api.openweathermap.org/geo/1.0/direct` +
      `?q=${encodeURIComponent(city)},${encodeURIComponent(state)},US` +
      `&limit=1&appid=${apiKey}`;

    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new HttpError(502, "Geocode failed");

    const geo = (await geoRes.json()) as GeoResult[];
    if (!Array.isArray(geo) || geo.length === 0)
      throw new HttpError(404, "Location not found");

    const { lat, lon, name } = geo[0];
    const stateName = geo[0].state ?? state;

    // 3) Fetch weather
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

    // 4) Write to Redis with TTL
    await cacheSetJson(cacheKey, weatherShape, env.WEATHER_TTL_SECONDS);

    return weatherShape;
  }
}
