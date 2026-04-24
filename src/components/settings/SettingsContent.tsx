import { AppearanceSettings } from "./AppearanceSettings";
import { ClassesSettings } from "./ClassesSettings";
import { ContractsSettings } from "./ContractsSettings";
import { GeneralSettings } from "./GeneralSettings";
import { IntegrationsSettings } from "./IntegrationsSettings";
import { ModalitiesSettings } from "./ModalitiesSettings";
import { NotificationsSettings } from "./NotificationsSettings";
import { TeachersSettings } from "./TeachersSettings";
import { UnitsSettings } from "./UnitsSettings";
import { UsersSettings } from "./UsersSettings";
import type { SettingsSection } from "@/lib/settings/types";

export function SettingsContent({ activeSection }: { activeSection: SettingsSection }) {
  switch (activeSection) {
    case "geral":
      return <GeneralSettings />;
    case "aparencia":
      return <AppearanceSettings />;
    case "usuarios":
      return <UsersSettings />;
    case "unidades":
      return <UnitsSettings />;
    case "modalidades":
      return <ModalitiesSettings />;
    case "turmas":
      return <ClassesSettings />;
    case "professores":
      return <TeachersSettings />;
    case "contratos":
      return <ContractsSettings />;
    case "notificacoes":
      return <NotificationsSettings />;
    case "integracoes":
      return <IntegrationsSettings />;
    default:
      return <GeneralSettings />;
  }
}
