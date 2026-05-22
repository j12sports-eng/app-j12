import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { type AppSidebarSectionKey } from "@/components/AppSidebar";
import { type Role } from "@/lib/auth";

export type PortalShellMenuItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  activePaths?: string[];
  section?: AppSidebarSectionKey;
};

type PortalShellAccount = {
  label: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
};

type PortalShellProps = {
  children: ReactNode;
  roles: Role[];
  menuItems: PortalShellMenuItem[];
  portalLabel: string;
  account?: PortalShellAccount;
  contextControl?: ReactNode;
  contentClassName?: string;
  workspaceTitle?: string;
  workspaceDescription?: string;
};

export function PortalShell({
  children,
  roles,
  menuItems,
  portalLabel,
  account,
  contextControl,
  contentClassName,
  workspaceTitle,
  workspaceDescription,
}: PortalShellProps) {
  return (
    <ProtectedRoute roles={roles}>
      <AppShell
        title={portalLabel}
        navItems={menuItems.map((item) => ({
          ...item,
          section: item.section ?? "overview",
          roles,
        }))}
        sidebarAccount={account}
        sidebarContextControl={contextControl}
        sidebarWorkspaceTitle={workspaceTitle}
        sidebarWorkspaceDescription={workspaceDescription}
        contentClassName={contentClassName ?? "mx-auto max-w-7xl"}
      >
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}
