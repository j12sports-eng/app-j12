import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Loader2,
  Repeat2,
  ReceiptText,
  Search,
  ShieldCheck,
  Tag,
  UserRound,
  Wallet,
} from "lucide-react";
import { useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import {
  despesaCategories,
  formatBRLFromNumber,
  formatBRLInput,
  getCategoryLabel,
  getDefaultMovementValues,
  movementSchema,
  normalizeCategoryForType,
  parseBRL,
  paymentMethods,
  receitaCategories,
  slugifyCategory,
  type MovementFormValues,
  type MovementType,
} from "./movement-form";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type {
  CriarCobrancaPayload,
  DespesaFinanceira,
  Mensalidade,
  SalvarDespesaPayload,
} from "@/hooks/useFinanceiroAdmin";
import { api, formatApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type FinancialMovementEditing =
  | { type: "receita"; item: Mensalidade }
  | { type: "despesa"; item: DespesaFinanceira }
  | null;

type FinancialMovementModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: MovementType;
  editing?: FinancialMovementEditing;
  actionLoading?: boolean;
  onCreateReceita: (payload: CriarCobrancaPayload) => Promise<unknown>;
  onUpdateReceita: (id: string, payload: CriarCobrancaPayload) => Promise<unknown>;
  onCreateDespesa: (payload: SalvarDespesaPayload) => Promise<unknown>;
  onUpdateDespesa: (id: string, payload: SalvarDespesaPayload) => Promise<unknown>;
};

type AlunoFinanceiroOption = {
  id: string | number;
  nome?: string;
  nome_completo?: string;
  nomeCompleto?: string;
  avatar?: string;
  foto?: string;
  foto_url?: string;
  status?: string;
  modalidade?: string;
  turma?: string;
  unidade?: string;
  plano?: string;
  planoId?: string | number | null;
  plano_id?: string | number | null;
  planoNome?: string;
  plano_nome?: string;
  planoValor?: number | string | null;
  plano_valor?: number | string | null;
  mensalidade?: number | string | null;
  responsavel?: string;
  telefoneResponsavel?: string;
  telefone_responsavel?: string;
  email?: string;
  numeroMatricula?: string;
  numero_matricula?: string;
  raw?: Record<string, unknown>;
  matricula?: {
    responsavel?: Record<string, unknown>;
    esportivas?: Record<string, unknown>;
  };
};

type PlanoFinanceiroOption = {
  id: string | number;
  nome?: string;
  name?: string;
  plano_nome?: string;
  valor?: number | string;
  precoMensal?: number | string;
  preco_mensal?: number | string;
  mensalidade?: number | string;
};

const stepLabels = ["Tipo", "Vinculo", "Dados"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  const record = asRecord(payload);
  const candidates = [
    record?.data,
    record?.items,
    record?.rows,
    record?.results,
    asRecord(record?.data)?.items,
    asRecord(record?.data)?.rows,
    asRecord(record?.data)?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as T[];
  }

  return [];
}

function readText(
  source: AlunoFinanceiroOption | Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!source) return "";
  const direct = source as Record<string, unknown>;

  for (const key of keys) {
    const value = direct[key];
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
  }

  const raw = asRecord(direct.raw);
  if (raw) {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === "string" || typeof value === "number") return String(value).trim();
    }
  }

  return "";
}

