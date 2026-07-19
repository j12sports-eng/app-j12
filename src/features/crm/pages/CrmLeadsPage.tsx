import { useMemo, useState } from "react";
import { ChevronDown, Loader2, RefreshCcw, ShieldCheck, UserRoundSearch } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonTable } from "@/components/ui/skeleton";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { formatApiErrorMessage } from "@/lib/api";
import { PipelineColumn } from "../components/PipelineColumn";
import { PipelineDragOverlay } from "../components/PipelineDragOverlay";
import { CrmLeadStageTransitionDialog } from "../components/CrmLeadStageTransitionDialog";
import { CrmSlaAlertsPanel } from "../components/CrmSlaAlertsPanel";
import { PipelineHeader } from "../components/PipelineHeader";
import { useCrmLead, useCrmLeads, useMoveCrmLeadStage } from "../hooks/use-crm-leads";
import { useCrmPipeline } from "../hooks/use-crm-pipeline";
import { useVisibleMinuteClock } from "../hooks/use-crm-lead-stage-timing";
import { telemetry, useCrmLeadDrag, type CrmLeadDropRequest } from "../hooks/use-crm-lead-drag";
import { recordCrmLeadDragEvent } from "../observability/crm-lead-drag.observability";
import {
  CrmLeadDetailsDialog,
  CrmLeadDraftEnrollmentConversionDialog,
} from "../components/CrmLeadConversionDialogs";
import type { CrmLeadFilters, CrmLeadListItem } from "../types/crm-lead.types";
import type { CrmPipeline, CrmPipelineStage } from "../types/crm-pipeline.types";

export function CrmLeadsRoutePage() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <CrmLeadsPage />
    </ProtectedRoute>
  );
}

