import { useMemo, type ReactNode } from "react";
import {
  FileText,
  Eye,
  Download,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  AlertTriangle,
} from "lucide-react";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getAlunoDocumentPendencies,
  getAlunoDocumentStatus,
  getAlunoDocumentStatusLabel,
} from "@/lib/aluno-matricula";
import {
  formatAlunoScope,
  getAlunoHorarios,
  getAlunoModalidades,
  getAlunoPlanos,
  getAlunoTurmas,
  getAlunoUnidades,
  type Aluno,
} from "@/lib/alunos-store";
import {
  STATUS_LABEL,
  useContratos,
  type Contrato,
  type StatusContrato,
} from "@/lib/contratos-store";
import {
  calcStatus,
  formatBRL,
  getValorAtualizado,
  useRecorrenciasFinanceiras,
  useTransacoes,
  type StatusCobranca,
} from "@/lib/financeiro-store";
import { baixarContratoPDF } from "@/lib/contratos-pdf";
import { formatDias, statsPresencaAluno, useTurmas } from "@/lib/turmas-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  aluno: Aluno | null;
  onAbrirContrato: (c: Contrato) => void;
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

function parcelaIcon(s: StatusCobranca) {
  if (s === "pago") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (s === "vencido") return <AlertCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function parcelaLabel(s: StatusCobranca): { txt: string; cls: string } {
  if (s === "pago") return { txt: "Pago", cls: "text-success" };
  if (s === "vencido") return { txt: "Vencido", cls: "text-destructive" };
  return { txt: "Pendente", cls: "text-muted-foreground" };
}

function fmtBRDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

export function AlunoPerfilDialog({ open, onOpenChange, aluno, onAbrirContrato }: Props) {
  const contratos = useContratos();
  const transacoes = useTransacoes();
  const recorrencias = useRecorrenciasFinanceiras();
  const turmas = useTurmas();

  const minhasTurmas = useMemo(
    () => {
      if (!aluno) return [];
      const turmasRelacionadas = new Set(getAlunoTurmas(aluno));
      return turmas.filter(
        (turma) => turma.alunoIds.includes(aluno.id) || turmasRelacionadas.has(turma.nome),
      );
    },
    [turmas, aluno],
  );

  const meusContratos = useMemo(
    () => (aluno ? contratos.filter((c) => c.alunoId === aluno.id) : []),
    [contratos, aluno],
  );
  const ativo = useMemo(
    () =>
      meusContratos.find((c) => c.status === "ativo") ??
      meusContratos.find((c) => c.status === "aguardando_assinatura") ??
      meusContratos[0] ??
      null,
    [meusContratos],
  );

  const proximasParcelas = useMemo(() => {
    if (!aluno) return [];
    const today = new Date().toISOString().slice(0, 10);
    return transacoes
      .filter((t) => t.alunoId === aluno.id && t.tipo === "mensalidade")
      .filter((t) => !t.pagoEm || t.vencimento >= today.slice(0, 7) + "-01")
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, 6);
  }, [transacoes, aluno]);

  const minhasTransacoes = useMemo(
    () => (aluno ? transacoes.filter((t) => t.alunoId === aluno.id) : []),
    [transacoes, aluno],
  );

  const historicoPagos = useMemo(
    () =>
      minhasTransacoes
        .filter((t) => t.pagoEm)
        .sort((a, b) => (b.pagoEm ?? "").localeCompare(a.pagoEm ?? "")),
    [minhasTransacoes],
  );

  const inadimplencia = useMemo(() => {
    const vencidas = minhasTransacoes.filter((t) => calcStatus(t) === "vencido");
    const total = vencidas.reduce((s, t) => s + getValorAtualizado(t), 0);
    return { vencidas, total };
  }, [minhasTransacoes]);

  const totalPago = useMemo(
    () => historicoPagos.reduce((s, t) => s + t.valor, 0),
    [historicoPagos],
  );

  const recorrenciaFinanceira = useMemo(
    () => (aluno ? recorrencias.find((item) => item.alunoId === aluno.id) ?? null : null),
    [recorrencias, aluno],
  );

  const formaLabel = (f?: string) => {
    switch (f) {
      case "pix":
        return "PIX";
      case "cartao":
        return "Cartão";
      case "dinheiro":
        return "Dinheiro";
      case "boleto":
        return "Boleto";
      default:
        return "—";
    }
  };

  if (!aluno) return null;
  const matricula = aluno.matricula;
  const modalidades = getAlunoModalidades(aluno);
  const turmasAluno = getAlunoTurmas(aluno);
  const unidadesAluno = getAlunoUnidades(aluno);
  const horariosAluno = getAlunoHorarios(aluno);
  const documentPendencies = getAlunoDocumentPendencies(matricula);
  const documentStatus = getAlunoDocumentStatus(matricula);
  const documentStatusLabel = getAlunoDocumentStatusLabel(documentStatus);
  const documentStatusTone =
    documentStatus === "documentacao_completa"
      ? "border-success/35 bg-success/10 text-success"
      : "border-amber-500/35 bg-amber-500/10 text-amber-200";
  const documents = [
    { label: "Foto de perfil", file: matricula?.documentos.fotoPerfilAluno },
    { label: "RG com CPF do aluno", file: matricula?.documentos.rgCpfAluno },
    { label: "RG com CPF do responsável", file: matricula?.documentos.rgCpfResponsavel },
    { label: "Comprovante de endereço", file: matricula?.documentos.comprovanteEndereco },
    { label: "Atestado médico", file: matricula?.documentos.atestadoMedico },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{aluno.nome}</DialogTitle>
          <DialogDescription>
            {formatAlunoScope(modalidades)} · {formatAlunoScope(turmasAluno)} · Planos{" "}
            {formatAlunoScope(getAlunoPlanos(aluno))}
          </DialogDescription>
        </DialogHeader>

        {/* Dados rápidos */}
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-6">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-muted-foreground">Nº matrícula</div>
            <div className="font-medium">{matricula?.dadosAluno.numeroMatricula || "—"}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-muted-foreground">E-mail</div>
            <div className="font-medium">{aluno.email}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-muted-foreground">Telefone</div>
            <div className="font-medium">{aluno.telefone}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-muted-foreground">Data da matrícula</div>
            <div className="font-medium">{fmtBRDate(aluno.matriculaEm)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-muted-foreground">Unidades</div>
            <div className="font-medium">{formatAlunoScope(unidadesAluno)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-muted-foreground">Planos</div>
            <div className="font-medium">{formatAlunoScope(getAlunoPlanos(aluno))}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-muted-foreground">Status documental</div>
            <div className="font-medium">{documentStatusLabel}</div>
          </div>
        </div>

        <div className={`rounded-xl border p-4 ${documentStatusTone}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{documentStatusLabel}</div>
              <div className="mt-1 text-xs opacity-90">
                {documentPendencies.length === 0
                  ? "Todos os documentos essenciais foram preenchidos e estão válidos."
                  : "Ainda existem documentos pendentes ou com validade expirada."}
              </div>
            </div>
            <Badge variant="outline" className="border-current/20 bg-transparent">
              {documentPendencies.length === 0
                ? "Cadastro completo"
                : `${documentPendencies.length} pendência(s)`}
            </Badge>
          </div>
          {documentPendencies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {documentPendencies.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-current/20 bg-black/10 px-3 py-1 text-[11px] font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ProfileSection title="Dados pessoais">
            <ProfileRow label="Nome completo" value={matricula?.dadosAluno.nomeCompleto || aluno.nome} />
            <ProfileRow label="Data de nascimento" value={fmtBRDate(matricula?.dadosAluno.dataNascimento || aluno.dataNascimento)} />
            <ProfileRow label="Idade" value={matricula?.dadosAluno.idade || "—"} />
            <ProfileRow label="CPF" value={matricula?.dadosAluno.cpf || "—"} />
            <ProfileRow label="RG" value={matricula?.dadosAluno.rg || "—"} />
            <ProfileRow label="Sexo" value={matricula?.dadosAluno.sexo || "—"} />
            <ProfileRow label="Colégio" value={matricula?.dadosAluno.colegio || "—"} />
            <ProfileRow label="Período escolar" value={matricula?.dadosAluno.periodoEscolar || "—"} />
          </ProfileSection>

          <ProfileSection title="Responsável">
            <ProfileRow label="Nome completo" value={matricula?.responsavel.nomeCompleto || aluno.responsavel || "—"} />
            <ProfileRow label="CPF" value={matricula?.responsavel.cpf || "—"} />
            <ProfileRow label="RG" value={matricula?.responsavel.rg || "—"} />
            <ProfileRow label="WhatsApp" value={matricula?.responsavel.whatsapp || aluno.telefoneResponsavel || "—"} />
            <ProfileRow label="E-mail" value={matricula?.responsavel.email || aluno.email} />
            <ProfileRow label="Parentesco" value={matricula?.responsavel.parentesco || "—"} />
          </ProfileSection>

          <ProfileSection title="Endereço">
            <ProfileRow label="CEP" value={matricula?.endereco.cep || "—"} />
            <ProfileRow label="Rua" value={matricula?.endereco.rua || "—"} />
            <ProfileRow label="Número" value={matricula?.endereco.numero || "—"} />
            <ProfileRow label="Complemento" value={matricula?.endereco.complemento || "—"} />
            <ProfileRow label="Bairro" value={matricula?.endereco.bairro || "—"} />
            <ProfileRow label="Cidade" value={matricula?.endereco.cidade || "—"} />
            <ProfileRow label="Estado" value={matricula?.endereco.estado || "—"} />
          </ProfileSection>

          <ProfileSection title="Informações esportivas">
            <ProfileRow label="Modalidades" value={formatAlunoScope(modalidades)} />
            <ProfileRow label="Unidades" value={formatAlunoScope(unidadesAluno)} />
            <ProfileRow label="Horários" value={formatAlunoScope(horariosAluno)} />
            <ProfileRow label="Turmas" value={formatAlunoScope(turmasAluno)} />
            <ProfileRow label="Nível" value={matricula?.esportivas.nivel || "—"} />
            <ProfileRow label="Já treinou antes?" value={matricula?.esportivas.treinouAntes || "—"} />
            <ProfileRow label="Característica" value={matricula?.esportivas.caracteristica || "—"} />
            <ProfileRow label="Objetivo" value={matricula?.esportivas.objetivo || "—"} />
          </ProfileSection>
        </div>

        <ProfileSection title="Documentos">
          {documents.map((document) => (
            <ProfileRow
              key={document.label}
              label={document.label}
              value={
                document.file?.name
                  ? `${document.file.name}${document.file.expiresAt ? ` · validade ${fmtBRDate(document.file.expiresAt)}` : ""}`
                  : "Pendente"
              }
            />
          ))}
        </ProfileSection>

        <ProfileSection title="Financeiro">
          <ProfileRow
            label="Plano vinculado"
            value={recorrenciaFinanceira?.planoNome || aluno.plano || "Sem plano financeiro"}
          />
          <ProfileRow
            label="Periodicidade"
            value={recorrenciaFinanceira?.periodicidade || "mensal"}
          />
          <ProfileRow
            label="Valor base"
            value={formatBRL(recorrenciaFinanceira?.valorPlano || proximasParcelas[0]?.valorOriginal || 0)}
          />
          <ProfileRow
            label="Dia de vencimento"
            value={recorrenciaFinanceira ? `Dia ${recorrenciaFinanceira.diaVencimento}` : "Nao definido"}
          />
          <ProfileRow
            label="Recorrencia"
            value={
              !recorrenciaFinanceira
                ? "Nao configurada"
                : recorrenciaFinanceira.recorrenciaAtiva
                  ? "Ativa"
                  : "Pausada"
            }
          />
          <ProfileRow
            label="Proxima cobranca"
            value={
              recorrenciaFinanceira?.proximaCobranca
                ? fmtBRDate(recorrenciaFinanceira.proximaCobranca)
                : "Sem previsao"
            }
          />
          <ProfileRow
            label="Desconto / bolsa"
            value={formatBRL((recorrenciaFinanceira?.descontoValor || 0) + (recorrenciaFinanceira?.bolsaValor || 0))}
          />
        </ProfileSection>

        {/* Indicador de inadimplência */}
        {inadimplencia.vencidas.length > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-destructive">
                Aluno inadimplente
              </div>
              <div className="text-xs text-destructive/80">
                {inadimplencia.vencidas.length} parcela(s) em atraso Â· Total devido:{" "}
                <span className="font-semibold">{formatBRL(inadimplencia.total)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-success">Em dia</div>
              <div className="text-xs text-success/80">
                Nenhuma parcela em atraso. Total pago:{" "}
                <span className="font-semibold">{formatBRL(totalPago)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Card de contrato */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Contrato</h3>
          {!ativo ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum contrato vinculado a este aluno.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">
                      {ativo.plano.tipo} — {ativo.plano.modalidades.join(" + ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Vigência: {fmtBRDate(ativo.dataInicio)} → {fmtBRDate(ativo.dataFim)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Unidade(s): {ativo.plano.unidades.join(", ")}
                    </div>
                  </div>
                </div>
                <Badge variant={statusVariant(ativo.status)}>{STATUS_LABEL[ativo.status]}</Badge>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Valor total</div>
                  <div className="font-semibold text-primary">{formatBRL(ativo.valorTotal)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Parcelas</div>
                  <div className="font-semibold">
                    {ativo.parcelas}× {formatBRL(ativo.valorMensal)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Venc.</div>
                  <div className="font-semibold">Dia {ativo.diaVencimento}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 text-xs">
                <span className={ativo.assinatura ? "text-success" : "text-muted-foreground"}>
                  {ativo.assinatura ? "✓ Responsável assinou" : "○ Aguardando responsável"}
                </span>
                <span className="text-muted-foreground">Â·</span>
                <span className={ativo.assinaturaJ12 ? "text-success" : "text-muted-foreground"}>
                  {ativo.assinaturaJ12 ? "✓ J12 assinou" : "○ Aguardando J12"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onAbrirContrato(ativo)}>
                  <Eye className="mr-2 h-4 w-4" /> Abrir contrato
                </Button>
                <Button size="sm" variant="outline" onClick={() => baixarContratoPDF(ativo)}>
                  <Download className="mr-2 h-4 w-4" /> Baixar PDF
                </Button>
              </div>
            </div>
          )}

          {meusContratos.length > 1 && (
            <div className="text-xs text-muted-foreground">
              + {meusContratos.length - 1} outro(s) contrato(s) no histÃ³rico.
            </div>
          )}
        </section>

        {/* Turmas matriculadas */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="h-4 w-4 text-primary" /> Turmas ({minhasTurmas.length})
          </h3>
          {minhasTurmas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Aluno não estÃ¡ matriculado em nenhuma turma.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {minhasTurmas.map((t) => {
                  const stats = statsPresencaAluno(t, aluno.id);
                  return (
                    <li key={t.id} className="px-4 py-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{t.nome}</span>
                            <Badge variant={t.ativa ? "default" : "outline"} className="text-[10px]">
                              {t.ativa ? "Ativa" : "Inativa"}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {t.modalidade} Â· {t.unidade} Â· {t.professor}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {formatDias(t.diasSemana)} Â· {t.horarioInicio}â€“{t.horarioFim}
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <div className="font-semibold text-primary">
                            {stats.total > 0 ? `${stats.taxa}%` : "—"}
                          </div>
                          <div className="text-muted-foreground">
                            {stats.total > 0 ? `${stats.presentes}/${stats.total} aulas` : "Sem registros"}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* PrÃ³ximas parcelas */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-primary" /> PrÃ³ximas parcelas
          </h3>
          {proximasParcelas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Sem parcelas pendentes.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {proximasParcelas.map((p) => {
                  const s = calcStatus(p);
                  const lbl = parcelaLabel(s);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        {parcelaIcon(s)}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.descricao}</div>
                          <div className="text-xs text-muted-foreground">
                            Vence em {fmtBRDate(p.vencimento)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatBRL(getValorAtualizado(p))}</div>
                        <div className={`text-xs ${lbl.cls}`}>{lbl.txt}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* HistÃ³rico de pagamentos */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-primary" /> HistÃ³rico de pagamentos
            </h3>
            {historicoPagos.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {historicoPagos.length} pagamento(s) Â· {formatBRL(totalPago)}
              </span>
            )}
          </div>
          {historicoPagos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum pagamento registrado ainda.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                {historicoPagos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.descricao}</div>
                        <div className="text-xs text-muted-foreground">
                          Pago em {fmtBRDate(p.pagoEm!)} Â· {formaLabel(p.formaPagamento)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-success">{formatBRL(getValorAtualizado(p))}</div>
                      <div className="text-xs text-muted-foreground">
                        Venc. {fmtBRDate(p.vencimento)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2 text-sm last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