function parseListValue(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      return trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function readList(aluno: AlunoFinanceiroOption | null, keys: string[]) {
  if (!aluno) return [];
  const direct = aluno as Record<string, unknown>;
  const raw = asRecord(aluno.raw);
  const matricula = asRecord(aluno.matricula);
  const esportivas = asRecord(matricula?.esportivas);

  for (const source of [direct, raw, esportivas]) {
    if (!source) continue;
    for (const key of keys) {
      const values = parseListValue(source[key]);
      if (values.length > 0) return values;
    }
  }

  return [];
}

function getAlunoName(aluno: AlunoFinanceiroOption | null | undefined) {
  return readText(aluno, ["nome", "nome_completo", "nomeCompleto"]) || "Aluno sem nome";
}

function getAlunoAvatar(aluno: AlunoFinanceiroOption | null | undefined) {
  return readText(aluno, ["avatar", "foto", "foto_url", "fotoUrl"]);
}

function getAlunoResponsavel(aluno: AlunoFinanceiroOption | null | undefined) {
  const matricula = asRecord(aluno?.matricula);
  const responsavel = asRecord(matricula?.responsavel);
  return (
    readText(aluno, [
      "responsavel",
      "responsavelNome",
      "responsavel_nome",
      "nomeResponsavel",
      "responsavelFinanceiro",
      "responsavel_financeiro",
    ]) ||
    readText(responsavel, ["nomeCompleto", "nome", "responsavel"]) ||
    "-"
  );
}

function getAlunoTelefone(aluno: AlunoFinanceiroOption | null | undefined) {
  const matricula = asRecord(aluno?.matricula);
  const responsavel = asRecord(matricula?.responsavel);
  return (
    readText(aluno, [
      "telefoneResponsavel",
      "telefone_responsavel",
      "whatsappResponsavel",
      "responsavel_whatsapp",
      "telefone",
    ]) || readText(responsavel, ["whatsapp", "telefone"])
  );
}

function getAlunoEmail(aluno: AlunoFinanceiroOption | null | undefined) {
  const matricula = asRecord(aluno?.matricula);
  const responsavel = asRecord(matricula?.responsavel);
  return readText(aluno, ["email", "responsavel_email"]) || readText(responsavel, ["email"]);
}

function getAlunoUnidades(aluno: AlunoFinanceiroOption | null) {
  return readList(aluno, ["unidades", "unidades_json", "unidade", "unidade_principal"]);
}

function getAlunoModalidades(aluno: AlunoFinanceiroOption | null) {
  return readList(aluno, ["modalidades", "modalidades_json", "modalidade", "modalidade_principal"]);
}

function getPlanoName(plano: PlanoFinanceiroOption | null) {
  return readText(plano as Record<string, unknown> | null, ["nome", "name", "plano_nome"]);
}

function getPlanoValue(plano: PlanoFinanceiroOption | null) {
  return parseBRL(
    String(plano?.precoMensal ?? plano?.preco_mensal ?? plano?.mensalidade ?? plano?.valor ?? ""),
  );
}

function findAlunoPlan(aluno: AlunoFinanceiroOption | null, planos: PlanoFinanceiroOption[]) {
  if (!aluno) return null;

  const alunoPlanoId = readText(aluno, ["planoId", "plano_id", "financeiro_plano_id"]);
  const alunoPlanoNome = readText(aluno, ["planoNome", "plano_nome", "plano"]).toLowerCase();

  return (
    planos.find((plano) => alunoPlanoId && String(plano.id) === alunoPlanoId) ??
    planos.find(
      (plano) => alunoPlanoNome && getPlanoName(plano).toLowerCase() === alunoPlanoNome,
    ) ??
    null
  );
}

function getAlunoPlanName(
  aluno: AlunoFinanceiroOption | null,
  plano: PlanoFinanceiroOption | null,
) {
  return readText(aluno, ["planoNome", "plano_nome", "plano"]) || getPlanoName(plano) || "-";
}

function getAlunoPlanValue(
  aluno: AlunoFinanceiroOption | null,
  plano: PlanoFinanceiroOption | null,
) {
  const directValue = parseBRL(
    String(
      readText(aluno, ["planoValor", "plano_valor", "mensalidade"]) ||
        readText(asRecord(aluno?.raw), ["planoValor", "plano_valor", "mensalidade"]) ||
        "",
    ),
  );

  return directValue > 0 ? directValue : getPlanoValue(plano);
}

function formatScope(values: string[]) {
  return values.length > 0 ? values.join(", ") : "-";
}

function formatDateLabel(value?: string) {
  if (!value) return "-";

  const [year, month, day] = value.slice(0, 10).split("-");
  if (year && month && day) return `${day}/${month}/${year}`;

  return value;
}

function isManualAlunoId(value: string | undefined) {
  const normalized = String(value || "").toLowerCase();
  return !normalized || normalized === "manual" || normalized.startsWith("manual-");
}

function buildInitialValues(
  initialType: MovementType,
  editing: FinancialMovementEditing,
): MovementFormValues {
  if (!editing) return getDefaultMovementValues(initialType);

  if (editing.type === "receita") {
    const item = editing.item;
    const category = normalizeCategoryForType("receita", item.tipo);

    return {
      ...getDefaultMovementValues("receita"),
      vincularAluno: !isManualAlunoId(item.aluno_id),
      alunoId: isManualAlunoId(item.aluno_id) ? "" : item.aluno_id,
      nomeManual: isManualAlunoId(item.aluno_id) ? item.aluno_nome : "",
      nome: item.descricao || "Receita",
      categoria: category,
      categoriaPersonalizada: category === "outros" ? item.tipo : "",
      valor: formatBRLFromNumber(item.valor_atualizado),
      data: item.data_vencimento?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      formaPagamento: item.forma_pagamento || "pix",
      recorrente: item.tipo_cobranca === "recorrente" || item.periodicidade === "mensal",
      observacoes: item.observacao || "",
    };
  }

  const item = editing.item;
  const category = normalizeCategoryForType("despesa", item.categoria);

  return {
    ...getDefaultMovementValues("despesa"),
    vincularAluno: false,
    nome: item.descricao || "Despesa",
    categoria: category,
    categoriaPersonalizada: category === "outros" ? item.categoria : "",
    valor: formatBRLFromNumber(item.valor),
    data:
      item.vencimento?.slice(0, 10) ||
      item.pagoEm?.slice(0, 10) ||
      new Date().toISOString().slice(0, 10),
    formaPagamento: item.formaPagamento || "transferencia",
    recorrente: false,
    observacoes: item.observacao || "",
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-semibold text-red-200">{message}</p>;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
      {children}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value || "-"}</p>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "highlight";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 transition",
        tone === "highlight"
          ? "border-primary/25 bg-primary/[0.08]"
          : "border-white/10 bg-black/25",
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 break-words text-sm font-bold leading-snug",
          tone === "highlight" ? "text-primary" : "text-white",
        )}
      >
        {value || "-"}
      </p>
    </div>
  );
}

