import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BadgeCheck,
  Blocks,
  Copy,
  Database,
  FileText,
  Layers3,
  Pencil,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  formatPlanoPrice,
  planosStore,
  planoStatusClass,
  planoStatusLabel,
  usePlanos,
  type CategoriaPlano,
  type Plano,
  type PlanoInput,
  type StatusPlano,
} from "@/lib/planos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planos")({
  component: () => (
    <RequireAuth roles={["admin", "coordenador"]}>
      <PlanosPage />
    </RequireAuth>
  ),
});

const STATUS_OPTIONS: Array<{ value: StatusPlano | "todos"; label: string }> = [
  { value: "todos", label: "Todos status" },
  { value: "ativo", label: "Ativos" },
  { value: "rascunho", label: "Rascunhos" },
  { value: "arquivado", label: "Arquivados" },
];

const CATEGORY_OPTIONS: Array<{ value: CategoriaPlano | "todas"; label: string }> = [
  { value: "todas", label: "Todas categorias" },
  { value: "Kids", label: "Kids" },
  { value: "Base", label: "Base" },
  { value: "Performance", label: "Performance" },
  { value: "Adulto", label: "Adulto" },
  { value: "Personalizado", label: "Personalizado" },
];

const NEXT_ITERATION_ITEMS = [
  {
    title: "Regras comerciais",
    description: "Aplicar descontos, campanhas, upgrade e downgrade com governanca por unidade.",
    icon: WandSparkles,
  },
  {
    title: "Contrato automatico",
    description:
      "Vincular plano ao contrato do aluno para preencher valores, fidelidade e clausulas.",
    icon: FileText,
  },
  {
    title: "Persistencia MySQL/API",
    description: "Trocar o mock store por endpoints reais mantendo a mesma interface visual.",
    icon: Database,
  },
  {
    title: "Operacao de catalogo",
    description: "Versionamento, historico, arquivamento inteligente e relatorios comerciais.",
    icon: Blocks,
  },
];

const emptyPlanoForm: PlanoInput = {
  nome: "",
  categoria: "Base",
  descricao: "",
  precoMensal: 0,
  taxaMatricula: 0,
  fidelidadeMeses: 1,
  aulasPorSemana: 1,
  modalidades: [],
  contratoVinculado: true,
  aceitaUpgrade: true,
  destaqueComercial: false,
  status: "rascunho",
  tags: [],
};

