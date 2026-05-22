import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  Home,
  Settings,
  User,
  Users,
} from "lucide-react";

import { PortalShell, type PortalShellMenuItem } from "@/components/layout/PortalShell";
import { ResponsavelAlunoSelector } from "@/components/ResponsavelAlunoSelector";
import { useAuth } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
};

const menuItems: PortalShellMenuItem[] = [
  {
    to: "/portal-responsavel/dashboard",
    label: "Dashboard",
    icon: Home,
    activePaths: ["/dashboard/aluno"],
    section: "overview",
  },
  { to: "/portal-responsavel/meus-filhos", label: "Meus Filhos", icon: Users, section: "overview" },
  { to: "/portal-responsavel/financeiro", label: "Financeiro", icon: CreditCard, section: "revenue" },
  { to: "/portal-responsavel/presencas", label: "Frequencia", icon: CalendarCheck, section: "operation" },
  { to: "/portal-responsavel/agenda", label: "Agenda", icon: CalendarDays, section: "operation" },
  { to: "/portal-responsavel/notificacoes", label: "Comunicados", icon: Bell, section: "account" },
  { to: "/portal-responsavel/perfil", label: "Perfil", icon: User, section: "account" },
  { to: "/portal-responsavel/configuracoes", label: "Configuracoes", icon: Settings, section: "account" },
];

export function PortalResponsavelLayout({ children }: Props) {
  const { user } = useAuth();

  return (
    <PortalShell
      roles={["responsavel"]}
      menuItems={menuItems}
      portalLabel="Portal do responsavel"
      workspaceTitle="Central da familia"
      workspaceDescription="Acompanhamento dos alunos, pagamentos, presenca e comunicados."
      contextControl={<ResponsavelAlunoSelector />}
      account={{
        label: "Familia",
        title: user?.nome || "Responsavel J12",
        subtitle: user?.email,
        icon: Users,
      }}
    >
      {children}
    </PortalShell>
  );
}
