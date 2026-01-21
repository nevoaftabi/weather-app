// WeatherApp.tsx
import React, { useMemo, useState } from "react";

type Units = "metric" | "imperial";

type WeatherResponse = {
  temp: number;
  feelsLike: number;
  condition?: string;
  // in case your server returns other fields
  [key: string]: unknown;
};

const isValidState = (state: string) => /^[A-Za-z]{2}$/.test(state.trim());
const isValidCity = (city: string) => /^[A-Za-z][A-Za-z .'-]{1,79}$/.test(city.trim());

export default function WeatherApp() {
  const [city, setCity] = useState<string>("");
  const [stateCode, setStateCode] = useState<string>("");

  const [units, setUnits] = useState<Units>("metric");

  const [resultText, setResultText] = useState<string>("");
  const [conditionText, setConditionText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const tempUnit = useMemo(() => (units === "imperial" ? "°F" : "°C"), [units]);

  const validateInputs = () => {
    const c = city.trim();
    const sRaw = stateCode.trim();

    if (!isValidCity(c)) {
      return { ok: false as const, msg: "Enter a valid city (letters/spaces only)." };
    }
    if (!isValidState(sRaw)) {
      return { ok: false as const, msg: "State must be 2 letters (e.g., TX)." };
    }

    // normalize for backend + cache stability
    const s = sRaw.toUpperCase();
    return { ok: true as const, city: c, state: s };
  };

  const handleToggleUnits = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setUnits((prev) => (prev === "metric" ? "imperial" : "metric"));
  };

  const handleStateInput = (value: string) => {
    // force state to 2 letters uppercase while typing
    const normalized = value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    setStateCode(normalized);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const check = validateInputs();
    if (!check.ok) {
      setResultText(check.msg);
      setConditionText("");
      return;
    }

    const { city: c, state: s } = check;

    setIsLoading(true);
    setResultText("Loading...");
    setConditionText("");

    try {
      const url =
        `http://localhost:3000/api/weather` +
        `?city=${encodeURIComponent(c)}` +
        `&state=${encodeURIComponent(s)}` +
        `&units=${encodeURIComponent(units)}`;

      const res = await fetch(url);
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
          const msg =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (typeof data === "object" && data && "error" in data && typeof (data as any).error === "string"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (data as any).error
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : typeof data === "object" && data && "message" in data && typeof (data as any).message === "string"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? (data as any).message
              : `Request failed (${res.status})`);

        setResultText(msg);
        setConditionText("");
        return;
      }

      const d = data as WeatherResponse;

      setResultText(`${d.temp}${tempUnit} (feels like ${d.feelsLike}${tempUnit})`);
      setConditionText(d.condition ?? "");
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
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Weather App
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Enter a city and state, then choose Metric or Imperial.
            </p>
          </div>

          {/* Card */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Inputs */}
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

              {/* Actions */}
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

                  <span className="text-xs text-slate-400">
                    Toggle units before submitting
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? "Loading..." : "Get weather"}
                </button>
              </div>

              {/* Results */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Result
                </div>

                <div className="mt-2 space-y-1">
                  <div className="text-lg font-semibold text-slate-100">
                    {resultText}
                  </div>
                  <div className="text-sm text-slate-300">
                    {conditionText}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Tip: Use state abbreviations like FL, NY, CA.
              </p>
            </form>
          </section>

          <p className="mt-6 text-center text-xs text-slate-500">
            Built with React + TypeScript + Tailwind
          </p>
        </div>
      </main>
    </div>
  );
}