function PlanosPage() {
  const planos = usePlanos();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<StatusPlano | "todos">("todos");
  const [categoria, setCategoria] = useState<CategoriaPlano | "todas">("todas");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const editingPlano = planos.find((plano) => plano.id === editingId) ?? null;
  const detailPlano = planos.find((plano) => plano.id === detailId) ?? null;
  const deletePlano = planos.find((plano) => plano.id === deleteId) ?? null;

  const planosFiltrados = useMemo(() => {
    const query = busca.trim().toLowerCase();

    return planos.filter((plano) => {
      if (status !== "todos" && plano.status !== status) return false;
      if (categoria !== "todas" && plano.categoria !== categoria) return false;
      if (!query) return true;

      return (
        plano.nome.toLowerCase().includes(query) ||
        plano.descricao.toLowerCase().includes(query) ||
        plano.modalidades.some((modalidade) => modalidade.toLowerCase().includes(query)) ||
        plano.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [busca, categoria, planos, status]);

  const kpis = useMemo(() => {
    const ativos = planos.filter((plano) => plano.status === "ativo").length;
    const rascunhos = planos.filter((plano) => plano.status === "rascunho").length;
    const contratosReady = planos.filter((plano) => plano.contratoVinculado).length;
    const destaques = planos.filter((plano) => plano.destaqueComercial).length;

    return {
      total: planos.length,
      ativos,
      rascunhos,
      contratosReady,
      destaques,
    };
  }, [planos]);

  function openCreate() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(plano: Plano) {
    setEditingId(plano.id);
    setFormOpen(true);
  }

  function openDetail(plano: Plano) {
    setDetailId(plano.id);
  }

  function handleResetMocks() {
    planosStore.reset();
    setDetailId(null);
    setEditingId(null);
    toast.success("Estrutura mock de planos restaurada.");
  }

  function handleSavePlano(payload: PlanoInput) {
    if (editingPlano) {
      planosStore.update(editingPlano.id, payload);
      toast.success("Plano atualizado.");
      setFormOpen(false);
      return;
    }

    const novo = planosStore.create(payload);
    toast.success("Plano criado.");
    setFormOpen(false);
    setDetailId(novo.id);
  }

  function handleDuplicate(plano: Plano) {
    const duplicated = planosStore.duplicate(plano.id);
    if (!duplicated) return;
    toast.success("Plano duplicado como rascunho.");
    setDetailId(duplicated.id);
  }

  function handleToggleStatus(plano: Plano) {
    planosStore.toggleStatus(plano.id);
    toast.success(
      plano.status === "arquivado"
        ? "Plano reativado."
        : plano.status === "ativo"
          ? "Plano arquivado."
          : "Plano ativado.",
    );
  }

  function handleDeleteRequest(plano: Plano) {
    setDeleteId(plano.id);
  }

  function confirmDeletePlano() {
    if (!deletePlano) return;
    planosStore.remove(deletePlano.id);
    if (detailId === deletePlano.id) setDetailId(null);
    if (editingId === deletePlano.id) setEditingId(null);
    setDeleteId(null);
    toast.success("Plano excluido.");
  }

  return (
    <AppShell title="Planos">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Planos</h2>
            <p className="text-sm text-muted-foreground">
              Catalogo comercial com o mesmo acabamento escuro e premium usado no Dashboard.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={openCreate}>
              <Layers3 className="mr-2 h-4 w-4" />
              Novo plano
            </Button>
            <Button variant="outline" onClick={handleResetMocks}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Resetar mocks
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <KpiCard label="Planos mapeados" value={String(kpis.total)} tone="text-white" />
          <KpiCard label="Ativos" value={String(kpis.ativos)} tone="text-emerald-300" />
          <KpiCard label="Rascunhos" value={String(kpis.rascunhos)} tone="text-amber-300" />
          <KpiCard label="Contrato ready" value={String(kpis.contratosReady)} tone="text-primary" />
          <KpiCard label="Destaques" value={String(kpis.destaques)} tone="text-primary" />
        </section>

        <section className="j12-toolbar p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por plano, modalidade, tag ou proposta comercial..."
                className="j12-field pl-9"
              />
            </div>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusPlano | "todos")}
              className="j12-field px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={categoria}
              onChange={(event) => setCategoria(event.target.value as CategoriaPlano | "todas")}
              className="j12-field px-3 py-2 text-sm"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="j12-table-shell hidden xl:block">
          <table className="w-full text-sm">
            <thead className="j12-table-head text-left text-xs uppercase tracking-[0.16em]">
              <tr>
                <th className="px-5 py-4">Plano</th>
                <th className="px-5 py-4">Oferta</th>
                <th className="px-5 py-4">Modalidades</th>
                <th className="px-5 py-4">Pronto para contrato/API</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {planosFiltrados.map((plano) => (
                <tr key={plano.id} className="j12-table-row">
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="j12-icon-chip flex h-11 w-11 items-center justify-center">
                        <Layers3 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openDetail(plano)}
                            className="font-semibold text-foreground transition hover:text-primary"
                          >
                            {plano.nome}
                          </button>
                          {plano.destaqueComercial && (
                            <Badge className="border-primary/30 bg-primary/15 text-primary">
                              Destaque
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{plano.categoria}</div>
                        <p className="mt-2 max-w-md text-sm text-foreground/90">
                          {plano.descricao}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-foreground/90">
                    <div>{formatPlanoPrice(plano.precoMensal)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Matricula {formatPlanoPrice(plano.taxaMatricula)} •{" "}
                      {plano.aulasPorSemana || "?"} aulas/semana
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Fidelidade: {plano.fidelidadeMeses} mes(es)
                    </div>
                  </td>
                  <td className="px-5 py-4 text-foreground/90">
                    <div className="max-w-[260px]">{plano.modalidades.join(", ")}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {plano.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border bg-card/70 px-2 py-1 text-[11px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <ReadinessCell plano={plano} />
                  </td>
                  <td className="px-5 py-4">
                    <Badge className={planoStatusClass(plano.status)}>
                      {planoStatusLabel(plano.status)}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => openDetail(plano)}>
                        Ver estrutura
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(plano)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRequest(plano)}
                        className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {planosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    Nenhum plano encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:hidden">
          {planosFiltrados.map((plano) => (
            <article key={plano.id} className="j12-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <button
                    type="button"
                    onClick={() => openDetail(plano)}
                    className="font-semibold text-foreground transition hover:text-primary"
                  >
                    {plano.nome}
                  </button>
                  <div className="mt-1 text-sm text-muted-foreground">{plano.categoria}</div>
                </div>
                <Badge className={planoStatusClass(plano.status)}>
                  {planoStatusLabel(plano.status)}
                </Badge>
              </div>

              <p className="mt-3 text-sm leading-6 text-foreground/90">{plano.descricao}</p>

              <div className="j12-panel-section mt-4 p-4 text-sm text-foreground/90">
                <div>{formatPlanoPrice(plano.precoMensal)}</div>
                <div className="mt-1 text-muted-foreground">
                  Matricula {formatPlanoPrice(plano.taxaMatricula)} • {plano.fidelidadeMeses}{" "}
                  mes(es)
                </div>
                <div className="mt-1 text-muted-foreground">{plano.modalidades.join(", ")}</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {plano.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-card/70 px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-4">
                <ReadinessCell plano={plano} compact />
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => openDetail(plano)} className="flex-1">
                  Ver estrutura
                </Button>
                <Button variant="outline" onClick={() => openEdit(plano)} className="flex-1">
                  Editar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDeleteRequest(plano)}
                  className="flex-1 border-red-400/30 text-red-300 hover:bg-red-500/10"
                >
                  Excluir
                </Button>
              </div>
            </article>
          ))}
        </div>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="j12-surface p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Preparacao tecnica
            </div>
            <div className="space-y-3">
              <RoadmapRow
                title="CRUD basico ativo"
                description="Criacao, edicao, duplicacao e arquivamento ja funcionam neste modulo."
                done
              />
              <RoadmapRow
                title="Store mock persistido"
                description="Os dados agora sao sincronizados com a API persistente da plataforma."
                done
              />
              <RoadmapRow
                title="Camada API/MySQL"
                description="O proximo passo e trocar o store local por servicos reais."
              />
              <RoadmapRow
                title="Automacoes comerciais"
                description="Descontos, cupons, upgrades e amarracoes com financeiro entram depois."
              />
            </div>
          </div>

          <div className="j12-surface p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Proxima iteracao
            </div>
            <div className="grid grid-cols-1 gap-3">
              {NEXT_ITERATION_ITEMS.map((item) => (
                <div
                  key={item.title}
                  className="j12-panel-section p-4 transition hover:border-primary/20 hover:bg-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="j12-icon-chip flex h-10 w-10 items-center justify-center">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <PlanoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        plano={editingPlano}
        onSubmit={handleSavePlano}
      />

      <PlanoDetailSheet
        open={Boolean(detailPlano)}
        onOpenChange={(value) => !value && setDetailId(null)}
        plano={detailPlano}
        onEdit={openEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteRequest}
        onToggleStatus={handleToggleStatus}
      />

      <AlertDialog
        open={Boolean(deletePlano)}
        onOpenChange={(value) => !value && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletePlano ? (
                <>
                  O plano <strong>{deletePlano.nome}</strong> sera removido do catalogo mock e essa
                  acao nao podera ser desfeita automaticamente.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePlano}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Excluir plano
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function PlanoFormDialog({
  open,
  onOpenChange,
  plano,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  plano: Plano | null;
  onSubmit: (payload: PlanoInput) => void;
}) {
  const [form, setForm] = useState<PlanoInput>(emptyPlanoForm);

  useEffect(() => {
    if (!open) return;

    if (plano) {
      const { id: _id, atualizadoEm: _updatedAt, ...payload } = plano;
      setForm(payload);
      return;
    }

    setForm(emptyPlanoForm);
  }, [open, plano]);

  function updateField<K extends keyof PlanoInput>(key: K, value: PlanoInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!form.nome.trim() || !form.descricao.trim()) {
      toast.error("Preencha nome e descricao do plano.");
      return;
    }

    if (form.precoMensal < 0 || form.taxaMatricula < 0) {
      toast.error("Os valores do plano nao podem ser negativos.");
      return;
    }

    onSubmit({
      ...form,
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      modalidades: form.modalidades.filter(Boolean),
      tags: form.tags.filter(Boolean),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{plano ? "Editar plano" : "Novo plano"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Estruture oferta, contrato e operacao comercial do plano dentro do padrao J12.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="j12-surface p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Dados principais
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Nome do plano</Label>
                <Input value={form.nome} onChange={(e) => updateField("nome", e.target.value)} />
              </div>
              <div>
                <Label>Categoria</Label>
                <select
                  value={form.categoria}
                  onChange={(e) => updateField("categoria", e.target.value as CategoriaPlano)}
                  className="j12-field mt-2 w-full px-3 py-2 text-sm"
                >
                  {CATEGORY_OPTIONS.filter((item) => item.value !== "todas").map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value as StatusPlano)}
                  className="j12-field mt-2 w-full px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.filter((item) => item.value !== "todos").map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label>Descricao comercial</Label>
                <Textarea
                  value={form.descricao}
                  onChange={(e) => updateField("descricao", e.target.value)}
                  className="j12-field mt-2 min-h-[110px]"
                />
              </div>
            </div>
          </section>

          <section className="j12-surface p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Oferta e operacao
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Preco mensal</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.precoMensal}
                  onChange={(e) => updateField("precoMensal", Number(e.target.value || "0"))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Taxa de matricula</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.taxaMatricula}
                  onChange={(e) => updateField("taxaMatricula", Number(e.target.value || "0"))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Fidelidade em meses</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.fidelidadeMeses}
                  onChange={(e) => updateField("fidelidadeMeses", Number(e.target.value || "0"))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Aulas por semana</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.aulasPorSemana}
                  onChange={(e) => updateField("aulasPorSemana", Number(e.target.value || "0"))}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Modalidades</Label>
                <Input
                  value={form.modalidades.join(", ")}
                  onChange={(e) =>
                    updateField(
                      "modalidades",
                      e.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="Ex: Futebol, Preparacao fisica"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Tags</Label>
                <Input
                  value={form.tags.join(", ")}
                  onChange={(e) =>
                    updateField(
                      "tags",
                      e.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="Ex: Premium, Contrato, Entrada"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <CheckItem
                checked={form.contratoVinculado}
                onCheckedChange={(checked) => updateField("contratoVinculado", checked)}
                label="Contrato vinculado"
              />
              <CheckItem
                checked={form.aceitaUpgrade}
                onCheckedChange={(checked) => updateField("aceitaUpgrade", checked)}
                label="Aceita upgrade"
              />
              <CheckItem
                checked={form.destaqueComercial}
                onCheckedChange={(checked) => updateField("destaqueComercial", checked)}
                label="Destaque comercial"
              />
            </div>
          </section>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {plano ? "Salvar plano" : "Criar plano"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlanoDetailSheet({
  open,
  onOpenChange,
  plano,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  plano: Plano | null;
  onEdit: (plano: Plano) => void;
  onDuplicate: (plano: Plano) => void;
  onDelete: (plano: Plano) => void;
  onToggleStatus: (plano: Plano) => void;
}) {
  if (!plano) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <div className="border-b border-border bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--color-primary)_16%,transparent),transparent_38%),linear-gradient(180deg,color-mix(in_srgb,var(--color-card)_92%,transparent),color-mix(in_srgb,var(--color-background)_96%,transparent))] px-6 py-8">
          <SheetHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="j12-surface-soft inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  <Layers3 className="h-4 w-4" />
                  Estrutura do plano
                </div>
                <SheetTitle className="mt-4 text-2xl text-foreground">{plano.nome}</SheetTitle>
                <SheetDescription className="mt-1 text-muted-foreground">
                  {plano.categoria} • Atualizado em{" "}
                  {new Date(plano.atualizadoEm).toLocaleString("pt-BR")}
                </SheetDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className={planoStatusClass(plano.status)}>
                    {planoStatusLabel(plano.status)}
                  </Badge>
                  {plano.destaqueComercial && (
                    <Badge className="border-primary/30 bg-primary/15 text-primary">
                      Destaque comercial
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => onEdit(plano)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button variant="outline" onClick={() => onDuplicate(plano)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicar
                </Button>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="space-y-5 px-6 py-6">
          <section className="j12-surface p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Resumo comercial
            </div>
            <p className="text-sm leading-6 text-foreground/90">{plano.descricao}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoCard label="Preco mensal" value={formatPlanoPrice(plano.precoMensal)} />
              <InfoCard label="Taxa de matricula" value={formatPlanoPrice(plano.taxaMatricula)} />
              <InfoCard label="Fidelidade" value={`${plano.fidelidadeMeses} mes(es)`} />
              <InfoCard label="Aulas por semana" value={`${plano.aulasPorSemana}`} />
            </div>
          </section>

          <section className="j12-surface p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Modalidades e readiness
            </div>
            <div className="text-sm text-foreground/90">
              {plano.modalidades.join(", ") || "Sem modalidades"}
            </div>
            <div className="mt-4">
              <ReadinessCell plano={plano} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {plano.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-card/70 px-2 py-1 text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <section className="j12-surface p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Acoes do plano
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onEdit(plano)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar plano
              </Button>
              <Button variant="outline" onClick={() => onDuplicate(plano)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicar
              </Button>
              <Button
                variant="outline"
                onClick={() => onDelete(plano)}
                className="border-red-400/30 text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir plano
              </Button>
              <Button variant="outline" onClick={() => onToggleStatus(plano)}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                {plano.status === "arquivado"
                  ? "Reativar plano"
                  : plano.status === "ativo"
                    ? "Arquivar plano"
                    : "Ativar plano"}
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CheckItem({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="j12-panel-section flex items-start gap-3 rounded-2xl p-4 text-sm text-foreground/80">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <span>{label}</span>
    </label>
  );
}

function ReadinessCell({ plano, compact = false }: { plano: Plano; compact?: boolean }) {
  const items = [
    { label: "Contrato", ok: plano.contratoVinculado },
    { label: "Upgrade", ok: plano.aceitaUpgrade },
    { label: "Oferta destaque", ok: plano.destaqueComercial },
  ];

  return (
    <div className={cn("flex flex-wrap gap-2", compact && "gap-3")}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs",
            item.ok
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
              : "border-border bg-card/70 text-muted-foreground",
          )}
        >
          <BadgeCheck className="h-3.5 w-3.5" />
          {item.label}
        </div>
      ))}
    </div>
  );
}

function RoadmapRow({
  title,
  description,
  done = false,
}: {
  title: string;
  description: string;
  done?: boolean;
}) {
  return (
    <div className="j12-panel-section p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border",
            done
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
              : "border-primary/20 bg-primary/10 text-primary",
          )}
        >
          {done ? <BadgeCheck className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </div>
        <div>
          <div className="font-medium text-foreground">{title}</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{description}</div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="j12-panel-section p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm text-foreground">{value}</div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="j12-kpi-card px-4 py-4">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold", tone)}>{value}</div>
    </div>
  );
}
