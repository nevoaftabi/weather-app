import React, { useMemo, useState } from "react";
import { Link } from "react-router";
import AppShell from "../ui/AppShell";
import { apiPostJson } from "../auth/api";
import { getTokenClaims } from "../auth/authStore";

export default function Feedback() {
  const accountEmail = useMemo(() => getTokenClaims()?.email ?? "", []);
  const [email, setEmail] = useState(accountEmail);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!body.trim()) {
      setError("Body is required.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiPostJson<{ message: string }>("/api/feedback", {
        email: email.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      setMessage(res.message);
      setBody("");
      setSubject("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send feedback.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell
      title="Feedback"
      subtitle={accountEmail ? "Send feedback from your account." : "Send feedback as a guest or with an account."}
    >
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-200">
            Email
          </label>
          <input
            id="email"
            type="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="subject" className="text-sm font-medium text-slate-200">
            Subject
          </label>
          <input
            id="subject"
            type="text"
            maxLength={120}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
            placeholder="Bug report, feature request, etc."
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="body" className="text-sm font-medium text-slate-200">
            Body
          </label>
          <textarea
            id="body"
            rows={8}
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30"
            placeholder="Tell us what happened or what you'd like to see."
          />
        </div>

        {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
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
            {isLoading ? "Sending..." : "Send feedback"}
          </button>

          <Link to="/home" className="text-sm text-slate-300 hover:text-slate-100">
            Back to home
          </Link>
        </div>
      </form>
    </AppShell>
  );
}
