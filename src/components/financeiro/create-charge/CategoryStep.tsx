import type { UseFormReturn } from "react-hook-form";
import { CalendarClock, ReceiptText, Repeat2, WalletCards } from "lucide-react";

import {
  CHARGE_CATEGORIES,
  RECURRENCE_OPTIONS,
  type CreateChargeFormValues,
  formatBRLInput,
  formatMoney,
  parseBRL,
} from "./charge-form";
import type { AlunoOption, PlanoOption } from "./types";
import { cn } from "@/lib/utils";

function getAlunoName(aluno: AlunoOption | null) {
  return aluno?.nome || aluno?.nome_completo || "Aluno";
}

function getPlanoValue(plano: PlanoOption | null) {
  return Number(
    plano?.precoMensal ?? plano?.preco_mensal ?? plano?.mensalidade ?? plano?.valor ?? 0,
  );
}

export function CategoryStep({
  form,
  selectedAluno,
  selectedPlano,
  planos,
  onSelectPlano,
}: {
  form: UseFormReturn<CreateChargeFormValues>;
  selectedAluno: AlunoOption | null;
  selectedPlano: PlanoOption | null;
  planos: PlanoOption[];
  onSelectPlano: (planoId: string) => void;
}) {
  const categoria = form.watch("categoria");
  const recorrencia = form.watch("recorrencia");
  const isMensalidade = categoria === "mensalidade";
  const errors = form.formState.errors;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Etapa 2</p>
        <h3 className="mt-2 text-xl font-black text-white md:text-2xl">Categoria da cobranca</h3>
        <p className="mt-1 text-sm text-slate-400">
          Mensalidade usa o plano do aluno. Outras categorias recebem descricao e valor manual.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CHARGE_CATEGORIES.map((item) => {
          const active = categoria === item.value;

          return (
            <button
              type="button"
              key={item.value}
              onClick={() => {
                form.setValue("categoria", item.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              className={cn(
                "rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5",
                active
                  ? "border-primary/55 bg-primary/10 shadow-[0_0_28px_rgba(255,69,0,0.12)]"
                  : "border-white/10 bg-white/[0.03]",
              )}
            >
              <ReceiptText className={cn("h-5 w-5", active ? "text-primary" : "text-slate-500")} />
              <p className="mt-3 font-bold text-white">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.value === "mensalidade" ? "Plano vinculado" : "Valor definido agora"}
              </p>
            </button>
          );
        })}
      </div>

      {isMensalidade ? (
        <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <div className="flex items-start gap-3">
              <WalletCards className="mt-0.5 h-5 w-5 text-primary" />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  Plano do aluno
                </p>
                <p className="mt-2 truncate text-lg font-black text-white">
                  {selectedPlano?.nome || "Plano nao encontrado"}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {getAlunoName(selectedAluno)} - {formatMoney(getPlanoValue(selectedPlano))}
                </p>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Ajustar plano
              </span>
              <select
                value={form.watch("planoId") || ""}
                onChange={(event) => onSelectPlano(event.target.value)}
                className="j12-field h-11 w-full px-3 text-sm"
              >
                {planos.map((plano) => (
                  <option key={plano.id} value={String(plano.id)}>
                    {plano.nome} - {formatMoney(getPlanoValue(plano))}
                  </option>
                ))}
              </select>
              {errors.planoId?.message && (
                <p className="mt-2 text-xs font-semibold text-red-200">
                  {String(errors.planoId.message)}
                </p>
              )}
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Repeat2 className="h-4 w-4 text-primary" />
              Recorrencia
            </div>
            <div className="mt-4 grid gap-2">
              {RECURRENCE_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() =>
                    form.setValue("recorrencia", item.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left text-sm font-bold transition",
                    recorrencia === item.value
                      ? "border-primary/45 bg-primary/10 text-primary"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-2">
          <label className="lg:col-span-2">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Descricao da cobranca
            </span>
            <input
              {...form.register("descricao")}
              className="j12-field h-12 w-full px-3 text-sm"
              placeholder="Ex.: Uniforme oficial, inscricao de evento, aluguel da arena"
            />
            {errors.descricao?.message && (
              <p className="mt-2 text-xs font-semibold text-red-200">
                {String(errors.descricao.message)}
              </p>
            )}
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Valor cobrado
            </span>
            <input
              value={form.watch("valorCobrado") || ""}
              onChange={(event) =>
                form.setValue("valorCobrado", formatBRLInput(event.target.value), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              inputMode="numeric"
              className="j12-field h-12 w-full px-3 text-sm"
              placeholder="0,00"
            />
            {errors.valorCobrado?.message && (
              <p className="mt-2 text-xs font-semibold text-red-200">
                {String(errors.valorCobrado.message)}
              </p>
            )}
          </label>

          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <CalendarClock className="h-4 w-4" />
              Valor informado
            </div>
            <p className="mt-3 text-3xl font-black text-white">
              {formatMoney(parseBRL(form.watch("valorCobrado")))}
            </p>
            <p className="mt-1 text-sm text-slate-400">Base para descontos e fechamento.</p>
          </div>
        </div>
      )}
    </section>
  );
}
