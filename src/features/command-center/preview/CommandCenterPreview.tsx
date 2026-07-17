import { DashboardBridge } from "../bridge";
import { useCourtsBI } from "../hooks/arena";
import { useStudentPortalBI } from "../hooks/athlete-portal";
import { useChampionshipsBI } from "../hooks/championships";
import { useClassesBI } from "../hooks/classes";
import { useCommunicationBI } from "../hooks/communication";
import { useFinancialBI } from "../hooks/financial";
import { useGuardianPortalBI } from "../hooks/guardian-portal";
import { useLibraryBI } from "../hooks/library";
import { useStudentsBI } from "../hooks/students";
import { useProfessorsBI } from "../hooks/teachers";
import { commandCenterPreviewProviders } from "./development-providers";
import { useAuth } from "@/lib/auth";

const queryOptions = (domain: string) => ({
  queryKey: ["command-center-preview", domain] as const,
  refetchOnWindowFocus: false,
  retry: false,
  staleTime: Number.POSITIVE_INFINITY,
});

export function CommandCenterPreview() {
  const { user } = useAuth();
  const financial = useFinancialBI(
    commandCenterPreviewProviders.financial,
    queryOptions("financial"),
  );
  const students = useStudentsBI(commandCenterPreviewProviders.students, queryOptions("students"));
  const classes = useClassesBI(commandCenterPreviewProviders.classes, queryOptions("classes"));
  const teachers = useProfessorsBI(
    commandCenterPreviewProviders.teachers,
    queryOptions("teachers"),
  );
  const arena = useCourtsBI(commandCenterPreviewProviders.arena, queryOptions("arena"));
  const championships = useChampionshipsBI(
    commandCenterPreviewProviders.championships,
    queryOptions("championships"),
  );
  const communication = useCommunicationBI(
    commandCenterPreviewProviders.communication,
    queryOptions("communication"),
  );
  const library = useLibraryBI(commandCenterPreviewProviders.library, queryOptions("library"));
  const athletePortal = useStudentPortalBI(
    commandCenterPreviewProviders.athletePortal,
    queryOptions("athlete-portal"),
  );
  const guardianPortal = useGuardianPortalBI(
    commandCenterPreviewProviders.guardianPortal,
    queryOptions("guardian-portal"),
  );

  const states = [
    financial,
    students,
    classes,
    teachers,
    arena,
    championships,
    communication,
    library,
    athletePortal,
    guardianPortal,
  ];
  const loading = states.some((state) => state.loading);
  const error = states.find((state) => state.error)?.error ?? null;
  const lastUpdate = states
    .map((state) => state.lastUpdate)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const today = new Date().toISOString().slice(0, 10);

  const refreshAll = () => {
    void Promise.all(states.map((state) => state.refetch()));
  };

  return (
    <DashboardBridge
      callbacks={{ onRefresh: refreshAll, onRetry: refreshAll }}
      contracts={{}}
      dashboardFilters={{ custom: { preview: true } }}
      description="Ambiente isolado para validar Contracts, Adapters, Providers e Hooks do Centro de Comando."
      eyebrow="Preview administrativo"
      period={{ endDate: today, preset: "TODAY", startDate: today }}
      runtimeState={{
        error,
        isFetching: loading,
        isStale: false,
        status: error ? "error" : loading ? "loading" : "success",
      }}
      title="Centro de Comando — Preview"
      toolbar={
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>Fontes temporárias de desenvolvimento</span>
          {lastUpdate ? <span>Última atualização: {lastUpdate}</span> : null}
          <button
            className="rounded-lg border border-primary/30 px-3 py-1.5 font-bold text-primary"
            onClick={refreshAll}
            type="button"
          >
            Atualizar contratos
          </button>
        </div>
      }
      unit={{
        id: "preview-all",
        name: "Todas as unidades autorizadas",
        timezone: "America/Sao_Paulo",
      }}
      user={
        user
          ? { id: user.id, name: user.nome, roles: [user.role] }
          : { id: "preview", name: "Preview", roles: [] }
      }
      widgets={{
        agenda: <PreviewContractGrid items={[contractItem("Arena", arena)]} />,
        alerts: <PreviewContractGrid items={[contractItem("Comunicação", communication)]} />,
        championships: <PreviewContractGrid items={[contractItem("Campeonatos", championships)]} />,
        classes: (
          <PreviewContractGrid
            items={[contractItem("Turmas", classes), contractItem("Professores", teachers)]}
          />
        ),
        executive: (
          <PreviewContractGrid
            items={[
              contractItem("Portal do Atleta", athletePortal),
              contractItem("Portal do Responsável", guardianPortal),
            ]}
          />
        ),
        financial: <PreviewContractGrid items={[contractItem("Financeiro", financial)]} />,
        rentals: <PreviewContractGrid items={[contractItem("Arena", arena)]} />,
        sponsorships: <PreviewContractGrid items={[contractItem("Biblioteca", library)]} />,
        students: <PreviewContractGrid items={[contractItem("Alunos", students)]} />,
      }}
    />
  );
}

type PreviewHookState = {
  contract?: {
    generatedAt: string;
    metadata: { warnings: readonly string[] };
    source: { name: string };
  };
  error: Error | null;
  loading: boolean;
};

type PreviewContractItem = {
  label: string;
  state: PreviewHookState;
};

function contractItem(label: string, state: PreviewHookState): PreviewContractItem {
  return { label, state };
}

function PreviewContractGrid({ items }: { items: PreviewContractItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(({ label, state }) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm text-white">{label}</strong>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              {state.error ? "erro" : state.loading ? "carregando" : "contrato pronto"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {state.error?.message ??
              state.contract?.metadata.warnings[0] ??
              "Aguardando Provider de desenvolvimento."}
          </p>
          {state.contract ? (
            <p className="mt-2 text-[11px] text-slate-500">Fonte: {state.contract.source.name}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
