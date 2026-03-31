import React, { useMemo, useState } from "react";
import { Link } from "react-router";
import { apiFetch } from "./auth/api";
import { appendWeatherHistory } from "./lib/localWeatherHistory";
import { getWeatherIcon } from "./lib/weather";

type Units = "metric" | "imperial";

type WeatherResponse = {
  location?: string;
  temp: number;
  feelsLike: number;
  condition?: string;
  icon?: string;
  [key: string]: unknown;
};

const isValidState = (state: string) => /^[A-Za-z]{2}$/.test(state.trim());
const isValidCity = (city: string) => /^[A-Za-z][A-Za-z .'-]{1,79}$/.test(city.trim());

export default function WeatherApp() {
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [units, setUnits] = useState<Units>("metric");
  const [resultText, setResultText] = useState("");
  const [conditionText, setConditionText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const tempUnit = useMemo(() => (units === "imperial" ? "\u00B0F" : "\u00B0C"), [units]);

  const validateInputs = () => {
    const trimmedCity = city.trim();
    const trimmedState = stateCode.trim();

    if (!isValidCity(trimmedCity)) {
      return { ok: false as const, msg: "Enter a valid city (letters/spaces only)." };
    }

    if (!isValidState(trimmedState)) {
      return { ok: false as const, msg: "State must be 2 letters (e.g., TX)." };
    }

    return {
      ok: true as const,
      city: trimmedCity,
      state: trimmedState.toUpperCase(),
    };
  };

  const handleToggleUnits = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setUnits((prev) => (prev === "metric" ? "imperial" : "metric"));
  };

  const handleStateInput = (value: string) => {
    setStateCode(value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const check = validateInputs();
    if (!check.ok) {
      setResultText(check.msg);
      setConditionText("");
      return;
    }

    setIsLoading(true);
    setResultText("Loading...");
    setConditionText("");

    try {
      const url =
        `/api/weather?city=${encodeURIComponent(check.city)}` +
        `&state=${encodeURIComponent(check.state)}` +
        `&units=${encodeURIComponent(units)}`;

      const res = await apiFetch(url);
      const data: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : typeof data === "object" &&
                data &&
                "message" in data &&
                typeof (data as { message?: unknown }).message === "string"
              ? (data as { message: string }).message
              : `Request failed (${res.status})`;

        setResultText(msg);
        setConditionText("");
        return;
      }

      const weather = data as WeatherResponse;
      const roundedTemp = Math.round(weather.temp);
      const roundedFeelsLike = Math.round(weather.feelsLike);
      const weatherIcon = getWeatherIcon(weather.icon, weather.condition);

      setResultText(`${roundedTemp}${tempUnit} (feels like ${roundedFeelsLike}${tempUnit})`);
      setConditionText(`${weatherIcon} ${weather.condition ?? ""}`.trim());
      appendWeatherHistory(weather);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setResultText(msg);
      setConditionText("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12">
        <div className="w-full">
          <div className="mb-8 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Weather App</h1>
              <p className="mt-2 text-sm text-slate-300">
                Check the current weather by city and state.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/feedback"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              >
                Feedback
              </Link>
              <Link
                to="/history"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              >
                History
              </Link>
            </div>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="city" className="text-sm font-medium text-slate-200">
                    City
                  </label>
                  <input
                    required
                    id="city"
                    minLength={2}
                    maxLength={80}
                    type="text"
                    placeholder="Miami"
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none ring-0 transition focus:border-white/20 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="state" className="text-sm font-medium text-slate-200">
                    State
                  </label>
                  <input
                    required
                    id="state"
                    minLength={2}
                    maxLength={2}
                    type="text"
                    placeholder="FL"
                    autoComplete="address-level1"
                    value={stateCode}
                    onChange={(e) => handleStateInput(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none ring-0 transition focus:border-white/20 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleUnits}
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    aria-label="Toggle units"
                  >
                    {units === "metric" ? "Metric" : "Imperial"}
                  </button>

                  <span className="text-xs text-slate-400">Toggle units before submitting</span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? "Loading..." : "Get weather"}
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Result</div>

                <div className="mt-2 space-y-1">
                  <div className="text-lg font-semibold text-slate-100">{resultText}</div>
                  <div className="text-sm text-slate-300">{conditionText}</div>
                </div>
              </div>

              <p className="text-xs text-slate-400">Tip: Use state abbreviations like FL, NY, or CA.</p>
            </form>
          </section>

          <p className="mt-6 text-center text-xs text-slate-500">Built with React + TypeScript + Tailwind</p>
        </div>
      </main>
    </div>
  );
}
