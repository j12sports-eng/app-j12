import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BellRing, ChevronDown, ListFilter, Loader2, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useCrmSlaAlerts, CRM_SLA_ALERTS_DEFAULT_LIMIT } from "../hooks/use-crm-sla-alerts";
import { recordCrmSlaAlertsEvent } from "../observability/crm-sla-alerts.observability";
import type { CrmLeadStage } from "../types/crm-lead.types";
import type {
  CrmSlaAlertFilters,
  CrmSlaAlertItem,
  CrmSlaAlertStatus,
} from "../types/crm-sla-alerts.types";
import { CrmSlaAlertItem as AlertItem } from "./CrmSlaAlertItem";

const DEFAULT_FILTERS: CrmSlaAlertFilters = { limit: CRM_SLA_ALERTS_DEFAULT_LIMIT };

const GROUPS: Array<{
  status: CrmSlaAlertStatus;
  title: string;
}> = [
  { status: "OVERDUE", title: "Em atraso" },
  { status: "WARNING", title: "Próximos do prazo" },
  { status: "UNAVAILABLE", title: "Sem histórico confiável" },
  { status: "NOT_CONFIGURED", title: "SLA não configurado" },
  { status: "NORMAL", title: "No prazo" },
  { status: "COMPLETED", title: "Concluídos" },
];

