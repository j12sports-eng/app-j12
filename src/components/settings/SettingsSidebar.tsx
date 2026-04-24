import { settingsSections } from "./shared";
import { cn } from "@/lib/utils";
import type { SettingsSection } from "@/lib/settings/types";

export function SettingsSidebar({
  activeSection,
  onSelect,
}: {
  activeSection: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}) {
  return (
    <aside className="j12-surface p-3">
      <div className="mb-3 px-3 pt-2">
        <div className="text-xs uppercase tracking-[0.22em] text-primary">Painel PRO</div>
        <div className="mt-2 text-lg font-semibold text-foreground">Configurações</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Ajuste identidade, pessoas, estrutura e integrações em um único lugar.
        </div>
      </div>

      <div className="space-y-1">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition",
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-transparent bg-transparent text-foreground/80 hover:border-border hover:bg-card/70",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 rounded-2xl border p-2",
                  active ? "border-primary/30 bg-primary/10" : "border-border bg-card/70",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">{section.label}</div>
                <div
                  className={cn(
                    "mt-1 text-xs",
                    active ? "text-primary/80" : "text-muted-foreground",
                  )}
                >
                  {section.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
