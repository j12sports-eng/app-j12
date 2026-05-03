import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Menu, Sparkles } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [],
  );

  return (
    <div
      className="flex min-h-screen w-full bg-background text-foreground"
      style={{ background: "var(--app-page-bg, var(--color-background))" }}
    >
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(28,195,182,0.08),transparent_28%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.04),transparent_20%)]" />

        <header
          className="sticky top-0 z-30 border-b border-white/8 px-4 py-3 backdrop-blur md:px-6"
          style={{
            background:
              "color-mix(in srgb, var(--app-header-bg, var(--color-background)) 84%, transparent)",
            color: "var(--app-header-foreground, var(--color-foreground))",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <button
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition hover:bg-white/10 md:hidden"
                    aria-label="Abrir menu"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
                  <AppSidebar onNavigate={() => setOpen(false)} />
                </SheetContent>
              </Sheet>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                    <Sparkles className="h-3 w-3" />
                    SaaS mode
                  </span>
                </div>
                <h1 className="mt-2 truncate text-lg font-semibold tracking-tight md:text-2xl">
                  {title}
                </h1>
              </div>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                <CalendarDays className="h-4 w-4 text-primary" />
                {todayLabel}
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Operacao em tempo real
              </div>
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 p-4 md:p-6">{children}</main>

        <footer
          className="relative z-10 border-t border-white/8 px-4 py-3 text-xs text-slate-400 md:px-6"
          style={{
            background:
              "var(--app-footer-bg, color-mix(in srgb, var(--color-card) 92%, transparent))",
            color: "var(--app-footer-foreground, var(--color-foreground))",
          }}
        >
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <span>J12 Sports · plataforma operacional e comercial</span>
            <span>Performance, receita e relacionamento no mesmo workspace</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
