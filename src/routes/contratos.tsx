import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Copy,
  Download,
  Eye,
  FileSignature,
  FileText,
  Filter,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  XCircle,
  Building2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { ResourceSyncBanner } from "@/components/shared/ResourceSyncBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useAuth } from "@/lib/auth";
import { usePortalAluno, usePortalContrato } from "@/lib/aluno-portal";
import {
  contratosStore,
  STATUS_LABEL,
  useContratos,
  useContratosStatus,
  type Contrato,
  type StatusContrato,
} from "@/lib/contratos-store";
import { baixarContratoPDF } from "@/lib/contratos-pdf";
import { ContratoFormDialog } from "@/components/contratos/ContratoFormDialog";
import { ContratoVisualizarDialog } from "@/components/contratos/ContratoVisualizarDialog";
import { AssinaturaDialog } from "@/components/contratos/AssinaturaDialog";

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusVariant(s: StatusContrato): "default" | "secondary" | "outline" | "destructive" {
  switch (s) {
    case "ativo":
      return "default";
    case "aguardando_assinatura":
      return "secondary";
    case "cancelado":
      return "destructive";
    default:
      return "outline";
  }
}

function ContratosPage() {
  const { hasRole, isSelfService } = useAuth();
  const canManage = hasRole("admin", "coordenador");

  if (isSelfService) {
    return <ContratosSelfServicePage />;
  }

  return <ContratosStaffPage canManage={canManage} />;
}

