import { Link, useLocation } from "@tanstack/react-router";
import {
  Bell,
  CalendarClock,
  ClipboardCheck,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  History,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode } from "react";
import { useAuth, type Role } from "@/lib/auth";
import { branding } from "@/lib/branding";
import { useSettingsState } from "@/lib/settings/settings-store";
import { cn } from "@/lib/utils";

export type AppSidebarSectionKey = "overview" | "operation" | "revenue" | "account";

export type AppSidebarNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  section: AppSidebarSectionKey;
  activePaths?: string[];
};

export type AppSidebarAccount = {
  label: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
};

const ITEMS: AppSidebarNavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "coordenador", "professor", "aluno"],
    section: "overview",
  },
  {
    to: "/alunos",
    label: "Alunos",
    icon: Users,
    roles: ["admin", "coordenador", "professor", "aluno"],
    section: "overview",
  },
  {
    to: "/professores",
    label: "Professores",
    icon: UserCog,
    roles: ["admin", "coordenador"],
    section: "operation",
  },
  {
    to: "/turmas",
    label: "Turmas",
    icon: GraduationCap,
    roles: ["admin", "coordenador", "professor"],
    section: "operation",
  },
  {
    to: "/presencas",
    label: "Presenca",
    icon: CalendarCheck,
    roles: ["admin", "coordenador", "professor"],
    section: "operation",
  },
  {
    to: "/admin/agenda",
    label: "Agenda",
    icon: CalendarClock,
    roles: ["admin", "coordenador"],
    section: "operation",
  },
  {
    to: "/admin/quadras",
    label: "Quadras",
    icon: MapPinned,
    roles: ["admin", "coordenador"],
    section: "operation",
  },
  {
    to: "/admin/campeonatos",
    label: "Campeonatos",
    icon: Trophy,
    roles: ["admin", "coordenador"],
    section: "operation",
  },
  {
    to: "/aula-experimental",
    label: "Aula Experimental",
    icon: Sparkles,
    roles: ["admin", "coordenador"],
    section: "operation",
  },
  {
    to: "/admin/enrollments",
    label: "Matriculas",
    icon: ClipboardCheck,
    roles: ["admin", "coordenador"],
    section: "operation",
  },
  {
    to: "/financeiro",
    label: "Financeiro",
    icon: DollarSign,
    roles: ["admin", "coordenador"],
    section: "revenue",
  },
  {
    to: "/admin/financeiro/automacoes/historico",
    label: "Historico de Automacoes",
    icon: History,
    roles: ["admin", "coordenador"],
    section: "revenue",
  },
  {
    to: "/planos",
    label: "Planos",
    icon: ClipboardList,
    roles: ["admin", "coordenador"],
    section: "revenue",
  },
  {
    to: "/contratos",
    label: "Contratos",
    icon: FileText,
    roles: ["admin", "coordenador", "aluno"],
    section: "revenue",
  },
  {
    to: "/configuracoes",
    label: "Configuracoes",
    icon: Settings,
    roles: ["admin"],
    section: "account",
  },
];

const SELF_SERVICE_ITEMS: AppSidebarNavItem[] = [
  {
    to: "/dashboard",
    label: "Meu Painel",
    icon: LayoutDashboard,
    roles: ["aluno", "responsavel"],
    section: "overview",
  },
  {
    to: "/alunos",
    label: "Meu Perfil",
    icon: Users,
    roles: ["aluno", "responsavel"],
    section: "overview",
  },
  {
    to: "/meu-plano",
    label: "Meu Plano",
    icon: ClipboardList,
    roles: ["aluno", "responsavel"],
    section: "revenue",
  },
  {
    to: "/financeiro",
    label: "Meu Financeiro",
    icon: DollarSign,
    roles: ["aluno", "responsavel"],
    section: "revenue",
  },
  {
    to: "/presenca",
    label: "Minha Presenca",
    icon: CalendarCheck,
    roles: ["aluno", "responsavel"],
    section: "operation",
  },
  {
    to: "/contratos",
    label: "Meu Contrato",
    icon: FileText,
    roles: ["aluno", "responsavel"],
    section: "revenue",
  },
  {
    to: "/notificacoes",
    label: "Notificacoes",
    icon: Bell,
    roles: ["aluno", "responsavel"],
    section: "account",
  },
  {
    to: "/trocar-senha",
    label: "Trocar Senha",
    icon: ShieldCheck,
    roles: ["aluno", "responsavel"],
    section: "account",
  },
];

