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
import { SkeletonTable } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Aluno = {
  id: string;
  nome: string;
};

type Turma = {
  id: string;
  nome: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
        <div
          className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", toneClass)}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
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

export default function ProfessorPresencasPage() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presencas, setPresencas] = useState<Record<string, string>>({});

  const selectedTurma = useMemo(() => {
    return turmas.find((turma) => turma.id === selectedTurmaId) ?? null;
  }, [turmas, selectedTurmaId]);

  useEffect(() => {
    async function carregarTurmas() {
      try {
        const response = await api.get<Turma[]>("/professor/me/turmas");
        const loaded = Array.isArray(response)
          ? response.map((item) => ({
              id: String(item.id),
              nome: item.nome,
            }))
          : [];
        setTurmas(loaded);

        setSelectedTurmaId((current) => current || loaded[0]?.id || "");
      } catch (error) {
        console.error("Erro ao carregar turmas:", error);
        toast.error("Não foi possível carregar as turmas.");
      }
    }

    carregarTurmas();
  }, []);

  useEffect(() => {
    async function carregarAlunos() {
      if (!selectedTurmaId) {
        setAlunos([]);
        setPresencas({});
        return;
      }

      try {
        const response = await api.get<Aluno[]>(
          `/professor/me/turmas/${encodeURIComponent(selectedTurmaId)}/alunos`,
        );
        const loaded = Array.isArray(response)
          ? response.map((item) => ({
              id: String(item.id),
              nome: item.nome,
            }))
          : [];
        setAlunos(loaded);

        // Inicializar presençasgfd como presentes por padrão
        const initialPresencas: Record<string, string> = {};
        for (const aluno of loaded) {
          initialPresencas[aluno.id] = "presente";
        }
        setPresencas(initialPresencas);
      } catch (error) {
        console.error("Erro ao carregar alunos:", error);
        toast.error("Não foi possível carregar os alunos da turma.");
      }
    }

    carregarAlunos();
  }, [selectedTurmaId]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const filteredAlunos = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return alunos;

    return alunos.filter((aluno) => aluno.nome.toLowerCase().includes(normalized));
  }, [search, alunos]);

  const stats = useMemo(() => {
    const presentes = Object.values(presencas).filter((v) => v === "presente").length;
    const faltas = Object.values(presencas).filter((v) => v === "falta").length;
    const total = Object.keys(presencas).length;
    const taxa = total > 0 ? Math.round((presentes / total) * 100) : 0;

    return { presentes, faltas, total, taxa };
  }, [presencas]);

  function alterarPresenca(alunoId: string, status: string) {
    setPresencas((prev) => ({
      ...prev,
      [alunoId]: status,
    }));
  }

  function marcarTodos(status: string) {
    const novo: Record<string, string> = {};
    for (const aluno of alunos) {
      novo[aluno.id] = status;
    }
    setPresencas(novo);
  }

  async function salvarChamada() {
    if (!selectedTurmaId) {
      toast.error("Selecione uma turma antes de salvar a chamada.");
      return;
    }

    if (alunos.length === 0) {
      toast.error("A turma selecionada não possui alunos vinculados.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/professor/me/presencas", {
        date: todayIso(),
        records: Object.entries(presencas).map(([alunoId, status]) => ({ alunoId, status })),
        turmaId: selectedTurmaId,
      });

      toast.success("Chamada salva com sucesso!");
      setSearch("");
    } catch (error) {
      console.error("Erro ao salvar chamada:", error);
      toast.error("Erro ao salvar a chamada.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Presenças">
      <div className="j12-page-enter space-y-6">
        {/* Header Section */}
        <section className="j12-surface overflow-hidden p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                <CalendarCheck className="h-3.5 w-3.5" />
                Registro de presencas
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">
                Controle de presencas.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
                Registre as presencas e faltas dos alunos nas aulas. Mantenha o histórico atualizado
                e acompanhe a frequência de sua turma.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-105">
              <button
                type="button"
                onClick={() => marcarTodos("presente")}
                disabled={alunos.length === 0 || loading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Todos presentes
              </button>
              <button
                type="button"
                onClick={() => marcarTodos("falta")}
                disabled={alunos.length === 0 || loading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Marcar faltas
              </button>
              <button
                type="button"
                onClick={() => setSearch("")}
                disabled={loading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <RefreshCcw className="h-4 w-4" />
                Limpar filtro
              </button>
              <button
                type="button"
                onClick={salvarChamada}
                disabled={saving || !selectedTurmaId || alunos.length === 0 || loading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar chamada"}
              </button>
            </div>
          </div>
        </section>

        {/* KPI Cards */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Turmas disponiveis"
            value={String(turmas.length)}
            detail="Turmas carregadas"
            icon={Users}
          />
          <KpiCard
            title="Alunos na turma"
            value={String(alunos.length)}
            detail={selectedTurma ? `De ${selectedTurma.nome}` : "Selecione uma turma"}
            icon={Users}
          />
          <KpiCard
            title="Presentes"
            value={String(stats.presentes)}
            detail={`De ${stats.total} alunos`}
            icon={CheckCircle2}
            tone="success"
          />
          <KpiCard
            title="Taxa de presença"
            value={`${stats.taxa}%`}
            detail="Percentual de presentes"
            icon={TrendingUp}
            tone={stats.taxa >= 75 ? "success" : "danger"}
          />
        </section>

        {/* Main Content */}
        {loading ? (
          <SkeletonTable columns={3} rows={6} />
        ) : (
          <section className="j12-surface p-4 md:p-5">
            {/* Filters */}
            <div className="mb-6 grid gap-4 md:grid-cols-[1fr_180px]">
              <label>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Turma
                </span>
                <select
                  value={selectedTurmaId}
                  onChange={(event) => setSelectedTurmaId(event.target.value)}
                  className="j12-field h-12 w-full px-4 text-sm"
                >
                  <option value="">Selecione a turma</option>
                  {turmas.map((turma) => (
                    <option key={turma.id} value={turma.id}>
                      {turma.nome}
                    </option>
                  ))}
                </select>
              </label>

              {selectedTurma && (
                <div className="pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      const novo: Record<string, string> = {};
                      for (const aluno of alunos) {
                        novo[aluno.id] = "presente";
                      }
                      setPresencas(novo);
                    }}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    Hoje
                  </button>
                </div>
              )}
            </div>

            {/* Stats Box */}
            {selectedTurma && alunos.length > 0 && (
              <div className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-4">
                <MiniStat label="Total" value={String(stats.total)} />
                <MiniStat label="Presentes" value={String(stats.presentes)} />
                <MiniStat label="Faltas" value={String(stats.faltas)} />
                <MiniStat label="Taxa" value={`${stats.taxa}%`} />
              </div>
            )}

            {/* Search and Title */}
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Lista de chamada</h2>
                <p className="text-sm text-slate-400">
                  {selectedTurma ? `${selectedTurma.nome}` : "Selecione uma turma para iniciar."}
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

            {/* Student List */}
            {selectedTurma ? (
              <>
                {filteredAlunos.length > 0 ? (
                  <div className="grid gap-3">
                    {filteredAlunos.map((aluno) => {
                      const status = presencas[aluno.id];
                      const presente = status === "presente";

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
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:min-w-64">
                              <button
                                type="button"
                                onClick={() => alterarPresenca(aluno.id, "presente")}
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
                                onClick={() => alterarPresenca(aluno.id, "falta")}
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
                ) : (
                  <div className="j12-empty-state p-8 text-center">
                    <p className="font-bold text-white">
                      {search ? "Nenhum aluno encontrado." : "Nenhum aluno na turma."}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {search
                        ? "Ajuste sua busca ou tente outro termo."
                        : "Vincule alunos a esta turma para começar."}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="j12-empty-state p-8 text-center">
                <p className="font-bold text-white">Selecione uma turma</p>
                <p className="mt-2 text-sm text-slate-400">
                  Escolha uma turma acima para registrar a presença dos alunos.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
