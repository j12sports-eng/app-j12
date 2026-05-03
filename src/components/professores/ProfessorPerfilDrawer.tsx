import {
  CreditCard,
  Download,
  FileSignature,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  PenSquare,
  Phone,
  RefreshCcw,
  Shapes,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Professor } from "@/lib/professores-store";
import {
  contratoProfessorBadgeClass,
  downloadProfessorContract,
  getProfessorInitials,
  getProfessorModalidadesLabel,
  getProfessorUnidadesLabel,
  nextProfessorPaymentDate,
  statusProfessorBadgeClass,
} from "@/lib/professores-store";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  professor: Professor | null;
  onEditProfessor: (professor: Professor) => void;
  onGenerateContract: (professor: Professor) => void;
  onOpenContract: (professor: Professor) => void;
  onOpenSignature: (professor: Professor) => void;
}

export function ProfessorPerfilDrawer({
  open,
  onOpenChange,
  professor,
  onEditProfessor,
  onGenerateContract,
  onOpenContract,
  onOpenSignature,
}: Props) {
  if (!professor) return null;

  const canViewContract = professor.contrato.status !== "Não gerado";
  const canSignContract = professor.contrato.status === "Pendente de assinatura";
  const isSigned = professor.contrato.status === "Assinado";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <div className="border-b border-border bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--color-primary)_16%,transparent),transparent_38%),linear-gradient(180deg,color-mix(in_srgb,var(--color-card)_92%,transparent),color-mix(in_srgb,var(--color-background)_96%,transparent))] px-6 py-8">
          <SheetHeader>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="j12-icon-chip flex h-16 w-16 items-center justify-center text-xl font-semibold">
                  {getProfessorInitials(professor.nome)}
                </div>
                <div>
                  <SheetTitle className="text-2xl text-foreground">{professor.nome}</SheetTitle>
                  <SheetDescription className="mt-1 text-muted-foreground">
                    {getProfessorModalidadesLabel(professor) || "Sem modalidades"} ·{" "}
                    {getProfessorUnidadesLabel(professor) || "Sem unidades"}
                  </SheetDescription>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className={statusProfessorBadgeClass(professor.status)}>
                      {professor.status}
                    </Badge>
                    <Badge className={contratoProfessorBadgeClass(professor.contrato.status)}>
                      {professor.contrato.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <Button variant="outline" onClick={() => onEditProfessor(professor)}>
                Editar cadastro
              </Button>
            </div>
          </SheetHeader>
        </div>

        <div className="space-y-5 px-6 py-6">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              {
                icon: Mail,
                label: "E-mail",
                value: professor.email,
              },
              {
                icon: Phone,
                label: "Telefone",
                value: professor.telefone,
              },
              {
                icon: CreditCard,
                label: "CPF / CREF",
                value: `${professor.cpf} · ${professor.cref || "CREF pendente"}`,
              },
            ].map((item) => (
              <div key={item.label} className="j12-panel-section p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary/80">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
                <div className="mt-3 text-sm text-foreground">{item.value}</div>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="j12-surface p-5">
              <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary/80">
                <Shapes className="h-4 w-4" />
                Modalidades
              </div>
              <TagList
                values={professor.modalidades}
                tone="primary"
                emptyLabel="Nenhuma modalidade"
              />
            </div>

            <div className="j12-surface p-5">
              <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary/80">
                <MapPin className="h-4 w-4" />
                Unidades
              </div>
              <TagList values={professor.unidades} tone="neutral" emptyLabel="Nenhuma unidade" />
            </div>
          </section>

          <section className="j12-surface p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-primary/80">
                  Contrato do professor
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Mesmo fluxo premium de visualizacao e assinatura aplicado ao contrato do aluno.
                </div>
              </div>
              <Badge className={contratoProfessorBadgeClass(professor.contrato.status)}>
                {professor.contrato.status}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoCard
                label="Numero do contrato"
                value={professor.contrato.numeroContrato || "Ainda nao gerado"}
              />
              <InfoCard label="Data de geracao" value={professor.contrato.dataGeracao || "—"} />
              <InfoCard
                label="Data da assinatura"
                value={professor.contrato.dataAssinatura || "Aguardando assinatura"}
              />
              <InfoCard label="Tipo de contrato" value={professor.tipoContrato} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => onGenerateContract(professor)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                {canViewContract ? "Gerar novo contrato" : "Gerar contrato"}
              </Button>

              <Button
                variant="outline"
                disabled={!canViewContract}
                onClick={() => onOpenContract(professor)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Visualizar contrato
              </Button>

              <Button
                variant="outline"
                disabled={!canSignContract}
                onClick={() => onOpenSignature(professor)}
              >
                <PenSquare className="mr-2 h-4 w-4" />
                Assinar contrato
              </Button>

              <Button
                variant="outline"
                disabled={!canViewContract}
                onClick={() => downloadProfessorContract(professor)}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar contrato
              </Button>

              <Button
                variant="outline"
                disabled={!canViewContract}
                onClick={() => toast.success("Contrato reenviado para assinatura.")}
              >
                <FileSignature className="mr-2 h-4 w-4" />
                Reenviar contrato
              </Button>
            </div>

            {isSigned && professor.contrato.assinatura && (
              <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
                <div className="font-semibold text-emerald-300">Assinatura digital registrada</div>
                <div className="mt-2 text-foreground/90">
                  {professor.contrato.assinatura.nomeAssinante} · CPF{" "}
                  {professor.contrato.assinatura.cpfAssinante}
                </div>
                <div className="text-muted-foreground">
                  {professor.contrato.assinatura.dataAssinatura} ·{" "}
                  {professor.contrato.assinatura.formaAssinatura}
                </div>
              </div>
            )}

            {professor.historicoContratos.length > 0 && (
              <div className="j12-panel-section mt-4 p-4">
                <div className="text-sm font-semibold text-foreground">
                  Historico simples de contratos
                </div>
                <div className="mt-3 space-y-2">
                  {professor.historicoContratos.slice(0, 4).map((contratoHistorico) => (
                    <div
                      key={`${contratoHistorico.numeroContrato}-${contratoHistorico.dataGeracao}`}
                      className="j12-panel-section flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs"
                    >
                      <div className="text-foreground/90">{contratoHistorico.numeroContrato}</div>
                      <div className="text-muted-foreground">{contratoHistorico.dataGeracao}</div>
                      <Badge className={contratoProfessorBadgeClass(contratoHistorico.status)}>
                        {contratoHistorico.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="j12-surface p-5">
              <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary/80">
                <GraduationCap className="h-4 w-4" />
                Turmas e jornada
              </div>
              <div className="space-y-3">
                <InfoRow label="Jornada" value={professor.jornadaProfessor || "A definir"} />
                <InfoRow
                  label="Turmas vinculadas"
                  value={
                    professor.turmas.length
                      ? professor.turmas.join(", ")
                      : "Nenhuma turma vinculada"
                  }
                />
              </div>
            </div>

            <div className="j12-surface p-5">
              <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary/80">
                <Wallet className="h-4 w-4" />
                Financeiro
              </div>
              <div className="space-y-3">
                <InfoRow
                  label="Valor combinado"
                  value={professor.valorContrato.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                />
                <InfoRow label="Forma de pagamento" value={professor.formaPagamentoProfessor} />
                <InfoRow label="Proximo pagamento" value={nextProfessorPaymentDate(professor)} />
                <div className="j12-panel-section p-3 text-sm text-muted-foreground">
                  {professor.contrato.status === "Assinado"
                    ? "Pagamento liberado para o proximo ciclo financeiro."
                    : "Pagamento aguardando contrato assinado ou nova geracao."}
                </div>
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="j12-panel-section p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="j12-panel-section flex items-start justify-between gap-3 px-4 py-3 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-right font-medium text-foreground">{value}</div>
    </div>
  );
}

function TagList({
  values,
  tone,
  emptyLabel,
}: {
  values: string[];
  tone: "primary" | "neutral";
  emptyLabel: string;
}) {
  if (values.length === 0) {
    return <div className="text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge
          key={value}
          className={
            tone === "primary"
              ? "border-primary/30 bg-primary/15 text-primary"
              : "border-border bg-card/70 text-foreground/80"
          }
        >
          {value}
        </Badge>
      ))}
    </div>
  );
}