export function FinancialMovementModal({
  open,
  onOpenChange,
  initialType = "receita",
  editing = null,
  actionLoading = false,
  onCreateReceita,
  onUpdateReceita,
  onCreateDespesa,
  onUpdateDespesa,
}: FinancialMovementModalProps) {
  const [step, setStep] = useState(0);
  const [alunos, setAlunos] = useState<AlunoFinanceiroOption[]>([]);
  const [planos, setPlanos] = useState<PlanoFinanceiroOption[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const submitTokenRef = useRef(0);
  const savingRef = useRef(false);

  const form = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: getDefaultMovementValues(initialType),
    mode: "onChange",
  });

  const values = form.watch();
  const isEditing = Boolean(editing);
  const saving = actionLoading || localSaving;
  const selectedAluno = useMemo(
    () => alunos.find((aluno) => String(aluno.id) === String(values.alunoId)) ?? null,
    [alunos, values.alunoId],
  );
  const selectedPlano = useMemo(
    () => findAlunoPlan(selectedAluno, planos),
    [selectedAluno, planos],
  );
  const firstStep = 1;
  const visibleStepLabels = stepLabels.slice(firstStep);
  const progressStep = Math.max(0, step - firstStep);
  const modalTitle = isEditing
    ? editing?.type === "despesa"
      ? "Editar despesa"
      : "Editar cobranca"
    : initialType === "despesa"
      ? "Nova despesa"
      : "Nova cobranca";
  const saveLabel = isEditing
    ? "Salvar alteracoes"
    : values.tipo === "despesa"
      ? "Criar despesa"
      : "Criar cobranca";

  const filteredAlunos = useMemo(() => {
    const term = studentQuery.trim().toLowerCase();
    const active = alunos.filter((aluno) => String(aluno.id).trim());
    if (!term) return active.slice(0, 8);

    return active
      .filter((aluno) =>
        [
          getAlunoName(aluno),
          getAlunoResponsavel(aluno),
          formatScope(getAlunoUnidades(aluno)),
          formatScope(getAlunoModalidades(aluno)),
          getAlunoPlanName(aluno, findAlunoPlan(aluno, planos)),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term)),
      )
      .slice(0, 8);
  }, [alunos, planos, studentQuery]);

  const editingKey = editing ? `${editing.type}:${editing.item.id}` : "new";

  useEffect(() => {
    if (!open) return;

    form.reset(buildInitialValues(initialType, editing));
    setStep(editing ? 2 : firstStep);
    setStudentQuery("");
    submitTokenRef.current += 1;
  }, [editing, editingKey, form, initialType, open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingRefs(true);

    Promise.all([api.get<unknown>("/alunos"), api.get<unknown>("/planos")])
      .then(([alunosResponse, planosResponse]) => {
        if (cancelled) return;
        setAlunos(asArray<AlunoFinanceiroOption>(alunosResponse));
        setPlanos(asArray<PlanoFinanceiroOption>(planosResponse));
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(formatApiErrorMessage(error, "Nao foi possivel carregar alunos e planos."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRefs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  function closeModal() {
    submitTokenRef.current += 1;
    savingRef.current = false;
    setLocalSaving(false);
    setStep(firstStep);
    form.reset(getDefaultMovementValues(initialType));
    setStudentQuery("");
    onOpenChange(false);
  }

  function selectType(tipo: MovementType) {
    if (isEditing) return;

    form.setValue("tipo", tipo, { shouldDirty: true, shouldValidate: true });
    form.setValue("vincularAluno", tipo === "receita", { shouldDirty: true });
    form.setValue("categoria", tipo === "receita" ? "mensalidade" : "aluguel", {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("formaPagamento", tipo === "receita" ? "pix" : "transferencia", {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("recorrente", tipo === "receita", { shouldDirty: true });
    form.setValue("alunoId", "", { shouldDirty: true });
    form.setValue("nomeManual", "", { shouldDirty: true });
    form.clearErrors();
  }

  function selectAluno(aluno: AlunoFinanceiroOption) {
    form.setValue("alunoId", String(aluno.id), { shouldDirty: true, shouldValidate: true });

    if (values.tipo === "receita" && values.categoria === "mensalidade") {
      const plano = findAlunoPlan(aluno, planos);
      const planValue = getAlunoPlanValue(aluno, plano);

      if (planValue > 0 && !isEditing) {
        form.setValue("valor", formatBRLFromNumber(planValue), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      if (!form.getValues("nome")) {
        form.setValue("nome", "Mensalidade", { shouldDirty: true, shouldValidate: true });
      }
    }
  }

  function validateStep() {
    if (step === 0) return true;

    if (step === 1) {
      const current = form.getValues();
      if (current.vincularAluno && !current.alunoId) {
        toast.error("Selecione um aluno para continuar.");
        form.setError("alunoId", { message: "Selecione um aluno." });
        return false;
      }

      if (!current.vincularAluno && current.tipo === "receita" && !current.nomeManual?.trim()) {
        toast.error("Informe a origem da receita para continuar.");
        form.setError("nomeManual", { message: "Informe o pagador ou origem da receita." });
        return false;
      }
    }

    return true;
  }

  function goNext() {
    if (!validateStep()) return;
    setStep((current) => Math.min(current + 1, stepLabels.length - 1));
  }

  function applyCategory(category: string) {
    form.setValue("categoria", category, { shouldDirty: true, shouldValidate: true });

    if (values.tipo === "receita" && category === "mensalidade" && selectedAluno) {
      const planValue = getAlunoPlanValue(selectedAluno, selectedPlano);
      if (planValue > 0 && !isEditing) {
        form.setValue("valor", formatBRLFromNumber(planValue), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      if (!form.getValues("nome")) {
        form.setValue("nome", "Mensalidade", { shouldDirty: true, shouldValidate: true });
      }
    }
  }

  function buildReceitaPayload(current: MovementFormValues): CriarCobrancaPayload {
    const value = Number(parseBRL(current.valor).toFixed(2));
    const category =
      current.categoria === "outros"
        ? slugifyCategory(current.categoriaPersonalizada || "outros") || "outros"
        : current.categoria;
    const categoryLabel = getCategoryLabel(
      "receita",
      current.categoria,
      current.categoriaPersonalizada,
    );
    const editingReceita = editing?.type === "receita" ? editing.item : null;
    const alunoId = current.vincularAluno ? String(selectedAluno?.id || current.alunoId) : "manual";
    const alunoNome = current.vincularAluno
      ? selectedAluno
        ? getAlunoName(selectedAluno)
        : editingReceita?.aluno_nome || "Aluno"
      : current.nomeManual?.trim() || "Receita avulsa";
    const recurrence = current.recorrente ? "recorrente" : "avulsa";
    const planName = current.vincularAluno
      ? selectedAluno
        ? getAlunoPlanName(selectedAluno, selectedPlano)
        : editingReceita?.plano_nome
      : undefined;
    const observations = [
      current.observacoes?.trim(),
      current.categoria === "outros" ? `Categoria personalizada: ${categoryLabel}` : "",
      !current.vincularAluno && current.responsavelManual?.trim()
        ? `Responsavel: ${current.responsavelManual.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      alunoId,
      alunoNome,
      planoId: current.vincularAluno
        ? String(
            selectedPlano?.id ??
              selectedAluno?.planoId ??
              selectedAluno?.plano_id ??
              editingReceita?.plano_id ??
              "",
          ) || null
        : null,
      planoNome: current.vincularAluno ? planName : undefined,
      tipo: category,
      tipoCobranca: recurrence,
      descricao: current.nome.trim(),
      valorOriginal: value,
      descontoValor: 0,
      descontoPercentual: 0,
      valorFinal: value,
      valor: value,
      vencimento: current.data,
      competencia: `${current.data.slice(0, 7)}:${current.recorrente ? "mensal" : "avulsa"}`,
      multaPercentual: 0,
      jurosDiaPercentual: 0,
      periodicidade: current.recorrente ? "mensal" : "avulsa",
      formaPagamento: current.formaPagamento,
      origem: "manual",
      status: editing?.type === "receita" ? editing.item.status : "pendente",
      pagoEm: editing?.type === "receita" ? editing.item.pago_em || undefined : undefined,
      dataPagamento:
        editing?.type === "receita"
          ? editing.item.data_pagamento || editing.item.pago_em || undefined
          : undefined,
      gerarPix: !isEditing && current.formaPagamento === "pix",
      observacao: observations,
      modalidade: current.vincularAluno
        ? selectedAluno
          ? formatScope(getAlunoModalidades(selectedAluno))
          : editingReceita?.modalidade
        : undefined,
      unidade: current.vincularAluno
        ? selectedAluno
          ? formatScope(getAlunoUnidades(selectedAluno))
          : editingReceita?.unidade
        : undefined,
      turma: current.vincularAluno
        ? selectedAluno
          ? readText(selectedAluno, ["turma", "turma_nome"])
          : editingReceita?.turma
        : undefined,
      responsavelFinanceiro: current.vincularAluno
        ? selectedAluno
          ? getAlunoResponsavel(selectedAluno)
          : editingReceita?.responsavel_financeiro
        : current.responsavelManual,
      telefoneWhatsapp: current.vincularAluno
        ? selectedAluno
          ? getAlunoTelefone(selectedAluno)
          : editingReceita?.telefone_whatsapp
        : undefined,
      email: current.vincularAluno
        ? selectedAluno
          ? getAlunoEmail(selectedAluno)
          : editingReceita?.email
        : undefined,
      numeroMatricula: current.vincularAluno
        ? readText(selectedAluno, ["numeroMatricula", "numero_matricula", "matricula_numero"])
        : undefined,
    };
  }

  function buildDespesaPayload(current: MovementFormValues): SalvarDespesaPayload {
    const category =
      current.categoria === "outros"
        ? slugifyCategory(current.categoriaPersonalizada || "outros") || "outros"
        : current.categoria;
    const categoryLabel = getCategoryLabel(
      "despesa",
      current.categoria,
      current.categoriaPersonalizada,
    );
    const observations = [
      current.observacoes?.trim(),
      current.categoria === "outros" ? `Categoria personalizada: ${categoryLabel}` : "",
      current.vincularAluno && selectedAluno
        ? `Aluno vinculado: ${getAlunoName(selectedAluno)} | Unidade: ${formatScope(getAlunoUnidades(selectedAluno))} | Modalidade: ${formatScope(getAlunoModalidades(selectedAluno))} | Responsavel: ${getAlunoResponsavel(selectedAluno)}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      descricao: current.nome.trim(),
      categoria: category,
      valor: Number(parseBRL(current.valor).toFixed(2)),
      vencimento: current.data,
      pagoEm: current.data,
      formaPagamento: current.formaPagamento,
      status: editing?.type === "despesa" ? editing.item.status : "pago",
      observacao: observations,
    };
  }

  async function submit(values: MovementFormValues) {
    if (savingRef.current) return;

    const token = submitTokenRef.current + 1;
    submitTokenRef.current = token;
    savingRef.current = true;

    try {
      setLocalSaving(true);

      if (values.tipo === "receita") {
        const payload = buildReceitaPayload(values);
        if (editing?.type === "receita") {
          await onUpdateReceita(editing.item.id, payload);
          if (submitTokenRef.current === token) toast.success("Cobranca atualizada com sucesso.");
        } else {
          await onCreateReceita(payload);
          if (submitTokenRef.current === token) toast.success("Cobranca criada com sucesso.");
        }
      } else {
        const payload = buildDespesaPayload(values);
        if (editing?.type === "despesa") {
          await onUpdateDespesa(editing.item.id, payload);
          if (submitTokenRef.current === token) toast.success("Despesa atualizada com sucesso.");
        } else {
          await onCreateDespesa(payload);
          if (submitTokenRef.current === token) toast.success("Despesa criada com sucesso.");
        }
      }

      if (submitTokenRef.current === token) closeModal();
    } catch (error) {
      if (submitTokenRef.current === token) {
        toast.error(formatApiErrorMessage(error, "Nao foi possivel salvar a movimentacao."));
      }
    } finally {
      if (submitTokenRef.current === token) {
        savingRef.current = false;
        setLocalSaving(false);
      }
    }
  }

  function handleInvalid(errors: FieldErrors<MovementFormValues>) {
    const firstError = Object.values(errors).find((error) => {
      return error && typeof error.message === "string";
    });

    toast.error(
      typeof firstError?.message === "string"
        ? firstError.message
        : "Revise os campos destacados antes de salvar.",
    );
  }

  const categories = values.tipo === "receita" ? receitaCategories : despesaCategories;
  const categoryLabel = getCategoryLabel(
    values.tipo,
    values.categoria,
    values.categoriaPersonalizada,
  );
  const amount = parseBRL(values.valor);
  const editingReceita = editing?.type === "receita" ? editing.item : null;
  const summaryName =
    values.vincularAluno && selectedAluno
      ? getAlunoName(selectedAluno)
      : values.vincularAluno && editingReceita
        ? editingReceita.aluno_nome
        : values.nomeManual ||
          (values.tipo === "despesa" ? "Despesa operacional" : "Receita avulsa");
  const summaryPlan =
    values.vincularAluno && selectedAluno
      ? getAlunoPlanName(selectedAluno, selectedPlano)
      : editingReceita?.plano_nome || "-";
  const summaryResponsible =
    values.vincularAluno && selectedAluno
      ? getAlunoResponsavel(selectedAluno)
      : editingReceita?.responsavel_financeiro || values.responsavelManual || "-";
  const movementKindLabel =
    values.tipo === "receita"
      ? values.recorrente
        ? "Cobrança recorrente"
        : "Cobrança avulsa"
      : "Despesa operacional";
  const displayMovementKindLabel = movementKindLabel.replace(/\u00c3\u00a7/g, "c");

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
        else if (!savingRef.current) closeModal();
      }}
    >
      <DialogContent className="!flex !h-[92vh] !w-[96vw] !max-w-[1500px] !gap-0 overflow-hidden border-primary/20 bg-[#060606] p-0 text-white shadow-[0_30px_120px_rgba(0,0,0,0.7),0_0_70px_rgba(255,69,0,0.08)] duration-300 sm:rounded-3xl">
        <div className="shrink-0 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,96,0,0.14),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.018))] p-3 pr-12 md:p-4 md:pr-14">
          <DialogTitle className="flex items-center gap-3 text-lg font-black text-white md:text-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary shadow-[0_0_28px_rgba(255,69,0,0.18)] md:h-10 md:w-10">
              <Wallet className="h-5 w-5" />
            </span>
            {modalTitle}
          </DialogTitle>
          <DialogDescription className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-400">
            Preencha os dados financeiros com validacao, persistencia em banco e atualizacao da
            tabela em tempo real.
          </DialogDescription>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {visibleStepLabels.map((label, index) => (
              <div
                key={label}
                className={cn(
                  "h-1.5 rounded-full transition",
                  index <= progressStep
                    ? "bg-primary shadow-[0_0_18px_rgba(255,69,0,0.35)]"
                    : "bg-white/10",
                )}
              />
            ))}
          </div>
        </div>

        <form
          onSubmit={form.handleSubmit(submit, handleInvalid)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="j12-scrollbar grid flex-1 grid-cols-1 gap-4 overflow-y-auto overflow-x-hidden p-3 md:p-4 xl:grid-cols-12 xl:gap-5 xl:p-5">
            <div className="min-w-0 xl:col-span-9">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.section
                    key="tipo"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                        Passo 1
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">Selecione o tipo</h3>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          value: "receita" as MovementType,
                          title: "Receita",
                          description: "Cobrancas, mensalidades, eventos e entradas financeiras.",
                          icon: Banknote,
                        },
                        {
                          value: "despesa" as MovementType,
                          title: "Despesa",
                          description: "Custos operacionais, contas, equipe e manutencoes.",
                          icon: ReceiptText,
                        },
                      ].map((option) => {
                        const Icon = option.icon;
                        const selected = values.tipo === option.value;

                        return (
                          <button
                            type="button"
                            key={option.value}
                            onClick={() => selectType(option.value)}
                            disabled={isEditing}
                            className={cn(
                              "min-h-[168px] rounded-3xl border p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-80",
                              selected
                                ? "border-primary/55 bg-primary/10 shadow-[0_0_30px_rgba(255,69,0,0.12)]"
                                : "border-white/10 bg-white/[0.03]",
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-primary">
                                <Icon className="h-5 w-5" />
                              </span>
                              {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                            </div>
                            <h4 className="mt-5 text-lg font-black text-white">{option.title}</h4>
                            <p className="mt-2 text-sm leading-relaxed text-slate-400">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </motion.section>
                )}

                {step === 1 && (
                  <motion.section
                    key="vinculo"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-5"
                  >
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                        Passo 1
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">
                        Vinculo da movimentacao
                      </h3>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold text-white">Vincular aluno?</p>
                          <p className="mt-1 text-sm text-slate-400">
                            Use o cadastro para preencher unidade, modalidade, plano e responsavel.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1">
                          {[
                            { value: true, label: "Sim" },
                            { value: false, label: "Nao" },
                          ].map((option) => (
                            <button
                              type="button"
                              key={String(option.value)}
                              onClick={() => {
                                form.setValue("vincularAluno", option.value, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                                if (!option.value)
                                  form.setValue("alunoId", "", { shouldDirty: true });
                              }}
                              className={cn(
                                "min-h-10 rounded-xl px-5 text-sm font-bold transition",
                                values.vincularAluno === option.value
                                  ? "bg-primary text-black"
                                  : "text-slate-300 hover:bg-white/10",
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {values.vincularAluno ? (
                      <div className="space-y-4">
                        <label className="relative block">
                          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                          <input
                            value={studentQuery}
                            onChange={(event) => setStudentQuery(event.target.value)}
                            className="j12-field h-12 w-full pl-11 pr-4 text-sm"
                            placeholder="Buscar aluno, unidade, modalidade ou responsavel..."
                          />
                        </label>
                        <FieldError message={form.formState.errors.alunoId?.message} />

                        <div className="grid max-h-[34vh] gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
                          {loadingRefs &&
                            Array.from({ length: 4 }).map((_, index) => (
                              <div key={index} className="j12-skeleton h-28 rounded-2xl" />
                            ))}

                          {!loadingRefs &&
                            filteredAlunos.map((aluno) => {
                              const selected = String(aluno.id) === String(values.alunoId);
                              const avatar = getAlunoAvatar(aluno);
                              const plano = findAlunoPlan(aluno, planos);

                              return (
                                <button
                                  key={String(aluno.id)}
                                  type="button"
                                  onClick={() => selectAluno(aluno)}
                                  className={cn(
                                    "rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5",
                                    selected
                                      ? "border-primary/55 bg-primary/10"
                                      : "border-white/10 bg-white/[0.03]",
                                  )}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 text-base font-black text-primary">
                                      {avatar ? (
                                        <img
                                          src={avatar}
                                          alt=""
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        getAlunoName(aluno).slice(0, 1).toUpperCase()
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-bold text-white">
                                        {getAlunoName(aluno)}
                                      </p>
                                      <p className="mt-1 truncate text-xs text-slate-400">
                                        {formatScope(getAlunoModalidades(aluno))} |{" "}
                                        {formatScope(getAlunoUnidades(aluno))}
                                      </p>
                                      <p className="mt-1 truncate text-xs text-slate-500">
                                        {getAlunoPlanName(aluno, plano)}
                                      </p>
                                    </div>
                                    {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                  </div>
                                </button>
                              );
                            })}
                        </div>

                        {!loadingRefs && filteredAlunos.length === 0 && (
                          <div className="j12-empty-state p-5 text-center text-sm text-slate-300">
                            Nenhum aluno encontrado.
                          </div>
                        )}

                        {selectedAluno && (
                          <div className="grid gap-3 rounded-3xl border border-primary/20 bg-primary/[0.06] p-4 sm:grid-cols-2">
                            <DetailRow label="Aluno" value={getAlunoName(selectedAluno)} />
                            <DetailRow
                              label="Responsavel"
                              value={getAlunoResponsavel(selectedAluno)}
                            />
                            <DetailRow
                              label="Unidade"
                              value={formatScope(getAlunoUnidades(selectedAluno))}
                            />
                            <DetailRow
                              label="Modalidade"
                              value={formatScope(getAlunoModalidades(selectedAluno))}
                            />
                            <DetailRow
                              label="Plano"
                              value={`${getAlunoPlanName(selectedAluno, selectedPlano)}${
                                getAlunoPlanValue(selectedAluno, selectedPlano) > 0
                                  ? ` - ${formatBRLFromNumber(getAlunoPlanValue(selectedAluno, selectedPlano))}`
                                  : ""
                              }`}
                            />
                            <DetailRow label="Status" value={selectedAluno.status || "ativo"} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label>
                          <span className="mb-2 block text-sm font-semibold text-slate-300">
                            Origem/Pagador
                          </span>
                          <input
                            {...form.register("nomeManual")}
                            className="j12-field h-12 w-full px-4 text-sm"
                            placeholder="Ex.: Patrocinador, venda avulsa"
                          />
                          <FieldError message={form.formState.errors.nomeManual?.message} />
                        </label>
                        <label>
                          <span className="mb-2 block text-sm font-semibold text-slate-300">
                            Responsavel/Contato
                          </span>
                          <input
                            {...form.register("responsavelManual")}
                            className="j12-field h-12 w-full px-4 text-sm"
                            placeholder="Opcional"
                          />
                        </label>
                      </div>
                    )}
                  </motion.section>
                )}

                {step === 2 && (
                  <motion.section
                    key="dados"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                          Passo 2
                        </p>
                        <h3 className="mt-1.5 text-xl font-black tracking-tight text-white md:text-2xl">
                          Editar dados financeiros
                        </h3>
                      </div>
                      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-primary">
                        <ReceiptText className="h-3.5 w-3.5" />
                        {displayMovementKindLabel}
                      </span>
                    </div>

                    <section className="rounded-[1.15rem] border border-white/10 bg-white/[0.035] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.03] transition hover:border-primary/20 md:p-5">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                        <label className="lg:col-span-6">
                          <FieldLabel>
                            {values.tipo === "receita" ? "Nome da cobranca" : "Nome da despesa"}
                          </FieldLabel>
                          <input
                            {...form.register("nome")}
                            className="j12-field min-h-[52px] w-full px-4 text-base"
                            placeholder={
                              values.tipo === "receita"
                                ? "Ex.: Mensalidade Maio"
                                : "Ex.: Aluguel arena"
                            }
                          />
                          <FieldError message={form.formState.errors.nome?.message} />
                        </label>

                        <label className="lg:col-span-3">
                          <FieldLabel>Tipo</FieldLabel>
                          <div className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-4 text-base font-bold text-white">
                            {values.tipo === "receita" ? (
                              <Banknote className="h-4 w-4 text-primary" />
                            ) : (
                              <ReceiptText className="h-4 w-4 text-primary" />
                            )}
                            {values.tipo === "receita" ? "Receita" : "Despesa"}
                          </div>
                        </label>

                        <label className="lg:col-span-3">
                          <FieldLabel>Categoria</FieldLabel>
                          <div className="relative">
                            <Tag className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <select
                              value={values.categoria}
                              onChange={(event) => applyCategory(event.target.value)}
                              className="j12-field min-h-[52px] w-full appearance-none px-4 pl-11 text-base"
                            >
                              {categories.map((category) => (
                                <option key={category.value} value={category.value}>
                                  {category.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <FieldError message={form.formState.errors.categoria?.message} />
                        </label>

                        <label className="lg:col-span-4">
                          <FieldLabel>Valor</FieldLabel>
                          <input
                            value={values.valor}
                            onChange={(event) =>
                              form.setValue("valor", formatBRLInput(event.target.value), {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                            className="j12-field min-h-[52px] w-full px-4 text-base font-bold text-white"
                            placeholder="R$ 0,00"
                            inputMode="numeric"
                          />
                          <FieldError message={form.formState.errors.valor?.message} />
                        </label>

                        <label className="lg:col-span-4">
                          <FieldLabel>
                            {values.tipo === "receita" ? "Data vencimento" : "Data"}
                          </FieldLabel>
                          <div className="relative">
                            <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <input
                              {...form.register("data")}
                              type="date"
                              className="j12-field min-h-[52px] w-full px-4 pl-11 text-base"
                            />
                          </div>
                          <FieldError message={form.formState.errors.data?.message} />
                        </label>

                        <label className="lg:col-span-4">
                          <FieldLabel>Forma pagamento</FieldLabel>
                          <div className="relative">
                            <CreditCard className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <select
                              {...form.register("formaPagamento")}
                              className="j12-field min-h-[52px] w-full appearance-none px-4 pl-11 text-base"
                            >
                              {paymentMethods.map((method) => (
                                <option key={method.value} value={method.value}>
                                  {method.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <FieldError message={form.formState.errors.formaPagamento?.message} />
                        </label>

                        <div className="lg:col-span-4">
                          <FieldLabel>Recorrente</FieldLabel>
                          <div className="flex min-h-[52px] items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/25 px-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                                <Repeat2 className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">
                                  {values.tipo === "receita" ? "Cobranca" : "Lancamento unico"}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {values.recorrente ? "Mensal" : "Avulsa"}
                                </p>
                              </div>
                            </div>

                            {values.tipo === "receita" && (
                              <button
                                type="button"
                                aria-pressed={values.recorrente}
                                onClick={() =>
                                  form.setValue("recorrente", !values.recorrente, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  })
                                }
                                className={cn(
                                  "relative h-8 w-14 shrink-0 rounded-full border transition duration-200",
                                  values.recorrente
                                    ? "border-primary/70 bg-primary shadow-[0_0_24px_rgba(255,69,0,0.28)]"
                                    : "border-white/15 bg-slate-800 hover:bg-slate-700",
                                )}
                              >
                                <span
                                  className={cn(
                                    "absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-lg transition duration-200",
                                    values.recorrente && "translate-x-6",
                                  )}
                                />
                              </button>
                            )}
                          </div>
                        </div>

                        <label className="lg:col-span-4">
                          <FieldLabel>Plano</FieldLabel>
                          <div className="flex min-h-[52px] w-full items-center rounded-xl border border-white/10 bg-black/25 px-4 text-base font-bold text-white">
                            <span className="truncate">{summaryPlan}</span>
                          </div>
                        </label>

                        <label className="lg:col-span-4">
                          <FieldLabel>Responsavel</FieldLabel>
                          {values.vincularAluno ? (
                            <div className="flex min-h-[52px] w-full items-center rounded-xl border border-white/10 bg-black/25 px-4 text-base font-bold text-white">
                              <span className="truncate">{summaryResponsible}</span>
                            </div>
                          ) : (
                            <input
                              {...form.register("responsavelManual")}
                              className="j12-field min-h-[52px] w-full px-4 text-base"
                              placeholder="Nome do responsavel"
                            />
                          )}
                        </label>

                        {values.categoria === "outros" && (
                          <label className="lg:col-span-6">
                            <FieldLabel>Categoria personalizada</FieldLabel>
                            <input
                              {...form.register("categoriaPersonalizada")}
                              className="j12-field min-h-[52px] w-full px-4 text-base"
                              placeholder="Digite a categoria"
                            />
                            <FieldError
                              message={form.formState.errors.categoriaPersonalizada?.message}
                            />
                          </label>
                        )}

                        <label className="lg:col-span-12">
                          <FieldLabel>Observacoes</FieldLabel>
                          <textarea
                            {...form.register("observacoes")}
                            className="j12-field min-h-[140px] w-full resize-none px-4 py-3 text-base leading-6"
                            placeholder="Informacoes adicionais para controle interno"
                          />
                        </label>
                      </div>
                    </section>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>

            <aside className="h-fit min-w-0 rounded-[1.15rem] border border-white/10 bg-white/[0.04] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.26)] ring-1 ring-white/[0.03] xl:sticky xl:top-5 xl:col-span-3">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_22px_rgba(255,69,0,0.14)]">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">Resumo financeiro</p>
                  <p className="text-xs text-slate-500">Painel compacto em tempo real</p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(255,96,0,0.20),transparent_44%),rgba(255,96,0,0.08)] p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
                  Valor
                </p>
                <p className="mt-1.5 text-2xl font-black tracking-tight text-white">
                  {formatBRLFromNumber(amount)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {displayMovementKindLabel}
                </p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <SummaryItem
                  label={values.tipo === "receita" ? "Aluno" : "Origem"}
                  value={summaryName}
                />
                <SummaryItem label="Categoria" value={categoryLabel} />
                <SummaryItem label="Plano" value={summaryPlan} />
                <SummaryItem
                  label="Recorrencia"
                  value={
                    values.tipo === "receita" ? (values.recorrente ? "Mensal" : "Avulsa") : "Unica"
                  }
                />
                <SummaryItem label="Vencimento" value={formatDateLabel(values.data)} />
                <SummaryItem
                  label="Tipo"
                  value={values.tipo === "receita" ? "Receita" : "Despesa"}
                />
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-primary">
                  <UserRound className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-400">Responsavel</p>
                  <p className="truncate text-sm font-bold text-white">{summaryResponsible}</p>
                </div>
              </div>
            </aside>
          </div>

          <div className="sticky bottom-0 z-10 flex shrink-0 justify-end border-t border-white/10 bg-[#070707]/95 p-3 shadow-[0_-18px_60px_rgba(0,0,0,0.34)] backdrop-blur md:p-4 md:px-5">
            <div className="flex w-full flex-col-reverse gap-3 md:w-auto md:flex-row">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:border-primary/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>

              {!isEditing && step > firstStep && (
                <button
                  type="button"
                  onClick={() => setStep((current) => Math.max(current - 1, firstStep))}
                  disabled={saving}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-white transition hover:border-primary/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Etapa anterior
                </button>
              )}

              {step < stepLabels.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={saving}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-black text-black shadow-[0_0_28px_rgba(255,69,0,0.22)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:min-w-[190px]"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-black text-black shadow-[0_0_28px_rgba(255,69,0,0.22)] transition hover:bg-primary/90 hover:shadow-[0_0_34px_rgba(255,69,0,0.32)] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:min-w-[230px]"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  {saving ? "Salvando..." : saveLabel}
                </button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
