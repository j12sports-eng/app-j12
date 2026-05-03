import { useEffect, useMemo, useState } from "react";
import { Blocks, BrushCleaning, Building2, FileText, ShieldCheck, UserCog } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ResourceSyncBanner } from "@/components/shared/ResourceSyncBanner";
import { useSettingsState, useSettingsStatus } from "@/lib/settings/settings-store";
import type { SettingsSection } from "@/lib/settings/types";
import { useProfessores } from "@/lib/professores-store";
import { useTurmas } from "@/lib/turmas-store";
import { SettingsContent } from "./SettingsContent";
import { SettingsSidebar } from "./SettingsSidebar";
import { SettingsMetricCard, SettingsSectionSkeleton } from "./shared";

export function SettingsPage() {
  const settings = useSettingsState();
  const settingsStatus = useSettingsStatus();
  const professores = useProfessores();
  const turmas = useTurmas();
  const [activeSection, setActiveSection] = useState<SettingsSection>("geral");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, []);

  const stats = useMemo(
    () => [
      {
        label: "Usuarios",
        value: String(settings.users.length),
        helper: "Perfis ativos para governanca do app",
        icon: ShieldCheck,
      },
      {
        label: "Unidades",
        value: String(settings.units.length),
        helper: "Nucleos operacionais configurados",
        icon: Building2,
      },
      {
        label: "Modalidades",
        value: String(settings.modalities.length),
        helper: "Catalogo esportivo em expansao",
        icon: Blocks,
      },
      {
        label: "Professores",
        value: String(professores.length),
        helper: `${turmas.length} turmas integradas com equipe tecnica`,
        icon: UserCog,
      },
      {
        label: "Templates",
        value: String(settings.contracts.length),
        helper: "Modelos prontos para assinatura futura",
        icon: FileText,
      },
      {
        label: "Tema",
        value: settings.appearance.mode === "dark" ? "Dark" : "Light",
        helper: "Personalizacao premium aplicada em tempo real",
        icon: BrushCleaning,
      },
    ],
    [
      professores.length,
      settings.appearance.mode,
      settings.contracts.length,
      settings.modalities.length,
      settings.units.length,
      settings.users.length,
      turmas.length,
    ],
  );

  const pageLoading = loading || (settingsStatus.loading && !settingsStatus.initialized);

  return (
    <AppShell title="Configuracoes">
      {pageLoading ? (
        <SettingsSectionSkeleton />
      ) : (
        <div className="space-y-6">
          <ResourceSyncBanner
            status={settingsStatus}
            resourceLabel="as configuracoes"
            hasData={settings.users.length > 0 || settings.units.length > 0}
          />

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Configuracoes</h2>
              <p className="text-sm text-muted-foreground">
                Centro administrativo para identidade visual, acessos, estrutura operacional e
                integrações.
              </p>
            </div>

            <div className="j12-surface-soft px-4 py-3 text-sm text-foreground/90">
              Empresa:{" "}
              <span className="font-semibold text-foreground">{settings.general.companyName}</span>
            </div>
          </div>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {stats.map((item) => (
              <SettingsMetricCard
                key={item.label}
                label={item.label}
                value={item.value}
                helper={item.helper}
                icon={item.icon}
              />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[300px_1fr]">
            <SettingsSidebar activeSection={activeSection} onSelect={setActiveSection} />
            <SettingsContent activeSection={activeSection} />
          </section>
        </div>
      )}
    </AppShell>
  );
}
