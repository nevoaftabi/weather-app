import React, { useEffect, useState } from "react";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router";
import AppShell from "../ui/AppShell";
import { apiPostJson } from "../auth/api";
import { verifyEmailSchema, type VerifyEmailInput } from "../auth/schemas";

function fieldError(err: z.ZodError, field: keyof VerifyEmailInput) {
  const issue = err.issues.find((i) => i.path[0] === field);
  return issue?.message ?? "";
}

type VerifyResponse = {
  message: string;
};

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; code?: string }>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const emailFromQuery = searchParams.get("email");
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSuccess("");
    setFieldErrors({});

    const parsed = verifyEmailSchema.safeParse({ email, code });
    if (!parsed.success) {
      const err = parsed.error;
      setFieldErrors({
        email: fieldError(err, "email"),
        code: fieldError(err, "code"),
      });
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiPostJson<VerifyResponse>("/auth/verify-email", parsed.data);
      setSuccess(data.message || "Email verified successfully.");

      setTimeout(() => {
        navigate(`/login?email=${encodeURIComponent(parsed.data.email)}`);
      }, 900);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppShell title="Verify Email" subtitle="Enter the 6-digit code we sent to your inbox.">
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
          <label htmlFor="code" className="text-sm font-medium text-slate-200">
            Verification code
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

        {formError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {formError}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Verifying..." : "Verify email"}
          </button>

          <Link to="/login" className="text-sm text-slate-300 hover:text-slate-100">
            Back to login
          </Link>
        </div>
      </form>
    </AppShell>
  );
}
