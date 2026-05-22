import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCircle2 } from "lucide-react";

import { PortalResponsavelLayout } from "@/components/PortalResponsavelLayout";
import { PortalHero } from "@/components/shared/PortalPrimitives";
import { useResponsavelAlunos } from "@/hooks/useResponsavelAlunos";
import { useResponsavelNotificacoes } from "@/hooks/useResponsavelNotificacoes";

export const Route = createFileRoute("/portal-responsavel/notificacoes")({
  component: NotificacoesResponsavelPage,
});

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function NotificacoesResponsavelPage() {
  const { notificacoes, loading, erro, marcarComoLida } = useResponsavelNotificacoes();
  const { isFamilyView, selectedStudent } = useResponsavelAlunos();

  return (
    <PortalResponsavelLayout>
      <div className="j12-page-enter space-y-8">
        <PortalHero
          eyebrow="Comunicados"
          title={isFamilyView ? "Notificacoes da familia" : selectedStudent?.nome || "Notificacoes"}
          description="Avisos e mensagens recentes com a mesma hierarquia visual dos demais modulos."
        />

        {loading ? (
          <div className="space-y-4">
            <div className="j12-skeleton h-28" />
            <div className="j12-skeleton h-28" />
            <div className="j12-skeleton h-28" />
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro}
          </div>
        ) : notificacoes.length === 0 ? (
          <div className="j12-empty-state p-8 text-center text-slate-300">
            Nenhuma notificacao encontrada.
          </div>
        ) : (
          <div className="space-y-3">
            {notificacoes.map((item) => (
              <article
                key={item.id}
                className={`rounded-2xl border bg-card p-5 shadow-[var(--shadow-elegant)] ${
                  item.lida ? "border-white/10" : "border-primary/35"
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Bell
                        className={`h-5 w-5 ${item.lida ? "text-slate-500" : "text-primary"}`}
                      />
                      <h3 className="truncate text-lg font-black text-white">{item.titulo}</h3>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-300">{item.alunoNome}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{item.mensagem}</p>
                    <p className="mt-3 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                  </div>

                  {item.lida ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Lida
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        void marcarComoLida(item.id);
                      }}
                      className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:brightness-110"
                    >
                      Marcar como lida
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </PortalResponsavelLayout>
  );
}
