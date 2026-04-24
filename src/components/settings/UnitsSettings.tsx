import { useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settingsStore, useSettingsState } from "@/lib/settings/settings-store";
import type { Unit } from "@/lib/settings/types";
import { SettingsEmptyState, SettingsPanel } from "./shared";

type UnitFormState = Omit<Unit, "id">;

const defaultForm: UnitFormState = {
  nome: "",
  endereco: "",
  telefone: "",
};

export function UnitsSettings() {
  const settings = useSettingsState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [form, setForm] = useState<UnitFormState>(defaultForm);

  function openCreate() {
    setEditingUnit(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(unit: Unit) {
    setEditingUnit(unit);
    setForm({
      nome: unit.nome,
      endereco: unit.endereco,
      telefone: unit.telefone,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da unidade.");
      return;
    }

    if (editingUnit) {
      settingsStore.updateUnit(editingUnit.id, form);
      toast.success("Unidade atualizada.");
    } else {
      settingsStore.createUnit(form);
      toast.success("Unidade criada.");
    }

    setDialogOpen(false);
  }

  function handleDelete(unit: Unit) {
    if (!window.confirm(`Excluir a unidade ${unit.nome}?`)) return;
    settingsStore.removeUnit(unit.id);
    toast.success("Unidade removida.");
  }

  return (
    <SettingsPanel
      title="Unidades"
      description="Configure os nucleos, contatos e enderecos operacionais da rede J12."
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-400">
          {settings.units.length} unidade(s) ativas no catalogo interno.
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova unidade
        </Button>
      </div>

      {settings.units.length === 0 ? (
        <SettingsEmptyState
          title="Nenhuma unidade cadastrada"
          description="Crie nucleos operacionais para vincular professores, turmas e contratos."
          icon={Building2}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {settings.units.map((unit) => (
            <article key={unit.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-slate-100">{unit.nome}</h4>
                  <p className="mt-2 text-sm text-slate-400">{unit.endereco}</p>
                  <p className="mt-1 text-sm text-slate-500">{unit.telefone}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(unit)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(unit)}
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
        <DialogContent className="border-white/10 bg-[#09101b] text-slate-100">
          <DialogHeader>
            <DialogTitle>{editingUnit ? "Editar unidade" : "Nova unidade"}</DialogTitle>
            <DialogDescription>
              Esses dados abastecem filtros, cadastros e vinculos de operacao.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field
              label="Nome"
              value={form.nome}
              onChange={(value) => setForm((current) => ({ ...current, nome: value }))}
            />
            <Field
              label="Endereco"
              value={form.endereco}
              onChange={(value) => setForm((current) => ({ ...current, endereco: value }))}
            />
            <Field
              label="Telefone"
              value={form.telefone}
              onChange={(value) => setForm((current) => ({ ...current, telefone: value }))}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editingUnit ? "Salvar unidade" : "Criar unidade"}</Button>
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
