import { useState } from "react";
import { FileSignature, Image, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { settingsStore, useSettingsState } from "@/lib/settings/settings-store";
import type { ContractDocumentType, ContractTemplateSetting } from "@/lib/settings/types";
import { SettingsEmptyState, SettingsPanel } from "./shared";

type ContractFormState = Omit<ContractTemplateSetting, "id" | "updatedAt">;

const defaultForm: ContractFormState = {
  nome: "",
  titulo: "",
  conteudo: "",
  ativo: true,
  documentType: "contrato_principal",
};

const variables = [
  "{{aluno.nome}}",
  "{{plano}}",
  "{{modalidade}}",
  "{{professor.nome}}",
  "{{unidade}}",
];

export function ContractsSettings() {
  const settings = useSettingsState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplateSetting | null>(null);
  const [form, setForm] = useState<ContractFormState>(defaultForm);

  function openCreate() {
    setEditingTemplate(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(template: ContractTemplateSetting) {
    setEditingTemplate(template);
    setForm({
      nome: template.nome,
      titulo: template.titulo,
      conteudo: template.conteudo,
      ativo: template.ativo,
      documentType: template.documentType,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.nome.trim() || !form.titulo.trim() || !form.conteudo.trim()) {
      toast.error("Preencha nome, titulo e conteudo do modelo.");
      return;
    }

    if (editingTemplate) {
      settingsStore.updateContract(editingTemplate.id, form);
      toast.success("Modelo de contrato atualizado.");
    } else {
      settingsStore.createContract(form);
      toast.success("Modelo de contrato criado.");
    }

    setDialogOpen(false);
  }

  function handleDelete(template: ContractTemplateSetting) {
    if (!window.confirm(`Excluir o modelo ${template.nome}?`)) return;
    settingsStore.removeContract(template.id);
    toast.success("Modelo removido.");
  }

  return (
    <SettingsPanel
      title="Contratos"
      description="Gerencie contrato principal, aditivo e direito de uso de imagem com templates reutilizáveis e parâmetros globais."
    >
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <ToggleCard
          title="Contrato principal"
          checked={settings.contractSettings.enableContract}
          onToggle={(checked) =>
            settingsStore.saveContractSettings({
              ...settings.contractSettings,
              enableContract: checked,
            })
          }
        />
        <ToggleCard
          title="Aditivo de contrato"
          checked={settings.contractSettings.enableContractAddendum}
          onToggle={(checked) =>
            settingsStore.saveContractSettings({
              ...settings.contractSettings,
              enableContractAddendum: checked,
            })
          }
        />
        <ToggleCard
          title="Direito de uso de imagem"
          checked={settings.contractSettings.enableImageRights}
          onToggle={(checked) =>
            settingsStore.saveContractSettings({
              ...settings.contractSettings,
              enableImageRights: checked,
            })
          }
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {variables.map((variable) => (
            <Badge key={variable} className="border-primary/20 bg-primary/10 text-primary">
              {variable}
            </Badge>
          ))}
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo modelo
        </Button>
      </div>

      {settings.contracts.length === 0 ? (
        <SettingsEmptyState
          title="Nenhum contrato configurado"
          description="Monte modelos reutilizaveis para aluno, professor e futuras automacoes de assinatura."
          icon={FileSignature}
        />
      ) : (
        <div className="grid gap-4">
          {settings.contracts.map((template) => (
            <article
              key={template.id}
              className="rounded-3xl border border-white/10 bg-black/20 p-5"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold text-slate-100">{template.nome}</h4>
                    <Badge
                      className={
                        template.ativo
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-500/15 text-slate-300"
                      }
                    >
                      {template.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <Badge className="border-primary/20 bg-primary/10 text-primary">
                      {labelForDocumentType(template.documentType)}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{template.titulo}</div>
                  <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-3xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">
                    {template.conteudo}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(template)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(template)}
                    className="border-red-400/30 text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl border-white/10 bg-[#09101b] text-slate-100">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar modelo" : "Novo modelo de contrato"}
            </DialogTitle>
            <DialogDescription>
              Use variaveis dinamicas para manter os documentos prontos para futura integracao com
              assinatura real.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Nome interno"
                value={form.nome}
                onChange={(value) => setForm((current) => ({ ...current, nome: value }))}
              />
              <Field
                label="Titulo do documento"
                value={form.titulo}
                onChange={(value) => setForm((current) => ({ ...current, titulo: value }))}
              />
              <Field
                label="Tipo de documento"
                value={form.documentType}
                as="select"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    documentType: value as ContractDocumentType,
                  }))
                }
                options={[
                  { value: "contrato_principal", label: "Contrato" },
                  { value: "aditivo_contrato", label: "Aditivo" },
                  { value: "direito_uso_imagem", label: "Uso de imagem" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Conteudo</label>
              <Textarea
                value={form.conteudo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, conteudo: event.target.value }))
                }
                className="min-h-[260px] border-white/10 bg-black/20 text-slate-100"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ativo: event.target.checked }))
                }
              />
              Modelo ativo
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingTemplate ? "Salvar modelo" : "Criar modelo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPanel>
  );
}

function Field({
  label,
  value,
  onChange,
  as = "input",
  options = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  as?: "input" | "select";
  options?: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-200">{label}</label>
      {as === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-primary"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="border-white/10 bg-black/20 text-slate-100"
        />
      )}
    </div>
  );
}

function ToggleCard({
  title,
  checked,
  onToggle,
}: {
  title: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
      <span className="flex items-center gap-2">
        {title.includes("imagem") ? (
          <Image className="h-4 w-4 text-primary" />
        ) : (
          <FileSignature className="h-4 w-4 text-primary" />
        )}
        {title}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggle(event.target.checked)}
      />
    </label>
  );
}

function labelForDocumentType(type: ContractDocumentType) {
  switch (type) {
    case "aditivo_contrato":
      return "Aditivo";
    case "direito_uso_imagem":
      return "Uso de imagem";
    default:
      return "Contrato";
  }
}
