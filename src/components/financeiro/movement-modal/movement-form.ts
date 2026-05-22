import { z } from "zod";

export const receitaCategories = [
  { value: "mensalidade", label: "Mensalidade" },
  { value: "aula_avulsa", label: "Aula Avulsa" },
  { value: "campeonato", label: "Campeonato" },
  { value: "uniforme", label: "Uniforme" },
  { value: "patrocinio", label: "Patrocinio" },
  { value: "evento", label: "Evento" },
  { value: "outros", label: "Outros" },
];

export const despesaCategories = [
  { value: "aluguel", label: "Aluguel" },
  { value: "energia", label: "Energia" },
  { value: "agua", label: "Agua" },
  { value: "funcionarios", label: "Funcionarios" },
  { value: "material_esportivo", label: "Material esportivo" },
  { value: "marketing", label: "Marketing" },
  { value: "manutencao", label: "Manutencao" },
  { value: "arbitragem", label: "Arbitragem" },
  { value: "impostos", label: "Impostos" },
  { value: "outros", label: "Outros" },
];

export const paymentMethods = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartao" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferencia" },
];

export type MovementType = "receita" | "despesa";

export const movementSchema = z
  .object({
    tipo: z.enum(["receita", "despesa"]),
    vincularAluno: z.boolean(),
    alunoId: z.string().optional(),
    nomeManual: z.string().optional(),
    responsavelManual: z.string().optional(),
    nome: z.string().trim().min(1, "Informe o nome da movimentacao."),
    categoria: z.string().trim().min(1, "Selecione uma categoria."),
    categoriaPersonalizada: z.string().optional(),
    valor: z.string().trim().min(1, "Informe o valor."),
    data: z.string().trim().min(1, "Informe a data."),
    formaPagamento: z.string().trim().min(1, "Selecione a forma de pagamento."),
    recorrente: z.boolean(),
    observacoes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.vincularAluno && !values.alunoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alunoId"],
        message: "Selecione um aluno.",
      });
    }

    if (!values.vincularAluno && values.tipo === "receita" && !values.nomeManual?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nomeManual"],
        message: "Informe o pagador ou origem da receita.",
      });
    }

    if (values.categoria === "outros" && !values.categoriaPersonalizada?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoriaPersonalizada"],
        message: "Informe a categoria personalizada.",
      });
    }

    if (parseBRL(values.valor) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valor"],
        message: "Informe um valor maior que zero.",
      });
    }
  });

export type MovementFormValues = z.infer<typeof movementSchema>;

export function getDefaultMovementValues(tipo: MovementType = "receita"): MovementFormValues {
  return {
    tipo,
    vincularAluno: tipo === "receita",
    alunoId: "",
    nomeManual: "",
    responsavelManual: "",
    nome: "",
    categoria: tipo === "receita" ? "mensalidade" : "aluguel",
    categoriaPersonalizada: "",
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    formaPagamento: tipo === "receita" ? "pix" : "transferencia",
    recorrente: tipo === "receita",
    observacoes: "",
  };
}

export function parseBRL(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatBRLFromNumber(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatBRLInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return formatBRLFromNumber(Number(digits) / 100);
}

export function slugifyCategory(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export function getCategoryLabel(tipo: MovementType, category: string, custom?: string) {
  if (category === "outros" && custom?.trim()) return custom.trim();
  const options = tipo === "receita" ? receitaCategories : despesaCategories;
  return options.find((item) => item.value === category)?.label ?? category;
}

export function normalizeCategoryForType(tipo: MovementType, value: string) {
  const options = tipo === "receita" ? receitaCategories : despesaCategories;
  const normalized = slugifyCategory(value);
  return options.some((item) => item.value === normalized) ? normalized : "outros";
}
