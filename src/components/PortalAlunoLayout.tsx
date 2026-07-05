import {
  Bell,
  CalendarDays,
  CreditCard,
  Home,
  IdCard,
  LineChart,
  Settings,
  ShieldCheck,
  Target,
  User,
} from "lucide-react";

import { PortalShell, type PortalShellMenuItem } from "@/components/layout/PortalShell";
import { useAuth } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
};

const menuItems: PortalShellMenuItem[] = [
  { to: "/portal-aluno/dashboard", label: "Dashboard", icon: Home, section: "overview" },
  { to: "/portal-aluno/perfil", label: "Meu Perfil", icon: User, section: "overview" },
  { to: "/portal-aluno/presencas", label: "Frequencia", icon: ShieldCheck, section: "operation" },
  { to: "/portal-aluno/financeiro", label: "Financeiro", icon: CreditCard, section: "revenue" },
  { to: "/portal-aluno/carteirinha", label: "Carteirinha", icon: IdCard, section: "account" },
  { to: "/portal-aluno/treinos", label: "Treinos", icon: Target, section: "operation" },
  { to: "/portal-aluno/agenda", label: "Agenda", icon: CalendarDays, section: "operation" },
  { to: "/portal-aluno/avaliacoes", label: "Avaliacoes", icon: LineChart, section: "operation" },
  { to: "/portal-aluno/notificacoes", label: "Comunicados", icon: Bell, section: "account" },
  { to: "/portal-aluno/configuracoes", label: "Configuracoes", icon: Settings, section: "account" },
];

export function PortalAlunoLayout({ children }: Props) {
  const { user } = useAuth();

  return (
    <PortalShell
      roles={["aluno"]}
      menuItems={menuItems}
      portalLabel="Portal do aluno"
      workspaceTitle="Jornada do aluno"
      workspaceDescription="Rotina, evolucao, financeiro e comunicados no mesmo workspace."
      account={{
        label: "Aluno",
        title: user?.nome || "Aluno J12",
        subtitle: user?.email,
        icon: User,
      }}
    >
      {children}
    </PortalShell>
  );
}
