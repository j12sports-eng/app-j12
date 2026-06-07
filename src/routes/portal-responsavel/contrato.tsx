import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, FileSignature, FileText } from "lucide-react";

import { PortalResponsavelLayout } from "@/components/PortalResponsavelLayout";
import { PortalHero } from "@/components/shared/PortalPrimitives";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useResponsavelAlunos } from "@/hooks/useResponsavelAlunos";
import { useResponsavelContratos } from "@/hooks/useResponsavelContratos";

export const Route = createFileRoute("/portal-responsavel/contrato")({
  component: ContratoResponsavelPage,
});

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "assinado") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  return "border-primary/30 bg-primary/10 text-primary";
}

function ContratoResponsavelPage() {
  const { contratos, loading, erro } = useResponsavelContratos();
  const { isFamilyView, selectedStudent } = useResponsavelAlunos();

  return (
    <PortalResponsavelLayout>
      <div className="j12-page-enter space-y-8">
        <PortalHero
          eyebrow="Contratos"
          title={isFamilyView ? "Documentos por aluno" : selectedStudent?.nome || "Contrato"}
          description="Documentos, status e assinatura dentro do padrao visual unificado da J12."
        />

        {loading ? (
          <div className="space-y-4">
            <SkeletonCard lines={2} withAvatar className="min-h-[132px]" />
            <SkeletonCard lines={2} withAvatar className="min-h-[132px]" />
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro}
          </div>
        ) : contratos.length === 0 ? (
          <div className="j12-empty-state p-8 text-center text-slate-300">
            Nenhum contrato encontrado.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {contratos.map((contrato) => (
              <article key={contrato.id} className="j12-surface p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="truncate text-lg font-black text-white">{contrato.titulo}</h3>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-300">
                      {contrato.alunoNome}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                      contrato.status,
                    )}`}
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
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:brightness-110 ${
                      contrato.arquivoPdf ? "" : "pointer-events-none opacity-50"
                    }`}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir contrato
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
            ))}
          </div>
        )}
      </div>
    </PortalResponsavelLayout>
  );
}
