const express = require("express");
require("dotenv").config();
const cors = require("cors");

const { PORT, WEATHER_API_KEY } = process.env;
const app = express();

app.use(cors({
  origin: "http://127.0.0.1:5500",
}));

app.get("/api/weather", async (req, res) => {
  try {
    const { city, state } = req.query;

    if (!city || !state) {
      return res.status(400).json({ error: "Provide city and state" });
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
      `?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric`
    );

    if (!weatherRes.ok) {
      return res.status(500).json({ error: "Weather fetch failed" });
    }

    const weather = await weatherRes.json();
    res.json(weather);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
