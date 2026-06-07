import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Download,
  Eye,
  FileText,
  HeartPulse,
  MessageSquareText,
  ShieldCheck,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";

import FrequenciaChart from "@/components/FrequenciaChart";
import { PortalResponsavelLayout } from "@/components/PortalResponsavelLayout";
import { SkeletonDashboard, SkeletonForm } from "@/components/ui/skeleton";
import {
  useResponsavelAlunoPerfil,
  type PerfilAlunoCompleto,
  type PerfilDocumento,
} from "@/hooks/useResponsavelAlunoPerfil";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/aluno/$id")({
  component: PerfilCompletoAlunoPage,
});

type TabKey =
  | "overview"
  | "personal"
  | "finance"
  | "attendance"
  | "evaluations"
  | "health"
  | "documents"
  | "messages";

const tabs: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: "overview", label: "Visao Geral", icon: UserRound },
  { key: "personal", label: "Dados Pessoais", icon: ShieldCheck },
  { key: "finance", label: "Financeiro", icon: CreditCard },
  { key: "attendance", label: "Frequencia", icon: Activity },
  { key: "evaluations", label: "Avaliacoes", icon: CalendarDays },
  { key: "health", label: "Saude", icon: HeartPulse },
  { key: "documents", label: "Documentos", icon: FileText },
  { key: "messages", label: "Mensagens", icon: MessageSquareText },
];

