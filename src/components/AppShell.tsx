import { Link, useLocation } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  DollarSign,
  Home,
  Menu,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AppSidebar, type AppSidebarAccount, type AppSidebarNavItem } from "./AppSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth, type Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

type MobileNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  activePaths?: string[];
};

const ADMIN_MOBILE_NAV: MobileNavItem[] = [
  { to: "/dashboard", label: "Painel", icon: Home, roles: ["admin", "coordenador"] },
  { to: "/alunos", label: "Alunos", icon: Users, roles: ["admin", "coordenador"] },
  {
    to: "/presencas",
    label: "Presenca",
    icon: CalendarCheck,
    roles: ["admin", "coordenador", "professor"],
  },
  { to: "/financeiro", label: "Receita", icon: DollarSign, roles: ["admin", "coordenador"] },
];

const SELF_SERVICE_MOBILE_NAV: MobileNavItem[] = [
  { to: "/dashboard", label: "Painel", icon: Home, roles: ["aluno", "responsavel"] },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign, roles: ["aluno", "responsavel"] },
  { to: "/presenca", label: "Presenca", icon: CalendarCheck, roles: ["aluno", "responsavel"] },
  { to: "/notificacoes", label: "Avisos", icon: Bell, roles: ["aluno", "responsavel"] },
];

type AppShellProps = {
  title: string;
  children: ReactNode;
  navItems?: AppSidebarNavItem[];
  sidebarAccount?: AppSidebarAccount;
  sidebarContextControl?: ReactNode;
  sidebarWorkspaceTitle?: string;
  sidebarWorkspaceDescription?: string;
  contentClassName?: string;
};

export function AppShell({
  title,
  children,
  navItems,
  sidebarAccount,
  sidebarContextControl,
  sidebarWorkspaceTitle,
  sidebarWorkspaceDescription,
  contentClassName,
}: AppShellProps) {
  const { logout, hasRole, isSelfService } = useAuth();
  const location = useLocation();
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

  const mobileBaseItems = navItems?.map((item) => ({
    to: item.to,
    label: item.label,
    icon: item.icon,
    roles: item.roles,
    activePaths: item.activePaths,
  })) ?? (isSelfService ? SELF_SERVICE_MOBILE_NAV : ADMIN_MOBILE_NAV);

  const mobileItems = mobileBaseItems.filter((item) => !item.roles?.length || hasRole(...item.roles));

  return (
    <div
      className="flex min-h-screen w-full bg-background text-foreground"
      style={{ background: "var(--app-page-bg, var(--color-background))" }}
    >
      <div className="hidden md:block">
        <AppSidebar
          items={navItems}
          account={sidebarAccount}
          contextControl={sidebarContextControl}
          workspaceTitle={sidebarWorkspaceTitle}
          workspaceDescription={sidebarWorkspaceDescription}
        />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,69,0,0.08),transparent_280px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:100%_100%,72px_72px,72px_72px]" />

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
                  <AppSidebar
                    onNavigate={() => setOpen(false)}
                    items={navItems}
                    account={sidebarAccount}
                    contextControl={sidebarContextControl}
                    workspaceTitle={sidebarWorkspaceTitle}
                    workspaceDescription={sidebarWorkspaceDescription}
                  />
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

            <div className="flex items-center gap-2">
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

              <button
                onClick={logout}
                className="hidden rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 sm:inline-flex"
              >
                Encerrar sessao
              </button>
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 p-4 pb-24 md:p-6">
          {sidebarContextControl && (
            <div className="mb-5 rounded-3xl border border-white/10 bg-card p-3 md:hidden">
              {sidebarContextControl}
            </div>
          )}
          <div className={contentClassName}>{children}</div>
        </main>

        {mobileItems.length > 0 && (
          <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/10 bg-black/90 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur md:hidden">
            <div className="grid grid-cols-4 gap-1">
              {mobileItems.slice(0, 4).map((item) => {
                const Icon = item.icon;
                const activePaths = [item.to, ...(item.activePaths || [])];
                const active = activePaths.some(
                  (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
                );

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-slate-400 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        <footer
          className="relative z-10 hidden border-t border-white/8 px-4 py-3 text-xs text-slate-400 md:block md:px-6"
          style={{
            background:
              "var(--app-footer-bg, color-mix(in srgb, var(--color-card) 92%, transparent))",
            color: "var(--app-footer-foreground, var(--color-foreground))",
          }}
        >
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <span>J12 Sports - plataforma operacional e comercial</span>
            <span>Performance, receita e relacionamento no mesmo workspace</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
