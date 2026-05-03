import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, MapPin, TimerReset, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { usePortalAluno } from "@/lib/aluno-portal";
import {
  formatAlunoScope,
  getAlunoHorarios,
  getAlunoModalidades,
  getAlunoUnidades,
} from "@/lib/alunos-store";

export const Route = createFileRoute("/meu-plano")({
  component: () => (
    <RequireAuth roles={["aluno", "responsavel"]}>
      <MeuPlanoPage />
    </RequireAuth>
  ),
});

function MeuPlanoPage() {
  const portalAluno = usePortalAluno(true);

  if (portalAluno.loading) {
    return (
      <AppShell title="Meu Plano">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (portalAluno.error || !portalAluno.data) {
    return (
      <AppShell title="Meu Plano">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          {portalAluno.error || "Nao foi possivel carregar o plano do aluno."}
        </div>
      </AppShell>
    );
  }

  const aluno = portalAluno.data;

  return (
    <AppShell title="Meu Plano">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Meu Plano</h2>
          <p className="text-sm text-muted-foreground">
            Consulte as informacoes esportivas e financeiras vinculadas ao aluno autenticado.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PlanCard
            icon={ClipboardList}
            label="Plano principal"
            value={aluno.plano || "Nao informado"}
          />
          <PlanCard
            icon={Users}
            label="Modalidades"
            value={formatAlunoScope(getAlunoModalidades(aluno))}
          />
          <PlanCard
            icon={MapPin}
            label="Unidades"
            value={formatAlunoScope(getAlunoUnidades(aluno))}
          />
          <PlanCard
            icon={TimerReset}
            label="Horarios"
            value={formatAlunoScope(getAlunoHorarios(aluno))}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold">Resumo da matricula</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InfoRow label="Turma" value={aluno.turma || "-"} />
            <InfoRow label="Status" value={aluno.status} />
            <InfoRow label="Data da matricula" value={aluno.matriculaEm || "-"} />
            <InfoRow
              label="Cobranca automatica"
              value={aluno.financeiro?.cobrancaAutomatica === false ? "Inativa" : "Ativa"}
            />
            <InfoRow label="Periodicidade" value={aluno.financeiro?.periodicidade || "Mensal"} />
            <InfoRow
              label="Dia de vencimento"
              value={String(aluno.financeiro?.diaVencimento ?? "-")}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PlanCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-2 text-lg font-semibold">{value}</div>
        </div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
