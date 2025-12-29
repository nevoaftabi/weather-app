const getDataAndCall = async () => {
  const city = document.getElementById("city").value.trim();
  const state = document.getElementById("state").value.trim();
  const resultEl = document.getElementById("result");
  const weatherEl = document.getElementById("weather-condition");
  const units = document.getElementById("units").textContent;

  if (!city || !state) {
    resultEl.textContent = "Enter both city and state (e.g., Miami, FL).";
    return;
  }

  resultEl.textContent = "Loading...";
  weatherEl.textContent = "";

  // Add country to make geocoding unambiguous

  try {
    const res = await fetch(
      `http://localhost:3000/api/weather?city=${city}&state=${state}&units=${units}`
    );

    // If server returns 400/404/500, don’t try to read weather.main.temp
    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error || data?.message || `Request failed (${res.status})`;
      resultEl.textContent = msg;
      return;
    }
    console.log(data);

    // Now safe to read
    if(units === "Imperial") {
      resultEl.textContent = `${data.temp}°F (feels like ${data.feelsLike}°F)`;
    }
    else {

      resultEl.textContent = `${data.temp}°C (feels like ${data.feelsLike}°C)`;
    }

    weatherEl.textContent = data.condition ?? "";
  } 
  catch (err) {
    console.error(err);
    resultEl.textContent = err.message || "Something went wrong.";
  }
};
