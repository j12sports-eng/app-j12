import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Search,
  Sparkles,
  UserPlus2,
  Users2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfessores } from "@/lib/professores-store";
import {
  TRIAL_CLASS_STATUS_OPTIONS,
  trialClassesStore,
  useTrialClasses,
  type TrialClass,
  type TrialClassStatus,
} from "@/lib/trial-classes-store";
import { MODALIDADES, type Modalidade } from "@/lib/alunos-store";
import { TrialClassConvertDialog } from "./TrialClassConvertDialog";
import { TrialClassDetailsDrawer } from "./TrialClassDetailsDrawer";
import { TrialClassFormDialog } from "./TrialClassFormDialog";
import { TrialClassTable } from "./TrialClassTable";

type FormMode = "create" | "edit" | "reschedule";
type PendingActionType = "attended" | "no-show" | "cancel";

export function TrialClassPage() {
  const trialClasses = useTrialClasses();
  const professores = useProfessores();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TrialClassStatus | "todos">("todos");
  const [modalityFilter, setModalityFilter] = useState<Modalidade | "todas">("todas");
  const [professorFilter, setProfessorFilter] = useState<string>("todos");
  const [dateFilter, setDateFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: PendingActionType;
    item: TrialClass;
  } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const editingTrialClass = trialClasses.find((item) => item.id === editingId) ?? null;
  const detailTrialClass = trialClasses.find((item) => item.id === detailsId) ?? null;
  const convertTrialClass = trialClasses.find((item) => item.id === convertId) ?? null;

  const professorOptions = useMemo(() => {
    const fromProfessores = professores
      .filter((professor) => professor.status === "ativo")
      .map((professor) => professor.nome);
    const fromTrialClasses = trialClasses.map((item) => item.professor);
    return [...new Set([...fromProfessores, ...fromTrialClasses])].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [professores, trialClasses]);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return trialClasses.filter((item) => {
      if (statusFilter !== "todos" && item.status !== statusFilter) return false;
      if (modalityFilter !== "todas" && item.modality !== modalityFilter) return false;
      if (professorFilter !== "todos" && item.professor !== professorFilter) return false;
      if (dateFilter && item.date !== dateFilter) return false;
      if (!normalized) return true;

      return (
        item.studentName.toLowerCase().includes(normalized) ||
        item.guardianName.toLowerCase().includes(normalized) ||
        item.phone.includes(normalized) ||
        item.modality.toLowerCase().includes(normalized)
      );
    });
  }, [dateFilter, modalityFilter, professorFilter, search, statusFilter, trialClasses]);

  const stats = useMemo(() => {
    const total = trialClasses.length;
    const upcoming = trialClasses.filter(
      (item) => item.status === "Agendada" || item.status === "Confirmada",
    ).length;
    const attended = trialClasses.filter((item) => item.status === "Compareceu").length;
    const converted = trialClasses.filter((item) => item.status === "Convertida").length;
    const noShow = trialClasses.filter((item) => item.status === "N\u00E3o compareceu").length;

    return { total, upcoming, attended, converted, noShow };
  }, [trialClasses]);

  function openCreate() {
    setFormMode("create");
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(item: TrialClass) {
    setFormMode("edit");
    setEditingId(item.id);
    setFormOpen(true);
  }

  function openReschedule(item: TrialClass) {
    setFormMode("reschedule");
    setEditingId(item.id);
    setFormOpen(true);
  }

  async function runTransition(
    item: TrialClass,
    status: TrialClassStatus,
    title: string,
    description: string,
    actionKey: string,
    toastMessage: string,
  ) {
    setBusyKey(`${item.id}:${actionKey}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const updated = trialClassesStore.transition(item.id, status, title, description);
    setBusyKey(null);

    if (!updated) {
      toast.error("Nao foi possivel atualizar a aula experimental.");
      return;
    }

    toast.success(toastMessage);
  }

  function handleConfirm(item: TrialClass) {
    void runTransition(
      item,
      "Confirmada",
      "Lead confirmado",
      "A familia confirmou presenca na aula experimental.",
      "confirm",
      "Aula experimental confirmada.",
    );
  }

  function handleAttended(item: TrialClass) {
    setPendingAction({ type: "attended", item });
  }

  function handleNoShow(item: TrialClass) {
    setPendingAction({ type: "no-show", item });
  }

  function handleCancel(item: TrialClass) {
    setPendingAction({ type: "cancel", item });
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;

    if (pendingAction.type === "attended") {
      await runTransition(
        pendingAction.item,
        "Compareceu",
        "Comparecimento registrado",
        "Aluno compareceu na aula experimental.",
        "attended",
        "Comparecimento registrado.",
      );
    }

    if (pendingAction.type === "no-show") {
      await runTransition(
        pendingAction.item,
        "N\u00E3o compareceu",
        "Falta registrada",
        "Aluno nao compareceu na aula experimental.",
        "no-show",
        "Falta registrada.",
      );
    }

    if (pendingAction.type === "cancel") {
      await runTransition(
        pendingAction.item,
        "Cancelada",
        "Aula cancelada",
        "Agendamento cancelado pela equipe ou pela familia.",
        "cancel",
        "Aula experimental cancelada.",
      );
    }

    setPendingAction(null);
  }

  function pendingCopy() {
    if (!pendingAction) return null;
    switch (pendingAction.type) {
      case "attended":
        return {
          title: "Confirmar comparecimento?",
          description: `Isso vai marcar ${pendingAction.item.studentName} como compareceu na aula experimental.`,
          button: "Registrar comparecimento",
        };
      case "no-show":
        return {
          title: "Registrar falta?",
          description: `Isso vai marcar ${pendingAction.item.studentName} como nao compareceu.`,
          button: "Registrar falta",
        };
      default:
        return {
          title: "Cancelar aula experimental?",
          description: `Isso vai cancelar o agendamento de ${pendingAction.item.studentName}.`,
          button: "Cancelar aula",
        };
    }
  }

  const pendingDialog = pendingCopy();

  return (
    <AppShell title="Aula Experimental">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Aula Experimental</h2>
            <p className="text-sm text-muted-foreground">
              Pipeline de leads, presenca e conversao com o mesmo visual premium do Dashboard.
            </p>
          </div>
          <Button onClick={openCreate}>Nova Aula Experimental</Button>
        </div>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <StatCard label="Leads" value={String(stats.total)} tone="text-white" icon={Users2} />
          <StatCard
            label="Agenda ativa"
            value={String(stats.upcoming)}
            tone="text-sky-300"
            icon={CalendarDays}
          />
          <StatCard
            label="Compareceram"
            value={String(stats.attended)}
            tone="text-emerald-300"
            icon={CheckCircle2}
          />
          <StatCard
            label="Faltas"
            value={String(stats.noShow)}
            tone="text-red-300"
            icon={XCircle}
          />
          <StatCard
            label="Convertidas"
            value={String(stats.converted)}
            tone="text-primary"
            icon={UserPlus2}
          />
        </section>

        <section className="j12-toolbar p-4">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.3fr)_0.7fr_0.7fr_0.9fr_0.8fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por aluno, responsavel, telefone ou modalidade..."
                className="j12-field pl-9"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as TrialClassStatus | "todos")
              }
              className="j12-field px-3 py-2 text-sm"
            >
              <option value="todos">Todos status</option>
              {TRIAL_CLASS_STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={modalityFilter}
              onChange={(event) => setModalityFilter(event.target.value as Modalidade | "todas")}
              className="j12-field px-3 py-2 text-sm"
            >
              <option value="todas">Todas modalidades</option>
              {MODALIDADES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={professorFilter}
              onChange={(event) => setProfessorFilter(event.target.value)}
              className="j12-field px-3 py-2 text-sm"
            >
              <option value="todos">Todos professores</option>
              {professorOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <Input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="j12-field"
            />
          </div>
        </section>

        {filtered.length === 0 ? (
          <section className="j12-empty-state p-10 text-center">
            <div className="j12-icon-chip mx-auto flex h-14 w-14 items-center justify-center">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Nenhuma aula encontrada</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajuste os filtros ou crie uma nova aula experimental para alimentar o pipeline.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("todos");
                  setModalityFilter("todas");
                  setProfessorFilter("todos");
                  setDateFilter("");
                }}
              >
                Limpar filtros
              </Button>
              <Button
                onClick={openCreate}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Nova Aula Experimental
              </Button>
            </div>
          </section>
        ) : (
          <TrialClassTable
            items={filtered}
            busyKey={busyKey}
            onView={(item) => setDetailsId(item.id)}
            onEdit={openEdit}
            onConfirm={handleConfirm}
            onAttended={handleAttended}
            onNoShow={handleNoShow}
            onReschedule={openReschedule}
            onConvert={(item) => setConvertId(item.id)}
            onCancel={handleCancel}
          />
        )}
      </div>

      <TrialClassFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        trialClass={editingTrialClass}
        mode={formMode}
        onSaved={(item) => {
          setDetailsId(item.id);
        }}
      />

      <TrialClassDetailsDrawer
        open={Boolean(detailTrialClass)}
        onOpenChange={(value) => !value && setDetailsId(null)}
        trialClass={detailTrialClass}
        onEdit={openEdit}
        onReschedule={openReschedule}
        onConvert={(item) => setConvertId(item.id)}
      />

      <TrialClassConvertDialog
        open={Boolean(convertTrialClass)}
        onOpenChange={(value) => !value && setConvertId(null)}
        trialClass={convertTrialClass}
        onConverted={(item) => setDetailsId(item.id)}
      />

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(value) => !value && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingAction}>
              {pendingDialog?.button}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon: typeof Users2;
}) {
  return (
    <div className="j12-kpi-card px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="j12-icon-chip h-9 w-9">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
