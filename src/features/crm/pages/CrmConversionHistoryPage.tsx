import { useMemo, useState } from "react";
import { ChevronDown, History, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonTable } from "@/components/ui/skeleton";
import { formatApiErrorMessage } from "@/lib/api";
import { CrmConversionHistoryDetailsDialog } from "../components/CrmConversionHistoryDetailsDialog";
import { useCrmConversionHistory } from "../hooks/use-crm-conversion-history";
import type {
  CrmConversionHistoryFilters,
  CrmConversionHistoryItem,
} from "../types/crm-conversion-history.types";

export function CrmConversionHistoryRoutePage() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <CrmConversionHistoryPage />
    </ProtectedRoute>
  );
}

function CrmConversionHistoryPage() {
  const [filters, setFilters] = useState<CrmConversionHistoryFilters>({ limit: 50 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useCrmConversionHistory(filters);
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  function setFilter<K extends keyof CrmConversionHistoryFilters>(
    key: K,
    value: CrmConversionHistoryFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <AppShell title="CRM · Histórico de conversões">
      <div className="j12-page-enter space-y-6">
        <section className="j12-surface overflow-hidden p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase text-primary">
                <History className="h-3.5 w-3.5" />
                Histórico operacional
              </div>
              <h1 className="mt-4 text-3xl font-bold text-white md:text-5xl">
                Conversões concluídas
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Consulte IDs internos persistidos das conversões para matrícula DRAFT. Nenhum dado
                pessoal é exibido.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                Área administrativa protegida
              </div>
              <p className="mt-1 text-xs text-emerald-200/80">Somente leitura</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <HistoryFilter
              id="crm-history-lead"
              label="Lead ID"
              value={filters.leadId || ""}
              onChange={(value) => setFilter("leadId", value || undefined)}
            />
            <HistoryFilter
              id="crm-history-unit"
              label="Unidade"
              value={filters.unitId || ""}
              onChange={(value) => setFilter("unitId", value || undefined)}
            />
            <HistoryFilter
              id="crm-history-user"
              label="Usuário"
              value={filters.convertedBy || ""}
              onChange={(value) => setFilter("convertedBy", value || undefined)}
            />
            <div className="space-y-2">
              <Label htmlFor="crm-history-status">Status da matrícula</Label>
              <select
                id="crm-history-status"
                className="j12-field h-10 w-full px-3"
                value={filters.enrollmentStatus || ""}
                onChange={(event) =>
                  setFilter("enrollmentStatus", event.target.value ? "DRAFT" : undefined)
                }
              >
                <option value="">Todos</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </div>
            <HistoryFilter
              id="crm-history-date-from"
              label="Data inicial"
              type="date"
              value={filters.dateFrom || ""}
              onChange={(value) => setFilter("dateFrom", value || undefined)}
            />
            <HistoryFilter
              id="crm-history-date-to"
              label="Data final"
              type="date"
              value={filters.dateTo || ""}
              onChange={(value) => setFilter("dateTo", value || undefined)}
            />
          </div>
        </section>

        {query.isLoading ? <SkeletonTable columns={9} rows={6} /> : null}
        {query.isError ? (
          <ErrorPanel
            message={formatApiErrorMessage(
              query.error,
              "Não foi possível carregar o histórico de conversões.",
            )}
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {!query.isLoading && !query.isError && items.length === 0 ? <EmptyPanel /> : null}
        {!query.isLoading && !query.isError && items.length > 0 ? (
          <ConversionHistoryList items={items} onSelect={setSelectedId} />
        ) : null}

        {query.hasNextPage ? (
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

      <CrmConversionHistoryDetailsDialog
        conversionId={selectedId}
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </AppShell>
  );
}

function ConversionHistoryList({
  items,
  onSelect,
}: {
  items: CrmConversionHistoryItem[];
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="border-white/10 bg-card">
      <CardHeader>
        <CardTitle className="text-white">
          Histórico persistido
          <span className="ml-2 text-sm font-normal text-slate-400">{items.length} carregadas</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <caption className="sr-only">Conversões CRM concluídas</caption>
            <thead className="border-y border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Data e hora
                </th>
                <th scope="col" className="px-4 py-3">
                  Lead
                </th>
                <th scope="col" className="px-4 py-3">
                  Unidade
                </th>
                <th scope="col" className="px-4 py-3">
                  Usuário
                </th>
                <th scope="col" className="px-4 py-3">
                  Pessoa
                </th>
                <th scope="col" className="px-4 py-3">
                  Perfil
                </th>
                <th scope="col" className="px-4 py-3">
                  Matrícula
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-white/8 text-slate-200">
                  <td className="px-4 py-4 text-slate-400">{formatDateTime(item.convertedAt)}</td>
                  <td className="px-4 py-4 font-semibold text-white">{item.leadId || "—"}</td>
                  <td className="px-4 py-4">{item.unitId || "—"}</td>
                  <td className="px-4 py-4">{item.convertedBy || "—"}</td>
                  <td className="px-4 py-4">{item.personId || "—"}</td>
                  <td className="px-4 py-4">{item.personProfileId || "—"}</td>
                  <td className="px-4 py-4">{item.enrollmentId || "—"}</td>
                  <td className="px-4 py-4">
                    <Badge>{item.enrollmentStatus || "—"}</Badge>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => onSelect(item.id)}>
                      Ver detalhe
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-3 md:hidden">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Conversão</p>
                  <p className="break-all font-semibold text-white">{item.id}</p>
                </div>
                <Badge>{item.enrollmentStatus || "—"}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300">
                <HistoryTerm label="Data" value={formatDateTime(item.convertedAt)} />
                <HistoryTerm label="Lead" value={item.leadId} />
                <HistoryTerm label="Unidade" value={item.unitId} />
                <HistoryTerm label="Usuário" value={item.convertedBy} />
                <HistoryTerm label="Pessoa" value={item.personId} />
                <HistoryTerm label="Matrícula" value={item.enrollmentId} />
              </dl>
              <Button className="mt-4 w-full" variant="outline" onClick={() => onSelect(item.id)}>
                Ver detalhe
              </Button>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryFilter({
  id,
  label,
  onChange,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function HistoryTerm({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="break-all">{value || "—"}</dd>
    </div>
  );
}

function EmptyPanel() {
  return (
    <Card className="border-white/10 bg-card">
      <CardContent className="p-10 text-center">
        <History className="mx-auto h-10 w-10 text-slate-500" />
        <h2 className="mt-4 text-lg font-semibold text-white">Nenhuma conversão concluída</h2>
        <p className="mt-2 text-sm text-slate-400">
          Ajuste os filtros ou aguarde uma nova conversão persistida.
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

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}
