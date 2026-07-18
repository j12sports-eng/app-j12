import { AlertTriangle, Database, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SkeletonCard } from "@/components/ui/skeleton";
import { formatApiErrorMessage } from "@/lib/api";
import { useCrmConversionHistoryDetail } from "../hooks/use-crm-conversion-history";
import type { CrmConversionHistoryDetail } from "../types/crm-conversion-history.types";

export function CrmConversionHistoryDetailsDialog({
  conversionId,
  onOpenChange,
  open,
}: {
  conversionId: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const query = useCrmConversionHistoryDetail(conversionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-white/10 bg-card">
        <DialogHeader>
          <DialogTitle className="text-white">Detalhe da conversão</DialogTitle>
          <DialogDescription>
            Identificadores operacionais da conversão concluída, sem dados pessoais.
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? <SkeletonCard announce lines={6} /> : null}
        {query.isError ? (
          <div
            role="alert"
            className="flex gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {formatApiErrorMessage(query.error, "Não foi possível carregar a conversão.")}
          </div>
        ) : null}
        {query.data ? <ConversionHistoryDetail detail={query.data} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ConversionHistoryDetail({ detail }: { detail: CrmConversionHistoryDetail }) {
  return (
    <div className="space-y-5">
      <section aria-labelledby="crm-history-identification">
        <h3 id="crm-history-identification" className="font-semibold text-white">
          Identificação da conversão
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DetailValue label="Conversão" value={detail.id} />
          <DetailValue label="Data e hora" value={formatDateTime(detail.convertedAt)} />
          <DetailValue label="Lead" value={detail.leadId} />
          <DetailValue label="Unidade" value={detail.unitId} />
          <DetailValue label="Usuário" value={detail.convertedBy} />
          <DetailValue label="Correlation ID" value={detail.correlationId} />
        </div>
      </section>

      <section
        aria-labelledby="crm-history-origin"
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
      >
        <div className="flex items-center gap-2 text-white">
          <Database className="h-4 w-4 text-primary" />
          <h3 id="crm-history-origin" className="font-semibold">
            Origem persistida
          </h3>
        </div>
        <p className="mt-2 break-all text-sm text-slate-300">{detail.source}</p>
        <p className="mt-1 text-xs text-slate-500">
          Versão e correlationId não são persistidos nesta tabela.
        </p>
      </section>

      <section aria-labelledby="crm-history-result">
        <div className="flex items-center gap-2">
          <h3 id="crm-history-result" className="font-semibold text-white">
            Resultado
          </h3>
          <Badge>{detail.enrollmentStatus || "Indisponível"}</Badge>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <DetailValue label="Pessoa" value={detail.personId} />
          <DetailValue label="Perfil de aluno" value={detail.personProfileId} />
          <DetailValue label="Matrícula" value={detail.enrollmentId} />
        </div>
      </section>

      <section
        aria-labelledby="crm-history-resolutions"
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
      >
        <h3 id="crm-history-resolutions" className="font-semibold text-white">
          Resoluções e reutilização
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ResolutionValue
            label="Pessoa"
            resolution={detail.resolutions.person}
            reused={detail.reused.person}
          />
          <ResolutionValue
            label="Perfil"
            resolution={detail.resolutions.profile}
            reused={detail.reused.profile}
          />
          <ResolutionValue
            label="Matrícula"
            resolution={detail.resolutions.enrollment}
            reused={detail.reused.enrollment}
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Estes campos aparecem como não persistidos porque a tabela canônica não registra a
          resolução original.
        </p>
      </section>

      <section className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Este histórico apresenta conversões concluídas. Tentativas e falhas são registradas
            apenas na infraestrutura externa de logs.
          </p>
        </div>
      </section>
    </div>
  );
}

function ResolutionValue({
  label,
  resolution,
  reused,
}: {
  label: string;
  resolution: "CREATED" | "FOUND" | null;
  reused: boolean | null;
}) {
  const resolutionLabel =
    resolution === "CREATED" ? "Criado" : resolution === "FOUND" ? "Encontrado" : "Não persistido";
  const reusedLabel = reused == null ? "Não persistido" : reused ? "Sim" : "Não";
  return (
    <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{resolutionLabel}</p>
      <p className="mt-1 text-xs text-slate-400">Reutilizado: {reusedLabel}</p>
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-white">{value || "Não persistido"}</p>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Não persistido";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}
