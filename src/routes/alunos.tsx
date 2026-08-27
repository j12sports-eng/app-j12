import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search, Pencil, Trash2, Mail, X, Eye, MessageCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { AlunoFormDialog } from "@/components/alunos/AlunoFormDialog";
import { AlunoPerfilDialog } from "@/components/alunos/AlunoPerfilDialog";
import { ContratoVisualizarDialog } from "@/components/contratos/ContratoVisualizarDialog";
import { SkeletonDashboard, SkeletonTable } from "@/components/ui/skeleton";
import type { Contrato } from "@/lib/contratos-store";
import {
  alunoStatusClass,
  alunoStatusLabel,
  formatAlunoScope,
  getAlunoModalidades,
  getAlunoPlanos,
  getAlunoTurmas,
  getAlunoUnidades,
  useAlunos,
  useAlunosLoading,
  useAlunosError,
  reloadAlunos,
  type Aluno,
  type AlunoStatus,
} from "@/lib/alunos-store";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTurmas } from "@/lib/turmas-store";
import { useSettingsState } from "@/lib/settings/settings-store";
import { usePortalAluno } from "@/lib/aluno-portal";

type AlunosSearch = {
  alunoId?: string;
};

export const Route = createFileRoute("/alunos")({
  validateSearch: (search: Record<string, unknown>): AlunosSearch => ({
    alunoId: typeof search.alunoId === "string" ? search.alunoId : undefined,
  }),
  component: () => (
    <RequireAuth>
      <AlunosPage />
    </RequireAuth>
  ),
});

const STATUS_OPTIONS: Array<{
  value: "ativo" | "pendente" | "experimental" | "inativo" | "todos";
  label: string;
}> = [
  { value: "todos", label: "Todos" },
  { value: "ativo", label: "Ativos" },
  { value: "pendente", label: "Pendentes" },
  { value: "experimental", label: "Experimentais" },
  { value: "inativo", label: "Inativos" },
];

function statusBadge(status: AlunoStatus) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        alunoStatusClass(status),
      )}
    >
      {alunoStatusLabel(status)}
    </span>
  );
}

