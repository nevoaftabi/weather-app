import React, { useState } from "react";
import { z } from "zod";
import AppShell from "../ui/AppShell";
import { loginSchema, type LoginInput } from "../auth/schemas";
import { apiPostJson } from "../auth/api";
import { setAccessToken } from "../auth/authStore";
import { Link, useNavigate } from "react-router";

type LoginResponse = { accessToken: string };

function fieldError(err: z.ZodError, field: keyof LoginInput) {
  const issue = err.issues.find((i) => i.path[0] === field);
  return issue?.message ?? "";
}

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const err = parsed.error;
      setFieldErrors({
        email: fieldError(err, "email"),
        password: fieldError(err, "password"),
      });
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiPostJson<LoginResponse>("/auth/login", parsed.data);
      setAccessToken(data.accessToken);
      navigate("/home");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppShell
      title="Login"
      subtitle="Sign in to access your weather dashboard."
    >
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-200">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
            placeholder="you@example.com"
          />
          {fieldErrors.email ? <p className="text-xs text-red-300">{fieldErrors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-200">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
            placeholder="••••••••"
          />
          {fieldErrors.password ? <p className="text-xs text-red-300">{fieldErrors.password}</p> : null}
        </div>

        {formError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {formError}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Signing in..." : "Login"}
          </button>

          <Link to="/register" className="text-sm text-slate-300 hover:text-slate-100">
            Need an account? Create one
          </Link>
        </div>
      </form>
    </AppShell>
  );
}
