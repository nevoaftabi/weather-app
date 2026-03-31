const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "http://localhost:3000";

export async function apiFetch(input: string, init: RequestInit = {}) {
  return fetch(`${API_BASE}${input}`, init);
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof data === "object" && data && "error" in data && typeof (data as any).error === "string"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (data as any).error
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : typeof data === "object" && data && "message" in data && typeof (data as any).message === "string"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (data as any).message
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
