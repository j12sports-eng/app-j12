import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Send, Sparkles, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  calcChargeValues,
  createChargeSchema,
  type CreateChargeFormValues,
  formatBRLFromNumber,
  formatMoney,
  getCategoryLabel,
  getDefaultChargeValues,
  parseBRL,
} from "./charge-form";
import { CategoryStep } from "./CategoryStep";
import { ChargeStepper } from "./ChargeStepper";
import { ChargeSummary } from "./ChargeSummary";
import { FinancialStep } from "./FinancialStep";
import { StudentStep } from "./StudentStep";
import type {
  AlunoOption,
  ChargeStudentStatus,
  CreatedChargeSummary,
  PlanoOption,
  SubmitChargeResult,
} from "./types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CriarCobrancaPayload } from "@/hooks/useFinanceiroAdmin";
import { api, formatApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const STEP_FIELDS: Array<Array<keyof CreateChargeFormValues>> = [
  ["alunoId"],
  ["categoria", "planoId", "descricao", "valorCobrado"],
  [
    "descontoValor",
    "descontoPercentual",
    "vencimento",
    "multaTipo",
    "jurosTipo",
    "encargosTipo",
    "formaPagamento",
  ],
];

function getAlunoName(aluno: AlunoOption | null) {
  return aluno?.nome || aluno?.nome_completo || "Aluno";
}

function getPlanoValue(plano: PlanoOption | null) {
  return Number(
    plano?.precoMensal ?? plano?.preco_mensal ?? plano?.mensalidade ?? plano?.valor ?? 0,
  );
}

function findAlunoPlan(aluno: AlunoOption | null, planos: PlanoOption[]) {
  if (!aluno || planos.length === 0) return planos[0] ?? null;

  const alunoPlanoId = String(aluno.planoId || aluno.plano_id || "");
  const alunoPlanoNome = String(
    aluno.planoNome || aluno.plano_nome || aluno.plano || "",
  ).toLowerCase();

  return (
    planos.find((plano) => alunoPlanoId && String(plano.id) === alunoPlanoId) ??
    planos.find((plano) => alunoPlanoNome && plano.nome.toLowerCase() === alunoPlanoNome) ??
    planos[0] ??
    null
  );
}

function extractText(value: unknown, keys: string[]) {
  const source = value as Record<string, unknown> | null | undefined;
  if (!source || typeof source !== "object") return "";

  for (const key of keys) {
    const direct = source[key];
    if (typeof direct === "string" || typeof direct === "number") return String(direct);
  }

  const data = source.data as Record<string, unknown> | undefined;
  if (data && typeof data === "object") {
    for (const key of keys) {
      const nested = data[key];
      if (typeof nested === "string" || typeof nested === "number") return String(nested);
    }
  }

  return "";
}

function buildCreatedSummary(
  result: SubmitChargeResult,
  payload: CriarCobrancaPayload,
): CreatedChargeSummary {
  const resultObject = result as { created?: unknown; pix?: unknown } | null;
  const created = resultObject?.created ?? result;
  const pix = resultObject?.pix ?? null;

  return {
    id: extractText(created, ["id", "chargeId", "mensalidadeId"]),
    txid: extractText(pix, ["txid", "txId"]) || extractText(created, ["txid", "txId"]),
    pixCopiaCola:
      extractText(pix, ["pixCopiaCola", "pix_copy_paste", "pixCopyPaste", "copiaCola"]) ||
      extractText(created, ["pixCopiaCola", "pix_copy_paste", "pixCopyPaste", "copiaCola"]),
    status: (extractText(created, ["status"]) || "PENDENTE").toUpperCase(),
    payload,
  };
}

function buildObservation(values: CreateChargeFormValues) {
  const entries = [
    `Categoria: ${getCategoryLabel(values.categoria)}`,
    values.multaTipo === "fixo" && parseBRL(values.multaValor) > 0
      ? `Multa fixa: ${formatMoney(parseBRL(values.multaValor))}`
      : "",
    values.jurosTipo === "fixo" && parseBRL(values.jurosValor) > 0
      ? `Juros fixo: ${formatMoney(parseBRL(values.jurosValor))}`
      : "",
    values.encargosTipo === "fixo" && parseBRL(values.encargosValor) > 0
      ? `Encargos fixos: ${formatMoney(parseBRL(values.encargosValor))}`
      : "",
    values.encargosTipo === "percentual" && parseBRL(values.encargosPercentual) > 0
      ? `Encargos: ${values.encargosPercentual}%`
      : "",
  ];

  return entries.filter(Boolean).join(" | ");
}

function buildPayload(
  values: CreateChargeFormValues,
  selectedAluno: AlunoOption | null,
  selectedPlano: PlanoOption | null,
): CriarCobrancaPayload {
  const calc = calcChargeValues(values);
  const isMensalidade = values.categoria === "mensalidade";
  const chargeKind = isMensalidade ? values.recorrencia : "avulsa";
  const descricao = isMensalidade
    ? `Mensalidade - ${selectedPlano?.nome || values.planoNome || "Plano do aluno"}`
    : values.descricao?.trim() || getCategoryLabel(values.categoria);

  return {
    alunoId: values.alunoId,
    alunoNome: getAlunoName(selectedAluno),
    planoId: isMensalidade ? values.planoId || null : null,
    planoNome: isMensalidade ? selectedPlano?.nome || values.planoNome : undefined,
    tipo: values.categoria,
    tipoCobranca: chargeKind,
    descricao,
    valorOriginal: Number(calc.original.toFixed(2)),
    descontoValor: Number(calc.discountManual.toFixed(2)),
    descontoPercentual: Number(calc.discountPercent.toFixed(2)),
    valorFinal: Number(calc.finalValue.toFixed(2)),
    valor: Number(calc.finalValue.toFixed(2)),
    vencimento: values.vencimento,
    competencia: `${values.vencimento.slice(0, 7)}:${chargeKind === "recorrente" ? "mensal" : "avulsa"}`,
    multaPercentual:
      values.multaTipo === "percentual" ? Number(parseBRL(values.multaPercentual).toFixed(2)) : 0,
    jurosDiaPercentual:
      values.jurosTipo === "percentual" ? Number(parseBRL(values.jurosPercentual).toFixed(2)) : 0,
    multaTipo: values.multaTipo,
    multaValor: values.multaTipo === "fixo" ? Number(parseBRL(values.multaValor).toFixed(2)) : 0,
    jurosTipo: values.jurosTipo,
    jurosValor: values.jurosTipo === "fixo" ? Number(parseBRL(values.jurosValor).toFixed(2)) : 0,
    encargosTipo: values.encargosTipo,
    encargosPercentual:
      values.encargosTipo === "percentual"
        ? Number(parseBRL(values.encargosPercentual).toFixed(2))
        : 0,
    encargosValor:
      values.encargosTipo === "fixo" ? Number(parseBRL(values.encargosValor).toFixed(2)) : 0,
    periodicidade: chargeKind === "recorrente" ? "mensal" : "avulsa",
    formaPagamento: values.formaPagamento,
    origem: "manual",
    status: "pendente",
    gerarPix: values.formaPagamento === "pix",
    observacao: buildObservation(values),
  };
}

export function CreateChargeModal({
  open,
  onOpenChange,
  onSubmit,
  actionLoading,
  cobrancas = [],
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSubmit: (payload: CriarCobrancaPayload) => Promise<SubmitChargeResult>;
  actionLoading: boolean;
  cobrancas?: ChargeStudentStatus[];
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [planos, setPlanos] = useState<PlanoOption[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<CreatedChargeSummary | null>(null);
  const submitTokenRef = useRef(0);

  const form = useForm<CreateChargeFormValues>({
    resolver: zodResolver(createChargeSchema),
    defaultValues: getDefaultChargeValues(),
    mode: "onChange",
  });
  const values = form.watch();

  const selectedAluno = useMemo(
    () => alunos.find((item) => String(item.id) === values.alunoId) ?? null,
    [alunos, values.alunoId],
  );
  const selectedPlano = useMemo(
    () => planos.find((item) => String(item.id) === values.planoId) ?? null,
    [planos, values.planoId],
  );
  const financeiroStatusByAluno = useMemo(() => {
    return cobrancas.reduce<Record<string, string[]>>((acc, cobranca) => {
      const alunoId = String(cobranca.alunoId ?? cobranca.aluno_id ?? "").trim();
      if (!alunoId) return acc;

      acc[alunoId] = [...(acc[alunoId] || []), String(cobranca.status || "pendente")];
      return acc;
    }, {});
  }, [cobrancas]);
  const isSubmitting = actionLoading || localSubmitting;

  function resetModalState() {
    submitTokenRef.current += 1;
    setLocalSubmitting(false);
    form.reset(getDefaultChargeValues());
    setCurrentStep(0);
    setCreatedSummary(null);
  }

  function applyDefaultSelection(nextAlunos = alunos, nextPlanos = planos) {
    const firstAluno = nextAlunos[0] ?? null;
    const firstPlan = findAlunoPlan(firstAluno, nextPlanos);

    if (firstAluno) {
      form.setValue("alunoId", String(firstAluno.id), { shouldValidate: true });
    }
    if (firstPlan) {
      form.setValue("planoId", String(firstPlan.id), { shouldValidate: true });
      form.setValue("planoNome", firstPlan.nome);
      form.setValue("valorPlano", formatBRLFromNumber(getPlanoValue(firstPlan)), {
        shouldValidate: true,
      });
    }
  }

  function startNewCharge() {
    form.reset(getDefaultChargeValues());
    setCurrentStep(0);
    setCreatedSummary(null);
    applyDefaultSelection();
  }

  function handleOpenChange(value: boolean) {
    if (!value) resetModalState();
    onOpenChange(value);
  }

  function handleSelectPlano(planoId: string) {
    const plano = planos.find((item) => String(item.id) === planoId) ?? null;
    form.setValue("planoId", planoId, { shouldDirty: true, shouldValidate: true });
    form.setValue("planoNome", plano?.nome || "", { shouldDirty: true });
    form.setValue("valorPlano", formatBRLFromNumber(getPlanoValue(plano)), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  useEffect(() => {
    if (!open) return;

    let active = true;
    setLoadingData(true);

    Promise.all([api.get<AlunoOption[]>("/alunos"), api.get<PlanoOption[]>("/planos")])
      .then(([alunosResponse, planosResponse]) => {
        if (!active) return;

        const nextAlunos = Array.isArray(alunosResponse) ? alunosResponse : [];
        const nextPlanos = Array.isArray(planosResponse) ? planosResponse : [];
        setAlunos(nextAlunos);
        setPlanos(nextPlanos);

        applyDefaultSelection(nextAlunos, nextPlanos);
      })
      .catch((error) => toast.error(formatApiErrorMessage(error, "Erro ao carregar dados")))
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, [form, open]);

  useEffect(() => {
    if (!selectedAluno || planos.length === 0) return;
    if (values.categoria !== "mensalidade") return;

    const plan = findAlunoPlan(selectedAluno, planos);
    if (!plan || String(plan.id) === form.getValues("planoId")) return;

    handleSelectPlano(String(plan.id));
  }, [form, selectedAluno, planos, values.categoria]);

  useEffect(() => {
    if (values.categoria === "mensalidade") return;
    const label = getCategoryLabel(values.categoria);

    if (values.recorrencia !== "avulsa") {
      form.setValue("recorrencia", "avulsa", { shouldDirty: true, shouldValidate: true });
    }

    if (!values.descricao?.trim()) {
      form.setValue("descricao", label, { shouldDirty: true });
    }
  }, [form, values.categoria, values.descricao, values.recorrencia]);

  async function goNext() {
    const isValid = await form.trigger(STEP_FIELDS[currentStep], { shouldFocus: true });
    if (!isValid) {
      toast.error("Revise os campos destacados antes de avancar.");
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, 2));
  }

  function goBack() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  async function handleSubmit(submittedValues: CreateChargeFormValues) {
    if (isSubmitting) return;

    const submitToken = submitTokenRef.current + 1;
    submitTokenRef.current = submitToken;
    const payload = buildPayload(submittedValues, selectedAluno, selectedPlano);

    try {
      setLocalSubmitting(true);
      const result = await onSubmit(payload);
      if (submitTokenRef.current !== submitToken) return;

      setCreatedSummary(buildCreatedSummary(result, payload));
      toast.success("Cobranca criada no J12 Pay.");
    } catch (error) {
      if (submitTokenRef.current !== submitToken) return;
      toast.error(formatApiErrorMessage(error, "Erro ao criar cobranca"));
    } finally {
      if (submitTokenRef.current === submitToken) {
        setLocalSubmitting(false);
      }
    }
  }

  function handleCancel() {
    handleOpenChange(false);
  }

  async function handleCopyPix(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("PIX copiado.");
    } catch {
      toast.error("Nao foi possivel copiar o PIX.");
    }
  }

  const stepContent = [
    <StudentStep
      key="student"
      form={form}
      alunos={alunos}
      financeiroStatusByAluno={financeiroStatusByAluno}
    />,
    <CategoryStep
      key="category"
      form={form}
      selectedAluno={selectedAluno}
      selectedPlano={selectedPlano}
      planos={planos}
      onSelectPlano={handleSelectPlano}
    />,
    <FinancialStep key="financial" form={form} />,
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92svh] w-[calc(100vw-1.5rem)] max-w-6xl overflow-hidden rounded-3xl border-primary/20 bg-zinc-950 p-0 shadow-2xl shadow-primary/10 sm:rounded-3xl [&>button]:hidden">
        <div className="flex max-h-[92svh] min-h-0 flex-col">
          <header className="border-b border-white/10 p-4 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  J12 Pay
                </div>
                <DialogTitle className="mt-3 text-2xl font-black text-white md:text-3xl">
                  Criar cobranca
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-slate-400">
                  Fluxo financeiro por etapas, com PIX Banco Inter e atualizacao em tempo real.
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                aria-label="Cancelar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
              <ChargeStepper currentStep={currentStep} />

              {loadingData ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="space-y-3">
                    <div className="j12-skeleton h-16" />
                    <div className="j12-skeleton h-36" />
                    <div className="j12-skeleton h-36" />
                  </div>
                  <div className="j12-skeleton h-96" />
                </div>
              ) : (
                <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <motion.div
                    layout
                    className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.025] p-4 md:p-5"
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                      >
                        {stepContent[currentStep]}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>

                  <ChargeSummary
                    values={values}
                    selectedAluno={selectedAluno}
                    selectedPlano={selectedPlano}
                    createdSummary={createdSummary}
                    onCopyPix={handleCopyPix}
                  />
                </div>
              )}
            </div>

            <footer className="border-t border-white/10 bg-zinc-950/95 p-4 md:px-6">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={goBack}
                  disabled={currentStep === 0 || isSubmitting}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>

                {createdSummary && currentStep === 2 ? (
                  <button
                    type="button"
                    onClick={startNewCharge}
                    disabled={isSubmitting}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                  >
                    <Sparkles className="h-4 w-4" />
                    Nova cobranca
                  </button>
                ) : currentStep < 2 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={loadingData}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Avancar
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60",
                      createdSummary && "bg-emerald-500 text-black shadow-emerald-500/20",
                    )}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Criar cobranca
                  </button>
                )}
              </div>
            </footer>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
