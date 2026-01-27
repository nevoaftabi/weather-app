import React from "react";

export default function AppShell({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12">
        <div className="w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
            ) : null}
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur sm:p-7">
            {children}
          </section>

          <p className="mt-6 text-center text-xs text-slate-500">
            Built with React + TypeScript + Tailwind
          </p>
        </div>
      </main>
    </div>
  );
}
