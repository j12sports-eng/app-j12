import { useEffect, useState } from "react";
import { ImageUp, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { settingsStore, useSettingsState } from "@/lib/settings/settings-store";
import type { GeneralSettingsData } from "@/lib/settings/types";
import { SettingsPanel } from "./shared";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao processar arquivo"));
    reader.readAsDataURL(file);
  });
}

export function GeneralSettings() {
  const settings = useSettingsState();
  const [draft, setDraft] = useState<GeneralSettingsData>(settings.general);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(settings.general);
  }, [settings.general]);

  async function handleLogoUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    try {
      const logoDataUrl = await readFileAsDataUrl(file);
      setDraft((current) => ({ ...current, logoDataUrl }));
      toast.success("Logo carregada para visualizacao.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar a logo.");
    }
  }

  async function handleSave() {
    if (!draft.companyName.trim() || !draft.email.trim()) {
      toast.error("Preencha ao menos nome da empresa e e-mail institucional.");
      return;
    }

    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 180));
    settingsStore.saveGeneral(draft);
    setSaving(false);
    toast.success("Configuracoes gerais salvas.");
  }

  return (
    <SettingsPanel
      title="Dados institucionais"
      description="Centralize as informacoes da marca, contato e identidade visual base da J12."
    >
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Nome da empresa"
              value={draft.companyName}
              onChange={(value) => setDraft((current) => ({ ...current, companyName: value }))}
            />
            <Field
              label="CNPJ"
              value={draft.cnpj}
              onChange={(value) => setDraft((current) => ({ ...current, cnpj: value }))}
            />
            <Field
              label="Telefone"
              value={draft.phone}
              onChange={(value) => setDraft((current) => ({ ...current, phone: value }))}
            />
            <Field
              label="WhatsApp"
              value={draft.whatsapp}
              onChange={(value) => setDraft((current) => ({ ...current, whatsapp: value }))}
            />
            <Field
              label="E-mail"
              type="email"
              value={draft.email}
              onChange={(value) => setDraft((current) => ({ ...current, email: value }))}
            />
            <Field
              label="Slogan"
              value={draft.slogan}
              onChange={(value) => setDraft((current) => ({ ...current, slogan: value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Endereco</label>
            <Textarea
              value={draft.address}
              onChange={(event) =>
                setDraft((current) => ({ ...current, address: event.target.value }))
              }
              className="min-h-[110px] border-white/10 bg-black/20 text-slate-100"
            />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="text-sm font-medium text-slate-200">Logo da empresa</div>
          <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-primary/25 bg-gradient-to-br from-primary/10 via-black/20 to-transparent p-6">
            {draft.logoDataUrl ? (
              <img
                src={draft.logoDataUrl}
                alt={draft.companyName}
                className="max-h-36 w-auto object-contain"
              />
            ) : (
              <div className="text-sm text-slate-500">Nenhuma logo enviada.</div>
            )}
          </div>

          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/15">
            <ImageUp className="h-4 w-4" />
            Upload da logo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleLogoUpload(event.target.files)}
            />
          </label>

          <Button onClick={handleSave} className="mt-4 w-full">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar configuracoes"}
          </Button>
        </div>
      </div>
    </SettingsPanel>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-200">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-white/10 bg-black/20 text-slate-100"
      />
    </div>
  );
}
