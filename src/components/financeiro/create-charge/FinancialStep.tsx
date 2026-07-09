import type { UseFormReturn } from "react-hook-form";
import { CalendarDays, Percent, ReceiptText, Wallet } from "lucide-react";

import {
  AMOUNT_TYPE_OPTIONS,
  PAYMENT_OPTIONS,
  type CreateChargeFormValues,
  formatBRLInput,
  formatPercentInput,
} from "./charge-form";
import { cn } from "@/lib/utils";

function MoneyField({
  label,
  value,
  onChange,
  placeholder = "0,00",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        value={value || ""}
        onChange={(event) => onChange(formatBRLInput(event.target.value))}
        inputMode="numeric"
        className="j12-field h-12 w-full px-3 text-sm"
        placeholder={placeholder}
      />
    </label>
  );
}

function PercentField({
  label,
  value,
  onChange,
  placeholder = "0",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        value={value || ""}
        onChange={(event) => onChange(formatPercentInput(event.target.value))}
        inputMode="decimal"
        className="j12-field h-12 w-full px-3 text-sm"
        placeholder={placeholder}
      />
    </label>
  );
}

function AmountRule({
  title,
  typeValue,
  percentValue,
  fixedValue,
  onTypeChange,
  onPercentChange,
  onFixedChange,
}: {
  title: string;
  typeValue: "percentual" | "fixo";
  percentValue: string;
  fixedValue: string;
  onTypeChange: (value: "percentual" | "fixo") => void;
  onPercentChange: (value: string) => void;
  onFixedChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm font-bold text-white">{title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {AMOUNT_TYPE_OPTIONS.map((item) => (
          <button
            type="button"
            key={item.value}
            onClick={() => onTypeChange(item.value)}
            className={cn(
              "rounded-xl border px-3 py-2 text-left text-xs font-bold transition",
              typeValue === item.value
                ? "border-primary/45 bg-primary/10 text-primary"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {typeValue === "percentual" ? (
          <PercentField label={`${title} %`} value={percentValue} onChange={onPercentChange} />
        ) : (
          <MoneyField label={`${title} R$`} value={fixedValue} onChange={onFixedChange} />
        )}
      </div>
    </div>
  );
}

export function FinancialStep({ form }: { form: UseFormReturn<CreateChargeFormValues> }) {
  const errors = form.formState.errors;
  const formaPagamento = form.watch("formaPagamento");

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Etapa 3</p>
        <h3 className="mt-2 text-xl font-black text-white md:text-2xl">Condicoes financeiras</h3>
        <p className="mt-1 text-sm text-slate-400">
          Defina descontos, vencimento, encargos e forma de pagamento em uma unica revisao.
        </p>
      </div>

      <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-3">
        <MoneyField
          label="Desconto R$"
          value={form.watch("descontoValor") || ""}
          onChange={(value) =>
            form.setValue("descontoValor", value, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          placeholder="20,00"
        />
        <PercentField
          label="Desconto %"
          value={form.watch("descontoPercentual") || ""}
          onChange={(value) =>
            form.setValue("descontoPercentual", value, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          placeholder="10"
        />
        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Vencimento
          </span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="date"
              {...form.register("vencimento")}
              className="j12-field h-12 w-full px-3 pl-10 text-sm"
            />
          </div>
          {errors.vencimento?.message && (
            <p className="mt-2 text-xs font-semibold text-red-200">
              {String(errors.vencimento.message)}
            </p>
          )}
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <AmountRule
          title="Multa"
          typeValue={form.watch("multaTipo")}
          percentValue={form.watch("multaPercentual") || ""}
          fixedValue={form.watch("multaValor") || ""}
          onTypeChange={(value) => form.setValue("multaTipo", value, { shouldDirty: true })}
          onPercentChange={(value) =>
            form.setValue("multaPercentual", value, { shouldDirty: true })
          }
          onFixedChange={(value) => form.setValue("multaValor", value, { shouldDirty: true })}
        />
        <AmountRule
          title="Juros"
          typeValue={form.watch("jurosTipo")}
          percentValue={form.watch("jurosPercentual") || ""}
          fixedValue={form.watch("jurosValor") || ""}
          onTypeChange={(value) => form.setValue("jurosTipo", value, { shouldDirty: true })}
          onPercentChange={(value) =>
            form.setValue("jurosPercentual", value, { shouldDirty: true })
          }
          onFixedChange={(value) => form.setValue("jurosValor", value, { shouldDirty: true })}
        />
        <AmountRule
          title="Encargos"
          typeValue={form.watch("encargosTipo")}
          percentValue={form.watch("encargosPercentual") || ""}
          fixedValue={form.watch("encargosValor") || ""}
          onTypeChange={(value) => form.setValue("encargosTipo", value, { shouldDirty: true })}
          onPercentChange={(value) =>
            form.setValue("encargosPercentual", value, { shouldDirty: true })
          }
          onFixedChange={(value) => form.setValue("encargosValor", value, { shouldDirty: true })}
        />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
          <Wallet className="h-4 w-4 text-primary" />
          Forma de pagamento
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PAYMENT_OPTIONS.map((item) => (
            <button
              type="button"
              key={item.value}
              onClick={() =>
                form.setValue("formaPagamento", item.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              className={cn(
                "min-h-16 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition hover:-translate-y-0.5",
                formaPagamento === item.value
                  ? "border-primary/55 bg-primary/10 text-primary shadow-[0_0_28px_rgba(255,69,0,0.12)]"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
              )}
            >
              <ReceiptText className="mb-2 h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
