import type { ReactNode } from "react";

export type PreviewShellProps = {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
};

/** Shared visual boundary for isolated Command Center previews. */
export function PreviewShell({ children, description, eyebrow, title }: PreviewShellProps) {
  return (
    <main className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-3xl border border-primary/20 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      </header>
      {children}
    </main>
  );
}