function normalizeWhatsappPhone(value?: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function getAlunoWhatsappLink(aluno: Aluno) {
  const phone = normalizeWhatsappPhone(
    aluno.matricula?.responsavel.whatsapp || aluno.telefoneResponsavel,
  );
  if (!phone) return null;

  const message = encodeURIComponent(
    `Olá! Aqui é da J12 Sports. Estou entrando em contato sobre o aluno ${aluno.nome}.`,
  );
  return `https://wa.me/${phone}?text=${message}`;
}

function WhatsappAction({ aluno }: { aluno: Aluno }) {
  const whatsappLink = getAlunoWhatsappLink(aluno);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {whatsappLink ? (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-emerald-500/10 hover:text-emerald-400"
            aria-label="Falar com responsável"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        ) : (
          <span tabIndex={0}>
            <button
              type="button"
              disabled
              className="rounded-md p-2 text-muted-foreground/40"
              aria-label="WhatsApp não cadastrado"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>
        {whatsappLink ? "Falar com responsável" : "WhatsApp não cadastrado"}
      </TooltipContent>
    </Tooltip>
  );
}

function AlunosPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { hasRole, user, isSelfService } = useAuth();
  const canEdit = hasRole("admin", "coordenador");
  const userRole = user?.role;
  const studentId = user?.studentId ?? null;
  const alunosBase = useAlunos();
  const loading = useAlunosLoading();
  const error = useAlunosError();
  const portalAluno = usePortalAluno(isSelfService);
  const alunos = useMemo(() => {
    if (isSelfService) {
      return portalAluno.data ? [portalAluno.data] : [];
    }

    return userRole === "aluno" && studentId
      ? alunosBase.filter((aluno) => aluno.id === studentId)
      : alunosBase;
  }, [alunosBase, isSelfService, portalAluno.data, studentId, userRole]);
  const turmas = useTurmas();
  const settings = useSettingsState();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<
    "ativo" | "pendente" | "experimental" | "inativo" | "todos"
  >("todos");
  const [filtroModalidade, setFiltroModalidade] = useState<string | "todas">("todas");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Aluno | null>(null);
  const [toDelete, setToDelete] = useState<Aluno | null>(null);
  const [perfil, setPerfil] = useState<Aluno | null>(null);
  const [contratoVer, setContratoVer] = useState<Contrato | null>(null);

  const modalidadesDisponiveis = useMemo(() => {
    const values = [
      ...settings.modalities.filter((item) => item.ativa).map((item) => item.nome),
      ...turmas.filter((turma) => turma.ativa).map((turma) => turma.modalidade),
      ...alunos.flatMap((aluno) => getAlunoModalidades(aluno)),
    ];

    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [settings.modalities, turmas, alunos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return alunos.filter((a) => {
      if (filtroStatus !== "todos" && a.status !== filtroStatus) return false;
      if (filtroModalidade !== "todas" && !getAlunoModalidades(a).includes(filtroModalidade)) {
        return false;
      }
      if (!q) return true;
      return (
        a.nome.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        getAlunoTurmas(a).some((turma) => turma.toLowerCase().includes(q)) ||
        getAlunoPlanos(a).some((plano) => plano.toLowerCase().includes(q)) ||
        getAlunoUnidades(a).some((unidade) => unidade.toLowerCase().includes(q))
      );
    });
  }, [alunos, busca, filtroStatus, filtroModalidade]);
  const alunosRenderizados = useMemo(() => {
    const hasBusca = busca.trim().length > 0;
    const hasFiltroStatus = filtroStatus !== "todos";
    const hasFiltroModalidade = filtroModalidade !== "todas";

    if (!hasBusca && !hasFiltroStatus && !hasFiltroModalidade) {
      return alunos;
    }

    return filtrados;
  }, [alunos, busca, filtroModalidade, filtroStatus, filtrados]);

  const totais = useMemo(
    () => ({
      total: alunos.length,
      ativos: alunos.filter((a) => a.status === "ativo").length,
      pendentes: alunos.filter((a) => a.status === "pendente").length,
      experimentais: alunos.filter((a) => a.status === "experimental").length,
      inativos: alunos.filter((a) => a.status === "inativo").length,
    }),
    [alunos],
  );

  useEffect(() => {
    if (!isSelfService) {
      void reloadAlunos();
    }
  }, [isSelfService]);

  useEffect(() => {
    if (!search.alunoId || alunos.length === 0) return;

    const selected = alunos.find((aluno) => String(aluno.id) === search.alunoId);

    if (selected && perfil?.id !== selected.id) {
      setPerfil(selected);
    }
  }, [alunos, perfil?.id, search.alunoId]);

  useEffect(() => {
    console.log("[alunos-page] Total renderizado:", alunos.length);
  }, [alunos.length]);

  const openNovo = useCallback(() => {
    navigate({ to: "/matricula" });
  }, [navigate]);

  const openEdit = useCallback((aluno: Aluno) => {
    setEditing(aluno);
    setOpenForm(true);
  }, []);

  const openPerfil = useCallback((aluno: Aluno) => {
    setPerfil(aluno);
  }, []);

  const handlePerfilOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setPerfil(null);

        if (search.alunoId) {
          void navigate({
            to: "/alunos",
            search: { alunoId: undefined },
            replace: true,
          });
        }
      }
    },
    [navigate, search.alunoId],
  );

  const handleFormOpenChange = useCallback((nextOpen: boolean) => {
    setOpenForm(nextOpen);

    if (!nextOpen) {
      setEditing(null);
    }
  }, []);

  useEffect(() => {
    if (!perfil) return;

    const updated = alunos.find((aluno) => String(aluno.id) === String(perfil.id));

    if (updated && updated !== perfil) {
      setPerfil(updated);
    }
  }, [alunos, perfil]);

  const handleContratoOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setContratoVer(null);
    }
  }, []);

  const handleDeleteOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setToDelete(null);
    }
  }, []);

  const handleAbrirContrato = useCallback((contrato: Contrato) => {
    setContratoVer(contrato);
  }, []);

  const confirmarExclusao = useCallback(() => {
    if (!toDelete) return;
    console.log("Excluir aluno:", toDelete.id);
    toast.success(`${toDelete.nome} foi removido`);
    setToDelete(null);
  }, [toDelete]);

  if (isSelfService && portalAluno.loading) {
    return (
      <TooltipProvider delayDuration={120}>
        <AlunosLoadingState title="Meu Perfil" />
      </TooltipProvider>
    );
  }

  if (isSelfService && portalAluno.error) {
    return (
      <TooltipProvider delayDuration={120}>
        <AppShell title="Meu Perfil">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
            {portalAluno.error}
          </div>
        </AppShell>
      </TooltipProvider>
    );
  }

  if (!isSelfService && loading && alunos.length === 0) {
    return (
      <TooltipProvider delayDuration={120}>
        <AlunosLoadingState title="Alunos" />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <AppShell title={isSelfService ? "Meu Perfil" : "Alunos"}>
        {!isSelfService && loading ? (
          <div className="mb-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            Atualizando lista de alunos no MySQL...
          </div>
        ) : null}

        {!isSelfService && error ? (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Total", value: totais.total, tone: "text-foreground" },
            { label: "Ativos", value: totais.ativos, tone: "text-success" },
            { label: "Pendentes", value: totais.pendentes, tone: "text-amber-400" },
            { label: "Experimentais", value: totais.experimentais, tone: "text-primary" },
            { label: "Inativos", value: totais.inativos, tone: "text-muted-foreground" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className={cn("text-2xl font-bold", k.tone)}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail, turma, plano ou unidade..."
              className="w-full rounded-lg border border-input bg-input/40 py-2 pl-9 pr-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent/30"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
            className="rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={filtroModalidade}
            onChange={(e) => setFiltroModalidade(e.target.value as typeof filtroModalidade)}
            className="rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="todas">Todas modalidades</option>
            {modalidadesDisponiveis.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {canEdit && (
            <button
              onClick={openNovo}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              <Plus className="h-4 w-4" />
              Nova matrícula
            </button>
          )}
        </div>

        {/* Tabela desktop */}
        <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Aluno</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Modalidade</th>
                <th className="px-4 py-3">Turma</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {alunosRenderizados.map((a) => (
                <tr key={a.id} className="hover:bg-accent/5">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openPerfil(a)}
                      className="text-left font-medium hover:text-primary hover:underline"
                    >
                      {a.nome}
                    </button>
                    {a.responsavel && (
                      <div className="text-xs text-muted-foreground">Resp.: {a.responsavel}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                    <div className="text-xs text-muted-foreground/80">
                      Matrícula {a.numeroMatricula || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatAlunoScope(getAlunoModalidades(a))}</td>
                  <td className="px-4 py-3">{formatAlunoScope(getAlunoTurmas(a))}</td>
                  <td className="px-4 py-3">{formatAlunoScope(getAlunoPlanos(a))}</td>
                  <td className="px-4 py-3">{statusBadge(a.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <WhatsappAction aluno={a} />
                      <button
                        onClick={() => openPerfil(a)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-primary/15 hover:text-primary"
                        aria-label="Ver perfil"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {canEdit ? (
                        <>
                          <button
                            onClick={() => openEdit(a)}
                            className="rounded-md p-2 text-muted-foreground hover:bg-primary/15 hover:text-primary"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setToDelete(a)}
                            className="rounded-md p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {alunosRenderizados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cards mobile */}
        <div className="space-y-3 md:hidden">
          {alunosRenderizados.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button
                    onClick={() => openPerfil(a)}
                    className="truncate text-left font-semibold hover:text-primary"
                  >
                    {a.nome}
                  </button>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatAlunoScope(getAlunoModalidades(a))} ·{" "}
                    {formatAlunoScope(getAlunoTurmas(a))}
                  </div>
                </div>
                {statusBadge(a.status)}
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  {a.email}
                </div>
                <div>Matrícula {a.numeroMatricula || "—"}</div>
              </div>
              <div className="mt-2 text-xs">
                <span className="text-muted-foreground">Plano: </span>
                <span className="font-medium">{formatAlunoScope(getAlunoPlanos(a))}</span>
              </div>
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <a
                  href={getAlunoWhatsappLink(a) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!getAlunoWhatsappLink(a)}
                  className={cn(
                    "flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-medium transition",
                    getAlunoWhatsappLink(a)
                      ? "hover:bg-emerald-500/10 hover:text-emerald-400"
                      : "pointer-events-none opacity-40",
                  )}
                  title={
                    getAlunoWhatsappLink(a) ? "Falar com responsável" : "WhatsApp não cadastrado"
                  }
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
                {canEdit ? (
                  <>
                    <button
                      onClick={() => openPerfil(a)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-medium hover:bg-primary/10 hover:text-primary"
                    >
                      <Eye className="h-4 w-4" /> Ver
                    </button>
                    <button
                      onClick={() => openEdit(a)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-medium hover:bg-primary/10 hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </button>
                    <button
                      onClick={() => setToDelete(a)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" /> Excluir
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openPerfil(a)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-medium hover:bg-primary/10 hover:text-primary"
                  >
                    <Eye className="h-4 w-4" /> Ver
                  </button>
                )}
              </div>
            </div>
          ))}
          {alunosRenderizados.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
              Nenhum aluno encontrado.
            </div>
          )}
        </div>

        <AlunoFormDialog open={openForm} onOpenChange={handleFormOpenChange} aluno={editing} />

        <AlunoPerfilDialog
          open={!!perfil}
          onOpenChange={handlePerfilOpenChange}
          aluno={perfil}
          onAbrirContrato={handleAbrirContrato}
        />

        <ContratoVisualizarDialog
          open={!!contratoVer}
          onOpenChange={handleContratoOpenChange}
          contrato={contratoVer}
        />

        <AlertDialog open={!!toDelete} onOpenChange={handleDeleteOpenChange}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir aluno?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. <strong>{toDelete?.nome}</strong> será removido
                permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmarExclusao}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AppShell>
    </TooltipProvider>
  );
}

function AlunosLoadingState({ title }: { title: string }) {
  return (
    <AppShell title={title}>
      <div className="space-y-5">
        <SkeletonDashboard cards={4} panels={1} withHero={false} />
        <SkeletonTable columns={7} rows={6} />
      </div>
    </AppShell>
  );
}