export function CrmSlaAlertsPanel({
  nowMs,
  onOpenLead,
}: {
  nowMs: number;
  onOpenLead: (leadId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [draftFilters, setDraftFilters] = useState<CrmSlaAlertFilters>(DEFAULT_FILTERS);
  const [filters, setFilters] = useState<CrmSlaAlertFilters>(DEFAULT_FILTERS);
  const queryStartedAt = useRef(Date.now());
  const viewed = useRef(false);
  const observedErrorAt = useRef(0);
  const query = useCrmSlaAlerts(filters);
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: items.filter((item) => item.alertStatus === group.status),
      })).filter((group) => group.items.length > 0),
    [items],
  );
  const activeFilterCount = countActiveFilters(filters);

  useEffect(() => {
    if (!open || !query.isSuccess || viewed.current) return;
    viewed.current = true;
    recordCrmSlaAlertsEvent("CRM_SLA_ALERTS_VIEWED", {
      durationMs: Date.now() - queryStartedAt.current,
      result: items.length ? "success" : "empty",
    });
  }, [items.length, open, query.isSuccess]);

  useEffect(() => {
    if (!query.isError || !query.errorUpdatedAt || observedErrorAt.current === query.errorUpdatedAt)
      return;
    observedErrorAt.current = query.errorUpdatedAt;
    recordCrmSlaAlertsEvent("CRM_SLA_ALERTS_LOAD_FAILED", {
      durationMs: Date.now() - queryStartedAt.current,
      result: "failure",
    });
  }, [query.errorUpdatedAt, query.isError]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = normalizeFilters(draftFilters);
    if (filtersKey(next) === filtersKey(filters)) return;
    queryStartedAt.current = Date.now();
    setFilters(next);
    recordCrmSlaAlertsEvent("CRM_SLA_ALERTS_FILTERED", {
      ...(next.slaStatus ? { alertStatus: next.slaStatus } : {}),
      filterCount: countActiveFilters(next),
      result: "applied",
      ...(next.stage ? { stage: next.stage } : {}),
    });
  }

  function clearFilters() {
    const hadDraftOrApplied =
      countActiveFilters(draftFilters) > 0 || countActiveFilters(filters) > 0;
    setDraftFilters(DEFAULT_FILTERS);
    if (countActiveFilters(filters) > 0) {
      queryStartedAt.current = Date.now();
      setFilters(DEFAULT_FILTERS);
    }
    if (hadDraftOrApplied) {
      recordCrmSlaAlertsEvent("CRM_SLA_ALERTS_FILTERED", {
        filterCount: 0,
        result: "cleared",
      });
    }
  }

  return (
    <section
      className="j12-surface overflow-hidden"
      aria-labelledby="crm-sla-alerts-title"
      aria-busy={query.isFetching}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <header className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between md:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <BellRing aria-hidden="true" className="h-5 w-5 text-primary" />
              <h2 id="crm-sla-alerts-title" className="text-xl font-bold text-white">
                Alertas de SLA
              </h2>
              {activeFilterCount ? (
                <Badge variant="outline">
                  {activeFilterCount} {activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Acompanhamento operacional dos prazos do funil.
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label={open ? "Recolher alertas de SLA" : "Expandir alertas de SLA"}
              className="w-full sm:w-auto"
            >
              <ChevronDown
                aria-hidden="true"
                className={`transition-transform ${open ? "rotate-180" : ""}`}
              />
              {open ? "Recolher" : "Expandir"}
            </Button>
          </CollapsibleTrigger>
        </header>

        <CollapsibleContent>
          <div className="space-y-5 p-5 md:p-6">
            <form
              className="grid gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={applyFilters}
              aria-label="Filtros dos alertas de SLA"
            >
              <AlertFilterSelect
                id="crm-sla-alert-stage"
                label="Etapa"
                value={draftFilters.stage || ""}
                onChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    stage: value ? (value as CrmLeadStage) : undefined,
                  }))
                }
                options={STAGE_OPTIONS}
              />
              <AlertFilterSelect
                id="crm-sla-alert-status"
                label="Situação do alerta"
                value={draftFilters.slaStatus || ""}
                onChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    slaStatus: value ? (value as CrmSlaAlertStatus) : undefined,
                  }))
                }
                options={ALERT_STATUS_OPTIONS}
              />
              <div className="space-y-2">
                <Label htmlFor="crm-sla-alert-unit">Unidade</Label>
                <Input
                  id="crm-sla-alert-unit"
                  value={draftFilters.unitId || ""}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      unitId: event.target.value || undefined,
                    }))
                  }
                  placeholder="ID da unidade"
                />
              </div>
              <div className="flex flex-col gap-2 self-end sm:flex-row lg:flex-col xl:flex-row">
                <Button type="submit" className="flex-1">
                  <ListFilter aria-hidden="true" />
                  Aplicar filtros
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={clearFilters}
                  disabled={
                    countActiveFilters(draftFilters) === 0 && countActiveFilters(filters) === 0
                  }
                >
                  Limpar filtros
                </Button>
              </div>
            </form>

            <p className="sr-only" aria-live="polite">
              {query.isFetchingNextPage
                ? "Carregando próxima página"
                : query.isFetching
                  ? "Atualizando alertas de SLA"
                  : `${items.length} alertas carregados`}
            </p>

            {query.isLoading ? <SkeletonCard announce lines={4} /> : null}

            {query.isError && !query.data ? (
              <AlertError onRetry={() => void query.refetch()} />
            ) : null}

            {!query.isLoading && !query.isError && items.length === 0 ? (
              <Card className="border-white/10 bg-card">
                <CardContent className="p-8 text-center" role="status">
                  <BellRing aria-hidden="true" className="mx-auto h-9 w-9 text-slate-500" />
                  <p className="mt-3 text-sm text-slate-300">
                    Nenhum alerta operacional encontrado para os filtros atuais.
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {items.length ? (
              <div className="space-y-5">
                {groups.map((group) => (
                  <AlertGroup
                    key={group.status}
                    status={group.status}
                    title={group.title}
                    items={group.items}
                    nowMs={nowMs}
                    onOpenLead={onOpenLead}
                  />
                ))}
              </div>
            ) : null}

            {query.isFetchNextPageError ? (
              <AlertError
                message="Não foi possível carregar a próxima página de alertas."
                onRetry={() => void query.fetchNextPage()}
              />
            ) : null}

            {query.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                >
                  {query.isFetchingNextPage ? (
                    <Loader2 aria-hidden="true" className="animate-spin" />
                  ) : (
                    <ChevronDown aria-hidden="true" />
                  )}
                  {query.isFetchingNextPage ? "Carregando próxima página" : "Carregar mais alertas"}
                </Button>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function AlertGroup({
  items,
  nowMs,
  onOpenLead,
  status,
  title,
}: {
  items: CrmSlaAlertItem[];
  nowMs: number;
  onOpenLead: (leadId: string) => void;
  status: CrmSlaAlertStatus;
  title: string;
}) {
  const headingId = `crm-sla-alert-group-${status.toLowerCase().replaceAll("_", "-")}`;
  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="font-semibold text-white">
          {title}
        </h3>
        <span className="text-xs text-slate-400">
          {items.length} {items.length === 1 ? "item carregado" : "itens carregados"}
        </span>
      </div>
      {status === "NOT_CONFIGURED" ? (
        <p className="mt-2 rounded-xl border border-slate-500/20 bg-slate-500/10 p-3 text-sm text-slate-300">
          Os prazos de SLA ainda não foram configurados para estas etapas.
        </p>
      ) : null}
      <ul className="mt-3 grid gap-3 xl:grid-cols-2">
        {items.map((item) => (
          <AlertItem key={item.leadId} item={item} nowMs={nowMs} onOpenLead={onOpenLead} />
        ))}
      </ul>
    </section>
  );
}

function AlertFilterSelect({
  id,
  label,
  onChange,
  options,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
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

function AlertError({
  message = "Não foi possível carregar os alertas de SLA.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-red-400/20 bg-red-500/10">
      <CardContent className="p-5">
        <p role="alert" className="text-sm text-red-100">
          {message}
        </p>
        <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>
          <RefreshCcw aria-hidden="true" />
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  );
}

function normalizeFilters(filters: CrmSlaAlertFilters): CrmSlaAlertFilters {
  return {
    limit: CRM_SLA_ALERTS_DEFAULT_LIMIT,
    ...(filters.slaStatus ? { slaStatus: filters.slaStatus } : {}),
    ...(filters.stage ? { stage: filters.stage } : {}),
    ...(filters.unitId?.trim() ? { unitId: filters.unitId.trim() } : {}),
  };
}

function filtersKey(filters: CrmSlaAlertFilters) {
  const normalized = normalizeFilters(filters);
  return `${normalized.stage || ""}|${normalized.slaStatus || ""}|${normalized.unitId || ""}`;
}

function countActiveFilters(filters: CrmSlaAlertFilters) {
  return (
    Number(Boolean(filters.stage)) +
    Number(Boolean(filters.slaStatus)) +
    Number(Boolean(filters.unitId?.trim()))
  );
}

const STAGE_OPTIONS = [
  ["NEW", "Novo"],
  ["CONTACTED", "Contatado"],
  ["QUALIFIED", "Qualificado"],
  ["PROPOSAL", "Proposta"],
  ["NEGOTIATION", "Negociação"],
  ["WON", "WON"],
  ["LOST", "Perdido"],
  ["TRIAL_SCHEDULED", "Aula experimental agendada"],
  ["TRIAL_COMPLETED", "Aula experimental concluída"],
] as const;

const ALERT_STATUS_OPTIONS = [
  ["OVERDUE", "Em atraso"],
  ["WARNING", "Próximo do prazo"],
  ["UNAVAILABLE", "Sem histórico confiável"],
  ["NOT_CONFIGURED", "SLA não configurado"],
  ["NORMAL", "No prazo"],
  ["COMPLETED", "Concluído"],
] as const;
