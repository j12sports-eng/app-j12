import { useState } from "react";
import { Blocks, Pencil, Plus, Trash2 } from "lucide-react";
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
import type { ModalityItem } from "@/lib/settings/types";
import { SettingsEmptyState, SettingsPanel } from "./shared";

type ModalityFormState = Omit<ModalityItem, "id" | "updatedAt">;

const defaultForm: ModalityFormState = {
  nome: "",
  descricao: "",
  destaque: "#FF6B00",
  ativa: true,
};

export function ModalitiesSettings() {
  const settings = useSettingsState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ModalityItem | null>(null);
  const [form, setForm] = useState<ModalityFormState>(defaultForm);

  function openCreate() {
    setEditingItem(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(item: ModalityItem) {
    setEditingItem(item);
    setForm({
      nome: item.nome,
      descricao: item.descricao,
      destaque: item.destaque,
      ativa: item.ativa,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da modalidade.");
      return;
    }

    if (editingItem) {
      settingsStore.updateModality(editingItem.id, form);
      toast.success("Modalidade atualizada.");
    } else {
      settingsStore.createModality(form);
      toast.success("Modalidade criada.");
    }

    setDialogOpen(false);
  }

  function handleDelete(item: ModalityItem) {
    if (!window.confirm(`Excluir a modalidade ${item.nome}?`)) return;
    settingsStore.removeModality(item.id);
    toast.success("Modalidade removida.");
  }

  return (
    <SettingsPanel
      title="Modalidades"
      description="Monte o catalogo comercial e pedagogico com destaque visual e status operacional."
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-400">
          {settings.modalities.filter((item) => item.ativa).length} modalidade(s) ativa(s).
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova modalidade
        </Button>
      </div>

      {settings.modalities.length === 0 ? (
        <SettingsEmptyState
          title="Nenhuma modalidade configurada"
          description="Cadastre modalidades para estruturar a oferta esportiva da J12."
          icon={Blocks}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {settings.modalities.map((item) => (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.destaque }}
                    />
                    <h4 className="text-lg font-semibold text-slate-100">{item.nome}</h4>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{item.descricao}</p>
                </div>
                <Badge
                  className={
                    item.ativa
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-slate-500/15 text-slate-300"
                  }
                >
                  {item.ativa ? "Ativa" : "Inativa"}
                </Badge>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(item)}
                  className="border-red-400/30 text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/10 bg-[#09101b] text-slate-100">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar modalidade" : "Nova modalidade"}</DialogTitle>
            <DialogDescription>
              Essa lista prepara o app para APIs de catalogo e ofertas comerciais.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field
              label="Nome"
              value={form.nome}
              onChange={(value) => setForm((current) => ({ ...current, nome: value }))}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Descricao</label>
              <Textarea
                value={form.descricao}
                onChange={(event) =>
                  setForm((current) => ({ ...current, descricao: event.target.value }))
                }
                className="min-h-[110px] border-white/10 bg-black/20 text-slate-100"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Cor de destaque</label>
                <Input
                  type="color"
                  value={form.destaque}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, destaque: event.target.value }))
                  }
                  className="h-12 border-white/10 bg-black/20 p-1"
                />
              </div>
              <label className="flex items-center gap-2 pt-8 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.ativa}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ativa: event.target.checked }))
                  }
                />
                Modalidade ativa
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingItem ? "Salvar modalidade" : "Criar modalidade"}
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
