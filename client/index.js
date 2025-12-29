const getDataAndCall = async () => {
  const city = document.getElementById("city").value.trim();
  const state = document.getElementById("state").value.trim();
  const resultEl = document.getElementById("result");
  const weatherEl = document.getElementById("weather-condition");

  if (!city || !state) {
    resultEl.textContent = "Enter both city and state (e.g., Miami, FL).";
    return;
  }

  resultEl.textContent = "Loading...";
  weatherEl.textContent = "";

  // Add country to make geocoding unambiguous

  try {
    const res = await fetch(
      `http://localhost:3000/api/weather?city=${city}&state=${state}`
    );

    // If server returns 400/404/500, don’t try to read weather.main.temp
    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error || data?.message || `Request failed (${res.status})`;
      resultEl.textContent = msg;
      return;
    }

    // Now safe to read
    resultEl.textContent = `${data.main.temp}°C (feels like ${data.main.feels_like}°C)`;
    weatherEl.textContent = data.weather?.[0]?.description ?? "";
  } catch (err) {
    console.error(err);
    resultEl.textContent = err.message || "Something went wrong.";
  }
};