const SECTION_LABELS: Record<AppSidebarSectionKey, string> = {
  overview: "Workspace",
  operation: "Operacao",
  revenue: "Receita",
  account: "Conta",
};

type AppSidebarProps = {
  onNavigate?: () => void;
  items?: AppSidebarNavItem[];
  workspaceTitle?: string;
  workspaceDescription?: string;
  account?: AppSidebarAccount;
  contextControl?: ReactNode;
};

export function AppSidebar({
  onNavigate,
  items,
  workspaceTitle,
  workspaceDescription,
  account,
  contextControl,
}: AppSidebarProps) {
  const { user, logout, hasRole, isSelfService } = useAuth();
  const settings = useSettingsState();
  const location = useLocation();

  const baseItems = items ?? (isSelfService ? SELF_SERVICE_ITEMS : ITEMS);
  const visibleItems = baseItems.filter((item) => !item.roles?.length || hasRole(...item.roles));
  const groupedItems = Object.entries(
    visibleItems.reduce<Record<AppSidebarSectionKey, AppSidebarNavItem[]>>(
      (groups, item) => {
        groups[item.section].push(item);
        return groups;
      },
      { overview: [], operation: [], revenue: [], account: [] },
    ),
  ) as Array<[AppSidebarSectionKey, AppSidebarNavItem[]]>;

  const accountIcon = account?.icon;
  const AccountIcon = accountIcon;
  const accountTitle = account?.title || user?.nome || "Usuario J12";
  const accountSubtitle = account?.subtitle ?? user?.email ?? user?.role;
  const accountLabel = account?.label || "Conta";

  return (
    <aside
      className="flex h-screen w-72 flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(7,7,8,0.98),rgba(16,16,18,0.98))] text-sidebar-foreground"
      style={{
        background:
          "var(--app-menu-bg, linear-gradient(180deg, rgba(7,7,8,0.98), rgba(16,16,18,0.98)))",
        color: "var(--app-menu-foreground, var(--color-sidebar-foreground))",
      }}
    >
      <div className="border-b border-white/10 px-5 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <img
              src={settings.general.logoDataUrl || branding.logo}
              alt={`Logo ${settings.general.companyName || branding.name}`}
              className="h-9 w-9 object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-wide text-white">
              {settings.general.companyName || branding.name}
            </div>
            <div className="mt-1 truncate text-xs text-slate-400">
              {settings.general.slogan || branding.subtitle}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-primary/20 bg-primary/10 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary/90">
            SaaS workspace
          </div>
          <div className="mt-2 text-sm font-medium text-white">
            {workspaceTitle ?? (isSelfService ? "Jornada do aluno" : "Central de operacao")}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-300">
            {workspaceDescription ?? "Navegacao estruturada para rotina, receita e relacionamento."}
          </div>
        </div>
      </div>

      {contextControl && (
        <div className="border-b border-white/10 px-4 py-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3">
            {contextControl}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {groupedItems.map(([section, items]) =>
          items.length === 0 ? null : (
            <div key={section} className="mb-6">
              <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {SECTION_LABELS[section]}
              </div>
              <div className="space-y-1.5">
                {items.map((item) => {
                  const activePaths = [item.to, ...(item.activePaths || [])];
                  const active = activePaths.some(
                    (path) =>
                      location.pathname === path || location.pathname.startsWith(`${path}/`),
                  );
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-all",
                        active
                          ? "border border-primary/30 bg-primary/10 text-white shadow-[0_12px_30px_rgba(255,69,0,0.14)]"
                          : "border border-transparent text-slate-300 hover:border-white/8 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl transition",
                          active
                            ? "bg-primary/15 text-primary"
                            : "bg-white/5 text-slate-400 group-hover:text-white",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{item.label}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ),
        )}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {AccountIcon && <AccountIcon className="h-4 w-4" />}
            {accountLabel}
          </div>
          <div className="truncate text-sm font-semibold text-white">{accountTitle}</div>
          <div className="mt-1 truncate text-xs capitalize text-slate-400">{accountSubtitle}</div>
          <button
            onClick={() => logout()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-300 transition hover:border-rose-400/20 hover:bg-rose-500/10 hover:text-rose-200"
          >
            <LogOut className="h-4 w-4" />
            Encerrar sessao
          </button>
        </div>
      </div>
    </aside>
  );
}
