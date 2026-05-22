import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { AlertTriangle, CheckCircle2, Search, ShieldCheck } from "lucide-react";

import type { CreateChargeFormValues } from "./charge-form";
import type { AlunoOption } from "./types";
import { cn } from "@/lib/utils";

function getAlunoName(aluno: AlunoOption) {
  return aluno.nome || aluno.nome_completo || "Aluno";
}

function getAlunoAvatar(aluno: AlunoOption) {
  return aluno.avatar || aluno.foto || aluno.foto_url || "";
}

function getAlunoCategory(aluno: AlunoOption) {
  return (
    aluno.categoria ||
    aluno.modalidade ||
    aluno.turma ||
    aluno.planoNome ||
    aluno.plano_nome ||
    "J12"
  );
}

function getAlunoFinancialStatus(aluno: AlunoOption) {
  const raw = String(
    aluno.statusFinanceiro ||
      aluno.status_financeiro ||
      aluno.financeiroStatus ||
      aluno.financeiro_status ||
      aluno.status ||
      "em_dia",
  ).toLowerCase();

  if (raw.includes("inad") || raw.includes("venc") || raw.includes("atras")) {
    return {
      label: "Com pendencia",
      tone: "danger" as const,
      icon: AlertTriangle,
    };
  }

  if (raw.includes("pend")) {
    return {
      label: "Pendente",
      tone: "warning" as const,
      icon: AlertTriangle,
    };
  }

  return {
    label: "Em dia",
    tone: "success" as const,
    icon: ShieldCheck,
  };
}

function getStatusFromChargeList(statuses: string[] | undefined) {
  if (!statuses?.length) return null;

  const normalized = statuses.map((status) => String(status || "").toLowerCase());
  if (normalized.some((status) => status.includes("venc") || status.includes("atras"))) {
    return {
      label: "Com pendencia",
      tone: "danger" as const,
      icon: AlertTriangle,
    };
  }

  if (normalized.some((status) => status.includes("pend"))) {
    return {
      label: "Pendente",
      tone: "warning" as const,
      icon: AlertTriangle,
    };
  }

  return {
    label: "Em dia",
    tone: "success" as const,
    icon: ShieldCheck,
  };
}

export function StudentStep({
  form,
  alunos,
  financeiroStatusByAluno,
}: {
  form: UseFormReturn<CreateChargeFormValues>;
  alunos: AlunoOption[];
  financeiroStatusByAluno?: Record<string, string[]>;
}) {
  const [query, setQuery] = useState("");
  const selectedId = form.watch("alunoId");
  const error = form.formState.errors.alunoId?.message;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return alunos;

    return alunos.filter((aluno) =>
      [getAlunoName(aluno), getAlunoCategory(aluno), aluno.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [alunos, query]);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Etapa 1</p>
        <h3 className="mt-2 text-xl font-black text-white md:text-2xl">Escolher aluno</h3>
        <p className="mt-1 text-sm text-slate-400">
          Busque pelo aluno e confirme o status financeiro antes de avancar.
        </p>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="j12-field h-12 w-full pl-11 pr-4 text-sm"
          placeholder="Buscar aluno, categoria ou status..."
        />
      </label>

      {error && (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="grid max-h-[46vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((aluno) => {
          const id = String(aluno.id);
          const selected = selectedId === id;
          const avatar = getAlunoAvatar(aluno);
          const status =
            getStatusFromChargeList(financeiroStatusByAluno?.[id]) ??
            getAlunoFinancialStatus(aluno);
          const StatusIcon = status.icon;

          return (
            <button
              type="button"
              key={id}
              onClick={() => {
                form.setValue("alunoId", id, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              className={cn(
                "group min-h-[132px] rounded-2xl border bg-white/[0.03] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5",
                selected
                  ? "border-primary/55 bg-primary/10 shadow-[0_0_28px_rgba(255,69,0,0.12)]"
                  : "border-white/10",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 text-base font-black text-primary">
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getAlunoName(aluno).slice(0, 1).toUpperCase()
                  )}
                  {selected && (
                    <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white">{getAlunoName(aluno)}</p>
                  <p className="mt-1 truncate text-sm text-slate-400">{getAlunoCategory(aluno)}</p>
                </div>
              </div>

              <div
                className={cn(
                  "mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
                  status.tone === "success" &&
                    "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
                  status.tone === "warning" && "border-amber-400/25 bg-amber-500/10 text-amber-200",
                  status.tone === "danger" && "border-red-400/25 bg-red-500/10 text-red-100",
                )}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {status.label}
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="j12-empty-state p-6 text-center text-sm text-slate-300">
          Nenhum aluno encontrado para a busca atual.
        </div>
      )}
    </section>
  );
}