function ContratosStaffPage({ canManage }: { canManage: boolean }) {
  const contratos = useContratos();
  const contratosStatus = useContratosStatus();

  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusContrato | "todos">("todos");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<Contrato | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [signing, setSigning] = useState<Contrato | null>(null);
  const [signParte, setSignParte] = useState<"responsavel" | "j12">("responsavel");
  const [delOpen, setDelOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<Contrato | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return contratos.filter((c) => {
      if (statusFilter !== "todos" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.alunoNome.toLowerCase().includes(q) ||
        c.responsavel.nome.toLowerCase().includes(q) ||
        c.plano.tipo.toLowerCase().includes(q)
      );
    });
  }, [contratos, busca, statusFilter]);

  const kpis = useMemo(() => {
    const total = contratos.length;
    const ativos = contratos.filter((c) => c.status === "ativo").length;
    const aguardando = contratos.filter((c) => c.status === "aguardando_assinatura").length;
    const valorAtivos = contratos
      .filter((c) => c.status === "ativo")
      .reduce((acc, c) => acc + c.valorTotal, 0);
    return { total, ativos, aguardando, valorAtivos };
  }, [contratos]);

  function abrirNovo() {
    setEditing(null);
    setFormOpen(true);
  }
  function abrirEdicao(c: Contrato) {
    setEditing(c);
    setFormOpen(true);
  }
  function abrirVisualizacao(c: Contrato) {
    setViewing(c);
    setViewOpen(true);
  }
  function abrirAssinatura(c: Contrato, parte: "responsavel" | "j12" = "responsavel") {
    setSigning(c);
    setSignParte(parte);
    setSignOpen(true);
  }
  function pedirExclusao(c: Contrato) {
    setDelTarget(c);
    setDelOpen(true);
  }
  function confirmarExclusao() {
    if (!delTarget) return;
    contratosStore.remove(delTarget.id);
    toast.success("Contrato excluído");
    setDelOpen(false);
    setDelTarget(null);
  }
  function duplicar(c: Contrato) {
    contratosStore.duplicate(c.id);
    toast.success("Contrato duplicado como rascunho");
  }
  function enviarAssinatura(c: Contrato) {
    contratosStore.enviarParaAssinatura(c.id);
    toast.success("Contrato enviado para assinatura");
  }

  return (
    <div className="space-y-6">
      <ResourceSyncBanner
        status={contratosStatus}
        resourceLabel="os contratos"
        hasData={contratos.length > 0}
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contratos</h2>
          <p className="text-sm text-muted-foreground">
            Operacao contratual, assinatura e acompanhamento no mesmo tema premium do Dashboard.
          </p>
        </div>
        {canManage && (
          <Button onClick={abrirNovo}>
            <Plus className="mr-2 h-4 w-4" /> Novo contrato
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total de contratos" value={String(kpis.total)} icon={<FileText />} />
        <KpiCard label="Ativos" value={String(kpis.ativos)} accent />
        <KpiCard label="Aguardando assinatura" value={String(kpis.aguardando)} />
        <KpiCard label="Receita contratada (ativos)" value={brl(kpis.valorAtivos)} accent />
      </div>

      {/* Toolbar */}
      <div className="j12-toolbar flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por aluno, responsável, plano..."
              className="j12-field pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusContrato | "todos")}
            >
              <SelectTrigger className="j12-field w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {(Object.keys(STATUS_LABEL) as StatusContrato[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabela desktop */}
      <div className="j12-table-shell hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="j12-table-head">
              <TableHead>Aluno</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum contrato encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((c) => (
                <TableRow key={c.id} className="j12-table-row border-border/50">
                  <TableCell>
                    <div className="font-medium">{c.alunoNome}</div>
                    <div className="text-xs text-muted-foreground">
                      Resp.: {c.responsavel.nome || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{c.plano.tipo}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.plano.modalidades.join(" + ")}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.dataInicio} → {c.dataFim}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-primary">{brl(c.valorTotal)}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.parcelas}× {brl(c.valorMensal)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{STATUS_LABEL[c.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <RowActions
                      c={c}
                      canManage={canManage}
                      onView={abrirVisualizacao}
                      onEdit={abrirEdicao}
                      onDelete={pedirExclusao}
                      onDuplicate={duplicar}
                      onSend={enviarAssinatura}
                      onSign={abrirAssinatura}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cards mobile */}
      <div className="grid gap-3 md:hidden">
        {filtrados.length === 0 ? (
          <div className="j12-empty-state p-8 text-center text-sm text-muted-foreground">
            Nenhum contrato encontrado.
          </div>
        ) : (
          filtrados.map((c) => (
            <div key={c.id} className="j12-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{c.alunoNome}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.plano.tipo} • {c.plano.modalidades.join(" + ")}
                  </div>
                </div>
                <Badge variant={statusVariant(c.status)}>{STATUS_LABEL[c.status]}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Vigência</div>
                  <div>
                    {c.dataInicio} → {c.dataFim}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Valor</div>
                  <div className="font-semibold text-primary">{brl(c.valorTotal)}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <RowActions
                  c={c}
                  canManage={canManage}
                  compact
                  onView={abrirVisualizacao}
                  onEdit={abrirEdicao}
                  onDelete={pedirExclusao}
                  onDuplicate={duplicar}
                  onSend={enviarAssinatura}
                  onSign={abrirAssinatura}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialogs */}
      <ContratoFormDialog open={formOpen} onOpenChange={setFormOpen} contrato={editing} />
      <ContratoVisualizarDialog open={viewOpen} onOpenChange={setViewOpen} contrato={viewing} />
      <AssinaturaDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        contrato={signing}
        parte={signParte}
      />

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O contrato de <strong>{delTarget?.alunoNome}</strong> será removido. Esta ação não
              pode ser desfeita.
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
    </div>
  );
}

function ContratosSelfServicePage() {
  const portalAluno = usePortalAluno(true);
  const portalContrato = usePortalContrato(true);

  if (portalAluno.loading || portalContrato.loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (portalAluno.error || portalContrato.error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        {portalAluno.error || portalContrato.error}
      </div>
    );
  }

  const contrato = portalContrato.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Meu Contrato</h2>
        <p className="text-sm text-muted-foreground">
          Visualize o documento vinculado ao aluno autenticado.
        </p>
      </div>

      {!contrato ? (
        <div className="j12-empty-state p-10 text-center text-sm text-muted-foreground">
          Nenhum contrato disponÃ­vel para leitura no momento.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Aluno" value={portalAluno.data?.nome || "-"} icon={<Users />} />
            <KpiCard label="Documento" value={contrato.tipoDocumento} icon={<FileText />} accent />
            <KpiCard label="Status" value={contrato.status} icon={<FileSignature />} />
            <KpiCard label="EmissÃ£o" value={contrato.dataEmissao || "-"} icon={<Eye />} />
          </div>

          <div className="j12-surface p-5">
            <div className="mb-4">
              <div className="text-lg font-semibold">{contrato.titulo}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Status atual: {contrato.status}
              </div>
            </div>

            {contrato.observacoes ? (
              <div className="mb-4 rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
                {contrato.observacoes}
              </div>
            ) : null}

            <div
              className="prose prose-invert max-w-none rounded-xl border border-border bg-background/40 p-5"
              dangerouslySetInnerHTML={{
                __html:
                  contrato.templateHtml ||
                  "<p>O documento ainda nÃ£o possui prÃ©-visualizaÃ§Ã£o HTML disponÃ­vel.</p>",
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="j12-kpi-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon && <span className="j12-icon-chip h-9 w-9">{icon}</span>}
      </div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function RowActions({
  c,
  canManage,
  compact,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onSend,
  onSign,
}: {
  c: Contrato;
  canManage: boolean;
  compact?: boolean;
  onView: (c: Contrato) => void;
  onEdit: (c: Contrato) => void;
  onDelete: (c: Contrato) => void;
  onDuplicate: (c: Contrato) => void;
  onSend: (c: Contrato) => void;
  onSign: (c: Contrato, parte?: "responsavel" | "j12") => void;
}) {
  const size = compact ? "sm" : "icon";
  const Wrap = compact ? "div" : "div";
  return (
    <Wrap className={compact ? "flex flex-wrap gap-2" : "flex items-center justify-end gap-1"}>
      <Button variant="ghost" size={size} title="Visualizar" onClick={() => onView(c)}>
        <Eye className="h-4 w-4" />
        {compact && <span className="ml-1">Ver</span>}
      </Button>
      <Button variant="ghost" size={size} title="Baixar PDF" onClick={() => baixarContratoPDF(c)}>
        <Download className="h-4 w-4" />
        {compact && <span className="ml-1">PDF</span>}
      </Button>
      {canManage && (
        <>
          {c.status !== "cancelado" && !c.assinatura && (
            <Button
              variant="ghost"
              size={size}
              title="Assinar como Responsável"
              onClick={() => onSign(c, "responsavel")}
            >
              <FileSignature className="h-4 w-4" />
              {compact && <span className="ml-1">Resp.</span>}
            </Button>
          )}
          {c.status !== "cancelado" && !c.assinaturaJ12 && (
            <Button
              variant="ghost"
              size={size}
              title="Assinar como J12 Sports"
              onClick={() => onSign(c, "j12")}
            >
              <Building2 className="h-4 w-4" />
              {compact && <span className="ml-1">J12</span>}
            </Button>
          )}
          {c.status === "rascunho" && (
            <Button
              variant="ghost"
              size={size}
              title="Enviar para assinatura"
              onClick={() => onSend(c)}
            >
              <Send className="h-4 w-4" />
              {compact && <span className="ml-1">Enviar</span>}
            </Button>
          )}
          <Button variant="ghost" size={size} title="Editar" onClick={() => onEdit(c)}>
            <Pencil className="h-4 w-4" />
            {compact && <span className="ml-1">Editar</span>}
          </Button>
          <Button variant="ghost" size={size} title="Duplicar" onClick={() => onDuplicate(c)}>
            <Copy className="h-4 w-4" />
            {compact && <span className="ml-1">Duplicar</span>}
          </Button>
          <Button
            variant="ghost"
            size={size}
            title="Excluir"
            onClick={() => onDelete(c)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            {compact && <span className="ml-1">Excluir</span>}
          </Button>
        </>
      )}
      {!canManage && c.status === "cancelado" && (
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <XCircle className="h-3 w-3" /> Encerrado
        </span>
      )}
    </Wrap>
  );
}

export const Route = createFileRoute("/contratos")({
  component: () => (
    <RequireAuth roles={["admin", "coordenador", "aluno", "responsavel"]}>
      <AppShell title="Contratos">
        <ContratosPage />
      </AppShell>
    </RequireAuth>
  ),
});
