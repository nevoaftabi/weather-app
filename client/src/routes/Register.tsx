import React, { useState } from "react";
import { z } from "zod";
import AppShell from "../ui/AppShell";
import { registerSchema, type RegisterInput } from "../auth/schemas";
import { apiPostJson } from "../auth/api";
import { Link, useNavigate } from "react-router";

function errorFor(err: z.ZodError, field: keyof RegisterInput) {
  const issue = err.issues.find((i) => i.path[0] === field);
  return issue?.message ?? "";
}

export default function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    const parsed = registerSchema.safeParse({ email, password, confirmPassword });
    if (!parsed.success) {
      const err = parsed.error;
      setFieldErrors({
        email: errorFor(err, "email"),
        password: errorFor(err, "password"),
        confirmPassword: errorFor(err, "confirmPassword"),
      });
      return;
    }

    setIsLoading(true);
    try {
      // backend expects { email, password } for register
      await apiPostJson<{ id: string; email: string }>("/auth/register", {
        email: parsed.data.email,
        password: parsed.data.password,
      });

      navigate("/login");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppShell
      title="Register"
      subtitle="Create an account to enable saved sessions and refresh tokens."
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
            placeholder="At least 8 chars, upper/lower/number"
          />
          {fieldErrors.password ? <p className="text-xs text-red-300">{fieldErrors.password}</p> : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-200">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
            placeholder="Re-type your password"
          />
          {fieldErrors.confirmPassword ? <p className="text-xs text-red-300">{fieldErrors.confirmPassword}</p> : null}
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
            {isLoading ? "Creating..." : "Create account"}
          </button>

          <Link to="/login" className="text-sm text-slate-300 hover:text-slate-100">
            Already have an account? Login
          </Link>
        </div>

        <p className="text-xs text-slate-400">
          Password rules: 8+ characters, uppercase, lowercase, and a number.
        </p>
      </form>
    </AppShell>
  );
}
