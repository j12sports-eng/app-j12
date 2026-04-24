import { createFileRoute } from "@tanstack/react-router";
import { Bell, MessageSquareMore } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { usePortalNotificacoes } from "@/lib/aluno-portal";

export const Route = createFileRoute("/notificacoes")({
  component: () => (
    <RequireAuth roles={["aluno", "responsavel"]}>
      <NotificacoesPage />
    </RequireAuth>
  ),
});

function NotificacoesPage() {
  const portalNotificacoes = usePortalNotificacoes(true);

  if (portalNotificacoes.loading) {
    return (
      <AppShell title="Notificacoes">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (portalNotificacoes.error) {
    return (
      <AppShell title="Notificacoes">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          {portalNotificacoes.error}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Notificacoes">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Notificacoes</h2>
          <p className="text-sm text-muted-foreground">
            Avisos e comunicados vinculados ao aluno autenticado.
          </p>
        </div>

        {portalNotificacoes.data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            Nenhuma notificacao encontrada.
          </div>
        ) : (
          <div className="space-y-3">
            {portalNotificacoes.data.map((notificacao) => (
              <div key={notificacao.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{notificacao.titulo}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{notificacao.mensagem}</div>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    {notificacao.lida ? <Bell className="h-4 w-4" /> : <MessageSquareMore className="h-4 w-4" />}
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Canal: {notificacao.canal} - Tipo: {notificacao.tipo} - {notificacao.createdAt}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
