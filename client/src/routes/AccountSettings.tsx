import React, { useState } from "react";
import { Link } from "react-router";
import { apiPostJson } from "../auth/api";

export default function AccountSettings() {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleChangeEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!newEmail.trim()) {
      setError("New email is required.");
      return;
    }
    if (!currentPassword.trim()) {
      setError("Current password is required.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiPostJson<{ message: string; newEmail: string }>("/auth/change-email", {
        newEmail: newEmail.trim(),
        currentPassword,
      });
      setMessage(`${response.message} Please verify ${response.newEmail}.`);
      setCurrentPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not change email.");
    } finally {
      setIsLoading(false);
    }
  };

  const requestResetCode = async () => {
    setResetError("");
    setResetMessage("");
    if (!resetEmail.trim()) {
      setResetError("Email is required.");
      return;
    }

    setIsRequestingCode(true);
    try {
      const response = await apiPostJson<{ message: string }>("/auth/request-password-reset", {
        email: resetEmail.trim(),
      });
      setResetMessage(response.message);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "Could not request reset code.");
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResetError("");
    setResetMessage("");

    if (!resetEmail.trim()) {
      setResetError("Email is required.");
      return;
    }
    if (!resetCode.trim()) {
      setResetError("Reset code is required.");
      return;
    }
    if (!newPassword.trim()) {
      setResetError("New password is required.");
      return;
    }

    setIsResettingPassword(true);
    try {
      const response = await apiPostJson<{ message: string }>("/auth/reset-password", {
        email: resetEmail.trim(),
        code: resetCode.trim(),
        newPassword,
      });
      setResetMessage(response.message);
      setResetCode("");
      setNewPassword("");
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12">
        <div className="w-full">
          <div className="mb-8 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Account Settings
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Manage your email and password.
              </p>
            </div>
            <Link
              to="/home"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              Back to home
            </Link>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur sm:p-7">
            <div className="space-y-8">
              <form onSubmit={handleChangeEmail} className="space-y-6" noValidate>
                <h2 className="text-lg font-semibold text-slate-100">Change email</h2>

                <div className="space-y-2">
                  <label htmlFor="newEmail" className="text-sm font-medium text-slate-200">
                    New email
                  </label>
                  <input
                    id="newEmail"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
                    placeholder="new-email@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="currentPassword" className="text-sm font-medium text-slate-200">
                    Current password
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
                    placeholder="Enter current password"
                  />
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}

                {message ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    {message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? "Updating..." : "Change email"}
                </button>
              </form>

              <form onSubmit={handleResetPassword} className="space-y-6 border-t border-white/10 pt-6" noValidate>
                <h2 className="text-lg font-semibold text-slate-100">Reset password</h2>

                <div className="space-y-2">
                  <label htmlFor="resetEmail" className="text-sm font-medium text-slate-200">
                    Email
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="resetEmail"
                      type="email"
                      autoComplete="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
                      placeholder="you@example.com"
                    />
                    <button
                      type="button"
                      onClick={requestResetCode}
                      disabled={isRequestingCode}
                      className="inline-flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-70"
                    >
                      {isRequestingCode ? "Sending..." : "Send code"}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="resetCode" className="text-sm font-medium text-slate-200">
                    Reset code
                  </label>
                  <input
                    id="resetCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
                    placeholder="123456"
                  />
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
                </div>

                {resetError ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                    {resetError}
                  </div>
                ) : null}

                {resetMessage ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    {resetMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isResettingPassword ? "Resetting..." : "Reset password"}
                </button>
              </form>
            </div>
          </section>

          <p className="mt-6 text-center text-xs text-slate-500">
            Built with React + TypeScript + Tailwind
          </p>
        </div>
      </main>
    </div>
  );
}
