import { useEffect, useState } from "react";
import { Globe2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settingsStore, useSettingsState } from "@/lib/settings/settings-store";
import type { IntegrationSettingsData } from "@/lib/settings/types";
import { SettingsPanel } from "./shared";

export function IntegrationsSettings() {
  const settings = useSettingsState();
  const [draft, setDraft] = useState<IntegrationSettingsData>(settings.integrations);

  useEffect(() => {
    setDraft(settings.integrations);
  }, [settings.integrations]);

  function handleSave() {
    if (!draft.bankProvider.trim()) {
      toast.error("Informe ao menos o banco ou provedor principal.");
      return;
    }

    settingsStore.saveIntegrations(draft);
    toast.success("Configuracoes de integracao salvas.");
  }

  return (
    <SettingsPanel
      title="Integracoes"
      description="Mantenha endpoints, chaves e webhooks preparados para pagamentos, automacoes e APIs externas."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Banco / Pix"
          value={draft.bankProvider}
          onChange={(value) => setDraft((current) => ({ ...current, bankProvider: value }))}
        />
        <Field
          label="Chave Pix"
          value={draft.pixKey}
          onChange={(value) => setDraft((current) => ({ ...current, pixKey: value }))}
        />
        <Field
          label="API key"
          value={draft.apiKey}
          onChange={(value) => setDraft((current) => ({ ...current, apiKey: value }))}
        />
        <Field
          label="Token de automacao"
          value={draft.automationToken}
          onChange={(value) => setDraft((current) => ({ ...current, automationToken: value }))}
        />
      </div>

      <div className="mt-4 space-y-2">
        <label className="text-sm font-medium text-slate-200">Webhook URL</label>
        <Input
          value={draft.webhookUrl}
          onChange={(event) =>
            setDraft((current) => ({ ...current, webhookUrl: event.target.value }))
          }
          className="border-white/10 bg-black/20 text-slate-100"
        />
      </div>

      <div className="mt-5 rounded-3xl border border-primary/20 bg-primary/10 p-4 text-sm text-slate-300">
        <div className="flex items-center gap-2 text-slate-100">
          <Globe2 className="h-4 w-4 text-primary" />
          Estrutura pronta para backend
        </div>
        <p className="mt-2">
          Esses campos ja estao persistidos e organizados para futura conexao com API real de
          pagamentos e automacoes.
        </p>
      </div>

      <Button onClick={handleSave} className="mt-5">
        <Save className="h-4 w-4" />
        Salvar integracoes
      </Button>
    </SettingsPanel>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-200">{label}</label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-white/10 bg-black/20 text-slate-100"
      />
    </div>
  );
}
