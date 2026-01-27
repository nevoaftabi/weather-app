import { useEffect } from "react";
import { useNavigate } from "react-router";
import { apiFetch } from "../auth/api";
import { setAccessToken } from "../auth/authStore";
import AppShell from "../ui/AppShell";

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await apiFetch("/auth/logout", { method: "POST" });
      } finally {
        setAccessToken(null);
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <AppShell title="Logging out" subtitle="Clearing your session...">
      <div className="text-sm text-slate-300">Please wait.</div>
    </AppShell>
  );
}
