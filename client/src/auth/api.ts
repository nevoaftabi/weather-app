import { getAccessToken, setAccessToken } from "./authStore";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  ((typeof import.meta !== "undefined" && import.meta.env?.DEV)
    ? "http://localhost:3000"
    : "https://weather-app-server-20260325123257.vercel.app");

type RefreshResponse = { accessToken: string };

async function refreshAccessToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Refresh failed");
  const data = (await res.json()) as RefreshResponse;
  setAccessToken(data.accessToken);
  return data.accessToken;
}

export async function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  let token = getAccessToken();
  if (!token && !input.startsWith("/auth/")) {
    try {
      token = await refreshAccessToken();
    } catch {
      token = null;
    }
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);

  const doReq = () =>
    fetch(`${API_BASE}${input}`, {
      ...init,
      headers,
      credentials: "include",
    });

  let res = await doReq();

  // If access token expired, try refresh once (except on refresh endpoint itself)
  if (res.status === 401 && !input.startsWith("/auth/")) {
    try {
      const newToken = await refreshAccessToken();
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await doReq();
    } catch {
      // refresh failed -> treat as logged out
      setAccessToken(null);
    }
  }

  return res;
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