function CrmLeadsPage() {
  const [filters, setFilters] = useState<CrmLeadFilters>({ limit: 50 });
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [conversionOpen, setConversionOpen] = useState(false);
  const [stageLeadId, setStageLeadId] = useState<string | null>(null);
  const [dragRequest, setDragRequest] = useState<CrmLeadDropRequest | null>(null);
  const [stageFocusRequest, setStageFocusRequest] = useState<StageFocusRequest | null>(null);
  const dragSucceeded = useRef(false);
  const pendingStageFocus = useRef<StageFocusRequest | null>(null);
  const query = useCrmLeads(filters);
  const pipelineQuery = useCrmPipeline();
  const stageLeadQuery = useCrmLead(stageLeadId);
  const nowMs = useVisibleMinuteClock();
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const hasNextPage = query.hasNextPage;

  function setFilter<K extends keyof CrmLeadFilters>(key: K, value: CrmLeadFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  function openDetails(leadId: string) {
    setSelectedLeadId(leadId);
    setDetailsOpen(true);
  }
  function openStage(leadId: string) {
    pendingStageFocus.current = { expectedStage: null, leadId };
    setStageFocusRequest(null);
    setStageLeadId(leadId);
  }
  function restoreStageFocus() {
    const request = pendingStageFocus.current;
    if (!request) return;
    pendingStageFocus.current = null;
    setStageFocusRequest(request);
  }
  function openConversion() {
    setDetailsOpen(false);
    setConversionOpen(true);
  }

  useLayoutEffect(() => {
    if (!stageFocusRequest || stageLeadId !== null) return;
    const lead = items.find((item) => item.id === stageFocusRequest.leadId);
    if (
      !lead ||
      (stageFocusRequest.expectedStage && lead.stage !== stageFocusRequest.expectedStage)
    ) {
      return;
    }
    const trigger = Array.from(
      document.querySelectorAll<HTMLElement>("[data-crm-stage-trigger]"),
    ).find((element) => element.dataset.crmStageTrigger === stageFocusRequest.leadId);
    if (!trigger?.isConnected) return;
    trigger.focus();
    if (document.activeElement === trigger) setStageFocusRequest(null);
  }, [items, stageFocusRequest, stageLeadId]);

  return (
    <AppShell title="CRM Â· Leads">
      <div className="j12-page-enter space-y-6">
        <section className="j12-surface overflow-hidden p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase text-primary">
                <UserRoundSearch className="h-3.5 w-3.5" />
                CRM interno
              </div>
              <h1 className="mt-4 text-3xl font-bold text-white md:text-5xl">Leads</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Consulte contatos comerciais, elegibilidade e conversÃµes antes de abrir um preview
                de matrÃ­cula DRAFT.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                Ãrea administrativa protegida
              </div>
              <p className="mt-1 text-xs text-emerald-200/80">Admin e coordenador</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="Etapa"
              value={filters.stage || ""}
              onChange={(value) =>
                setFilter("stage", value ? (value as CrmLeadFilters["stage"]) : undefined)
              }
              options={[
                ["NEW", "Novo"],
                ["CONTACTED", "Contatado"],
                ["QUALIFIED", "Qualificado"],
                ["PROPOSAL", "Proposta"],
                ["NEGOTIATION", "NegociaÃ§Ã£o"],
                ["WON", "WON"],
                ["LOST", "Perdido"],
                ["TRIAL_SCHEDULED", "Aula experimental agendada"],
                ["TRIAL_COMPLETED", "Aula experimental concluÃ­da"],
              ]}
            />
            <FilterSelect
              label="Status"
              value={filters.status || ""}
              onChange={(value) =>
                setFilter("status", value ? (value as CrmLeadFilters["status"]) : undefined)
              }
              options={[
                ["OPEN", "Aberto"],
                ["CONVERTED", "Convertido"],
                ["LOST", "Perdido"],
                ["TRIAL_SCHEDULED", "Aula experimental agendada"],
                ["TRIAL_COMPLETED", "Aula experimental concluÃ­da"],
                ["ARCHIVED", "Arquivado"],
              ]}
            />
            <FilterSelect
              label="ConversÃ£o"
              value={filters.conversionStatus || ""}
              onChange={(value) =>
                setFilter(
                  "conversionStatus",
                  value ? (value as CrmLeadFilters["conversionStatus"]) : undefined,
                )
              }
              options={[
                ["NONE", "Sem conversÃ£o"],
                ["STUDENT_COMPLETED", "Aluno convertido"],
                ["ENROLLMENT_COMPLETED", "MatrÃ­cula convertida"],
              ]}
            />
            <div className="space-y-2">
              <Label htmlFor="crm-unit-filter">Unidade (filtro)</Label>
              <Input
                id="crm-unit-filter"
                value={filters.unitId || ""}
                onChange={(event) => setFilter("unitId", event.target.value || undefined)}
                placeholder="ID da unidade"
              />
            </div>
          </div>
        </section>

        <CrmSlaAlertsPanel nowMs={nowMs} onOpenLead={openDetails} />

        {query.isLoading || pipelineQuery.isLoading ? <SkeletonTable columns={8} rows={6} /> : null}
        {query.isError ? (
          <ErrorPanel
            message={formatApiErrorMessage(query.error, "NÃ£o foi possÃ­vel carregar os Leads.")}
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {pipelineQuery.isError ? (
          <ErrorPanel
            message={formatApiErrorMessage(
              pipelineQuery.error,
              "NÃ£o foi possÃ­vel carregar o pipeline comercial.",
            )}
            onRetry={() => void pipelineQuery.refetch()}
          />
        ) : null}
        {!query.isLoading &&
        !pipelineQuery.isLoading &&
        !query.isError &&
        !pipelineQuery.isError &&
        pipelineQuery.data ? (
          <PipelineBoard
            pipeline={pipelineQuery.data}
            items={items}
            onSelect={openDetails}
            onChangeStage={openStage}
            onDragConfirmation={(request) => {
              dragSucceeded.current = false;
              setDragRequest(request);
            }}
            nowMs={nowMs}
          />
        ) : null}

        {hasNextPage ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => void query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
            >
              {query.isFetchingNextPage ? <Loader2 className="animate-spin" /> : <ChevronDown />}
              Carregar mais
            </Button>
          </div>
        ) : null}
      </div>

      <CrmLeadDetailsDialog
        leadId={selectedLeadId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onConvert={openConversion}
      />
      <CrmLeadDraftEnrollmentConversionDialog
        leadId={selectedLeadId}
        open={conversionOpen}
        onOpenChange={setConversionOpen}
      />
      {stageLeadQuery.data && pipelineQuery.data ? (
        <CrmLeadStageTransitionDialog
          lead={stageLeadQuery.data}
          pipeline={pipelineQuery.data}
          open={Boolean(stageLeadId)}
          initialStage={dragRequest?.lead.id === stageLeadId ? dragRequest.toStage : null}
          onSucceeded={(result) => {
            pendingStageFocus.current = {
              expectedStage: result.stage,
              leadId: result.leadId,
            };
            dragSucceeded.current = true;
            if (dragRequest) recordCrmLeadDragEvent("DRAG_SUCCEEDED", telemetry(dragRequest));
            setDragRequest(null);
          }}
          onFailed={() => {
            if (dragRequest) recordCrmLeadDragEvent("DRAG_FAILED", telemetry(dragRequest));
          }}
          onReturnFocus={restoreStageFocus}
          onOpenChange={(open) => {
            if (!open) {
              if (dragRequest && !dragSucceeded.current)
                recordCrmLeadDragEvent("DRAG_CANCELLED", telemetry(dragRequest));
              setDragRequest(null);
              setStageLeadId(null);
            }
          }}
        />
      ) : null}
    </AppShell>
  );
}

type StageFocusRequest = {
  expectedStage: CrmLeadListItem["stage"] | null;
  leadId: string;
};

function PipelineBoard({
  items,
  onSelect,
  onChangeStage,
  onDragConfirmation,
  nowMs,

  pipeline,
}: {
  items: CrmLeadListItem[];
  onSelect: (leadId: string) => void;
  onChangeStage: (leadId: string) => void;
  onDragConfirmation: (request: CrmLeadDropRequest | null) => void;
  nowMs: number;
  pipeline: CrmPipeline;
}) {
  const mutation = useMoveCrmLeadStage();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [submittingLeadId, setSubmittingLeadId] = useState<string | null>(null);
  const drag = useCrmLeadDrag({
    items,
    pipeline,
    onDrop: (request) => {
      if (request.toStage === "LOST" || request.toStage === "WON") {
        onDragConfirmation(request);
        onChangeStage(request.lead.id);
        return;
      }
      setSubmittingLeadId(request.lead.id);
      void mutation
        .mutateAsync({
          leadId: request.lead.id,
          input: {
            nextStage: request.toStage,
            expectedStage: request.lead.stage,
            expectedStatus: request.lead.status,
          },
        })
        .then(() => {
          recordCrmLeadDragEvent("DRAG_SUCCEEDED", telemetry(request));
          toast.success("Estágio atualizado.");
        })
        .catch((error) => {
          recordCrmLeadDragEvent("DRAG_FAILED", telemetry(request));
          const conflict =
            (error as { data?: { code?: string } })?.data?.code === "CRM_STAGE_CONFLICT";
          toast.error(
            conflict
              ? "O Lead foi atualizado por outro usuário. Os dados foram recarregados."
              : "Não foi possível mover o Lead. Ele voltou à coluna original.",
          );
        })
        .finally(() => setSubmittingLeadId(null));
    },
  });
  const compatibilityStages = LEGACY_READ_ONLY_STAGES.filter((stage) =>
    items.some((item) => item.stage === stage.id),
  );
  const stages = [...pipeline.stages, ...compatibilityStages];
  return (
    <DndContext
      sensors={sensors}
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDragEnd={drag.onDragEnd}
      onDragCancel={drag.onDragCancel}
    >
      <section
        className="j12-surface overflow-hidden"
        aria-label="Pipeline comercial com arraste opcional"
      >
        <PipelineHeader leadCount={items.length} stageCount={stages.length} />
        <div className="overflow-x-auto p-4">
          <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4">
            {stages.map((stage) => (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                leads={items.filter((item) => item.stage === stage.id)}
                onSelect={onSelect}
                onChangeStage={onChangeStage}
                submittingLeadId={submittingLeadId}
                nowMs={nowMs}
                dragState={
                  !drag.activeLead
                    ? "idle"
                    : drag.allowed(drag.activeLead, stage.id)
                      ? "allowed"
                      : "invalid"
                }
              />
            ))}
          </div>
        </div>
      </section>
      {typeof document !== "undefined"
        ? createPortal(
            <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
              {drag.activeLead ? <PipelineDragOverlay lead={drag.activeLead} /> : null}
            </DragOverlay>,
            document.body,
          )
        : null}
    </DndContext>
  );
}

const LEGACY_READ_ONLY_STAGES: CrmPipelineStage[] = [
  {
    id: "TRIAL_SCHEDULED",
    order: 8,
    label: "Aula experimental agendada",
    description: "EstÃ¡gio legado exibido somente para compatibilidade.",
    color: "#64748b",
    terminal: false,
    transitions: [],
  },
  {
    id: "TRIAL_COMPLETED",
    order: 9,
    label: "Aula experimental concluÃ­da",
    description: "EstÃ¡gio legado exibido somente para compatibilidade.",
    color: "#64748b",
    terminal: false,
    transitions: [],
  },
];

function LeadList({
  items,
  onSelect,
}: {
  items: CrmLeadListItem[];
  onSelect: (leadId: string) => void;
}) {
  return (
    <Card className="border-white/10 bg-card">
      <CardHeader>
        <CardTitle className="text-white">
          Leads encontrados{" "}
          <span className="ml-2 text-sm font-normal text-slate-400">{items.length} carregados</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-y border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">ID comercial</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3">Elegibilidade</th>
                <th className="px-4 py-3">Aluno</th>
                <th className="px-4 py-3">MatrÃ­cula</th>
                <th className="px-4 py-3">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  tabIndex={0}
                  onClick={() => onSelect(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onSelect(item.id);
                  }}
                  className="cursor-pointer border-b border-white/8 text-slate-200 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <td className="px-4 py-4 font-semibold text-white">{item.id}</td>
                  <td className="px-4 py-4">{stageLabel(item.stage)}</td>
                  <td className="px-4 py-4">{statusLabel(item.status)}</td>
                  <td className="px-4 py-4">{item.unitId}</td>
                  <td className="px-4 py-4">
                    <EligibilityBadge item={item} />
                  </td>
                  <td className="px-4 py-4">
                    {item.conversions.studentCompleted ? "Convertido" : "Pendente"}
                  </td>
                  <td className="px-4 py-4">
                    {item.conversions.enrollmentCompleted
                      ? item.conversions.enrollmentStatus || "Convertida"
                      : "Pendente"}
                  </td>
                  <td className="px-4 py-4 text-slate-400">{formatDate(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 p-3 md:hidden">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold text-white">{item.id}</span>
                <EligibilityBadge item={item} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300">
                <span>{stageLabel(item.stage)}</span>
                <span>{statusLabel(item.status)}</span>
                <span>Unidade {item.unitId}</span>
                <span>{formatDate(item.updatedAt)}</span>
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Aluno: {item.conversions.studentCompleted ? "convertido" : "pendente"} Â·
                MatrÃ­cula:{" "}
                {item.conversions.enrollmentCompleted
                  ? item.conversions.enrollmentStatus || "convertida"
                  : "pendente"}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`crm-${label}`}>{label}</Label>
      <select
        id={`crm-${label}`}
        className="j12-field h-10 w-full px-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Todos</option>
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
function EligibilityBadge({ item }: { item: CrmLeadListItem }) {
  return (
    <Badge variant={item.eligibility.canConvertToDraftEnrollment ? "default" : "outline"}>
      {item.eligibility.canConvertToDraftEnrollment ? "ElegÃ­vel" : "Bloqueado"}
    </Badge>
  );
}
function EmptyPanel() {
  return (
    <Card className="border-white/10 bg-card">
      <CardContent className="p-10 text-center">
        <UserRoundSearch className="mx-auto h-10 w-10 text-slate-500" />
        <h2 className="mt-4 text-lg font-semibold text-white">Nenhum Lead encontrado</h2>
        <p className="mt-2 text-sm text-slate-400">
          Ajuste os filtros ou aguarde novos contatos comerciais.
        </p>
      </CardContent>
    </Card>
  );
}
function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-red-400/20 bg-red-500/10">
      <CardContent className="p-6">
        <p role="alert" className="text-sm text-red-100">
          {message}
        </p>
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCcw />
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  );
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}
function stageLabel(value: string) {
  return value.replaceAll("_", " ");
}
function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}
