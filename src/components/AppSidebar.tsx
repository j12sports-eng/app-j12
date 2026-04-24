import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserCog,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  FileText,
  Sparkles,
  Settings,
  LogOut,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { useAuth, type Role } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { branding } from "@/lib/branding";
import { useSettingsState } from "@/lib/settings/settings-store";

type Item = { to: string; label: string; icon: typeof Users; roles: Role[] };

const ITEMS: Item[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "coordenador", "professor", "aluno"],
  },
  { to: "/alunos", label: "Alunos", icon: Users, roles: ["admin", "coordenador", "professor", "aluno"] },
  { to: "/professores", label: "Professores", icon: UserCog, roles: ["admin", "coordenador"] },
  {
    to: "/turmas",
    label: "Turmas",
    icon: GraduationCap,
    roles: ["admin", "coordenador", "professor"],
  },
  {
    to: "/presenca",
    label: "Presença",
    icon: CalendarCheck,
    roles: ["admin", "coordenador", "professor"],
  },
  {
    to: "/aula-experimental",
    label: "Aula Experimental",
    icon: Sparkles,
    roles: ["admin", "coordenador"],
  },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign, roles: ["admin", "coordenador"] },
  { to: "/planos", label: "Planos", icon: ClipboardList, roles: ["admin", "coordenador"] },
  { to: "/contratos", label: "Contratos", icon: FileText, roles: ["admin", "coordenador", "aluno"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
];

const SELF_SERVICE_ITEMS: Item[] = [
  { to: "/dashboard", label: "Meu Painel", icon: LayoutDashboard, roles: ["aluno", "responsavel"] },
  { to: "/alunos", label: "Meu Perfil", icon: Users, roles: ["aluno", "responsavel"] },
  { to: "/meu-plano", label: "Meu Plano", icon: ClipboardList, roles: ["aluno", "responsavel"] },
  { to: "/financeiro", label: "Meu Financeiro", icon: DollarSign, roles: ["aluno", "responsavel"] },
  { to: "/presenca", label: "Minha Presenca", icon: CalendarCheck, roles: ["aluno", "responsavel"] },
  { to: "/contratos", label: "Meu Contrato", icon: FileText, roles: ["aluno", "responsavel"] },
  { to: "/notificacoes", label: "Notificacoes", icon: Bell, roles: ["aluno", "responsavel"] },
  { to: "/trocar-senha", label: "Trocar Senha", icon: ShieldCheck, roles: ["aluno", "responsavel"] },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, hasRole, isSelfService } = useAuth();
  const settings = useSettingsState();
  const location = useLocation();
  const navigate = useNavigate();

  const visible = (isSelfService ? SELF_SERVICE_ITEMS : ITEMS).filter((i) => hasRole(...i.roles));

  return (
    <aside
      className="flex h-full w-64 flex-col border-r border-sidebar-border text-sidebar-foreground"
      style={{
        background: "var(--app-menu-bg, var(--color-sidebar))",
        color: "var(--app-menu-foreground, var(--color-sidebar-foreground))",
      }}
    >
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <img
          src={settings.general.logoDataUrl || branding.logo}
          alt={`Logo ${settings.general.companyName || branding.name}`}
          className="h-10 w-10 object-contain"
        />
        <div>
          <div className="text-sm font-bold tracking-wide">
            {settings.general.companyName || branding.name}
          </div>
          <div className="text-xs text-muted-foreground">
            {settings.general.slogan || branding.subtitle}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visible.map((item) => {
          const active =
            location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 px-2">
          <div className="text-sm font-semibold truncate">{user?.nome}</div>
          <div className="text-xs text-muted-foreground capitalize">{user?.role}</div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate({ to: "/login" });
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-destructive/15 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
