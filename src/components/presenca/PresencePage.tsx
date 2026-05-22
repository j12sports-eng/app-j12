import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  Save,
  Search,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { getAlunosDaTurma, useAlunos } from "@/lib/alunos-store";
import {
  formatDias,
  statsPresencaAluno,
  turmasStore,
  useTurmas,
} from "@/lib/turmas-store";
import { cn } from "@/lib/utils";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function KpiCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof CalendarCheck;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    primary: "border-primary/25 bg-primary/10 text-primary",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    danger: "border-red-400/20 bg-red-500/10 text-red-200",
  }[tone];

  return (
    <div className="j12-kpi-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {title}
          </p>
          <p className="mt-3 text-2xl font-bold text-white md:text-3xl">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function PresencePage() {
  const turmas = useTurmas();
  const alunos = useAlunos();
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [registros, setRegistros] = useState<Record<string, boolean>>({});

  const activeTurmas = useMemo(
    () => turmas.filter((turma) => turma.ativa).sort((a, b) => a.nome.localeCompare(b.nome)),
    [turmas],
  );

  const selectedTurma = useMemo(
    () => activeTurmas.find((turma) => turma.id === selectedTurmaId) ?? activeTurmas[0] ?? null,
    [activeTurmas, selectedTurmaId],
  );

  useEffect(() => {
    if (!selectedTurma && selectedTurmaId) {
      setSelectedTurmaId("");
      return;
    }

    if (!selectedTurmaId && selectedTurma) {
      setSelectedTurmaId(selectedTurma.id);
    }
  }, [selectedTurma, selectedTurmaId]);

  const turmaAlunos = useMemo(() => {
    return getAlunosDaTurma(selectedTurma, alunos);
  }, [alunos, selectedTurma]);

  const existingSession = useMemo(
    () => selectedTurma?.presencas.find((sessao) => sessao.data === selectedDate) ?? null,
    [selectedDate, selectedTurma],
  );

  useEffect(() => {
    const next: Record<string, boolean> = {};
    const existing = new Map(
      (existingSession?.registros ?? []).map((registro) => [
        String(registro.alunoId),
        Boolean(registro.presente),
      ]),
    );

    for (const aluno of turmaAlunos) {
      next[String(aluno.id)] = existing.get(String(aluno.id)) ?? true;
    }

    setRegistros(next);
  }, [existingSession, turmaAlunos]);

  const filteredAlunos = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return turmaAlunos;

    return turmaAlunos.filter((aluno) =>
      [aluno.nome, aluno.email, aluno.telefone, aluno.responsavel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [search, turmaAlunos]);

  const overview = useMemo(() => {
    const sessions = turmas.flatMap((turma) =>
      turma.presencas.map((sessao) => ({
        ...sessao,
        turma,
      })),
    );
    const todaySessions = sessions.filter((sessao) => sessao.data === todayIso());
    const registrosHoje = todaySessions.flatMap((sessao) => sessao.registros);
    const presentesHoje = registrosHoje.filter((registro) => registro.presente).length;
    const taxaHoje =
      registrosHoje.length > 0 ? Math.round((presentesHoje / registrosHoje.length) * 100) : 0;

    return {
      activeTurmas: activeTurmas.length,
      totalSessions: sessions.length,
      todaySessions: todaySessions.length,
      taxaHoje,
      recentSessions: sessions
        .sort((left, right) => right.data.localeCompare(left.data))
        .slice(0, 6),
    };
  }, [activeTurmas.length, turmas]);

  const selectedStats = useMemo(() => {
    const total = turmaAlunos.length;
    const presentes = turmaAlunos.filter((aluno) => registros[String(aluno.id)]).length;
    const faltas = Math.max(total - presentes, 0);
    const taxa = total > 0 ? Math.round((presentes / total) * 100) : 0;
    return { total, presentes, faltas, taxa };
  }, [registros, turmaAlunos]);

  function toggleAluno(alunoId: string, presente: boolean) {
    setRegistros((current) => ({
      ...current,
      [alunoId]: presente,
    }));
  }

  function markAll(presente: boolean) {
    const next: Record<string, boolean> = {};
    for (const aluno of turmaAlunos) {
      next[String(aluno.id)] = presente;
    }
    setRegistros(next);
  }

  async function handleSave() {
    if (!selectedTurma) {
      toast.error("Selecione uma turma para registrar presenca.");
      return;
    }

    if (turmaAlunos.length === 0) {
      toast.error("A turma selecionada ainda nao possui alunos vinculados.");
      return;
    }

    setSaving(true);

    try {
      turmasStore.registrarPresenca(
        selectedTurma.id,
        selectedDate,
        turmaAlunos.map((aluno) => ({
          alunoId: String(aluno.id),
          presente: Boolean(registros[String(aluno.id)]),
        })),
      );

      toast.success("Presenca registrada com sucesso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Presencas">
      <div className="j12-page-enter space-y-6">
        <section className="j12-surface overflow-hidden p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <CalendarCheck className="h-3.5 w-3.5" />
                Chamada, historico e frequencia
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">
                Controle de presencas por turma.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
                Registre chamadas, acompanhe faltas e mantenha o historico operacional alinhado com
                turmas, alunos e professores.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
              <button
                type="button"
                onClick={() => markAll(true)}
                disabled={turmaAlunos.length === 0}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Todos presentes
              </button>
              <button
                type="button"
                onClick={() => markAll(false)}
                disabled={turmaAlunos.length === 0}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Marcar faltas
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(todayIso())}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <RefreshCcw className="h-4 w-4" />
                Hoje
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !selectedTurma || turmaAlunos.length === 0}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar chamada"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Turmas ativas"
            value={String(overview.activeTurmas)}
            detail="Disponiveis para chamada"
            icon={Users}
          />
          <KpiCard
            title="Sessoes hoje"
            value={String(overview.todaySessions)}
            detail="Chamadas registradas no dia"
            icon={Clock3}
            tone="warning"
          />
          <KpiCard
            title="Frequencia hoje"
            value={`${overview.taxaHoje}%`}
            detail="Presencas sobre registros do dia"
            icon={TrendingUp}
            tone={overview.taxaHoje >= 75 ? "success" : "danger"}
          />
          <KpiCard
            title="Historico"
            value={String(overview.totalSessions)}
            detail="Sessoes salvas nas turmas"
            icon={CalendarCheck}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="j12-surface p-4 md:p-5">
            <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_180px]">
              <label>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Turma
                </span>
                <select
                  value={selectedTurma?.id ?? ""}
                  onChange={(event) => setSelectedTurmaId(event.target.value)}
                  className="j12-field h-12 w-full px-4 text-sm"
                >
                  {activeTurmas.length === 0 ? (
                    <option value="">Nenhuma turma ativa</option>
                  ) : null}
                  {activeTurmas.map((turma) => (
                    <option key={turma.id} value={turma.id}>
                      {turma.nome} - {turma.modalidade}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Data
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="j12-field h-12 w-full px-4 text-sm"
                />
              </label>
            </div>

            {selectedTurma ? (
              <div className="mb-5 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-4">
                <MiniStat label="Alunos" value={String(selectedStats.total)} />
                <MiniStat label="Presentes" value={String(selectedStats.presentes)} />
                <MiniStat label="Faltas" value={String(selectedStats.faltas)} />
                <MiniStat label="Taxa" value={`${selectedStats.taxa}%`} />
              </div>
            ) : null}

            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Lista de chamada</h2>
                <p className="text-sm text-slate-400">
                  {selectedTurma
                    ? `${selectedTurma.unidade || "Sem unidade"} - ${formatDias(selectedTurma.diasSemana) || "sem dias definidos"}`
                    : "Selecione uma turma para iniciar."}
                </p>
              </div>

              <label className="relative lg:min-w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar aluno..."
                  className="j12-field h-12 w-full pl-10 pr-4 text-sm"
                />
              </label>
            </div>

            <div className="grid gap-3">
              {filteredAlunos.map((aluno) => {
                const presente = Boolean(registros[String(aluno.id)]);
                const stats = selectedTurma
                  ? statsPresencaAluno(selectedTurma, String(aluno.id))
                  : { total: 0, presentes: 0, faltas: 0, taxa: 0 };

                return (
                  <article
                    key={aluno.id}
                    className={cn(
                      "rounded-2xl border p-4 transition",
                      presente
                        ? "border-emerald-400/20 bg-emerald-500/10"
                        : "border-red-400/20 bg-red-500/10",
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-white">{aluno.nome}</h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {aluno.responsavel || aluno.email || aluno.telefone || "Cadastro sem contato"}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Historico: {stats.taxa}% ({stats.presentes}/{stats.total})
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:min-w-64">
                        <button
                          type="button"
                          onClick={() => toggleAluno(String(aluno.id), true)}
                          className={cn(
                            "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition",
                            presente
                              ? "bg-emerald-500 text-black"
                              : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                          )}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Presente
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAluno(String(aluno.id), false)}
                          className={cn(
                            "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition",
                            !presente
                              ? "bg-red-500 text-white"
                              : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                          )}
                        >
                          <XCircle className="h-4 w-4" />
                          Falta
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {filteredAlunos.length === 0 && (
              <div className="j12-empty-state mt-4 p-8 text-center">
                <p className="font-bold text-white">Nenhum aluno encontrado.</p>
                <p className="mt-2 text-sm text-slate-400">
                  Vincule alunos a esta turma ou ajuste a busca atual.
                </p>
              </div>
            )}
          </div>

          <div className="j12-surface p-4 md:p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Historico recente</h2>
                <p className="text-sm text-slate-400">Ultimas sessoes registradas.</p>
              </div>
              <CalendarCheck className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-3">
              {overview.recentSessions.map((sessao) => {
                const presentes = sessao.registros.filter((registro) => registro.presente).length;
                const total = sessao.registros.length;
                const taxa = total > 0 ? Math.round((presentes / total) * 100) : 0;

                return (
                  <div
                    key={`${sessao.turma.id}-${sessao.id}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">{sessao.turma.nome}</p>
                        <p className="mt-1 text-sm text-slate-400">{formatDate(sessao.data)}</p>
                      </div>
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        {taxa}%
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">
                      {presentes}/{total} presentes - {sessao.turma.modalidade}
                    </p>
                  </div>
                );
              })}

              {overview.recentSessions.length === 0 && (
                <div className="j12-empty-state p-8 text-center">
                  <p className="font-bold text-white">Sem historico de presencas.</p>
                  <p className="mt-2 text-sm text-slate-400">
                    A primeira chamada salva aparecera nesta lista.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
