import { useEffect, useMemo, useState } from "react";
import { MonitorCog, Palette, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultAppearanceSettings } from "@/lib/settings/defaults";
import { settingsStore } from "@/lib/settings/settings-store";
import { useThemeSettings } from "@/lib/settings/theme-context";
import type { AppearanceSettingsData } from "@/lib/settings/types";
import { SettingsPanel } from "./shared";

const colorFields: Array<{ key: keyof AppearanceSettingsData; label: string }> = [
  { key: "headerColor", label: "Cor do cabeçalho" },
  { key: "footerColor", label: "Cor do rodapé" },
  { key: "menuColor", label: "Cor do menu lateral" },
  { key: "menuBackgroundColor", label: "Cor do fundo do menu" },
  { key: "pageBackgroundColor", label: "Cor do fundo geral" },
  { key: "primaryColor", label: "Cor de destaque principal" },
  { key: "buttonColor", label: "Cor dos botões principais" },
  { key: "menuTextColor", label: "Cor do texto do menu" },
  { key: "headerTextColor", label: "Cor do texto do cabeçalho" },
  { key: "cardColor", label: "Cor de superfícies" },
  { key: "textColor", label: "Cor base do texto" },
];

export function AppearanceSettings() {
  const { appearance, updateAppearance } = useThemeSettings();
  const [draft, setDraft] = useState<AppearanceSettingsData>(appearance);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(appearance);
  }, [appearance]);

  const previewStyle = useMemo(
    () => ({
      backgroundColor: draft.cardColor,
      color: draft.textColor,
      borderColor: `${draft.primaryColor}33`,
    }),
    [draft.cardColor, draft.primaryColor, draft.textColor],
  );

  function handleChange<K extends keyof AppearanceSettingsData>(
    key: K,
    value: AppearanceSettingsData[K],
  ) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    updateAppearance(next);
  }

  function handleSave() {
    setSaving(true);
    settingsStore.saveAppearance(draft);
    window.setTimeout(() => {
      toast.success("Aparência global salva e aplicada em todo o sistema.");
      setSaving(false);
    }, 180);
  }

  function handleReset() {
    setDraft(defaultAppearanceSettings);
    settingsStore.saveAppearance(defaultAppearanceSettings);
    toast.success("Tema premium J12 restaurado.");
  }

  return (
    <SettingsPanel
      title="Aparência do sistema"
      description="Personalize cabeçalho, rodapé, menu, fundo e cores principais com preview em tempo real e persistência global."
    >
      <div className="grid gap-5 xl:grid-cols-[1.2fr_380px]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            {colorFields.map((field) => (
              <div key={field.key} className="rounded-3xl border border-border bg-card/60 p-4">
                <div className="mb-3 text-sm font-medium text-foreground">{field.label}</div>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={String(draft[field.key])}
                    onChange={(event) => handleChange(field.key, event.target.value as never)}
                    className="h-12 w-20 border-border bg-transparent p-1"
                  />
                  <Input
                    value={String(draft[field.key])}
                    onChange={(event) => handleChange(field.key, event.target.value as never)}
                    className="j12-field"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar aparência"}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Restaurar padrão
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/70 to-transparent p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Palette className="h-4 w-4" />
              Preview em tempo real
            </div>

            <div
              className="mt-4 overflow-hidden rounded-[28px] border shadow-[var(--shadow-elegant)]"
              style={previewStyle}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ backgroundColor: draft.headerColor, color: draft.headerTextColor }}
              >
                <div>
                  <div className="text-sm font-semibold">Cabeçalho J12</div>
                  <div className="text-xs opacity-80">Aplicação imediata</div>
                </div>
                <div
                  className="rounded-2xl px-3 py-2 text-xs font-semibold"
                  style={{ backgroundColor: draft.buttonColor, color: draft.textColor }}
                >
                  Botão
                </div>
              </div>

              <div
                className="grid min-h-[180px] grid-cols-[92px_1fr]"
                style={{ backgroundColor: draft.pageBackgroundColor }}
              >
                <div
                  className="flex flex-col gap-2 px-3 py-4"
                  style={{ backgroundColor: draft.menuBackgroundColor, color: draft.menuTextColor }}
                >
                  <div
                    className="rounded-xl px-2 py-2 text-xs font-medium"
                    style={{ backgroundColor: draft.menuColor }}
                  >
                    Menu
                  </div>
                  <div className="text-[11px] opacity-80">Dashboard</div>
                  <div className="text-[11px] opacity-80">Alunos</div>
                  <div className="text-[11px] opacity-80">Contratos</div>
                </div>
                <div className="p-4">
                  <div className="rounded-2xl border p-4" style={previewStyle}>
                    <div className="text-sm font-semibold">Painel central</div>
                    <div className="mt-2 text-xs opacity-75">
                      Fundo global, cards, destaque e tipografia já sincronizados.
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="px-4 py-3 text-xs"
                style={{ backgroundColor: draft.footerColor, color: draft.textColor }}
              >
                Rodapé institucional
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/60 p-5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground">
              <MonitorCog className="h-4 w-4 text-primary" />
              Aplicação global
            </div>
            <p className="mt-3">
              As variáveis de tema são centralizadas e reaproveitadas por cabeçalho, menu lateral,
              cards, botões e fundo das páginas.
            </p>
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
