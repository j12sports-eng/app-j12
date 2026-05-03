import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  alunosStore,
  formatAlunoScope,
  getAlunoModalidades,
  getAlunoPlanos,
  getAlunoTurmas,
  getAlunoUnidades,
  type Aluno,
  type Modalidade,
  type StatusAluno,
} from "@/lib/alunos-store";
import { useModalidades } from "@/lib/modalidades-store";
import { formatDias, type DiaSemana, useTurmas } from "@/lib/turmas-store";
import { usePlanos, type Plano } from "@/lib/planos-store";
import { useResponsaveis } from "@/lib/responsaveis-store";
import { useSettingsState } from "@/lib/settings/settings-store";
import { useUnidades } from "@/lib/unidades-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  aluno?: Aluno | null;
}

type FormState = {
  nome: string;
  email: string;
  telefone: string;
  dataNascimento: string;
  responsavel: string;
  telefoneResponsavel: string;
  modalidade: Modalidade;
  turmas: string[];
  planos: string[];
  status: StatusAluno;
};

const emptyForm: FormState = {
  nome: "",
  email: "",
  telefone: "",
  dataNascimento: "",
  responsavel: "",
  telefoneResponsavel: "",
  modalidade: "" as Modalidade,
  turmas: [],
  planos: [],
  status: "ativo",
};

function normalizeComparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[·|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function splitComparableValues(value: string) {
  return uniqueValues(
    value
      .split(/[;,/|]/g)
      .map((item) => normalizeComparable(item))
      .filter(Boolean),
  );
}

function planoMatchesModalidade(plano: Plano, modalidadeSelecionada: string) {
  if (!modalidadeSelecionada) return true;

  const modalidadesDoPlano = uniqueValues(
    (Array.isArray(plano.modalidades) && plano.modalidades.length > 0
      ? plano.modalidades
      : [plano.modalidade || ""]
    ).map((modalidade) => String(modalidade ?? "")),
  );

  if (modalidadesDoPlano.length === 0) return true;

  return modalidadesDoPlano.some(
    (modalidade) => normalizeComparable(modalidade) === normalizeComparable(modalidadeSelecionada),
  );
}

function planoMatchesUnidade(plano: Plano, unidadeSelecionada: string) {
  if (!unidadeSelecionada) return true;
  if (!plano.unidade) return true;

  return normalizeComparable(plano.unidade) === normalizeComparable(unidadeSelecionada);
}

function planoMatchesHorarios(plano: Plano, horariosSelecionadosLabels: string[]) {
  if (horariosSelecionadosLabels.length === 0) return true;
  if (!plano.dias_horarios) return true;

  const normalizedPlano = normalizeComparable(plano.dias_horarios);
  if (!normalizedPlano) return true;

  const planoSegments = splitComparableValues(plano.dias_horarios);
  const selectedSegments = horariosSelecionadosLabels.flatMap((horario) =>
    splitComparableValues(horario),
  );

  return horariosSelecionadosLabels.some((horario) => {
    const normalizedHorario = normalizeComparable(horario);

    return (
      normalizedHorario.includes(normalizedPlano) ||
      normalizedPlano.includes(normalizedHorario) ||
      planoSegments.some((segmentoPlano) =>
        selectedSegments.some(
          (segmentoSelecionado) =>
            segmentoSelecionado.includes(segmentoPlano) ||
            segmentoPlano.includes(segmentoSelecionado),
        ),
      )
    );
  });
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function areStringArraysEqual(current: string[], next: string[]) {
  if (current === next) return true;
  if (current.length !== next.length) return false;
  return current.every((value, index) => value === next[index]);
}

function areFormStatesEqual(current: FormState, next: FormState) {
  return (
    current.nome === next.nome &&
    current.email === next.email &&
    current.telefone === next.telefone &&
    current.dataNascimento === next.dataNascimento &&
    current.responsavel === next.responsavel &&
    current.telefoneResponsavel === next.telefoneResponsavel &&
    current.modalidade === next.modalidade &&
    areStringArraysEqual(current.turmas, next.turmas) &&
    areStringArraysEqual(current.planos, next.planos) &&
    current.status === next.status
  );
}

function formatHorarioOptionLabel(turma: {
  nome: string;
  diasSemana: string[];
  horarioInicio: string;
  horarioFim: string;
  unidade: string;
}) {
  return `${formatDias(turma.diasSemana as DiaSemana[])} · ${turma.horarioInicio}-${turma.horarioFim}`;
}

function formatCurrency(value: string | number) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) return String(value);

  return numericValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function buildPlanoOptionLabel(plano: Plano) {
  return `${plano.nome} | ${plano.frequencia || "Mensal"} - ${formatCurrency(plano.valor)}`;
}

export function AlunoFormDialog({ open, onOpenChange, aluno }: Props) {
  const isEdit = !!aluno;
  const turmas = useTurmas();
  const planosCatalogo = usePlanos();
  const modalidadesCatalogo = useModalidades();
  const unidadesCatalogo = useUnidades();
  const responsaveisCatalogo = useResponsaveis();

  const settings = useSettingsState();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<Modalidade>("" as Modalidade);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState("");
  const [horariosSelecionados, setHorariosSelecionados] = useState<string[]>([]);
  const [planoSelecionado, setPlanoSelecionado] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cascadeLoading, setCascadeLoading] = useState(false);
  const [responsavelSelecionado, setResponsavelSelecionado] = useState("");

  const unidadeSelecionadaRef = useRef(unidadeSelecionada);
  const horariosSelecionadosRef = useRef(horariosSelecionados);
  const planoSelecionadoRef = useRef(planoSelecionado);

  const activeTurmas = useMemo(() => turmas.filter((turma) => turma.ativa), [turmas]);

  const availableModalidades = useMemo(() => {
    const values = [
      ...settings.modalities.filter((item) => item.ativa).map((item) => item.nome),
      ...activeTurmas.map((turma) => turma.modalidade),
    ];

    return uniqueValues(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [settings.modalities, activeTurmas]);

  const availableUnidades = useMemo(() => {
    if (!modalidadeSelecionada) return [];

    return uniqueValues(
      activeTurmas
        .filter(
          (turma) =>
            normalizeComparable(turma.modalidade) === normalizeComparable(modalidadeSelecionada),
        )
        .map((turma) => turma.unidade),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [activeTurmas, modalidadeSelecionada]);

  const availableHorarios = useMemo(() => {
    if (!modalidadeSelecionada || !unidadeSelecionada) return [];

    return activeTurmas.filter(
      (turma) =>
        normalizeComparable(turma.modalidade) === normalizeComparable(modalidadeSelecionada) &&
        normalizeComparable(turma.unidade) === normalizeComparable(unidadeSelecionada),
    );
  }, [activeTurmas, modalidadeSelecionada, unidadeSelecionada]);

  const selectedHorarioTurmas = useMemo(
    () => availableHorarios.filter((turma) => horariosSelecionados.includes(turma.id)),
    [availableHorarios, horariosSelecionados],
  );

  const horariosSelecionadosLabels = useMemo(
    () => selectedHorarioTurmas.map((turma) => formatHorarioOptionLabel(turma)),
    [selectedHorarioTurmas],
  );

  const availablePlanos = useMemo(() => {
    if (!modalidadeSelecionada) {
      return [];
    }

    return planosCatalogo
      .filter((plano) => plano.status === "ativo")
      .filter((plano) => planoMatchesModalidade(plano, modalidadeSelecionada))
      .filter((plano) => planoMatchesUnidade(plano, unidadeSelecionada))
      .filter((plano) => planoMatchesHorarios(plano, horariosSelecionadosLabels))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [horariosSelecionadosLabels, modalidadeSelecionada, planosCatalogo, unidadeSelecionada]);

  const unidadesSelecionadas = useMemo(
    () => (unidadeSelecionada ? [unidadeSelecionada] : []),
    [unidadeSelecionada],
  );

  unidadeSelecionadaRef.current = unidadeSelecionada;
  horariosSelecionadosRef.current = horariosSelecionados;
  planoSelecionadoRef.current = planoSelecionado;

  const clearCascadeSelections = useCallback(() => {
    setHorariosSelecionados((current) => (current.length === 0 ? current : []));
    setPlanoSelecionado((current) => (current ? "" : current));
  }, []);

  useEffect(() => {
    if (!open) return;

    if (aluno) {
      const modalidadesAluno = getAlunoModalidades(aluno);
      const unidadesAluno = getAlunoUnidades(aluno);
      const turmasAluno = getAlunoTurmas(aluno);
      const matchedTurmas = activeTurmas.filter((turma) => turmasAluno.includes(turma.nome));
      const planoAlunoNome = getAlunoPlanos(aluno)[0] ?? "";
      const planoAlunoId =
        aluno.financeiro?.planoId ??
        aluno.planoId ??
        aluno.plano_id ??
        planosCatalogo.find((plano) => plano.nome === planoAlunoNome)?.id ??
        "";

      const nextForm: FormState = {
        nome: aluno.nome,
        email: aluno.email,
        telefone: aluno.telefone,
        dataNascimento: aluno.dataNascimento,
        responsavel: aluno.responsavel ?? "",
        telefoneResponsavel: aluno.telefoneResponsavel ?? "",
        modalidade: (modalidadesAluno[0] ?? aluno.modalidade ?? "") as Modalidade,
        turmas: turmasAluno,
        planos: planoAlunoNome ? [planoAlunoNome] : [],
        status: aluno.status,
      };

      const matchedHorarioIds = matchedTurmas.map((turma) => turma.id);
      const nextModalidade = (modalidadesAluno[0] ?? aluno.modalidade ?? "") as Modalidade;
      const nextUnidade = unidadesAluno[0] ?? "";
      const responsavelExistente =
        responsaveisCatalogo.find(
          (item) =>
            normalizeComparable(item.nome) === normalizeComparable(aluno.responsavel ?? "") ||
            (item.telefone && item.telefone === (aluno.telefoneResponsavel ?? "")),
        ) ?? null;

      setForm((current) => (areFormStatesEqual(current, nextForm) ? current : nextForm));
      setModalidadeSelecionada((current) =>
        current === nextModalidade ? current : nextModalidade,
      );
      setUnidadeSelecionada((current) => (current === nextUnidade ? current : nextUnidade));
      setHorariosSelecionados((current) =>
        areStringArraysEqual(current, matchedHorarioIds) ? current : matchedHorarioIds,
      );
      setResponsavelSelecionado((current) =>
        current === String(responsavelExistente?.id ?? "")
          ? current
          : String(responsavelExistente?.id ?? ""),
      );
      setPlanoSelecionado((current) =>
        current === String(planoAlunoId || "") ? current : String(planoAlunoId || ""),
      );
    } else {
      setForm((current) => (areFormStatesEqual(current, emptyForm) ? current : emptyForm));
      setModalidadeSelecionada((current) => (current ? ("" as Modalidade) : current));
      setUnidadeSelecionada((current) => (current ? "" : current));
      setHorariosSelecionados((current) => (current.length === 0 ? current : []));
      setResponsavelSelecionado((current) => (current ? "" : current));
      setPlanoSelecionado((current) => (current ? "" : current));
    }

    setErrors((current) => (Object.keys(current).length === 0 ? current : {}));
  }, [open, aluno, activeTurmas, planosCatalogo, responsaveisCatalogo]);

  useEffect(() => {
    if (!open) return;

    setCascadeLoading(true);
    const timeoutId = window.setTimeout(() => setCascadeLoading(false), 120);

    return () => window.clearTimeout(timeoutId);
  }, [modalidadeSelecionada, unidadeSelecionada, horariosSelecionados, open]);

  useEffect(() => {
    const currentUnidade = unidadeSelecionadaRef.current;
    const currentHorarios = horariosSelecionadosRef.current;
    const currentPlano = planoSelecionadoRef.current;

    if (!modalidadeSelecionada) {
      if (currentUnidade) setUnidadeSelecionada("");
      if (currentHorarios.length > 0) setHorariosSelecionados([]);
      if (currentPlano) setPlanoSelecionado("");
      return;
    }

    if (currentUnidade && !availableUnidades.includes(currentUnidade)) {
      setUnidadeSelecionada("");
      clearCascadeSelections();
    }
  }, [modalidadeSelecionada, availableUnidades, clearCascadeSelections]);

  useEffect(() => {
    const currentHorarios = horariosSelecionadosRef.current;
    const currentPlano = planoSelecionadoRef.current;

    if (!unidadeSelecionada) {
      if (currentHorarios.length > 0 || currentPlano) {
        clearCascadeSelections();
      }
      return;
    }

    const availableIds = new Set(availableHorarios.map((turma) => turma.id));

    if (currentHorarios.some((id) => !availableIds.has(id))) {
      const nextHorarios = currentHorarios.filter((id) => availableIds.has(id));

      setHorariosSelecionados((current) =>
        areStringArraysEqual(current, nextHorarios) ? current : nextHorarios,
      );

      if (currentPlano) {
        setPlanoSelecionado("");
      }
    }
  }, [unidadeSelecionada, availableHorarios, clearCascadeSelections]);

  useEffect(() => {
    const currentPlano = planoSelecionadoRef.current;
    if (!currentPlano) return;

    if (!availablePlanos.some((plano) => String(plano.id) === currentPlano)) {
      setPlanoSelecionado("");
    }
  }, [availablePlanos]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function clearFieldError(field: string) {
    setErrors((current) => {
      if (!current[field]) return current;

      const next = { ...current };
      delete next[field];

      return next;
    });
  }

  function handleModalidadeChange(value: string) {
    setModalidadeSelecionada(value as Modalidade);
    setUnidadeSelecionada("");
    setHorariosSelecionados([]);
    setPlanoSelecionado("");
    setForm((current) => ({
      ...current,
      modalidade: value as Modalidade,
      turmas: [],
      planos: [],
    }));
    clearFieldError("modalidade");
    clearFieldError("unidade");
    clearFieldError("horarios");
    clearFieldError("plano");
  }

  function handleUnidadeChange(value: string) {
    setUnidadeSelecionada(value);
    setHorariosSelecionados([]);
    setPlanoSelecionado("");
    setForm((current) => ({ ...current, turmas: [], planos: [] }));
    clearFieldError("unidade");
    clearFieldError("horarios");
    clearFieldError("plano");
  }

  function toggleHorario(turmaId: string) {
    setHorariosSelecionados((current) =>
      current.includes(turmaId) ? current.filter((id) => id !== turmaId) : [...current, turmaId],
    );

    setPlanoSelecionado("");
    setForm((current) => ({ ...current, planos: [] }));
    clearFieldError("horarios");
    clearFieldError("plano");
  }

  function handlePlanoChange(value: string) {
    const plano = availablePlanos.find((item) => String(item.id) === value);
    setPlanoSelecionado(value);
    setForm((current) => ({ ...current, planos: plano ? [plano.nome] : [] }));
    clearFieldError("plano");
  }

  function validate() {
    const nextErrors: Record<string, string> = {};

    if (!form.nome.trim()) nextErrors.nome = "Informe o nome completo do aluno.";
    if (!form.email.trim()) nextErrors.email = "Informe o e-mail do aluno.";
    if (!form.telefone.trim()) nextErrors.telefone = "Informe o telefone do aluno.";
    if (!modalidadeSelecionada) nextErrors.modalidade = "Selecione uma modalidade.";

    if (modalidadeSelecionada && availableUnidades.length === 0) {
      nextErrors.unidade = "Nenhuma unidade disponível para a modalidade selecionada.";
    } else if (!unidadeSelecionada) {
      nextErrors.unidade = "Selecione uma unidade.";
    }

    if (unidadeSelecionada && availableHorarios.length === 0) {
      nextErrors.horarios = "Nenhum horário encontrado para a combinação atual.";
    } else if (horariosSelecionados.length === 0) {
      nextErrors.horarios = "Selecione pelo menos um dia/horário.";
    }

    if (horariosSelecionados.length > 0 && availablePlanos.length === 0) {
      nextErrors.plano = "Nenhum plano disponível para a seleção atual.";
    } else if (!planoSelecionado) {
      nextErrors.plano = "Selecione um plano.";
    }

    setErrors(nextErrors);

    return {
      ok: Object.keys(nextErrors).length === 0,
      errors: nextErrors,
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const validation = validate();

    if (!validation.ok) {
      const message =
        Object.values(validation.errors)[0] ?? "Revise os campos obrigatórios do cadastro.";
      toast.error(message);
      return;
    }

    const turmasSelecionadas = selectedHorarioTurmas.map((turma) => turma.nome);
    const planoEscolhido = availablePlanos.find(
      (plano) => String(plano.id) === String(planoSelecionado),
    );

    if (!planoEscolhido) {
      toast.error("Selecione um plano ativo e valido do catalogo oficial.");
      return;
    }

    const diasHorarios = horariosSelecionadosLabels;
    const turmaPrincipal = selectedHorarioTurmas[0] ?? null;
    const unidadeCatalogo = unidadesCatalogo.find(
      (item) =>
        normalizeComparable(item.nome) ===
        normalizeComparable(planoEscolhido.unidade || unidadeSelecionada),
    );
    const modalidadeCatalogo = modalidadesCatalogo.find(
      (item) => normalizeComparable(item.nome) === normalizeComparable(modalidadeSelecionada),
    );
    const responsavelCatalogo =
      responsaveisCatalogo.find((item) => String(item.id) === responsavelSelecionado) ?? null;

    const payload = {
      ...form,
      modalidade: modalidadeSelecionada,
      turmas: turmasSelecionadas,
      planos: [planoEscolhido.nome],
      unidades: unidadesSelecionadas,
      horarios: diasHorarios,
      turma: turmasSelecionadas[0],
      turmaId: turmaPrincipal?.id,
      turma_id: turmaPrincipal?.id,
      plano: planoEscolhido.nome,
      planoId: planoEscolhido.id,
      planoNome: planoEscolhido.nome,
      planoValor: planoEscolhido.valor,
      plano_id: planoEscolhido.id,
      plano_nome: planoEscolhido.nome,
      plano_valor: planoEscolhido.valor,
      modalidadeId: modalidadeCatalogo?.id,
      modalidade_id: modalidadeCatalogo?.id,
      unidadeId: unidadeCatalogo?.id,
      unidade_id: unidadeCatalogo?.id,
      responsavelId: responsavelCatalogo?.id,
      responsavel_id: responsavelCatalogo?.id,
      responsavelCpf: responsavelCatalogo?.cpf ?? "",
      responsavelEmail: responsavelCatalogo?.email || form.email,
      parentesco: responsavelCatalogo?.parentesco ?? "",
      unidade: planoEscolhido.unidade ?? unidadeSelecionada,
      dias_horarios: diasHorarios,
      financeiro: {
        ...(aluno?.financeiro ?? {}),
        planoId: planoEscolhido.id,
        planoNome: planoEscolhido.nome,
        valorPlano: planoEscolhido.valor,
        periodicidade: aluno?.financeiro?.periodicidade ?? "mensal",
        modalidade: planoEscolhido.modalidade ?? modalidadeSelecionada,
        unidade: planoEscolhido.unidade ?? unidadeSelecionada,
        diasHorarios,
      },
      matricula: aluno?.matricula
        ? {
            ...aluno.matricula,
            responsavel: {
              ...aluno.matricula.responsavel,
              id: responsavelCatalogo?.id,
              nomeCompleto: form.responsavel,
              whatsapp: form.telefoneResponsavel,
              email: responsavelCatalogo?.email || form.email,
              cpf: responsavelCatalogo?.cpf || aluno.matricula.responsavel.cpf,
              parentesco: responsavelCatalogo?.parentesco || aluno.matricula.responsavel.parentesco,
            },
            esportivas: {
              ...aluno.matricula.esportivas,
              modalidades: [modalidadeSelecionada],
              unidades: unidadesSelecionadas,
              turmas: turmasSelecionadas,
              horarios: diasHorarios,
            },
          }
        : undefined,
    };

    setSaving(true);

    try {
      if (isEdit && aluno) {
        alunosStore.update(aluno.id, payload);
        toast.success("Aluno atualizado com a nova lógica de vínculo.");
      } else {
        alunosStore.create(payload);
        toast.success("Aluno cadastrado com sucesso.");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar o aluno.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";
  const disabledCls =
    "w-full rounded-lg border border-input/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground";
  const labelCls = "mb-1 block text-xs font-medium text-muted-foreground";
  const cardCls =
    "rounded-xl border border-border bg-card/60 p-3 transition-colors hover:border-primary/40";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar aluno" : "Novo aluno"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados do aluno com vínculos esportivos guiados."
              : "Preencha os dados do aluno seguindo a ordem de seleção esportiva."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nome completo *</label>
              <input
                className={inputCls}
                value={form.nome}
                onChange={(e) => {
                  setField("nome", e.target.value);
                  clearFieldError("nome");
                }}
              />
              {errors.nome ? <p className="mt-1 text-xs text-destructive">{errors.nome}</p> : null}
            </div>

            <div>
              <label className={labelCls}>E-mail *</label>
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={(e) => {
                  setField("email", e.target.value);
                  clearFieldError("email");
                }}
              />
              {errors.email ? (
                <p className="mt-1 text-xs text-destructive">{errors.email}</p>
              ) : null}
            </div>

            <div>
              <label className={labelCls}>Telefone *</label>
              <input
                className={inputCls}
                value={form.telefone}
                onChange={(e) => {
                  setField("telefone", e.target.value);
                  clearFieldError("telefone");
                }}
                placeholder="(11) 9..."
              />
              {errors.telefone ? (
                <p className="mt-1 text-xs text-destructive">{errors.telefone}</p>
              ) : null}
            </div>

            <div>
              <label className={labelCls}>Data de nascimento</label>
              <input
                type="date"
                className={inputCls}
                value={form.dataNascimento}
                onChange={(e) => setField("dataNascimento", e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Status</label>
              <select
                className={inputCls}
                value={form.status}
                onChange={(e) => setField("status", e.target.value as StatusAluno)}
              >
                <option value="ativo">Ativo</option>
                <option value="experimental">Experimental</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>

            <div className="sm:col-span-2 mt-2 border-t border-border pt-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Responsável
              </div>
            </div>

            <div>
              <label className={labelCls}>Nome do responsável</label>
              <input
                className={inputCls}
                value={form.responsavel}
                onChange={(e) => setField("responsavel", e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>WhatsApp do responsável</label>
              <input
                className={inputCls}
                value={form.telefoneResponsavel}
                onChange={(e) => setField("telefoneResponsavel", e.target.value)}
                placeholder="(11) 9..."
              />
            </div>

            <div className="sm:col-span-2 mt-2 border-t border-border pt-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Vínculo esportivo
              </div>
            </div>

            <div>
              <label className={labelCls}>Modalidade *</label>
              <select
                className={inputCls}
                value={modalidadeSelecionada}
                onChange={(e) => handleModalidadeChange(e.target.value)}
              >
                <option value="">Selecione</option>
                {availableModalidades.map((modalidade) => (
                  <option key={modalidade} value={modalidade}>
                    {modalidade}
                  </option>
                ))}
              </select>
              {errors.modalidade ? (
                <p className="mt-1 text-xs text-destructive">{errors.modalidade}</p>
              ) : null}
            </div>

            <div>
              <label className={labelCls}>Unidade *</label>
              <select
                className={modalidadeSelecionada ? inputCls : disabledCls}
                value={unidadeSelecionada}
                onChange={(e) => handleUnidadeChange(e.target.value)}
                disabled={!modalidadeSelecionada}
              >
                <option value="">
                  {modalidadeSelecionada ? "Selecione" : "Escolha a modalidade primeiro"}
                </option>
                {availableUnidades.map((unidade) => (
                  <option key={unidade} value={unidade}>
                    {unidade}
                  </option>
                ))}
              </select>
              {!modalidadeSelecionada ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Unidade liberada após a seleção da modalidade.
                </p>
              ) : null}
              {modalidadeSelecionada && availableUnidades.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">Nenhuma unidade disponível.</p>
              ) : null}
              {errors.unidade ? (
                <p className="mt-1 text-xs text-destructive">{errors.unidade}</p>
              ) : null}
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Dias e horários *</label>
              <div className="min-h-11 rounded-lg border border-input bg-input/20 px-3 py-2 text-sm text-muted-foreground">
                {horariosSelecionadosLabels.length > 0
                  ? formatAlunoScope(horariosSelecionadosLabels)
                  : !unidadeSelecionada
                    ? "Escolha modalidade e unidade para liberar os horários"
                    : cascadeLoading
                      ? "Carregando horários disponíveis..."
                      : "Selecione os horários desejados"}
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {availableHorarios.map((turma) => {
                  const checked = horariosSelecionados.includes(turma.id);

                  return (
                    <label
                      key={turma.id}
                      className={`${cardCls} ${checked ? "border-primary bg-primary/10" : ""} ${
                        !unidadeSelecionada ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!unidadeSelecionada}
                          onChange={() => toggleHorario(turma.id)}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium">{turma.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatHorarioOptionLabel(turma)}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {turma.unidade} · {turma.professor}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {unidadeSelecionada && !cascadeLoading && availableHorarios.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Nenhum horário encontrado.</p>
              ) : null}
              {errors.horarios ? (
                <p className="mt-2 text-xs text-destructive">{errors.horarios}</p>
              ) : null}
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Plano *</label>
              <select
                className={modalidadeSelecionada && unidadeSelecionada ? inputCls : disabledCls}
                value={planoSelecionado}
                onChange={(e) => handlePlanoChange(e.target.value)}
                disabled={!modalidadeSelecionada || !unidadeSelecionada}
              >
                <option value="">
                  {horariosSelecionados.length > 0
                    ? "Selecione"
                    : "Escolha os dias e horários primeiro"}
                </option>
                {availablePlanos.map((plano) => (
                  <option key={plano.id} value={plano.id}>
                    {buildPlanoOptionLabel(plano)}
                  </option>
                ))}
              </select>

              <div className="mt-2 flex flex-wrap gap-2">
                {availablePlanos.map((plano) => (
                  <Badge
                    key={plano.id}
                    variant="outline"
                    className={
                      planoSelecionado === String(plano.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border"
                    }
                  >
                    {buildPlanoOptionLabel(plano)}
                  </Badge>
                ))}
              </div>

              {horariosSelecionados.length > 0 && availablePlanos.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Nenhum plano disponível.</p>
              ) : null}
              {errors.plano ? (
                <p className="mt-2 text-xs text-destructive">{errors.plano}</p>
              ) : null}
            </div>

            <div className="sm:col-span-2">
              <div className="rounded-xl border border-border bg-card/50 px-3 py-3 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">Fluxo guiado</div>
                <div className="mt-1">
                  Modalidade {modalidadeSelecionada || "—"} · Unidade {unidadeSelecionada || "—"} ·
                  Horários {horariosSelecionados.length} · Plano{" "}
                  {availablePlanos.find((plano) => String(plano.id) === planoSelecionado)?.nome ||
                    "—"}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground transition-all disabled:opacity-60"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </span>
              ) : isEdit ? (
                "Salvar alterações"
              ) : (
                "Cadastrar aluno"
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
