import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAlunos } from "@/lib/alunos-store";
import {
  financeiroStore,
  type TipoCobranca,
  type TipoLancamento,
  type Transacao,
} from "@/lib/financeiro-store";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  transacao?: Transacao | null;
}

const TIPOS: Array<{ v: TipoCobranca; label: string }> = [
  { v: "mensalidade", label: "Mensalidade" },
  { v: "matricula", label: "Matricula" },
  { v: "uniforme", label: "Uniforme" },
  { v: "evento", label: "Evento" },
  { v: "outros", label: "Outros" },
];

const TIPO_LANCAMENTO: Array<{ v: TipoLancamento; label: string }> = [
  { v: "recorrente", label: "Recorrente" },
  { v: "avulsa", label: "Avulsa" },
];

function formatMoneyInput(value: number | null | undefined) {
  if (!value) return "";
  return value.toFixed(2).replace(".", ",");
}

export function CobrancaDialog({ open, onOpenChange, transacao }: Props) {
  const alunos = useAlunos();
  const [alunoId, setAlunoId] = useState("");
  const [tipo, setTipo] = useState<TipoCobranca>("mensalidade");
  const [tipoCobranca, setTipoCobranca] = useState<TipoLancamento>("avulsa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [valorOriginal, setValorOriginal] = useState("");
  const [descontoValor, setDescontoValor] = useState("");
  const [vencimento, setVencimento] = useState(() => {
    const date = new Date();
    date.setDate(10);
    return date.toISOString().slice(0, 10);
  });
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 7));
  const [jaPago, setJaPago] = useState(false);
  const [saving, setSaving] = useState(false);

  const alunoSelecionado = useMemo(
    () => alunos.find((aluno) => aluno.id === alunoId) ?? null,
    [alunos, alunoId],
  );

  useEffect(() => {
    if (!open) return;

    if (transacao) {
      setAlunoId(transacao.alunoId);
      setTipo(transacao.tipo);
      setTipoCobranca(transacao.tipoCobranca ?? "avulsa");
      setDescricao(transacao.descricao);
      setValor(formatMoneyInput(transacao.valorFinal ?? transacao.valor));
      setValorOriginal(formatMoneyInput(transacao.valorOriginal ?? transacao.valor));
      setDescontoValor(formatMoneyInput(transacao.descontoValor));
      setVencimento(transacao.vencimento);
      setCompetencia(transacao.competencia?.slice(0, 7) ?? transacao.vencimento.slice(0, 7));
      setJaPago(Boolean(transacao.pagoEm));
      return;
    }

    setAlunoId(alunos[0]?.id ?? "");
    setTipo("mensalidade");
    setTipoCobranca("avulsa");
    setDescricao("");
    setValor("");
    setValorOriginal("");
    setDescontoValor("");
    setVencimento(() => {
      const date = new Date();
      date.setDate(10);
      return date.toISOString().slice(0, 10);
    });
    setCompetencia(new Date().toISOString().slice(0, 7));
    setJaPago(false);
  }, [open, alunos, transacao]);

  useEffect(() => {
    if (!alunoSelecionado || transacao) return;

    if (!descricao.trim()) {
      const plano = alunoSelecionado.plano || alunoSelecionado.planos[0] || "Plano do aluno";
      setDescricao(
        tipo === "mensalidade"
          ? `Mensalidade - ${plano}`
          : `${TIPOS.find((item) => item.v === tipo)?.label || "Cobranca"} - ${alunoSelecionado.nome}`,
      );
    }
  }, [alunoSelecionado, descricao, tipo, transacao]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const valorFinal = Number(valor.replace(",", "."));
    const valorBase = Number((valorOriginal || valor).replace(",", "."));
    const desconto = Number(descontoValor.replace(",", ".")) || 0;

    if (!alunoId) return toast.error("Selecione um aluno.");
    if (!descricao.trim()) return toast.error("Informe a descricao da cobranca.");
    if (!valorFinal || valorFinal < 0) return toast.error("Informe um valor final valido.");
    if (!valorBase || valorBase < 0) return toast.error("Informe um valor original valido.");
    if (!vencimento) return toast.error("Informe o vencimento.");

    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      const payload: Parameters<typeof financeiroStore.create>[0] = {
        alunoId,
        tipo,
        tipoCobranca,
        descricao: descricao.trim(),
        valorOriginal: valorBase,
        descontoValor: desconto,
        valorFinal,
        valor: valorFinal,
        vencimento,
        competencia: `${competencia}:${tipoCobranca === "recorrente" ? "mensal" : "avulsa"}`,
        pagoEm: jaPago ? new Date().toISOString().slice(0, 10) : null,
        formaPagamento: jaPago ? ("pix" as const) : undefined,
        planoNome: alunoSelecionado?.plano || alunoSelecionado?.planos[0] || "",
        origem: "manual" as const,
      };

      if (transacao) {
        financeiroStore.update(transacao.id, payload);
        toast.success("Cobranca atualizada.");
      } else {
        financeiroStore.create(payload);
        toast.success("Cobranca criada.");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a cobranca.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";
  const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transacao ? "Editar cobranca" : "Nova cobranca"}</DialogTitle>
          <DialogDescription>
            {transacao
              ? "Atualize os dados financeiros sem perder o historico do aluno."
              : "Crie uma cobranca manual aproveitando o cadastro ja existente do aluno."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelClass}>Aluno *</label>
            <select
              className={inputClass}
              value={alunoId}
              onChange={(event) => setAlunoId(event.target.value)}
            >
              {alunos.map((aluno) => (
                <option key={aluno.id} value={aluno.id}>
                  {aluno.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tipo *</label>
              <select
                className={inputClass}
                value={tipo}
                onChange={(event) => setTipo(event.target.value as TipoCobranca)}
              >
                {TIPOS.map((item) => (
                  <option key={item.v} value={item.v}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Lancamento</label>
              <select
                className={inputClass}
                value={tipoCobranca}
                onChange={(event) => setTipoCobranca(event.target.value as TipoLancamento)}
              >
                {TIPO_LANCAMENTO.map((item) => (
                  <option key={item.v} value={item.v}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Descricao *</label>
            <input
              className={inputClass}
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              placeholder="Mensalidade - Plano do aluno"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Valor original *</label>
              <input
                className={inputClass}
                value={valorOriginal}
                onChange={(event) => setValorOriginal(event.target.value)}
                placeholder="280,00"
                inputMode="decimal"
              />
            </div>
            <div>
              <label className={labelClass}>Desconto</label>
              <input
                className={inputClass}
                value={descontoValor}
                onChange={(event) => setDescontoValor(event.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
            <div>
              <label className={labelClass}>Valor final *</label>
              <input
                className={inputClass}
                value={valor}
                onChange={(event) => setValor(event.target.value)}
                placeholder="280,00"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Competencia</label>
              <input
                type="month"
                className={inputClass}
                value={competencia}
                onChange={(event) => setCompetencia(event.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Vencimento *</label>
              <input
                type="date"
                className={inputClass}
                value={vencimento}
                onChange={(event) => setVencimento(event.target.value)}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
            <input
              type="checkbox"
              checked={jaPago}
              onChange={(event) => setJaPago(event.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Registrar esta cobranca como ja paga
          </label>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              {saving ? "Salvando..." : transacao ? "Salvar alteracoes" : "Criar cobranca"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
