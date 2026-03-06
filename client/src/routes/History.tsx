import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiFetch } from "../auth/api";

type HistoryItem = {
  id: string;
  requestedAt: string;
  result: {
    location?: string;
    temp?: number;
    feelsLike?: number;
    condition?: string;
    [key: string]: unknown;
  };
};

function formatDateTime(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true);
      setError("");

      try {
        const res = await apiFetch("/api/weather/history");
        const data: unknown = await res.json().catch(() => []);

        if (!res.ok) {
          const msg =
            typeof data === "object" &&
            data &&
            "error" in data &&
            typeof (data as { error?: unknown }).error === "string"
              ? (data as { error: string }).error
              : `Request failed (${res.status})`;
          setError(msg);
          return;
        }

        if (Array.isArray(data)) {
          setItems(data as HistoryItem[]);
        } else {
          setItems([]);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadHistory();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-12">
        <div className="w-full">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Weather history
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Your latest 100 weather requests.
              </p>
            </div>

            <Link
              to="/home"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              Back to home
            </Link>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur sm:p-7">
            {isLoading ? (
              <p className="text-slate-300">Loading history...</p>
            ) : null}

            {!isLoading && error ? (
              <p className="text-red-300">{error}</p>
            ) : null}

            {!isLoading && !error && items.length === 0 ? (
              <p className="text-slate-300">No weather history yet.</p>
            ) : null}

            {!isLoading && !error && items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      {formatDateTime(item.requestedAt)}
                    </div>
                    <div className="mt-1 text-base font-semibold text-slate-100">
                      {item.result.location ?? "Unknown location"}
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      Temp: {typeof item.result.temp === "number" ? item.result.temp : "N/A"} |
                      Feels like:{" "}
                      {typeof item.result.feelsLike === "number" ? item.result.feelsLike : "N/A"} |
                      Condition: {item.result.condition ?? "N/A"}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
