const isValidState = (state) => /^[A-Za-z]{2}$/.test(state.trim());
const isValidCity = (city) => /^[A-Za-z][A-Za-z .'-]{1,79}$/.test(city.trim());

function validateInputs() {
  const cityEl = document.getElementById("city");
  const stateEl = document.getElementById("state");

  const city = cityEl.value.trim();
  const stateRaw = stateEl.value.trim();

  if (!isValidCity(city)) {
    return { ok: false, msg: "Enter a valid city (letters/spaces only)." };
  }

  if (!isValidState(stateRaw)) {
    return { ok: false, msg: "State must be 2 letters (e.g., TX)." };
  }

  // normalize for backend + cache stability
  const state = stateRaw.toUpperCase();

  return { ok: true, city, state };
}

// --- units: store state in data-units so you always send metric/imperial ---
const unitsBtn = document.getElementById("units");
if (unitsBtn) {
  // Ensure initial value is consistent
  if (!unitsBtn.dataset.units) unitsBtn.dataset.units = "metric";
  unitsBtn.textContent = unitsBtn.dataset.units === "metric" ? "Metric" : "Imperial";

  unitsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const current = unitsBtn.dataset.units || "metric";
    const next = current === "metric" ? "imperial" : "metric";
    unitsBtn.dataset.units = next;
    unitsBtn.textContent = next === "metric" ? "Metric" : "Imperial";
  });
}

async function submitForm(event) {
  event.preventDefault();
  await getDataAndCall();
  return false;
}

const getDataAndCall = async () => {
  const resultEl = document.getElementById("result");
  const weatherEl = document.getElementById("weather-condition");

  const check = validateInputs();
  if (!check.ok) {
    resultEl.textContent = check.msg;
    weatherEl.textContent = "";
    return;
  }

  const { city, state } = check;

  const units = (document.getElementById("units")?.dataset.units || "metric").toLowerCase();

  resultEl.textContent = "Loading...";
  weatherEl.textContent = "";

  try {
    const url =
      `http://localhost:3000/api/weather` +
      `?city=${encodeURIComponent(city)}` +
      `&state=${encodeURIComponent(state)}` +
      `&units=${encodeURIComponent(units)}`;

    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error || data?.message || `Request failed (${res.status})`;
      resultEl.textContent = msg;
      return;
    }

    const tempUnit = units === "imperial" ? "°F" : "°C";
    resultEl.textContent = `${data.temp}${tempUnit} (feels like ${data.feelsLike}${tempUnit})`;
    weatherEl.textContent = data.condition ?? "";
  } catch (err) {
    console.error(err);
    resultEl.textContent = err?.message || "Something went wrong.";
  }
};

// optional nice UX: force state to 2 letters uppercase while typing
document.getElementById("state")?.addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
});
