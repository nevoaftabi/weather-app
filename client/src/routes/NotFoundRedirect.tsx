import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import AppShell from "../ui/AppShell";
import { getAccessToken, setAccessToken } from "../auth/authStore";
import { apiFetch } from "../auth/api";

type Status = "loading" | "authed" | "nope";

export default function NotFoundRedirect() {
  const location = useLocation();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    (async () => {
      // If we already have an access token in memory, treat as signed in
      if (getAccessToken()) {
        setStatus("authed");
        return;
      }

      // Try silent refresh using HttpOnly refresh cookie
      try {
        const res = await apiFetch("/auth/refresh", { method: "POST" });
        if (!res.ok) throw new Error("refresh failed");
        const data = (await res.json()) as { accessToken: string };
        setAccessToken(data.accessToken);
        setStatus("authed");
      } catch {
        setStatus("nope");
      }
    })();
  }, []);

  if (status === "loading") {
    return (
      <AppShell
        title="Redirecting"
        subtitle={`Unknown route: ${location.pathname}`}
      >
        <div className="text-sm text-slate-300">Checking session...</div>
      </AppShell>
    );
  }

  return status === "authed"
    ? <Navigate to="/home" replace />
    : <Navigate to="/login" replace />;
}
