import { useEffect, useMemo, useState } from "react";
import type { ComponentProps, FormEvent, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { formatApiErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
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
import { SkeletonCard } from "@/components/ui/skeleton";
import { useConvertCrmLeadToDraftEnrollment, useCrmLead } from "../hooks/use-crm-leads";
import { useCrmLeadStageTiming, useVisibleMinuteClock } from "../hooks/use-crm-lead-stage-timing";
import { CrmLeadStageTimingDetails } from "./CrmLeadStageTimingDetails";
import type {
  CrmLeadConversionResult,
  CrmLeadDetail,
  CrmStudentData,
} from "../types/crm-lead.types";

export function CrmLeadDetailsDialog({
  leadId,
  onConvert,
  onOpenChange,
  open,
}: {
  leadId: string | null;
  onConvert: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const query = useCrmLead(leadId);
  const timingQuery = useCrmLeadStageTiming(leadId, open);
  const nowMs = useVisibleMinuteClock();
  const lead = query.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-card">
        <DialogHeader>
          <DialogTitle className="text-white">Detalhes do Lead</DialogTitle>
          <DialogDescription>
            Dados comerciais e estado canônico da conversão. Este contato não é tratado como aluno.
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? <SkeletonCard announce lines={5} /> : null}
        {query.isError ? (
          <ErrorNotice
            message={formatApiErrorMessage(query.error, "Não foi possível carregar o Lead.")}
          />
        ) : null}
        {lead ? (
          <LeadDetails
            lead={lead}
            onConvert={onConvert}
            timing={timingQuery.data}
            timingError={
              timingQuery.isError
                ? formatApiErrorMessage(
                    timingQuery.error,
                    "Não foi possível carregar o tempo no funil.",
                  )
                : null
            }
            timingLoading={timingQuery.isLoading}
            nowMs={nowMs}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LeadDetails({
  lead,
  nowMs,
  onConvert,
  timing,
  timingError,
  timingLoading,
}: {
  lead: CrmLeadDetail;
  nowMs: number;
  onConvert: () => void;
  timing: import("../types/crm-lead-stage-timing.types").CrmLeadStageTimingDetail | undefined;
  timingError: string | null;
  timingLoading: boolean;
}) {
  const reason = reasonMessage(lead.eligibility.reasonCode);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailValue label="ID comercial" value={lead.id} />
        <DetailValue label="Unidade" value={lead.unitId} />
        <DetailValue label="Etapa" value={stageLabel(lead.stage)} />
        <DetailValue label="Status" value={statusLabel(lead.status)} />
        <DetailValue label="Criado em" value={formatDate(lead.createdAt)} />
        <DetailValue label="Atualizado em" value={formatDate(lead.updatedAt)} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="font-semibold text-white">Contato comercial</h3>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <DetailValue label="Nome" value={lead.contact.nome} />
          <DetailValue label="E-mail" value={lead.contact.email} />
          <DetailValue label="Telefone" value={lead.contact.telefone} />
        </div>
      </section>

      <CrmLeadStageTimingDetails
        data={timing}
        error={timingError}
        isLoading={timingLoading}
        nowMs={nowMs}
      />

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Elegibilidade para matrícula DRAFT</h3>
            <p className="mt-1 text-sm text-slate-400">
              O backend permanece a fonte final da verdade.
            </p>
          </div>
          <Badge variant={lead.eligibility.canConvertToDraftEnrollment ? "default" : "outline"}>
            {lead.eligibility.canConvertToDraftEnrollment ? "Elegível" : "Bloqueado"}
          </Badge>
        </div>
        {!lead.eligibility.canConvertToDraftEnrollment && reason ? (
          <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {reason}
          </p>
        ) : null}
        {lead.eligibility.canConvertToDraftEnrollment ? (
          <Button className="mt-4 w-full sm:w-auto" onClick={onConvert}>
            Converter em matrícula DRAFT
          </Button>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <ConversionState title="Pessoa / perfil de aluno">
          <DetailValue label="Status" value={lead.conversions.student.status || "Não convertido"} />
          <DetailValue label="Pessoa" value={lead.conversions.student.personId} />
          <DetailValue label="Perfil" value={lead.conversions.student.personProfileId} />
        </ConversionState>
        <ConversionState title="Matrícula">
          <DetailValue
            label="Status"
            value={lead.conversions.enrollment.status || "Não convertida"}
          />
          <DetailValue label="Estado" value={lead.conversions.enrollment.enrollmentStatus} />
          <DetailValue label="Enrollment" value={lead.conversions.enrollment.enrollmentId} />
        </ConversionState>
      </section>
    </div>
  );
}

export function CrmLeadDraftEnrollmentConversionDialog({
  leadId,
  onOpenChange,
  open,
}: {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const leadQuery = useCrmLead(leadId);
  const lead = leadQuery.data;
  const mutation = useConvertCrmLeadToDraftEnrollment();
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState<CrmStudentData["sexo"] | "">("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setNome("");
      setDataNascimento("");
      setSexo("");
      setCpf("");
      setEmail("");
      setTelefone("");
      setStartDate("");
      setFormError(null);
      setIdempotencyKey(createIdempotencyKey());
    }
  }, [open, leadId]);

  const canSubmit = useMemo(
    () => Boolean(lead?.eligibility.canConvertToDraftEnrollment && !mutation.isSuccess),
    [lead, mutation.isSuccess],
  );

  function handleDialogOpenChange(nextOpen: boolean) {
    if (mutation.isPending) return;
    if (!nextOpen) mutation.reset();
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || !canSubmit || mutation.isPending) return;

    const validationError = validateForm({ dataNascimento, nome, sexo, startDate });
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    const studentData: CrmStudentData = {
      dataNascimento,
      nome: nome.trim(),
      sexo: sexo as CrmStudentData["sexo"],
      ...(cpf.trim() ? { cpf: cpf.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(telefone.trim() ? { telefone: telefone.trim() } : {}),
    };

    try {
      const result = await mutation.mutateAsync({
        leadId: lead.id,
        payload: {
          enrollmentData: { startDate },
          studentData,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
      });
      toast.success("Conversão concluída.");
      onOpenChange(false);
      setFormError(null);
      return result;
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-white/10 bg-card">
        <DialogHeader>
          <DialogTitle className="text-white">Preview de conversão</DialogTitle>
          <DialogDescription>
            Informe explicitamente os dados do aluno. Os dados do contato comercial não serão
            copiados automaticamente.
          </DialogDescription>
        </DialogHeader>

        {leadQuery.isLoading ? <SkeletonCard announce lines={3} /> : null}
        {leadQuery.isError ? (
          <ErrorNotice
            message={formatApiErrorMessage(
              leadQuery.error,
              "N\u00e3o foi poss\u00edvel validar o Lead.",
            )}
          />
        ) : null}

        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm text-slate-200">
          <p className="font-semibold text-white">Esta ação criará ou reutilizará:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>uma Pessoa;</li>
            <li>um Perfil de Aluno;</li>
            <li>uma Matrícula em estado DRAFT.</li>
          </ul>
          <p className="mt-3 text-slate-300">
            A matrícula não será ativada, nenhuma cobrança será gerada, nenhuma turma será
            selecionada, nenhum contrato será criado e nenhuma notificação será enviada
            automaticamente.
          </p>
        </div>

        {mutation.data ? (
          <ConversionSuccess result={mutation.data} onClose={() => handleDialogOpenChange(false)} />
        ) : (
          <form
            className="space-y-4"
            onSubmit={handleSubmit}
            aria-describedby={formError ? "crm-conversion-error" : undefined}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nome do aluno *"
                value={nome}
                onChange={setNome}
                maxLength={160}
                autoFocus
              />
              <div className="space-y-2">
                <Label htmlFor="crm-sexo">Sexo *</Label>
                <select
                  id="crm-sexo"
                  className="j12-field h-10 w-full px-3"
                  value={sexo}
                  onChange={(event) => setSexo(event.target.value as typeof sexo)}
                >
                  <option value="">Selecione</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>
              <Field
                label="Data de nascimento *"
                type="date"
                value={dataNascimento}
                onChange={setDataNascimento}
              />
              <Field
                label="Data inicial da matrícula *"
                type="date"
                value={startDate}
                onChange={setStartDate}
              />
              <Field
                label="CPF (opcional)"
                value={cpf}
                onChange={setCpf}
                inputMode="numeric"
                maxLength={20}
              />
              <Field
                label="E-mail (opcional)"
                type="email"
                value={email}
                onChange={setEmail}
                maxLength={254}
              />
              <Field
                label="Telefone (opcional)"
                value={telefone}
                onChange={setTelefone}
                inputMode="tel"
                maxLength={32}
              />
            </div>

            {formError ? <ErrorNotice id="crm-conversion-error" message={formError} /> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!canSubmit || mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                Confirmar conversão
              </Button>
            </DialogFooter>
          </form>
        )}
        <p aria-live="polite" className="sr-only">
          {mutation.isPending ? "Enviando conversão" : ""}
        </p>
      </DialogContent>
    </Dialog>
  );
}

function ConversionSuccess({
  onClose,
  result,
}: {
  onClose: () => void;
  result: CrmLeadConversionResult;
}) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5"
    >
      <div className="flex items-center gap-2 text-emerald-100">
        <CheckCircle2 className="h-5 w-5" />
        <h3 className="font-semibold">Conversão concluída.</h3>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-200">
        <li>Pessoa: {result.resolutions.person === "CREATED" ? "criada" : "reutilizada"}.</li>
        <li>
          Perfil de aluno: {result.resolutions.profile === "CREATED" ? "criado" : "reutilizado"}.
        </li>
        <li>
          Matrícula: {result.resolutions.enrollment === "CREATED" ? "criada" : "reutilizada"}.
        </li>
        <li>Status da matrícula: {result.enrollmentStatus}.</li>
      </ul>
      <Button className="mt-5 w-full sm:w-auto" onClick={onClose}>
        Concluir
      </Button>
    </section>
  );
}
function Field({
  label,
  onChange,
  value,
  ...props
}: { label: string; value: string; onChange: (value: string) => void } & Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange"
>) {
  const id = `crm-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </div>
  );
}

function ConversionState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="font-semibold text-white">{title}</h3>
      <div className="mt-3 grid gap-2">{children}</div>
    </section>
  );
}

function DetailValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-white">{value || "—"}</p>
    </div>
  );
}

function ErrorNotice({ id, message }: { id?: string; message: string }) {
  return (
    <div
      id={id}
      role="alert"
      className="flex gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}
function validateForm({
  dataNascimento,
  nome,
  sexo,
  startDate,
}: {
  dataNascimento: string;
  nome: string;
  sexo: string;
  startDate: string;
}) {
  const normalizedName = nome.trim();
  if (normalizedName.length < 2 || normalizedName.length > 160) {
    return "Informe um nome de aluno válido.";
  }
  if (!isValidIsoDate(dataNascimento)) return "Informe uma data de nascimento válida.";
  if (!sexo || !["M", "F", "OUTRO"].includes(sexo)) return "Selecione um sexo válido.";
  if (!isValidIsoDate(startDate)) return "Informe uma data inicial de matrícula válida.";
  return null;
}
function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function createIdempotencyKey() {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : undefined;
}
function errorMessage(error: unknown) {
  const code = (error as { data?: { code?: string } })?.data?.code;
  const messages: Record<string, string> = {
    CRM_ACCESS_DENIED: "Você não possui permissão para esta operação.",
    CRM_ENROLLMENT_ALREADY_CONVERTED: "Este Lead já possui matrícula vinculada.",
    CRM_INPUT_INVALID: "Revise os dados informados.",
    CRM_LEAD_NOT_CONVERTIBLE: "Este Lead não pode ser convertido no estado atual.",
    CRM_LEAD_NOT_FOUND: "O Lead não foi encontrado.",
    CRM_LEAD_UNIT_CONTEXT_UNAVAILABLE: "A unidade do Lead não está disponível.",
    CRM_LEAD_UNIT_CONTEXT_FAILED: "Não foi possível validar a unidade do Lead.",
    DATABASE_UNAVAILABLE: "A conversão está temporariamente indisponível.",
    ENROLLMENT_ACTIVE_EXISTS: "Já existe uma matrícula ativa para este aluno.",
    ENROLLMENT_STATE_CONFLICT: "O estado atual da matrícula precisa de revisão.",
    PERSON_IDENTITY_CONFLICT: "Existe um conflito de identidade que precisa de revisão.",
    STUDENT_PROFILE_CONFLICT: "Existem múltiplos perfis de aluno para esta Pessoa.",
  };
  return messages[code || ""] || "Não foi possível concluir a conversão.";
}
function reasonMessage(code: string | null) {
  return (
    (
      {
        CRM_ENROLLMENT_ALREADY_CONVERTED: "Este Lead já possui matrícula vinculada.",
        CRM_LEAD_NOT_CONVERTED: "O Lead ainda não está marcado como convertido.",
        CRM_LEAD_NOT_WON: "O Lead precisa estar na etapa WON.",
        CRM_LEAD_UNIT_CONTEXT_UNAVAILABLE: "A unidade do Lead não pôde ser determinada.",
      } as Record<string, string>
    )[code || ""] || code
  );
}
function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}
function stageLabel(value: string) {
  return value.replaceAll("_", " ");
}
function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}
