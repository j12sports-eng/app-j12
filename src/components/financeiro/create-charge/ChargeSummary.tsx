import { CheckCircle2, Copy, ReceiptText, ShieldCheck } from "lucide-react";

import {
  calcChargeValues,
  type CreateChargeFormValues,
  formatMoney,
  getCategoryLabel,
} from "./charge-form";
import type { AlunoOption, CreatedChargeSummary, PlanoOption } from "./types";
import { cn } from "@/lib/utils";

function getAlunoName(aluno: AlunoOption | null) {
  return aluno?.nome || aluno?.nome_completo || "Aluno nao selecionado";
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/8 py-2 last:border-b-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={cn("text-right text-sm font-semibold text-slate-200", strong && "text-white")}>
        {value}
      </span>
    </div>
  );
}

export function ChargeSummary({
  values,
  selectedAluno,
  selectedPlano,
  createdSummary,
  onCopyPix,
}: {
  values: CreateChargeFormValues;
  selectedAluno: AlunoOption | null;
  selectedPlano: PlanoOption | null;
  createdSummary: CreatedChargeSummary | null;
  onCopyPix: (value: string) => void;
}) {
  const calc = calcChargeValues(values);
  const isMensalidade = values.categoria === "mensalidade";
  const categoryLabel = getCategoryLabel(values.categoria);

  return (
    <aside className="rounded-3xl border border-primary/20 bg-primary/10 p-4 shadow-[0_0_38px_rgba(255,69,0,0.10)] lg:sticky lg:top-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Resumo</p>
          <h3 className="mt-2 text-xl font-black text-white">Cobranca</h3>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-black/25 text-primary">
          <ReceiptText className="h-5 w-5" />
        </span>
      </div>

      {createdSummary && (
        <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
            <div className="min-w-0">
              <p className="font-bold text-emerald-100">Cobranca criada</p>
              <p className="mt-1 text-sm text-emerald-100/80">
                Status {createdSummary.status || "PENDENTE"}
              </p>
              {createdSummary.txid && (
                <p className="mt-2 truncate text-xs font-semibold text-emerald-100/70">
                  TXID {createdSummary.txid}
                </p>
              )}
            </div>
          </div>

          {createdSummary.pixCopiaCola && (
            <button
              type="button"
              onClick={() => onCopyPix(createdSummary.pixCopiaCola)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/15"
            >
              <Copy className="h-4 w-4" />
              Copiar PIX
            </button>
          )}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
        <Row label="Aluno" value={getAlunoName(selectedAluno)} strong />
        <Row label="Categoria" value={categoryLabel} />
        {isMensalidade && <Row label="Plano" value={selectedPlano?.nome || values.planoNome || "-"} />}
        {isMensalidade && (
          <Row
            label="Recorrencia"
            value={values.recorrencia === "recorrente" ? "Recorrente" : "Avulsa"}
          />
        )}
        {!isMensalidade && <Row label="Descricao" value={values.descricao || "-"} />}
        <Row label="Valor original" value={formatMoney(calc.original)} />
        <Row label="Desconto R$" value={formatMoney(calc.discountManual)} />
        <Row label="Desconto %" value={`${calc.discountPercent.toLocaleString("pt-BR")}%`} />
        <Row label="Desconto total" value={formatMoney(calc.discountTotal)} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
        <Row
          label="Multa"
          value={
            values.multaTipo === "fixo"
              ? formatMoney(calc.multaPreview)
              : `${values.multaPercentual || "0"}%`
          }
        />
        <Row
          label="Juros"
          value={
            values.jurosTipo === "fixo"
              ? formatMoney(calc.jurosPreview)
              : `${values.jurosPercentual || "0"}%`
          }
        />
        <Row
          label="Encargos"
          value={
            values.encargosTipo === "fixo"
              ? formatMoney(calc.encargosPreview)
              : `${values.encargosPercentual || "0"}%`
          }
        />
        <Row label="Pagamento" value={values.formaPagamento.toUpperCase()} />
      </div>

      <div className="mt-4 rounded-2xl border border-primary/30 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Valor final
            </p>
            <p className="mt-2 text-3xl font-black text-white">{formatMoney(calc.finalValue)}</p>
          </div>
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
      </div>
    </aside>
  );
}