function formatCurrency(value: number | undefined | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function statusClass(status: string | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (
    normalized.includes("pago") ||
    normalized.includes("ativo") ||
    normalized.includes("enviado")
  ) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (normalized.includes("venc") || normalized.includes("atras") || normalized.includes("falta")) {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }
  if (normalized.includes("pend")) return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-primary/30 bg-primary/10 text-primary";
}

function InfoCard({ label, value, icon }: { label: string; value?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="break-words text-base font-bold text-white">{value ?? "-"}</div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="j12-surface p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-black text-white md:text-2xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="j12-empty-state p-6 text-center text-sm text-slate-300">{children}</div>;
}

function ProfileSkeleton() {
  return (
    <PortalResponsavelLayout>
      <div className="space-y-5">
        <SkeletonDashboard cards={3} panels={0} />
        <SkeletonForm fields={8} className="min-h-96" />
      </div>
    </PortalResponsavelLayout>
  );
}

function ProfileHero({ perfil }: { perfil: PerfilAlunoCompleto }) {
  const aluno = perfil.aluno;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-zinc-950 p-5 shadow-[0_0_58px_rgba(255,106,0,0.11)] md:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/90 to-transparent" />
      <Link
        to="/portal-responsavel/dashboard"
        className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para dashboard
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-primary/30 bg-primary/10 text-3xl font-black text-primary">
            {aluno.fotoUrl ? (
              <img src={aluno.fotoUrl} alt={aluno.nome} className="h-full w-full object-cover" />
            ) : (
              initials(aluno.nome) || <UserRound className="h-9 w-9" />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Perfil completo do aluno
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-6xl">
              {aluno.nome}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {[aluno.categoria, aluno.modalidade, aluno.turma, aluno.statusMatricula]
                .filter(Boolean)
                .map((item) => (
                  <span
                    key={String(item)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200"
                  >
                    {item}
                  </span>
                ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard label="Professor" value={aluno.professor || "A definir"} />
          <InfoCard label="Unidade" value={aluno.unidade || "A definir"} />
          <InfoCard label="Mensalidade" value={formatCurrency(perfil.financeiro.mensalidade)} />
          <InfoCard label="Presenca" value={`${perfil.frequencia.percentual || 0}%`} />
        </div>
      </div>
    </section>
  );
}

function TabNav({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <div className="sticky top-[96px] z-20 -mx-4 overflow-x-auto border-y border-white/10 bg-black/90 px-4 py-3 backdrop-blur md:top-[89px] md:mx-0 md:rounded-3xl md:border md:bg-zinc-950/80">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const activeTab = active === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black transition",
                activeTab
                  ? "border-primary/40 bg-primary text-primary-foreground shadow-[0_0_34px_rgba(255,106,0,0.2)]"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-primary/25 hover:bg-primary/10 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OverviewTab({ perfil }: { perfil: PerfilAlunoCompleto }) {
  const aluno = perfil.aluno;

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionCard
        title="Identificacao esportiva"
        description="Resumo operacional do aluno na J12."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard label="Nome completo" value={aluno.nome} />
          <InfoCard label="Idade" value={aluno.idade ? `${aluno.idade} anos` : "-"} />
          <InfoCard label="Data nascimento" value={formatDate(aluno.dataNascimento)} />
          <InfoCard label="Modalidade" value={aluno.modalidade} />
          <InfoCard label="Categoria" value={aluno.categoria} />
          <InfoCard label="Turma" value={aluno.turma} />
          <InfoCard label="Professor" value={aluno.professor} />
          <InfoCard label="Unidade" value={aluno.unidade} />
          <InfoCard label="Status matricula" value={aluno.statusMatricula} />
          <InfoCard label="Numero matricula" value={aluno.numeroMatricula} />
        </div>
      </SectionCard>

      <SectionCard
        title="Proximas aulas e rotina"
        description="Agenda resumida disponivel para a familia."
      >
        <div className="space-y-3">
          {perfil.proximasAulas.length === 0 ? (
            <EmptyState>Nenhuma aula programada.</EmptyState>
          ) : (
            perfil.proximasAulas.map((aula, index) => (
              <article
                key={`${aula.turma}-${index}`}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{String(aula.turma || "Turma J12")}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {[aula.modalidade, aula.unidade, aula.professor, aula.horario]
                        .filter(Boolean)
                        .join(" | ")}
                    </p>
                  </div>
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
              </article>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function PersonalTab({ perfil }: { perfil: PerfilAlunoCompleto }) {
  const aluno = perfil.aluno;
  const endereco = aluno.endereco || {};
  const enderecoCompleto = [
    endereco.rua,
    endereco.numero,
    endereco.complemento,
    endereco.bairro,
    endereco.cidade,
    endereco.estado,
    endereco.cep,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <SectionCard title="Dados pessoais" description="Informacoes cadastrais e contatos principais.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InfoCard label="CPF" value={aluno.cpf} />
        <InfoCard label="RG" value={aluno.rg} />
        <InfoCard label="Endereco" value={enderecoCompleto || "-"} />
        <InfoCard label="Telefone" value={aluno.telefone} />
        <InfoCard label="E-mail" value={aluno.email} />
        <InfoCard label="Escola" value={aluno.escola} />
        <InfoCard label="Serie escolar" value={aluno.serieEscolar} />
        <InfoCard label="Responsavel" value={aluno.responsavel?.nome} />
        <InfoCard
          label="Contato responsavel"
          value={aluno.responsavel?.whatsapp || aluno.responsavel?.email}
        />
      </div>
    </SectionCard>
  );
}

function FinanceTab({ perfil }: { perfil: PerfilAlunoCompleto }) {
  const financeiro = perfil.financeiro;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <InfoCard label="Mensalidade" value={formatCurrency(financeiro.mensalidade)} />
        <InfoCard label="Vencimento" value={formatDate(financeiro.vencimento)} />
        <InfoCard label="Status pagamento" value={financeiro.statusPagamento} />
        <InfoCard label="Pendentes" value={financeiro.pendentes} />
      </div>

      <SectionCard title="Ultimas cobrancas" description="Historico financeiro separado por aluno.">
        {financeiro.ultimasCobrancas.length === 0 ? (
          <EmptyState>Nenhuma cobranca encontrada.</EmptyState>
        ) : (
          <div className="space-y-3">
            {financeiro.ultimasCobrancas.map((charge: any) => (
              <article
                key={String(charge.id)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-white">
                        {charge.descricao || charge.competencia || "Mensalidade"}
                      </p>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-bold",
                          statusClass(charge.status),
                        )}
                      >
                        {charge.status || "pendente"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      Vencimento: {formatDate(charge.vencimento)}
                    </p>
                  </div>
                  <p className="text-2xl font-black text-primary">
                    {formatCurrency(Number(charge.valorFinal ?? charge.valor ?? 0))}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function AttendanceTab({ perfil }: { perfil: PerfilAlunoCompleto }) {
  const frequencia = perfil.frequencia;
  const maxTotal = Math.max(...frequencia.graficoMensal.map((item) => item.total), 1);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionCard title="Resumo de frequencia">
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <InfoCard label="Presenca" value={`${frequencia.percentual || 0}%`} />
          <InfoCard label="Presencas" value={frequencia.presentes} />
          <InfoCard label="Faltas" value={frequencia.faltas} />
        </div>
        <FrequenciaChart presentes={frequencia.presentes || 0} faltas={frequencia.faltas || 0} />
      </SectionCard>

      <SectionCard title="Historico e grafico mensal">
        <div className="mb-6 space-y-3">
          {frequencia.graficoMensal.length === 0 ? (
            <EmptyState>Sem dados mensais de frequencia.</EmptyState>
          ) : (
            frequencia.graficoMensal.map((item) => (
              <div
                key={item.mes}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-white">{item.mes}</span>
                  <span className="text-slate-400">{item.percentual}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width:
                        item.presentes > 0
                          ? `${Math.max(8, (item.presentes / maxTotal) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          {frequencia.ultimasPresencas.map((item: any) => (
            <article
              key={String(item.id)}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-white">
                    {formatDate(item.dataAula || item.data_aula)}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{item.turma || "Treino J12"}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-bold",
                    statusClass(item.status),
                  )}
                >
                  {item.presente ? "presente" : "falta"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function EvaluationsTab({ perfil }: { perfil: PerfilAlunoCompleto }) {
  return (
    <SectionCard
      title="Avaliacoes e desempenho"
      description="Evolucao tecnica e observacoes disponiveis."
    >
      {perfil.avaliacoes.length === 0 ? (
        <EmptyState>Nenhuma avaliacao registrada.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {perfil.avaliacoes.map((avaliacao) => (
            <article
              key={avaliacao.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                {avaliacao.tipo}
              </p>
              <h3 className="mt-3 text-lg font-black text-white">{avaliacao.titulo}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{avaliacao.descricao}</p>
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function HealthTab({ perfil }: { perfil: PerfilAlunoCompleto }) {
  const saude = perfil.aluno.saude || {};

  return (
    <SectionCard
      title="Saude"
      description="Dados de seguranca para treinos e comunicacao emergencial."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InfoCard label="Alergias" value={saude.alergias} />
        <InfoCard label="Restricoes medicas" value={saude.restricoesMedicas} />
        <InfoCard label="Medicamentos" value={saude.medicamentos} />
        <InfoCard label="Contato emergencia" value={saude.contatoEmergencia} />
        <InfoCard label="Plano saude" value={saude.planoSaude} />
        <InfoCard label="Lesoes" value={saude.lesoes} />
        <InfoCard label="Observacoes" value={saude.observacoes} />
      </div>
    </SectionCard>
  );
}

function DocumentActions({
  document,
  uploading,
  onUpload,
}: {
  document: PerfilDocumento;
  uploading: boolean;
  onUpload: (documentId: string, file: File) => Promise<boolean>;
}) {
  const source = document.dataUrl || document.url || "";

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void onUpload(document.id, file);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {document.canUpload !== false && (
        <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-3 py-2 text-sm font-black text-primary-foreground transition hover:brightness-110">
          <Upload className="h-4 w-4" />
          {uploading ? "Enviando..." : "Upload"}
          <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      )}
      <a
        href={source || undefined}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!source}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold transition",
          source
            ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
            : "pointer-events-none border-white/5 bg-white/[0.03] text-slate-600",
        )}
      >
        <Eye className="h-4 w-4" />
        Visualizar
      </a>
      <a
        href={source || undefined}
        download={document.nome}
        aria-disabled={!source}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold transition",
          source
            ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
            : "pointer-events-none border-white/5 bg-white/[0.03] text-slate-600",
        )}
      >
        <Download className="h-4 w-4" />
        Download
      </a>
    </div>
  );
}

function DocumentsTab({
  perfil,
  uploadingDocumentId,
  onUpload,
}: {
  perfil: PerfilAlunoCompleto;
  uploadingDocumentId: string | null;
  onUpload: (documentId: string, file: File) => Promise<boolean>;
}) {
  return (
    <SectionCard title="Documentos" description="Documentos do aluno, contrato e comprovantes.">
      <div className="grid gap-4 md:grid-cols-2">
        {perfil.documentos.map((document) => (
          <article
            key={document.id}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black text-white">{document.titulo}</h3>
                <p className="mt-1 truncate text-sm text-slate-400">{document.nome}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Enviado em: {formatDate(document.uploadedAt)}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-bold",
                  statusClass(document.status),
                )}
              >
                {document.status}
              </span>
            </div>
            <DocumentActions
              document={document}
              uploading={uploadingDocumentId === document.id}
              onUpload={onUpload}
            />
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function MessagesTab({ perfil }: { perfil: PerfilAlunoCompleto }) {
  return (
    <SectionCard title="Mensagens" description="Avisos, notificacoes e comunicados de professores.">
      {perfil.mensagens.length === 0 ? (
        <EmptyState>Nenhuma mensagem recente.</EmptyState>
      ) : (
        <div className="space-y-3">
          {perfil.mensagens.map((message: any) => (
            <article
              key={String(message.id)}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-white">{message.titulo}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{message.mensagem}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {formatDate(message.createdAt || message.created_at)}
                  </p>
                </div>
                {!message.lida && (
                  <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-black text-primary">
                    Nova
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function ActiveTabContent({
  active,
  perfil,
  uploadingDocumentId,
  uploadDocument,
}: {
  active: TabKey;
  perfil: PerfilAlunoCompleto;
  uploadingDocumentId: string | null;
  uploadDocument: (documentId: string, file: File) => Promise<boolean>;
}) {
  switch (active) {
    case "personal":
      return <PersonalTab perfil={perfil} />;
    case "finance":
      return <FinanceTab perfil={perfil} />;
    case "attendance":
      return <AttendanceTab perfil={perfil} />;
    case "evaluations":
      return <EvaluationsTab perfil={perfil} />;
    case "health":
      return <HealthTab perfil={perfil} />;
    case "documents":
      return (
        <DocumentsTab
          perfil={perfil}
          uploadingDocumentId={uploadingDocumentId}
          onUpload={uploadDocument}
        />
      );
    case "messages":
      return <MessagesTab perfil={perfil} />;
    case "overview":
    default:
      return <OverviewTab perfil={perfil} />;
  }
}

function PerfilCompletoAlunoPage() {
  const { id } = Route.useParams();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const { perfil, loading, erro, uploadingDocumentId, uploadDocument } =
    useResponsavelAlunoPerfil(id);
  const selectedTab = useMemo(() => tabs.find((tab) => tab.key === activeTab), [activeTab]);

  if (loading) return <ProfileSkeleton />;

  if (!perfil) {
    return (
      <PortalResponsavelLayout>
        <div className="j12-empty-state p-8 text-center text-slate-300">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-300" />
          <p>{erro || "Perfil nao encontrado."}</p>
          <Link
            to="/portal-responsavel/dashboard"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground"
          >
            Voltar para dashboard
          </Link>
        </div>
      </PortalResponsavelLayout>
    );
  }

  return (
    <PortalResponsavelLayout>
      <div className="j12-page-enter space-y-6">
        <ProfileHero perfil={perfil} />
        <TabNav active={activeTab} onChange={setActiveTab} />

        {erro && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100">
            {erro}
          </div>
        )}

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {selectedTab?.label}
          </p>
          <ActiveTabContent
            active={activeTab}
            perfil={perfil}
            uploadingDocumentId={uploadingDocumentId}
            uploadDocument={uploadDocument}
          />
        </div>
      </div>
    </PortalResponsavelLayout>
  );
}
