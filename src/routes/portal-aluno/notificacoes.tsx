import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCircle2, MessageSquareText } from "lucide-react";

import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero } from "@/components/shared/PortalPrimitives";
import { useNotificacoesAluno } from "@/hooks/useNotificacoesAluno";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal-aluno/notificacoes")({
  component: NotificacoesPage,
});

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function NotificacoesPage() {
  const { notificacoes, loading, erro, marcarComoLida } = useNotificacoesAluno();

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Comunicados"
          title="Avisos da J12"
          description="Mensagens, comunicados e alertas operacionais concentrados no mesmo workspace."
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
            Nenhum comunicado encontrado.
          </div>
        ) : (
          <section className="space-y-3">
            {notificacoes.map((item) => (
              <article
                key={item.id}
                className={cn(
                  "rounded-2xl border bg-card p-5 shadow-[var(--shadow-elegant)]",
                  item.lida ? "border-white/10" : "border-primary/35",
                )}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Bell className={cn("h-5 w-5", item.lida ? "text-slate-500" : "text-primary")} />
                      <h3 className="truncate text-lg font-bold text-white">{item.titulo}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{item.mensagem}</p>
                    <p className="mt-3 text-xs text-slate-500">
                      {formatDate(item.created_at || item.createdAt)}
                    </p>
                  </div>

                  {item.lida ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Lida
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void marcarComoLida(item.id);
                      }}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:brightness-110"
                    >
                      <MessageSquareText className="h-4 w-4" />
                      Marcar como lida
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </PortalAlunoLayout>
  );
}
