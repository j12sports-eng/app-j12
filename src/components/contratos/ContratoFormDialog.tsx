import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODALIDADES, useAlunos } from "@/lib/alunos-store";
import {
  buildVariaveis,
  contratosStore,
  draftFromAluno,
  type Contrato,
  type ContratoInput,
} from "@/lib/contratos-store";
import { CONTRATO_TEMPLATE_J12, renderTemplate } from "@/lib/contratos-template";
import { useSettingsState } from "@/lib/settings/settings-store";
import { useTurmas } from "@/lib/turmas-store";

const MODALIDADES_DISPONIVEIS = ["Futsal", "Society", "Escolinha", "Goleiro"];
const UNIDADES_DISPONIVEIS = [
  "Pirituba â€” SP",
  "Lapa â€” SP",
  "Freguesia do Ã“ â€” SP",
  "Perus â€” SP",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contrato?: Contrato | null;
}

export function ContratoFormDialog({ open, onOpenChange, contrato }: Props) {
  const alunos = useAlunos();
  const settings = useSettingsState();
  const turmas = useTurmas();
  const [alunoId, setAlunoId] = useState("");
  const [form, setForm] = useState<ContratoInput | null>(null);
  const [conteudo, setConteudo] = useState("");
  const [editandoTexto, setEditandoTexto] = useState(false);

  const modalidadeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...settings.modalities.filter((item) => item.ativa).map((item) => item.nome),
          ...turmas.map((turma) => turma.modalidade),
          ...MODALIDADES,
        ]),
      ),
    [settings.modalities, turmas],
  );

  const unidadeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...settings.units.map((unit) => unit.nome),
          ...turmas.map((turma) => turma.unidade),
        ]),
      ),
    [settings.units, turmas],
  );

  useEffect(() => {
    if (!open) return;
    if (contrato) {
      setAlunoId(contrato.alunoId);
      setForm({
        alunoId: contrato.alunoId,
        responsavel: contrato.responsavel,
        plano: contrato.plano,
        valorTotal: contrato.valorTotal,
        parcelas: contrato.parcelas,
        diaVencimento: contrato.diaVencimento,
        dataInicio: contrato.dataInicio,
        dataFim: contrato.dataFim,
      });
      setConteudo(contrato.conteudo);
      setEditandoTexto(false);
    } else {
      setAlunoId("");
      setForm(null);
      setConteudo("");
      setEditandoTexto(false);
    }
  }, [open, contrato]);

  useEffect(() => {
    if (!alunoId || contrato) return;
    const draft = draftFromAluno(alunoId);
    if (draft) setForm(draft);
  }, [alunoId, contrato]);

  const previewConteudo = useMemo(() => {
    if (!form) return "";
    if (editandoTexto) return conteudo;
    const aluno = alunos.find((item) => item.id === form.alunoId);
    const vars = buildVariaveis(form, aluno?.nome ?? "â€”", aluno?.dataNascimento ?? "");
    return renderTemplate(CONTRATO_TEMPLATE_J12, vars);
  }, [form, conteudo, editandoTexto, alunos]);

  function update<K extends keyof ContratoInput>(key: K, value: ContratoInput[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateResp<K extends keyof ContratoInput["responsavel"]>(
    key: K,
    value: ContratoInput["responsavel"][K],
  ) {
    setForm((prev) =>
      prev ? { ...prev, responsavel: { ...prev.responsavel, [key]: value } } : prev,
    );
  }

  function updatePlano<K extends keyof ContratoInput["plano"]>(
    key: K,
    value: ContratoInput["plano"][K],
  ) {
    setForm((prev) => (prev ? { ...prev, plano: { ...prev.plano, [key]: value } } : prev));
  }

  function salvar() {
    if (!form) return;
    if (!form.alunoId) {
      toast.error("Selecione um aluno");
      return;
    }
    if (!form.responsavel.nome) {
      toast.error("Informe o nome do responsÃ¡vel");
      return;
    }

    const conteudoFinal = editandoTexto ? conteudo : undefined;

    if (contrato) {
      contratosStore.update(contrato.id, form, conteudoFinal);
      toast.success("Contrato atualizado");
    } else {
      contratosStore.create(form, conteudoFinal);
      toast.success("Contrato criado como rascunho");
    }

    onOpenChange(false);
  }

  const valorMensal =
    form && form.parcelas > 0 ? form.valorTotal / form.parcelas : (form?.valorTotal ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contrato ? "Editar contrato" : "Novo contrato"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Modelo oficial J12 com variÃ¡veis preenchidas automaticamente. Edite o que precisar e
            veja o preview ao lado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="j12-surface p-4">
              <Label>Aluno</Label>
              <Select value={alunoId} onValueChange={setAlunoId} disabled={!!contrato}>
                <SelectTrigger className="j12-field mt-2">
                  <SelectValue placeholder="Selecione o aluno" />
                </SelectTrigger>
                <SelectContent>
                  {alunos.map((aluno) => (
                    <SelectItem key={aluno.id} value={aluno.id}>
                      {aluno.nome} â€” {aluno.modalidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form && (
              <>
                <fieldset className="j12-surface space-y-3 p-4">
                  <legend className="px-1 text-xs font-semibold uppercase text-muted-foreground">
                    ResponsÃ¡vel
                  </legend>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Nome completo</Label>
                      <Input
                        value={form.responsavel.nome}
                        onChange={(e) => updateResp("nome", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>CPF</Label>
                      <Input
                        value={form.responsavel.cpf}
                        onChange={(e) => updateResp("cpf", e.target.value)}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input
                        value={form.responsavel.telefone}
                        onChange={(e) => updateResp("telefone", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <Input
                        value={form.responsavel.email}
                        onChange={(e) => updateResp("email", e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>EndereÃ§o completo</Label>
                      <Input
                        value={form.responsavel.endereco}
                        onChange={(e) => updateResp("endereco", e.target.value)}
                        placeholder="Rua, nÂº, bairro, cidade, CEP"
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="j12-surface space-y-3 p-4">
                  <legend className="px-1 text-xs font-semibold uppercase text-muted-foreground">
                    Plano
                  </legend>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Tipo</Label>
                      <Select
                        value={form.plano.tipo}
                        onValueChange={(value) => updatePlano("tipo", value)}
                      >
                        <SelectTrigger className="j12-field mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Mensal", "Trimestral", "Semestral", "Anual"].map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Modalidades (selecione uma ou mais)</Label>
                      <div className="j12-panel-section mt-1 flex flex-wrap gap-3 rounded-md p-3">
                        {modalidadeOptions.map((modalidade) => {
                          const checked = form.plano.modalidades.includes(modalidade);
                          return (
                            <label key={modalidade} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  const novas = value
                                    ? [...form.plano.modalidades, modalidade]
                                    : form.plano.modalidades.filter((item) => item !== modalidade);
                                  updatePlano("modalidades", novas);
                                }}
                              />
                              {modalidade}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <Label>FrequÃªncia</Label>
                      <Input
                        value={form.plano.frequencia}
                        onChange={(e) => updatePlano("frequencia", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Dias e horÃ¡rio</Label>
                      <Input
                        value={form.plano.horario}
                        onChange={(e) => updatePlano("horario", e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Unidades (selecione uma ou mais)</Label>
                      <div className="j12-panel-section mt-1 flex flex-wrap gap-3 rounded-md p-3">
                        {unidadeOptions.map((unidade) => {
                          const checked = form.plano.unidades.includes(unidade);
                          return (
                            <label key={unidade} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  const novas = value
                                    ? [...form.plano.unidades, unidade]
                                    : form.plano.unidades.filter((item) => item !== unidade);
                                  updatePlano("unidades", novas);
                                }}
                              />
                              {unidade}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="j12-surface space-y-3 p-4">
                  <legend className="px-1 text-xs font-semibold uppercase text-muted-foreground">
                    Financeiro e vigÃªncia
                  </legend>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label>Valor total (R$)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.valorTotal}
                        onChange={(e) => update("valorTotal", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Parcelas</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.parcelas}
                        onChange={(e) => update("parcelas", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Dia venc.</Label>
                      <Input
                        type="number"
                        min={1}
                        max={28}
                        value={form.diaVencimento}
                        onChange={(e) => update("diaVencimento", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Data inÃ­cio</Label>
                      <Input
                        type="date"
                        value={form.dataInicio}
                        onChange={(e) => update("dataInicio", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Data fim</Label>
                      <Input
                        type="date"
                        value={form.dataFim}
                        onChange={(e) => update("dataFim", e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="j12-panel-section w-full px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Mensal:</span>{" "}
                        <span className="font-semibold text-primary">
                          {valorMensal.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </fieldset>
              </>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Preview do contrato</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!editandoTexto) setConteudo(previewConteudo);
                  setEditandoTexto((value) => !value);
                }}
                disabled={!form}
              >
                {editandoTexto ? "Voltar ao automÃ¡tico" : "Editar texto manualmente"}
              </Button>
            </div>
            <Textarea
              readOnly={!editandoTexto}
              value={editandoTexto ? conteudo : previewConteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="j12-field h-[520px] font-mono text-xs leading-relaxed"
              placeholder="Selecione um aluno para gerar o contrato..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!form}>
            {contrato ? "Salvar alteraÃ§Ãµes" : "Criar contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
