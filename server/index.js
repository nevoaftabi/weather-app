// NOTE: Old API key should expire soon. Use the new old.

const express = require("express");
require("dotenv").config();
const cors = require("cors");

const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if(!entry) {
    return null;
  }

  if(Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

const { PORT, WEATHER_API_KEY } = process.env;
const app = express();

app.use((req, res, next) => {
  console.log(`${req.method} - ${req.url}`);
  next();
});

app.use(cors({
  origin: "http://127.0.0.1:5500",
}));

app.get("/api/weather", async (req, res) => {
  try {
    const cityRaw = req.query.city;
    const stateRaw = req.query.state;
    const units = req.query.units;

    if (!cityRaw || !stateRaw || !units) {
      return res.status(400).json({ error: "Provide city, state, and units" });
    }

    const city = cityRaw.trim().toLowerCase();
    const state = stateRaw.trim().toLowerCase();

    const cacheKey = `wx:${city},${state},us:${units}`;
    const cached = cacheGet(cacheKey);

    if(cached) {
      return res.json({ ...cached });
    }

    const geoUrl =
      `https://api.openweathermap.org/geo/1.0/direct` +
      `?q=${encodeURIComponent(city)},${encodeURIComponent(state)},US` +
      `&limit=1&appid=${WEATHER_API_KEY}`;

    const geoRes = await fetch(geoUrl);
    const geo = await geoRes.json();

    if (!Array.isArray(geo) || geo.length === 0) {
      return res.status(404).json({ error: "Location not found" });
    }

    const { lat, lon } = geo[0];

    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=${units}`
    );

    if (!weatherRes.ok) {
      return res.status(500).json({ error: "Weather fetch failed" });
    }

    const weather = await weatherRes.json();
    
    const weatherShape = {
      location: `${geo[0].name}, ${geo[0].state}`,
      temp: weather.main.temp,
      feelsLike: weather.main.feels_like,
      condition: weather.weather[0].description,
      icon: weather.weather[0].icon,
      wind: weather.wind.speed
    };
    // 10 minutes
    cacheSet(cacheKey, weatherShape, 10 * 60 * 1000);
    
    return res.json({ ...weatherShape });
  } 
  catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
