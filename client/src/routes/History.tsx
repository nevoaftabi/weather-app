import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../auth/api";
import { getCurrentUserId, getTokenClaims, isAdminUser } from "../auth/authStore";
import {
  clearWeatherHistory,
  readWeatherHistory,
  removeWeatherHistoryItem,
  type StoredWeatherHistoryItem,
} from "../lib/localWeatherHistory";
import { getWeatherIcon } from "../lib/weather";

type AccountHistoryItem = {
  id: string;
  requestedAt: string;
  result: {
    location?: string;
    temp?: number;
    feelsLike?: number;
    condition?: string;
    icon?: string;
    [key: string]: unknown;
  };
};

function formatDateTime(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

export default function History() {
  const [items, setItems] = useState<Array<AccountHistoryItem | StoredWeatherHistoryItem>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingAccountHistory, setUsingAccountHistory] = useState(false);
  const [searchParams] = useSearchParams();

  const userId = searchParams.get("userId");
  const email = searchParams.get("email");
  const myUserId = getCurrentUserId();
  const viewingOtherUser = !!userId && isAdminUser() && userId !== myUserId;

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true);
      setError("");

      try {
        if (viewingOtherUser && userId) {
          const res = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/history`);
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
            setItems([]);
            setUsingAccountHistory(true);
            return;
          }

          setItems(Array.isArray(data) ? (data as AccountHistoryItem[]) : []);
          setUsingAccountHistory(true);
          return;
        }

        const res = await apiFetch("/api/weather/history");
        const data: unknown = await res.json().catch(() => []);

        if (res.ok && Array.isArray(data)) {
          setItems(data as AccountHistoryItem[]);
          setUsingAccountHistory(true);
          return;
        }

        setItems(readWeatherHistory());
        setUsingAccountHistory(false);
      } catch (err: unknown) {
        if (getTokenClaims()) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
          setItems([]);
          setUsingAccountHistory(true);
        } else {
          setItems(readWeatherHistory());
          setUsingAccountHistory(false);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadHistory();
  }, [userId, viewingOtherUser, myUserId]);

  const subtitle = viewingOtherUser
    ? `${email ?? "This user"}'s latest 100 weather requests.`
    : usingAccountHistory
      ? "Your account weather history."
      : "Your latest guest weather lookups.";

  async function deleteAccountHistoryResult(resultId: string) {
    try {
      if (!viewingOtherUser || !userId) {
        return;
      }

      await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/history/${encodeURIComponent(resultId)}`, {
        method: "DELETE",
      });

      setItems((currentItems) => currentItems.filter((item) => item.id !== resultId));
    } catch (err) {
      console.log(err);
    }
  }

  function deleteGuestHistoryResult(resultId: string) {
    removeWeatherHistoryItem(resultId);
    setItems((currentItems) => currentItems.filter((item) => item.id !== resultId));
  }

  function clearGuestHistory() {
    clearWeatherHistory();
    setItems([]);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-12">
        <div className="w-full">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Weather history</h1>
              <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
            </div>

            <Link
              to="/home"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              Back to home
            </Link>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur sm:p-7">
            {isLoading ? <p className="text-slate-300">Loading history...</p> : null}
            {!isLoading && error ? <p className="text-red-300">{error}</p> : null}
            {!isLoading && !error && items.length === 0 ? <p className="text-slate-300">No weather history yet.</p> : null}

            {!isLoading && !error && items.length > 0 ? (
              <>
                {!usingAccountHistory ? (
                  <div className="mb-4 flex justify-end">
                    <button
                      type="button"
                      onClick={clearGuestHistory}
                      className="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    >
                      Clear all
                    </button>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {items.map((item) => (
                    <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-400">{formatDateTime(item.requestedAt)}</div>
                      <div className="mt-1 text-base font-semibold text-slate-100">{item.result.location ?? "Unknown location"}</div>
                      <div className="mt-1 text-sm text-slate-300">
                        Temp: {typeof item.result.temp === "number" ? Math.round(item.result.temp) : "N/A"} | Feels like:{" "}
                        {typeof item.result.feelsLike === "number" ? Math.round(item.result.feelsLike) : "N/A"} | Condition:{" "}
                        {getWeatherIcon(item.result.icon, item.result.condition)} {item.result.condition ?? "N/A"}
                      </div>

                      {!usingAccountHistory ? (
                        <button
                          type="button"
                          className="mt-3 inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                          onClick={() => deleteGuestHistoryResult(item.id)}
                        >
                          Delete
                        </button>
                      ) : null}

                      {usingAccountHistory && viewingOtherUser && isAdminUser() ? (
                        <button
                          type="button"
                          className="mt-3 inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                          onClick={() => void deleteAccountHistoryResult(item.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
