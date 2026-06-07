import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, FileSignature, FileText } from "lucide-react";

import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero } from "@/components/shared/PortalPrimitives";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useContratoAluno } from "@/hooks/useContratoAluno";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal-aluno/contrato")({
  component: ContratoPage,
});

function ContratoPage() {
  return (
    <ProtectedRoute roles={["aluno"]}>
      <ContratoContent />
    </ProtectedRoute>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function statusClass(status: string) {
  return status.toLowerCase() === "assinado"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : "border-primary/30 bg-primary/10 text-primary";
}

function ContratoContent() {
  const { contrato, loading, erro } = useContratoAluno();

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Contrato"
          title="Contrato do aluno"
          description="Documento, aceite e status organizados no mesmo padrao visual dos demais portais."
        />

        {loading ? (
          <div className="space-y-4">
            <SkeletonCard lines={2} withAvatar className="min-h-[132px]" />
            <SkeletonCard lines={5} className="min-h-64" />
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro}
          </div>
        ) : !contrato ? (
          <div className="j12-empty-state p-8 text-center text-slate-300">
            Nenhum contrato encontrado.
          </div>
        ) : (
          <article className="j12-surface p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h2 className="truncate text-xl font-bold text-white">{contrato.titulo}</h2>
                </div>
                <p className="mt-2 text-sm text-slate-400">Documento vinculado ao aluno.</p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-bold capitalize",
                  statusClass(contrato.status),
                )}
              >
                {contrato.status}
              </span>
            </div>

            <div className="grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase text-slate-500">Emissao</div>
                <div className="mt-1 font-semibold text-white">
                  {formatDate(contrato.dataEmissao)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase text-slate-500">Assinatura</div>
                <div className="mt-1 font-semibold text-white">
                  {formatDate(contrato.dataAssinatura)}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href={contrato.arquivoPdf || "#"}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:brightness-110",
                  !contrato.arquivoPdf && "pointer-events-none opacity-50",
                )}
              >
                <ExternalLink className="h-4 w-4" />
                Abrir PDF
              </a>
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">
                {contrato.status.toLowerCase() === "assinado" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                ) : (
                  <FileSignature className="h-4 w-4 text-primary" />
                )}
                Assinatura digital
              </button>
            </div>
          </article>
        )}
      </div>
    </PortalAlunoLayout>
  );
}
