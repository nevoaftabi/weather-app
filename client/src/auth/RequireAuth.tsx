import React, { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { getAccessToken, setAccessToken } from "./authStore";
import { apiFetch } from "./api";
import AppShell from "../ui/AppShell";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "authed" | "nope">("loading");

  useEffect(() => {
    (async () => {
      // if we already have an access token in memory, good enough
      if (getAccessToken()) {
        setStatus("authed");
        return;
      }

      // try silent refresh (cookie-based)
      try {
        const res = await apiFetch("/auth/refresh", { method: "POST" });
        if (!res.ok) throw new Error();
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
      <AppShell title="Loading" subtitle="Restoring session...">
        <div className="text-sm text-slate-300">Please wait.</div>
      </AppShell>
    );
  }

  if (status === "nope") return <Navigate to="/login" replace />;
  return <>{children}</>;
}
