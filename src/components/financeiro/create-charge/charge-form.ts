import { z } from "zod";

export const CHARGE_CATEGORIES = [
  { value: "mensalidade", label: "Mensalidade" },
  { value: "matricula", label: "Matricula" },
  { value: "uniforme", label: "Uniforme" },
  { value: "arena", label: "Arena" },
  { value: "evento", label: "Evento" },
  { value: "personalizado", label: "Personalizado" },
] as const;

export const RECURRENCE_OPTIONS = [
  { value: "recorrente", label: "Recorrente" },
  { value: "avulsa", label: "Avulsa" },
] as const;

export const PAYMENT_OPTIONS = [
  { value: "pix", label: "PIX Banco Inter" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartao" },
  { value: "dinheiro", label: "Dinheiro" },
] as const;

export const AMOUNT_TYPE_OPTIONS = [
  { value: "percentual", label: "Percentual (%)" },
  { value: "fixo", label: "Valor fixo (R$)" },
] as const;

export const CHARGE_CATEGORY_VALUES = CHARGE_CATEGORIES.map((item) => item.value) as [
  "mensalidade",
  "matricula",
  "uniforme",
  "arena",
  "evento",
  "personalizado",
];

const RECURRENCE_VALUES = RECURRENCE_OPTIONS.map((item) => item.value) as [
  "recorrente",
  "avulsa",
];

const PAYMENT_VALUES = PAYMENT_OPTIONS.map((item) => item.value) as [
  "pix",
  "boleto",
  "cartao",
  "dinheiro",
];

const AMOUNT_TYPE_VALUES = AMOUNT_TYPE_OPTIONS.map((item) => item.value) as [
  "percentual",
  "fixo",
];

export const createChargeSchema = z
  .object({
    alunoId: z.string().min(1, "Selecione um aluno."),
    categoria: z.enum(CHARGE_CATEGORY_VALUES),
    planoId: z.string().optional(),
    planoNome: z.string().optional(),
    valorPlano: z.string().optional(),
    recorrencia: z.enum(RECURRENCE_VALUES),
    descricao: z.string().optional(),
    valorCobrado: z.string().optional(),
    descontoValor: z.string().optional(),
    descontoPercentual: z.string().optional(),
    vencimento: z.string().min(1, "Informe o vencimento."),
    multaTipo: z.enum(AMOUNT_TYPE_VALUES),
    multaPercentual: z.string().optional(),
    multaValor: z.string().optional(),
    jurosTipo: z.enum(AMOUNT_TYPE_VALUES),
    jurosPercentual: z.string().optional(),
    jurosValor: z.string().optional(),
    encargosTipo: z.enum(AMOUNT_TYPE_VALUES),
    encargosPercentual: z.string().optional(),
    encargosValor: z.string().optional(),
    formaPagamento: z.enum(PAYMENT_VALUES),
  })
  .superRefine((values, ctx) => {
    if (values.categoria === "mensalidade") {
      if (!values.planoId || parseBRL(values.valorPlano) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Plano do aluno sem valor valido.",
          path: ["planoId"],
        });
      }
      return;
    }

    if (!values.descricao?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a descricao da cobranca.",
        path: ["descricao"],
      });
    }

    if (parseBRL(values.valorCobrado) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o valor cobrado.",
        path: ["valorCobrado"],
      });
    }
  });

export type CreateChargeFormValues = z.infer<typeof createChargeSchema>;

export function getDefaultChargeValues(): CreateChargeFormValues {
  const now = new Date();
  const due = new Date(now.getFullYear(), now.getMonth() + (now.getDate() > 10 ? 1 : 0), 10);
  const month = `${due.getMonth() + 1}`.padStart(2, "0");
  const day = `${due.getDate()}`.padStart(2, "0");

  return {
    alunoId: "",
    categoria: "mensalidade",
    planoId: "",
    planoNome: "",
    valorPlano: "",
    recorrencia: "recorrente",
    descricao: "",
    valorCobrado: "",
    descontoValor: "",
    descontoPercentual: "",
    vencimento: `${due.getFullYear()}-${month}-${day}`,
    multaTipo: "percentual",
    multaPercentual: "2",
    multaValor: "",
    jurosTipo: "percentual",
    jurosPercentual: "0,33",
    jurosValor: "",
    encargosTipo: "percentual",
    encargosPercentual: "",
    encargosValor: "",
    formaPagamento: "pix",
  };
}

export function parseBRL(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized || 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatBRLInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatBRLFromNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";

  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercentInput(value: string) {
  return value
    .replace(/[^\d,.]/g, "")
    .replace(/\./g, ",")
    .replace(/(,.*),/g, "$1")
    .slice(0, 8);
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatMoney(value: number) {
  return currencyFormatter.format(Number(value || 0));
}

export function getCategoryLabel(value: string) {
  return CHARGE_CATEGORIES.find((item) => item.value === value)?.label || "Cobranca";
}

export function calcChargeValues(values: CreateChargeFormValues) {
  const original =
    values.categoria === "mensalidade"
      ? parseBRL(values.valorPlano)
      : parseBRL(values.valorCobrado);
  const discountManual = Math.max(0, parseBRL(values.descontoValor));
  const discountPercent = Math.max(0, parseBRL(values.descontoPercentual));
  const discountPercentValue = original * (discountPercent / 100);
  const discountTotal = Math.min(original, discountManual + discountPercentValue);
  const finalValue = Math.max(0, original - discountTotal);
  const multaPreview =
    values.multaTipo === "fixo"
      ? parseBRL(values.multaValor)
      : finalValue * (parseBRL(values.multaPercentual) / 100);
  const jurosPreview =
    values.jurosTipo === "fixo"
      ? parseBRL(values.jurosValor)
      : finalValue * (parseBRL(values.jurosPercentual) / 100);
  const encargosPreview =
    values.encargosTipo === "fixo"
      ? parseBRL(values.encargosValor)
      : finalValue * (parseBRL(values.encargosPercentual) / 100);

  return {
    original,
    discountManual,
    discountPercent,
    discountPercentValue,
    discountTotal,
    finalValue,
    multaPreview,
    jurosPreview,
    encargosPreview,
  };
}

