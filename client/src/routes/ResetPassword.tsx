import React, { useEffect, useState } from "react";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router";
import AppShell from "../ui/AppShell";
import { apiPostJson } from "../auth/api";
import { resetPasswordSchema, type ResetPasswordInput } from "../auth/schemas";

type MessageResponse = { message: string };

function fieldError(err: z.ZodError, field: keyof ResetPasswordInput) {
  const issue = err.issues.find((i) => i.path[0] === field);
  return issue?.message ?? "";
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ResetPasswordInput, string>>>({});
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    const emailFromQuery = searchParams.get("email");
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [searchParams]);

  async function requestCode() {
    setFormError("");
    setMessage("");
    setIsRequesting(true);
    try {
      const res = await apiPostJson<MessageResponse>("/auth/request-password-reset", { email });
      setMessage(res.message);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not request reset code.");
    } finally {
      setIsRequesting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");
    setMessage("");

    const parsed = resetPasswordSchema.safeParse({ email, code, newPassword });
    if (!parsed.success) {
      const err = parsed.error;
      setFieldErrors({
        email: fieldError(err, "email"),
        code: fieldError(err, "code"),
        newPassword: fieldError(err, "newPassword"),
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiPostJson<MessageResponse>("/auth/reset-password", parsed.data);
      setMessage(res.message);
      setTimeout(() => {
        navigate(`/login?email=${encodeURIComponent(parsed.data.email)}`);
      }, 1000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Password reset failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppShell title="Reset Password" subtitle="Request a code, then set a new password.">
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-200">
            Email
          </label>
          <div className="flex gap-2">
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
              placeholder="you@example.com"
            />
            <button
              type="button"
              onClick={requestCode}
              disabled={isRequesting}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-70"
            >
              {isRequesting ? "Sending..." : "Send code"}
            </button>
          </div>
          {fieldErrors.email ? <p className="text-xs text-red-300">{fieldErrors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="code" className="text-sm font-medium text-slate-200">
            Reset code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
            placeholder="123456"
          />
          {fieldErrors.code ? <p className="text-xs text-red-300">{fieldErrors.code}</p> : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="newPassword" className="text-sm font-medium text-slate-200">
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
            placeholder="At least 8 chars, upper/lower/number"
          />
          {fieldErrors.newPassword ? <p className="text-xs text-red-300">{fieldErrors.newPassword}</p> : null}
        </div>

        {formError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {formError}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {message}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Resetting..." : "Reset password"}
          </button>

          <Link to="/login" className="text-sm text-slate-300 hover:text-slate-100">
            Back to login
          </Link>
        </div>
      </form>
    </AppShell>
  );
}
