import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileImage,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  buildEmptyAlunoMatricula,
  calculateStudentAge,
  type AlunoMatriculaData,
  type AlunoUploadedDocument,
} from "@/lib/aluno-matricula";
import { useAuth } from "@/lib/auth";
import { branding } from "@/lib/branding";
import {
  createPublicEnrollment as createPublicEnrollmentRequest,
  getNextEnrollmentNumber,
  lookupCepAddress as lookupCepAddressRequest,
} from "@/lib/matricula-api";
import { useSettingsState } from "@/lib/settings/settings-store";
import { formatDias, useTurmas } from "@/lib/turmas-store";
import {
  usePublicModalidades,
  usePublicUnidades,
  usePublicTurmas,
} from "@/lib/public-catalog-hooks";

type FormState = AlunoMatriculaData;
type FieldErrors = Record<string, string>;

type StepDefinition = {
  title: string;
  description: string;
  fields: string[];
};

type HorarioOption = {
  turmaId: string;
  turmaNome: string;
  modalidade: string;
  unidade: string;
  horarioLabel: string;
  description: string;
};

// Mantém a associação visual entre os campos; o payload continua usando os arrays de esportivas.
type TrainingBlock = {
  id: number;
  modalidade: string;
  unidade: string;
  turmaId: string;
};

type UploadedDocumentField = keyof FormState["documentos"];

type AsyncStatus = "idle" | "loading" | "success" | "error";

function createTrainingBlock(id: number): TrainingBlock {
  return {
    id,
    modalidade: "",
    unidade: "",
    turmaId: "",
  };
}

const steps: StepDefinition[] = [
  {
    title: "Aluno",
    description: "Dados essenciais do aluno e escolha do treino.",
    fields: [
      "dadosAluno.nomeCompleto",
      "dadosAluno.dataNascimento",
      "dadosAluno.sexo",
      "esportivas.horarios",
    ],
  },
  {
    title: "Responsável",
    description: "Contato e identificação do responsável.",
    fields: [
      "responsavel.nomeCompleto",
      "responsavel.cpf",
      "responsavel.whatsapp",
      "responsavel.parentesco",
    ],
  },
  {
    title: "Adicionais",
    description: "Informações opcionais que também podem ser completadas depois.",
    fields: [],
  },
  {
    title: "Revisão",
    description: "Confira os dados principais antes de concluir.",
    fields: [],
  },
];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function maskCpf(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function maskRg(value: string) {
  const clean = value
    .toUpperCase()
    .replace(/[^0-9X]/g, "")
    .slice(0, 9);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 2)}.${clean.slice(2)}`;
  if (clean.length <= 8) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}-${clean.slice(8)}`;
}

function maskCep(value: string) {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function maskWhatsapp(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function toUploadedDocument(
  file: File | null,
  current: AlunoUploadedDocument | null,
): AlunoUploadedDocument | null {
  if (!file) return null;

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    uploadedAt: new Date().toISOString(),
    expiresAt: current?.expiresAt ?? null,
  };
}

function validateMatriculaForm(form: FormState, hasAvailableTurmas: boolean): FieldErrors {
  const errors: FieldErrors = {};

  const requireText = (path: string, value: string, message: string) => {
    if (!value.trim()) errors[path] = message;
  };

  requireText(
    "dadosAluno.nomeCompleto",
    form.dadosAluno.nomeCompleto,
    "Informe o nome completo do aluno.",
  );
  requireText(
    "dadosAluno.dataNascimento",
    form.dadosAluno.dataNascimento,
    "Informe a data de nascimento.",
  );
  requireText("dadosAluno.sexo", form.dadosAluno.sexo, "Selecione o sexo.");

  if (form.dadosAluno.dataNascimento && !form.dadosAluno.idade) {
    errors["dadosAluno.dataNascimento"] = "Informe uma data de nascimento válida.";
  }

  if (hasAvailableTurmas && form.esportivas.turmas.length === 0) {
    errors["esportivas.horarios"] = "Selecione a categoria/turma.";
  }

  requireText(
    "responsavel.nomeCompleto",
    form.responsavel.nomeCompleto,
    "Informe o nome completo do responsável.",
  );
  requireText("responsavel.cpf", form.responsavel.cpf, "Informe o CPF do responsável.");
  requireText("responsavel.whatsapp", form.responsavel.whatsapp, "Informe o telefone principal.");
  requireText(
    "responsavel.parentesco",
    form.responsavel.parentesco,
    "Selecione o grau de parentesco.",
  );

  if (form.responsavel.cpf && digitsOnly(form.responsavel.cpf).length !== 11) {
    errors["responsavel.cpf"] = "Digite um CPF válido com 11 números.";
  }
  if (form.responsavel.whatsapp && digitsOnly(form.responsavel.whatsapp).length < 10) {
    errors["responsavel.whatsapp"] = "Digite um telefone válido com DDD.";
  }

  return errors;
}

export const Route = createFileRoute("/matricula")({
  component: MatriculaPage,
});

function MatriculaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const settings = useSettingsState();
  const turmas = useTurmas();

  // ===== NOVOS HOOKS PÚBLICOS =====
  const publicModalidades = usePublicModalidades();
  const publicUnidades = usePublicUnidades();
  const publicTurmas = usePublicTurmas();

  // Estados de carregamento
  const isLoadingCatalog =
    publicModalidades.isPending || publicUnidades.isPending || publicTurmas.isPending;
  const catalogError = publicModalidades.error || publicUnidades.error || publicTurmas.error;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => buildEmptyAlunoMatricula());
  const [trainingBlocks, setTrainingBlocks] = useState<TrainingBlock[]>(() => [
    createTrainingBlock(0),
  ]);
  const nextTrainingBlockIdRef = useRef(1);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [protocol, setProtocol] = useState("");
  const [success, setSuccess] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [assignedEnrollmentNumber, setAssignedEnrollmentNumber] = useState("");
  const [enrollmentNumberStatus, setEnrollmentNumberStatus] = useState<AsyncStatus>("idle");
  const [, setEnrollmentNumberMessage] = useState("");
  const [cepLookupStatus, setCepLookupStatus] = useState<AsyncStatus>("idle");
  const [cepLookupMessage, setCepLookupMessage] = useState("");
  const lastFetchedCepRef = useRef("");
  const catalogErrorNotifiedRef = useRef(false);

  // ===== DADOS CONSOLIDADOS =====
  // Usa dados públicos com fallback para settings/turmas
  const consolidatedModalidades = useMemo(() => {
    const publicData = publicModalidades.data || [];
    const settingsData = settings.modalities || [];

    // Log de debug
    if (publicData.length > 0 || settingsData.length > 0) {
      console.log("[MATRICULA] Modalidades consolidadas:", {
        public: publicData.length,
        settings: settingsData.length,
        total: [...publicData, ...settingsData].length,
      });
    }

    // Combina e remove duplicatas por nome
    const all = [...publicData, ...settingsData];
    const byName = new Map();
    all.forEach((item) => {
      const nome = item.nome || ("name" in item ? item.name : undefined);
      if (nome && !byName.has(nome)) {
        byName.set(nome, item);
      }
    });

    return Array.from(byName.values()).filter((item) => item.ativa !== false);
  }, [publicModalidades.data, settings.modalities]);

  const consolidatedUnidades = useMemo(() => {
    const publicData = publicUnidades.data || [];
    const settingsData = settings.units || [];

    if (publicData.length > 0 || settingsData.length > 0) {
      console.log("[MATRICULA] Unidades consolidadas:", {
        public: publicData.length,
        settings: settingsData.length,
        total: [...publicData, ...settingsData].length,
      });
    }

    const all = [...publicData, ...settingsData];
    const byName = new Map();
    all.forEach((item) => {
      const nome = item.nome || ("name" in item ? item.name : undefined);
      if (nome && !byName.has(nome)) {
        byName.set(nome, item);
      }
    });

    return Array.from(byName.values()).filter((item) => item.ativa !== false);
  }, [publicUnidades.data, settings.units]);

  const consolidatedTurmas = useMemo(() => {
    const publicData = publicTurmas.data || [];
    const localData = turmas || [];

    if (publicData.length > 0 || localData.length > 0) {
      console.log("[MATRICULA] Turmas consolidadas:", {
        public: publicData.length,
        local: localData.length,
        total: [...publicData, ...localData].length,
      });
    }

    const all = [...publicData, ...localData];
    const byId = new Map();
    all.forEach((item) => {
      const id = item.id || item.nome;
      if (id && !byId.has(id)) {
        byId.set(id, item);
      }
    });

    return Array.from(byId.values()).filter((item) => item.ativa !== false);
  }, [publicTurmas.data, turmas]);

  const modalityOptions = useMemo(
    () => uniqueValues([...consolidatedModalidades.map((item) => item.nome)]),
    [consolidatedModalidades],
  );

  const unitOptions = useMemo(
    () => uniqueValues([...consolidatedUnidades.map((unit) => unit.nome)]),
    [consolidatedUnidades],
  );

  const horarioOptions = useMemo<HorarioOption[]>(() => {
    const filtered = consolidatedTurmas.filter((turma) => turma.ativa !== false);
    return filtered.map((turma) => {
      const diasSemana = turma.diasSemana || [];
      const horarioInicio = turma.horarioInicio || "00:00";
      const horarioFim = turma.horarioFim || "23:59";
      const professor = turma.professor || "Professor não informado";
      const unidade = turma.unidade || "Unidade não informada";
      const modalidade = turma.modalidade || "Modalidade não informada";

      return {
        turmaId: turma.id,
        turmaNome: turma.nome,
        modalidade,
        unidade,
        horarioLabel: `${horarioInicio} - ${horarioFim}`,
        description: `${formatDias(diasSemana)} · ${unidade} · ${professor}`,
      };
    });
  }, [consolidatedTurmas]);

  const hasAvailableTurmas = horarioOptions.length > 0;

  useEffect(() => {
    if (!catalogError) {
      catalogErrorNotifiedRef.current = false;
      return;
    }

    if (!catalogErrorNotifiedRef.current) {
      toast.error("Erro ao carregar categorias.");
      catalogErrorNotifiedRef.current = true;
    }
  }, [catalogError]);

  useEffect(() => {
    console.log("Categorias carregadas:", horarioOptions);
  }, [horarioOptions]);

  // DEBUG LOGS - Remover após verificar
  useEffect(() => {
    console.log("[MATRICULA DEBUG]");
    console.log("isLoadingCatalog:", isLoadingCatalog);
    console.log("catalogError:", catalogError);
    console.log("Settings:", settings);
    console.log("Turmas:", turmas);
    console.log("Consolidated Modalidades:", consolidatedModalidades);
    console.log("Consolidated Unidades:", consolidatedUnidades);
    console.log("Consolidated Turmas:", consolidatedTurmas);
    console.log("Modalidades (options):", modalityOptions);
    console.log("Unidades (options):", unitOptions);
    console.log("Horários (options):", horarioOptions);
  }, [
    settings,
    turmas,
    consolidatedModalidades,
    consolidatedUnidades,
    consolidatedTurmas,
    modalityOptions,
    unitOptions,
    horarioOptions,
    isLoadingCatalog,
    catalogError,
  ]);

  const allErrors = useMemo(() => {
    const errors = validateMatriculaForm(form, hasAvailableTurmas);
    const hasIncompleteTraining =
      hasAvailableTurmas &&
      trainingBlocks.some(
        (training) => !training.modalidade || !training.unidade || !training.turmaId,
      );

    if (hasIncompleteTraining) {
      errors["esportivas.horarios"] =
        trainingBlocks.length > 1
          ? "Complete todos os blocos de treino."
          : "Selecione modalidade, unidade e categoria/turma.";
    }

    return errors;
  }, [form, hasAvailableTurmas, trainingBlocks]);
  const progress = ((step + 1) / steps.length) * 100;

  useEffect(() => {
    const nextAge = calculateStudentAge(form.dadosAluno.dataNascimento);
    if (nextAge === form.dadosAluno.idade) return;

    setForm((current) => ({
      ...current,
      dadosAluno: {
        ...current.dadosAluno,
        idade: nextAge,
      },
    }));
  }, [form.dadosAluno.dataNascimento, form.dadosAluno.idade]);

  const loadEnrollmentNumber = useEffectEvent(async (force = false) => {
    if (!force && form.dadosAluno.numeroMatricula) return;

    setEnrollmentNumberStatus("loading");
    setEnrollmentNumberMessage("Gerando o prÃ³ximo nÃºmero de matrÃ­cula disponÃ­vel...");

    try {
      const result = await getNextEnrollmentNumber();

      setForm((current) => ({
        ...current,
        dadosAluno: {
          ...current.dadosAluno,
          numeroMatricula: result.numeroMatricula,
        },
      }));
      setAssignedEnrollmentNumber(result.numeroMatricula);
      setEnrollmentNumberStatus("success");
      setEnrollmentNumberMessage(
        result.strategy === "reused"
          ? `NÃºmero automÃ¡tico reutilizado com seguranÃ§a a partir de matrÃ­cula ${result.reusedFrom === "inativo" ? "inativa" : "excluÃ­da"}.`
          : "NÃºmero automÃ¡tico pronto. O backend confirma o valor final no salvamento para evitar conflitos.",
      );
    } catch (error) {
      setEnrollmentNumberStatus("error");
      setEnrollmentNumberMessage(
        error instanceof Error
          ? error.message
          : "NÃ£o foi possÃ­vel gerar a matrÃ­cula agora. O backend confirmarÃ¡ no salvamento.",
      );
    }
  });

  useEffect(() => {
    void loadEnrollmentNumber();
  }, [loadEnrollmentNumber]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    const cep = digitsOnly(form.endereco.cep);

    if (cep.length !== 8) {
      lastFetchedCepRef.current = "";
      setCepLookupStatus("idle");
      setCepLookupMessage("");
      return;
    }

    if (lastFetchedCepRef.current === cep) return;

    const timeoutId = window.setTimeout(() => {
      void lookupCepAddress(cep);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [form.endereco.cep]);

  function markTouched(fields: string[]) {
    if (fields.length === 0) return;

    setTouched((current) => {
      const next = { ...current };
      fields.forEach((field) => {
        next[field] = true;
      });
      return next;
    });
  }

  function getFieldError(field: string) {
    return touched[field] ? allErrors[field] : "";
  }

  async function loadEnrollmentNumberLegacy(force = false) {
    if (!force && form.dadosAluno.numeroMatricula) return;

    setEnrollmentNumberStatus("loading");
    setEnrollmentNumberMessage("Gerando o próximo número de matrícula disponível...");

    try {
      const result = await getNextEnrollmentNumber();

      setForm((current) => ({
        ...current,
        dadosAluno: {
          ...current.dadosAluno,
          numeroMatricula: result.numeroMatricula,
        },
      }));
      setAssignedEnrollmentNumber(result.numeroMatricula);
      setEnrollmentNumberStatus("success");
      setEnrollmentNumberMessage(
        result.strategy === "reused"
          ? `Número automático reutilizado com segurança a partir de matrícula ${result.reusedFrom === "inativo" ? "inativa" : "excluída"}.`
          : "Número automático pronto. O backend confirma o valor final no salvamento para evitar conflitos.",
      );
    } catch (error) {
      setEnrollmentNumberStatus("error");
      setEnrollmentNumberMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar a matrícula agora. O backend confirmará no salvamento.",
      );
    }
  }

  async function lookupCepAddress(cep: string) {
    const normalizedCep = digitsOnly(cep);
    if (normalizedCep.length !== 8) return;

    setCepLookupStatus("loading");
    setCepLookupMessage("Buscando endereço automaticamente pelo CEP...");

    try {
      const result = await lookupCepAddressRequest(normalizedCep);
      lastFetchedCepRef.current = normalizedCep;
      setForm((current) => ({
        ...current,
        endereco: {
          ...current.endereco,
          cep: maskCep(result.cep),
          rua: result.rua,
          bairro: result.bairro,
          cidade: result.cidade,
          estado: result.estado,
        },
      }));
      setCepLookupStatus("success");
      setCepLookupMessage("Endereço preenchido automaticamente. Confira o número e o complemento.");
    } catch (error) {
      lastFetchedCepRef.current = normalizedCep;
      setCepLookupStatus("error");
      setCepLookupMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível localizar esse CEP. Você pode preencher o endereço manualmente.",
      );
    }
  }

  function updateSection<K extends keyof FormState>(
    section: K,
    partial: Partial<FormState[K]>,
    fieldsToTouch: string[] = [],
  ) {
    setForm((current) => ({
      ...current,
      [section]: { ...current[section], ...partial },
    }));
    markTouched(fieldsToTouch);
  }

  function syncTrainingBlocks(nextBlocks: TrainingBlock[], shouldTouch = true) {
    const selectedOptions = nextBlocks
      .map((training) =>
        horarioOptions.find(
          (option) =>
            option.turmaId === training.turmaId &&
            option.modalidade === training.modalidade &&
            option.unidade === training.unidade,
        ),
      )
      .filter((option): option is HorarioOption => Boolean(option));

    setTrainingBlocks(nextBlocks);
    setForm((current) => ({
      ...current,
      esportivas: {
        ...current.esportivas,
        modalidades: uniqueValues(nextBlocks.map((training) => training.modalidade)),
        unidades: uniqueValues(nextBlocks.map((training) => training.unidade)),
        turmas: uniqueValues(selectedOptions.map((option) => option.turmaNome)),
        horarios: uniqueValues(selectedOptions.map((option) => option.horarioLabel)),
      },
    }));
    if (shouldTouch) {
      markTouched(["esportivas.modalidades", "esportivas.unidades", "esportivas.horarios"]);
    }
  }

  function updateTrainingBlock(
    blockId: number,
    field: "modalidade" | "unidade" | "turmaId",
    value: string,
  ) {
    let duplicateSelection = false;
    const nextBlocks = trainingBlocks.map((training) => {
      if (training.id !== blockId) return training;

      if (field === "modalidade") {
        const availableUnits = new Set(
          horarioOptions
            .filter((option) => option.modalidade === value)
            .map((option) => option.unidade),
        );

        return {
          ...training,
          modalidade: value,
          unidade: availableUnits.has(training.unidade) ? training.unidade : "",
          turmaId: "",
        };
      }

      if (field === "unidade") {
        return {
          ...training,
          unidade: value,
          turmaId: "",
        };
      }

      const option = horarioOptions.find((candidate) => candidate.turmaId === value);
      if (!option) {
        return {
          ...training,
          turmaId: "",
        };
      }

      duplicateSelection = trainingBlocks.some(
        (candidate) =>
          candidate.id !== blockId &&
          candidate.modalidade === option.modalidade &&
          candidate.unidade === option.unidade &&
          candidate.turmaId === option.turmaId,
      );

      if (duplicateSelection) return training;

      return {
        ...training,
        modalidade: option.modalidade,
        unidade: option.unidade,
        turmaId: option.turmaId,
      };
    });

    if (duplicateSelection) {
      toast.error("Essa combinação de modalidade, unidade e turma já foi adicionada.");
      return;
    }

    syncTrainingBlocks(nextBlocks);
  }

  function addTrainingBlock() {
    const hasIncompleteTraining = trainingBlocks.some(
      (training) => !training.modalidade || !training.unidade || !training.turmaId,
    );

    if (hasIncompleteTraining) {
      markTouched(["esportivas.horarios"]);
      toast.error("Complete o treino atual antes de adicionar outro.");
      return;
    }

    const nextId = nextTrainingBlockIdRef.current;
    nextTrainingBlockIdRef.current += 1;
    syncTrainingBlocks([...trainingBlocks, createTrainingBlock(nextId)], false);
    setTouched((current) => ({
      ...current,
      "esportivas.horarios": false,
    }));
  }

  function removeTrainingBlock(blockId: number) {
    if (trainingBlocks.length === 1) return;
    syncTrainingBlocks(trainingBlocks.filter((training) => training.id !== blockId));
  }

  function handlePhotoChange(file: File | null) {
    setForm((current) => ({
      ...current,
      documentos: {
        ...current.documentos,
        fotoPerfilAluno: toUploadedDocument(file, current.documentos.fotoPerfilAluno),
      },
    }));

    setPhotoPreview((currentPreview) => {
      if (currentPreview) URL.revokeObjectURL(currentPreview);
      return file ? URL.createObjectURL(file) : "";
    });

    markTouched(["documentos.fotoPerfilAluno"]);
  }

  function handleDocumentChange(field: UploadedDocumentField, file: File | null) {
    setForm((current) => ({
      ...current,
      documentos: {
        ...current.documentos,
        [field]: toUploadedDocument(file, current.documentos[field]),
      },
    }));

    if (field === "atestadoMedico") {
      markTouched(["documentos.atestadoMedico"]);
      return;
    }

    markTouched([`documentos.${field}`]);
  }

  function updateMedicalExpiry(value: string) {
    setForm((current) => ({
      ...current,
      documentos: {
        ...current.documentos,
        atestadoMedico: current.documentos.atestadoMedico
          ? { ...current.documentos.atestadoMedico, expiresAt: value || null }
          : null,
      },
    }));
    markTouched(["documentos.atestadoMedico"]);
  }

  function goNext() {
    if (step === 0 && isLoadingCatalog) {
      toast.info("Aguarde carregar categorias.");
      return;
    }

    const fields = steps[step].fields;
    markTouched(fields);

    const messages = uniqueValues(
      fields
        .map((field) => allErrors[field])
        .filter((message): message is string => Boolean(message)),
    );

    if (messages.length > 0) {
      toast.error(messages[0]);
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function resetForm() {
    setForm(buildEmptyAlunoMatricula());
    setTrainingBlocks([createTrainingBlock(0)]);
    nextTrainingBlockIdRef.current = 1;
    setTouched({});
    setStep(0);
    setProtocol("");
    setSuccess(false);
    setAssignedEnrollmentNumber("");
    setEnrollmentNumberStatus("idle");
    setEnrollmentNumberMessage("");
    setCepLookupStatus("idle");
    setCepLookupMessage("");
    lastFetchedCepRef.current = "";
    setPhotoPreview((currentPreview) => {
      if (currentPreview) URL.revokeObjectURL(currentPreview);
      return "";
    });
    void loadEnrollmentNumber(true);
  }

  async function handleSubmit() {
    markTouched(steps.flatMap((item) => item.fields));

    const messages = uniqueValues(Object.values(allErrors).filter(Boolean));
    if (messages.length > 0) {
      toast.error(messages[0]);
      const firstInvalidStep = steps.findIndex((item) =>
        item.fields.some((field) => Boolean(allErrors[field])),
      );
      if (firstInvalidStep >= 0) setStep(firstInvalidStep);
      return;
    }

    setSubmitting(true);
    try {
      const enrollmentPayload = {
        dadosAluno: { ...form.dadosAluno },
        responsavel: { ...form.responsavel },
        endereco: { ...form.endereco },
        documentos: { ...form.documentos },
        esportivas: { ...form.esportivas },
        saude: { ...form.saude },
        estrategicas: { ...form.estrategicas },
        submittedAt: new Date().toISOString(),
      };

      const result = await createPublicEnrollmentRequest(enrollmentPayload);

      setAssignedEnrollmentNumber(result.numeroMatricula);
      setForm((current) => ({
        ...current,
        dadosAluno: {
          ...current.dadosAluno,
          numeroMatricula: result.numeroMatricula,
        },
      }));
      setProtocol(result.protocol);
      setSuccess(true);
      toast.success("Matrícula enviada com sucesso!");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a matrícula. Tente novamente em instantes.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
          <div className="mb-6 rounded-full border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-300">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-black">Matrícula registrada</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            Recebemos a matrícula e geramos o protocolo{" "}
            <strong className="text-white">{protocol}</strong> com o número{" "}
            <strong className="text-white">
              {assignedEnrollmentNumber || form.dadosAluno.numeroMatricula}
            </strong>
            . O cadastro já está pronto para seguir com validação documental e acompanhamento
            operacional no App J12.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-[#ff6b00]/35 bg-[#ff6b00]/12 px-5 text-sm font-semibold text-[#ffb07e] transition hover:bg-[#ff6b00]/18"
            >
              Nova matrícula
            </button>
            {user ? (
              <button
                type="button"
                onClick={() => navigate({ to: "/alunos" })}
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/80 transition hover:border-[#ff6b00]/35 hover:text-white"
              >
                Ir para alunos
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/80 transition hover:border-[#ff6b00]/35 hover:text-white"
              >
                Ir para login
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,107,0,0.18),_transparent_34%),linear-gradient(180deg,_rgba(12,12,12,0.98),_#050505)]" />
      <div className="relative mx-auto w-full max-w-[760px] px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/45 shadow-[0_0_30px_-14px_rgba(255,107,0,0.85)]">
              <img
                src={branding.logo}
                alt={`Logo ${branding.name}`}
                className="h-8 w-8 object-contain"
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ff9f6b]">
                J12 Sports
              </div>
              <h1 className="text-lg font-bold sm:text-xl">Nova matrícula</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: user ? "/alunos" : "/login" })}
            aria-label={user ? "Voltar para alunos" : "Voltar ao login"}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 text-sm font-medium text-white/75 transition hover:border-[#ff6b00]/35 hover:text-white sm:px-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{user ? "Alunos" : "Login"}</span>
          </button>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:p-6">
          <div className="mb-6 md:hidden">
            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-white">
                Etapa {step + 1} de {steps.length} — {steps[step].title}
              </span>
              <span className="text-xs text-white/45">{Math.round(progress)}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              aria-label="Progresso da matrícula"
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#ff6b00,#ff9248)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <nav aria-label="Etapas da matrícula" className="mb-7 hidden md:block">
            <ol className="grid grid-cols-4 gap-2">
              {steps.map((item, index) => {
                const active = index === step;
                const complete = index < step;

                return (
                  <li key={item.title}>
                    <button
                      type="button"
                      onClick={() => {
                        if (index <= step) setStep(index);
                      }}
                      disabled={index > step}
                      aria-current={active ? "step" : undefined}
                      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-2 text-sm font-medium transition ${
                        active
                          ? "border-[#ff6b00]/55 bg-[#ff6b00]/12 text-white"
                          : complete
                            ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-200"
                            : "border-white/8 bg-white/[0.02] text-white/40"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          active
                            ? "bg-[#ff6b00] text-white"
                            : complete
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-white/8 text-white/45"
                        }`}
                      >
                        {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span>{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ff9f6b]">
              Etapa {step + 1}
            </p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">{steps[step].title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">{steps[step].description}</p>
          </div>

          {isLoadingCatalog && step === 0 && (
            <div className="mb-5 flex items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/8 px-4 py-3 text-sm text-blue-100">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Carregando categorias e turmas...</span>
            </div>
          )}

          {catalogError && step === 0 && (
            <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-100">
              <AlertCircle className="h-4 w-4" />
              <span>Não foi possível atualizar as categorias. Tentando novamente...</span>
            </div>
          )}

          <div className="space-y-6">
            {step === 0 && (
              <>
                <StepStudent
                  form={form}
                  updateSection={updateSection}
                  getFieldError={getFieldError}
                  enrollmentNumberStatus={enrollmentNumberStatus}
                  retryEnrollmentNumber={() => void loadEnrollmentNumberLegacy(true)}
                />
                <StepClassSelection
                  trainingBlocks={trainingBlocks}
                  modalityOptions={modalityOptions}
                  unitOptions={unitOptions}
                  hasAnyTurma={hasAvailableTurmas}
                  horarioOptions={horarioOptions}
                  updateTrainingBlock={updateTrainingBlock}
                  addTrainingBlock={addTrainingBlock}
                  removeTrainingBlock={removeTrainingBlock}
                  getFieldError={getFieldError}
                  isLoading={isLoadingCatalog}
                />
              </>
            )}
            {step === 1 && (
              <StepGuardian
                form={form}
                updateSection={updateSection}
                getFieldError={getFieldError}
              />
            )}
            {step === 2 && (
              <StepComplementary
                form={form}
                updateSection={updateSection}
                getFieldError={getFieldError}
                cepLookupStatus={cepLookupStatus}
                cepLookupMessage={cepLookupMessage}
                photoPreview={photoPreview}
                handlePhotoChange={handlePhotoChange}
                handleDocumentChange={handleDocumentChange}
                updateMedicalExpiry={updateMedicalExpiry}
              />
            )}
            {step === 3 && (
              <StepReview
                form={form}
                trainingBlocks={trainingBlocks}
                horarioOptions={horarioOptions}
              />
            )}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-5 text-sm font-medium text-white/80 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>

            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={step === 0 && isLoadingCatalog}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                style={{ background: "linear-gradient(135deg,#ff6b00,#ff8f47)" }}
              >
                {step === 0 && isLoadingCatalog ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando categorias...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 sm:w-auto"
                style={{ background: "linear-gradient(135deg,#ff6b00,#ff8f47)" }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando matrícula...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Concluir matrícula
                  </>
                )}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  disabled,
  readOnly,
  required,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  helper?: string;
}) {
  const isOptional = !required && !disabled && !readOnly;
  const helpText = isOptional
    ? helper?.toLowerCase().includes("opcional")
      ? helper
      : helper
        ? `Opcional. ${helper}`
        : "Opcional"
    : helper || "";

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-white/88">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={Boolean(error)}
        className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none transition ${
          disabled
            ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/45"
            : readOnly
              ? "border-white/10 bg-white/[0.03] text-white"
              : error
                ? "border-rose-500/70 bg-rose-500/10 text-white focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10"
                : "border-white/10 bg-[#101010] text-white focus:border-[#ff6b00] focus:ring-4 focus:ring-[#ff6b00]/15"
        }`}
      />
      {helpText ? <p className="text-xs text-white/40">{helpText}</p> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  error?: string;
  required?: boolean;
}) {
  const helpText = !required ? "Opcional" : "";

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-white/88">
        {label}
        {required ? " *" : ""}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none transition ${
          error
            ? "border-rose-500/70 bg-rose-500/10 text-white focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10"
            : "border-white/10 bg-[#101010] text-white focus:border-[#ff6b00] focus:ring-4 focus:ring-[#ff6b00]/15"
        }`}
      >
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {helpText ? <p className="text-xs text-white/40">{helpText}</p> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
}) {
  const helpText = !required ? "Opcional" : "";

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-white/88">
        {label}
        {required ? " *" : ""}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
          error
            ? "border-rose-500/70 bg-rose-500/10 text-white focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10"
            : "border-white/10 bg-white/[0.03] text-white focus:border-[#ff6b00] focus:ring-4 focus:ring-[#ff6b00]/15"
        }`}
      />
      {helpText ? <p className="text-xs text-white/40">{helpText}</p> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </label>
  );
}

function FileField({
  label,
  helper,
  file,
  error,
  accept,
  onChange,
}: {
  label: string;
  helper?: string;
  file: AlunoUploadedDocument | null;
  error?: string;
  accept?: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label
      className={`block rounded-3xl border p-4 transition ${error ? "border-rose-500/60 bg-rose-500/10" : "border-dashed border-white/15 bg-white/[0.03] hover:border-[#ff6b00]/35"}`}
    >
      <div className="mb-3 text-sm font-medium text-white">{label}</div>
      <input
        type="file"
        accept={accept}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="block w-full text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-[#ff6b00] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#ff4500]"
      />
      <p className="mt-2 text-xs text-white/45">
        {helper?.toLowerCase().includes("opcional")
          ? helper
          : helper
            ? `Opcional. ${helper}`
            : "Opcional"}
      </p>
      {file ? <p className="mt-3 text-xs text-[#ffb07e]">Arquivo: {file.name}</p> : null}
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </label>
  );
}

function StepStudent({
  form,
  updateSection,
  getFieldError,
  enrollmentNumberStatus,
  retryEnrollmentNumber,
}: {
  form: FormState;
  updateSection: <K extends keyof FormState>(
    section: K,
    partial: Partial<FormState[K]>,
    fieldsToTouch?: string[],
  ) => void;
  getFieldError: (field: string) => string;
  enrollmentNumberStatus: AsyncStatus;
  retryEnrollmentNumber: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <InputField
            label="Nome completo do aluno"
            required
            value={form.dadosAluno.nomeCompleto}
            onChange={(value) =>
              updateSection("dadosAluno", { nomeCompleto: value }, ["dadosAluno.nomeCompleto"])
            }
            error={getFieldError("dadosAluno.nomeCompleto")}
          />
        </div>
        <InputField
          label="Data de nascimento"
          required
          type="date"
          value={form.dadosAluno.dataNascimento}
          onChange={(value) =>
            updateSection(
              "dadosAluno",
              { dataNascimento: value, idade: calculateStudentAge(value) },
              ["dadosAluno.dataNascimento"],
            )
          }
          error={getFieldError("dadosAluno.dataNascimento")}
        />
        <InputField
          label="Idade"
          value={form.dadosAluno.idade}
          onChange={() => undefined}
          readOnly
          helper="Calculada automaticamente."
        />
        <SelectField
          label="Sexo"
          required
          value={form.dadosAluno.sexo}
          onChange={(value) => updateSection("dadosAluno", { sexo: value }, ["dadosAluno.sexo"])}
          options={["Masculino", "Feminino", "Outro"]}
          error={getFieldError("dadosAluno.sexo")}
        />
      </div>

      <div
        aria-live="polite"
        className="flex min-h-9 items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-white/45"
      >
        <span>
          {enrollmentNumberStatus === "loading"
            ? "Preparando o número da matrícula..."
            : enrollmentNumberStatus === "error"
              ? "O número será confirmado ao concluir."
              : "Número de matrícula gerado automaticamente."}
        </span>
        {enrollmentNumberStatus === "error" ? (
          <button
            type="button"
            onClick={retryEnrollmentNumber}
            className="shrink-0 font-semibold text-[#ff9f6b] hover:text-[#ffc09a]"
          >
            Tentar novamente
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StepGuardian({
  form,
  updateSection,
  getFieldError,
}: {
  form: FormState;
  updateSection: <K extends keyof FormState>(
    section: K,
    partial: Partial<FormState[K]>,
    fieldsToTouch?: string[],
  ) => void;
  getFieldError: (field: string) => string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <InputField
          label="Nome completo do responsável"
          required
          value={form.responsavel.nomeCompleto}
          onChange={(value) =>
            updateSection("responsavel", { nomeCompleto: value }, ["responsavel.nomeCompleto"])
          }
          error={getFieldError("responsavel.nomeCompleto")}
        />
      </div>
      <InputField
        label="CPF"
        required
        value={form.responsavel.cpf}
        onChange={(value) =>
          updateSection("responsavel", { cpf: maskCpf(value) }, ["responsavel.cpf"])
        }
        error={getFieldError("responsavel.cpf")}
      />
      <InputField
        label="WhatsApp"
        required
        value={form.responsavel.whatsapp}
        onChange={(value) =>
          updateSection("responsavel", { whatsapp: maskWhatsapp(value) }, ["responsavel.whatsapp"])
        }
        error={getFieldError("responsavel.whatsapp")}
      />
      <SelectField
        label="Parentesco"
        required
        value={form.responsavel.parentesco}
        onChange={(value) =>
          updateSection("responsavel", { parentesco: value }, ["responsavel.parentesco"])
        }
        options={["Mãe", "Pai", "Avó", "Avô", "Tia", "Tio", "Responsável legal"]}
        error={getFieldError("responsavel.parentesco")}
      />
      <InputField
        label="E-mail"
        type="email"
        value={form.responsavel.email}
        onChange={(value) => updateSection("responsavel", { email: value }, ["responsavel.email"])}
        error={getFieldError("responsavel.email")}
      />
    </div>
  );
}

function StepStudentAdditional({
  form,
  updateSection,
  getFieldError,
}: {
  form: FormState;
  updateSection: <K extends keyof FormState>(
    section: K,
    partial: Partial<FormState[K]>,
    fieldsToTouch?: string[],
  ) => void;
  getFieldError: (field: string) => string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <InputField
        label="CPF do aluno"
        value={form.dadosAluno.cpf}
        onChange={(value) =>
          updateSection("dadosAluno", { cpf: maskCpf(value) }, ["dadosAluno.cpf"])
        }
        error={getFieldError("dadosAluno.cpf")}
      />
      <InputField
        label="RG do aluno"
        value={form.dadosAluno.rg}
        onChange={(value) => updateSection("dadosAluno", { rg: maskRg(value) }, ["dadosAluno.rg"])}
        error={getFieldError("dadosAluno.rg")}
      />
      <InputField
        label="Nome do colégio"
        value={form.dadosAluno.colegio}
        onChange={(value) =>
          updateSection("dadosAluno", { colegio: value }, ["dadosAluno.colegio"])
        }
        error={getFieldError("dadosAluno.colegio")}
      />
      <SelectField
        label="Período escolar"
        value={form.dadosAluno.periodoEscolar}
        onChange={(value) =>
          updateSection("dadosAluno", { periodoEscolar: value }, ["dadosAluno.periodoEscolar"])
        }
        options={["Manhã", "Tarde", "Noite", "Integral"]}
        error={getFieldError("dadosAluno.periodoEscolar")}
      />
    </div>
  );
}

function StepGuardianAdditional({
  form,
  updateSection,
  getFieldError,
}: {
  form: FormState;
  updateSection: <K extends keyof FormState>(
    section: K,
    partial: Partial<FormState[K]>,
    fieldsToTouch?: string[],
  ) => void;
  getFieldError: (field: string) => string;
}) {
  return (
    <InputField
      label="RG do responsável"
      value={form.responsavel.rg}
      onChange={(value) => updateSection("responsavel", { rg: maskRg(value) }, ["responsavel.rg"])}
      error={getFieldError("responsavel.rg")}
    />
  );
}

function StepAddress({
  form,
  updateSection,
  getFieldError,
  cepLookupStatus,
  cepLookupMessage,
}: {
  form: FormState;
  updateSection: <K extends keyof FormState>(
    section: K,
    partial: Partial<FormState[K]>,
    fieldsToTouch?: string[],
  ) => void;
  getFieldError: (field: string) => string;
  cepLookupStatus: AsyncStatus;
  cepLookupMessage: string;
}) {
  return (
    <div className="space-y-5">
      {cepLookupMessage ? (
        <div
          className={`rounded-3xl border px-4 py-4 text-sm leading-6 ${
            cepLookupStatus === "success"
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
              : cepLookupStatus === "error"
                ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
                : "border-white/10 bg-black/20 text-white/70"
          }`}
        >
          {cepLookupMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <InputField
          label="CEP"
          value={form.endereco.cep}
          onChange={(value) => updateSection("endereco", { cep: maskCep(value) }, ["endereco.cep"])}
          error={getFieldError("endereco.cep")}
          helper="Ao informar um CEP válido, rua, bairro, cidade e estado serão preenchidos automaticamente."
        />
        <InputField
          label="Rua"
          value={form.endereco.rua}
          onChange={(value) => updateSection("endereco", { rua: value }, ["endereco.rua"])}
          error={getFieldError("endereco.rua")}
        />
        <InputField
          label="Número"
          value={form.endereco.numero}
          onChange={(value) => updateSection("endereco", { numero: value }, ["endereco.numero"])}
          error={getFieldError("endereco.numero")}
        />
        <InputField
          label="Complemento"
          value={form.endereco.complemento}
          onChange={(value) =>
            updateSection("endereco", { complemento: value }, ["endereco.complemento"])
          }
          error={getFieldError("endereco.complemento")}
          helper="Opcional."
        />
        <InputField
          label="Bairro"
          value={form.endereco.bairro}
          onChange={(value) => updateSection("endereco", { bairro: value }, ["endereco.bairro"])}
          error={getFieldError("endereco.bairro")}
        />
        <InputField
          label="Cidade"
          value={form.endereco.cidade}
          onChange={(value) => updateSection("endereco", { cidade: value }, ["endereco.cidade"])}
          error={getFieldError("endereco.cidade")}
        />
        <InputField
          label="Estado"
          value={form.endereco.estado}
          onChange={(value) => updateSection("endereco", { estado: value }, ["endereco.estado"])}
          error={getFieldError("endereco.estado")}
        />
      </div>
    </div>
  );
}

function StepDocuments({
  form,
  photoPreview,
  handlePhotoChange,
  handleDocumentChange,
  updateMedicalExpiry,
  getFieldError,
}: {
  form: FormState;
  photoPreview: string;
  handlePhotoChange: (file: File | null) => void;
  handleDocumentChange: (field: UploadedDocumentField, file: File | null) => void;
  updateMedicalExpiry: (value: string) => void;
  getFieldError: (field: string) => string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white/70">
        Documentos e foto sao opcionais na matricula inicial e podem ser anexados depois no perfil
        do aluno.
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 text-sm font-medium text-white">Foto de perfil do aluno</div>
          {photoPreview ? (
            <img
              src={photoPreview}
              alt="Preview do aluno"
              className="mb-4 h-64 w-full rounded-3xl object-cover"
            />
          ) : (
            <div className="mb-4 flex h-64 items-center justify-center rounded-3xl border border-dashed border-white/12 bg-black/25 text-white/35">
              <div className="text-center text-sm">
                <FileImage className="mx-auto mb-3 h-7 w-7" />
                Envie uma foto para visualizar aqui
              </div>
            </div>
          )}

          <FileField
            label="Selecionar foto"
            accept="image/*"
            onChange={handlePhotoChange}
            file={form.documentos.fotoPerfilAluno}
            helper="Formatos aceitos: JPG, PNG ou WEBP."
            error={getFieldError("documentos.fotoPerfilAluno")}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FileField
            label="RG com CPF do aluno"
            file={form.documentos.rgCpfAluno}
            onChange={(file) => handleDocumentChange("rgCpfAluno", file)}
          />
          <FileField
            label="RG com CPF do responsável"
            file={form.documentos.rgCpfResponsavel}
            onChange={(file) => handleDocumentChange("rgCpfResponsavel", file)}
          />
          <FileField
            label="Comprovante de endereço"
            file={form.documentos.comprovanteEndereco}
            onChange={(file) => handleDocumentChange("comprovanteEndereco", file)}
          />
          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:col-span-2">
            <FileField
              label="Atestado médico / exame médico"
              file={form.documentos.atestadoMedico}
              onChange={(file) => handleDocumentChange("atestadoMedico", file)}
              helper="Quando anexado, informe uma validade de no máximo 1 ano."
              error={getFieldError("documentos.atestadoMedico")}
            />
            <InputField
              label="Validade do atestado médico"
              type="date"
              value={form.documentos.atestadoMedico?.expiresAt ?? ""}
              onChange={updateMedicalExpiry}
              error={getFieldError("documentos.atestadoMedico")}
              helper="Opcional."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepClassSelection({
  trainingBlocks,
  modalityOptions,
  unitOptions,
  hasAnyTurma,
  horarioOptions,
  updateTrainingBlock,
  addTrainingBlock,
  removeTrainingBlock,
  getFieldError,
  isLoading,
}: {
  trainingBlocks: TrainingBlock[];
  modalityOptions: string[];
  unitOptions: string[];
  hasAnyTurma: boolean;
  horarioOptions: HorarioOption[];
  updateTrainingBlock: (
    blockId: number,
    field: "modalidade" | "unidade" | "turmaId",
    value: string,
  ) => void;
  addTrainingBlock: () => void;
  removeTrainingBlock: (blockId: number) => void;
  getFieldError: (field: string) => string;
  isLoading?: boolean;
}) {
  const availableModalities = uniqueValues([
    ...modalityOptions,
    ...horarioOptions.map((option) => option.modalidade),
  ]);
  const trainingError = getFieldError("esportivas.horarios");

  return (
    <div className={`space-y-5 ${isLoading ? "opacity-60" : ""}`}>
      <div className="border-t border-white/8 pt-5">
        <h3 className="text-lg font-bold text-white">Treino</h3>
        <p className="mt-1 text-sm text-white/50">
          Adicione uma ou mais modalidades e turmas para o aluno.
        </p>
      </div>

      {!isLoading && !hasAnyTurma ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55">
          Nenhuma turma cadastrada no momento.
        </div>
      ) : (
        <div className="space-y-4">
          {trainingBlocks.map((training, index) => {
            const relatedUnits = uniqueValues(
              horarioOptions
                .filter((option) => option.modalidade === training.modalidade)
                .map((option) => option.unidade),
            );
            const availableUnits = relatedUnits.length > 0 ? relatedUnits : unitOptions;
            const availableClasses = horarioOptions.filter((option) => {
              const matchesFilters =
                option.modalidade === training.modalidade && option.unidade === training.unidade;
              const selectedInAnotherBlock = trainingBlocks.some(
                (candidate) =>
                  candidate.id !== training.id &&
                  candidate.modalidade === option.modalidade &&
                  candidate.unidade === option.unidade &&
                  candidate.turmaId === option.turmaId,
              );
              return matchesFilters && !selectedInAnotherBlock;
            });
            const selectedClass = horarioOptions.find(
              (option) => option.turmaId === training.turmaId,
            );
            const showError =
              Boolean(trainingError) &&
              (!training.modalidade || !training.unidade || !training.turmaId);

            return (
              <div
                key={training.id}
                className={`rounded-2xl border p-4 sm:p-5 ${
                  showError
                    ? "border-rose-500/45 bg-rose-500/[0.04]"
                    : index === 0
                      ? "border-[#ff6b00]/30 bg-[#ff6b00]/[0.04]"
                      : "border-white/10 bg-white/[0.025]"
                }`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-white">
                      {index === 0 ? "Treino principal" : "Treino adicional"}
                    </h4>
                    {index > 0 ? (
                      <p className="mt-0.5 text-xs text-white/40">Treino {index + 1}</p>
                    ) : null}
                  </div>
                  {index > 0 ? (
                    <button
                      type="button"
                      onClick={() => removeTrainingBlock(training.id)}
                      className="min-h-11 rounded-xl border border-rose-500/25 px-3 text-xs font-semibold text-rose-300 transition hover:border-rose-400/50 hover:bg-rose-500/10"
                      aria-label={`Remover treino adicional ${index}`}
                    >
                      Remover
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-white/88">Modalidade *</span>
                    <select
                      value={training.modalidade}
                      onChange={(event) =>
                        updateTrainingBlock(training.id, "modalidade", event.target.value)
                      }
                      disabled={isLoading}
                      aria-invalid={showError && !training.modalidade}
                      className="h-[52px] w-full rounded-2xl border border-white/10 bg-[#101010] px-4 text-sm text-white outline-none transition focus:border-[#ff6b00] focus:ring-4 focus:ring-[#ff6b00]/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecione</option>
                      {availableModalities.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-white/88">Unidade *</span>
                    <select
                      value={training.unidade}
                      onChange={(event) =>
                        updateTrainingBlock(training.id, "unidade", event.target.value)
                      }
                      disabled={isLoading || !training.modalidade}
                      aria-invalid={showError && !training.unidade}
                      className="h-[52px] w-full rounded-2xl border border-white/10 bg-[#101010] px-4 text-sm text-white outline-none transition focus:border-[#ff6b00] focus:ring-4 focus:ring-[#ff6b00]/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecione</option>
                      {availableUnits.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2 sm:col-span-2">
                    <span className="text-sm font-medium text-white/88">Categoria/Turma *</span>
                    <select
                      value={training.turmaId}
                      onChange={(event) =>
                        updateTrainingBlock(training.id, "turmaId", event.target.value)
                      }
                      disabled={isLoading || !training.modalidade || !training.unidade}
                      aria-invalid={showError && !training.turmaId}
                      className="h-[52px] w-full rounded-2xl border border-white/10 bg-[#101010] px-4 text-sm text-white outline-none transition focus:border-[#ff6b00] focus:ring-4 focus:ring-[#ff6b00]/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecione</option>
                      {availableClasses.map((option) => (
                        <option key={option.turmaId} value={option.turmaId}>
                          {option.turmaNome}
                        </option>
                      ))}
                    </select>
                    {training.modalidade &&
                    training.unidade &&
                    availableClasses.length === 0 &&
                    !training.turmaId ? (
                      <p className="text-xs text-white/45">
                        Não há outra turma disponível para essa modalidade e unidade.
                      </p>
                    ) : null}
                  </label>
                </div>

                {selectedClass ? (
                  <div className="mt-4 rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                    <span className="text-xs uppercase tracking-[0.16em] text-white/35">
                      Horário
                    </span>
                    <p className="mt-1 text-sm font-medium text-white">
                      {selectedClass.horarioLabel}
                    </p>
                    <p className="mt-1 text-xs text-white/45">{selectedClass.description}</p>
                  </div>
                ) : null}

                {showError ? <p className="mt-3 text-xs text-rose-300">{trainingError}</p> : null}
              </div>
            );
          })}
        </div>
      )}

      {hasAnyTurma ? (
        <button
          type="button"
          onClick={addTrainingBlock}
          disabled={isLoading}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#ff6b00]/45 bg-[#ff6b00]/[0.04] px-4 text-sm font-semibold text-[#ffad78] transition hover:bg-[#ff6b00]/10 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          + Adicionar outra modalidade/turma
        </button>
      ) : null}
    </div>
  );
}

function StepSportsComplement({
  form,
  updateSection,
  getFieldError,
}: {
  form: FormState;
  updateSection: <K extends keyof FormState>(
    section: K,
    partial: Partial<FormState[K]>,
    fieldsToTouch?: string[],
  ) => void;
  getFieldError: (field: string) => string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SelectField
        label="Nivel"
        value={form.esportivas.nivel}
        onChange={(value) => updateSection("esportivas", { nivel: value }, ["esportivas.nivel"])}
        options={["Iniciante", "Intermediario", "Avancado"]}
        error={getFieldError("esportivas.nivel")}
      />
      <SelectField
        label="Ja treinou antes?"
        value={form.esportivas.treinouAntes}
        onChange={(value) =>
          updateSection("esportivas", { treinouAntes: value }, ["esportivas.treinouAntes"])
        }
        options={["Sim", "Nao"]}
        error={getFieldError("esportivas.treinouAntes")}
      />
      <SelectField
        label="Caracteristica"
        value={form.esportivas.caracteristica}
        onChange={(value) =>
          updateSection("esportivas", { caracteristica: value }, ["esportivas.caracteristica"])
        }
        options={["Ofensivo", "Defensivo", "Equilibrado"]}
        error={getFieldError("esportivas.caracteristica")}
      />
      <SelectField
        label="Objetivo"
        value={form.esportivas.objetivo}
        onChange={(value) =>
          updateSection("esportivas", { objetivo: value }, ["esportivas.objetivo"])
        }
        options={["Lazer", "Desenvolvimento", "Competicao"]}
        error={getFieldError("esportivas.objetivo")}
      />
    </div>
  );
}

function StepHealth({
  form,
  updateSection,
  getFieldError,
}: {
  form: FormState;
  updateSection: <K extends keyof FormState>(
    section: K,
    partial: Partial<FormState[K]>,
    fieldsToTouch?: string[],
  ) => void;
  getFieldError: (field: string) => string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InputField
        label="Restrição médica"
        value={form.saude.restricaoMedica}
        onChange={(value) =>
          updateSection("saude", { restricaoMedica: value }, ["saude.restricaoMedica"])
        }
        error={getFieldError("saude.restricaoMedica")}
      />
      <InputField
        label="Medicamentos"
        value={form.saude.medicamentos}
        onChange={(value) =>
          updateSection("saude", { medicamentos: value }, ["saude.medicamentos"])
        }
        error={getFieldError("saude.medicamentos")}
      />
      <InputField
        label="Alergias"
        value={form.saude.alergias}
        onChange={(value) => updateSection("saude", { alergias: value }, ["saude.alergias"])}
        error={getFieldError("saude.alergias")}
      />
      <InputField
        label="Lesões"
        value={form.saude.lesoes}
        onChange={(value) => updateSection("saude", { lesoes: value }, ["saude.lesoes"])}
        error={getFieldError("saude.lesoes")}
      />
      <InputField
        label="Plano de saúde"
        value={form.saude.planoSaude}
        onChange={(value) => updateSection("saude", { planoSaude: value }, ["saude.planoSaude"])}
        error={getFieldError("saude.planoSaude")}
      />
      <div className="md:col-span-2">
        <TextareaField
          label="Observações importantes"
          value={form.saude.observacoesImportantes}
          onChange={(value) =>
            updateSection("saude", { observacoesImportantes: value }, [
              "saude.observacoesImportantes",
            ])
          }
          error={getFieldError("saude.observacoesImportantes")}
        />
      </div>
    </div>
  );
}

function StepStrategy({
  form,
  updateSection,
  getFieldError,
}: {
  form: FormState;
  updateSection: <K extends keyof FormState>(
    section: K,
    partial: Partial<FormState[K]>,
    fieldsToTouch?: string[],
  ) => void;
  getFieldError: (field: string) => string;
}) {
  return (
    <div className="space-y-4">
      <InputField
        label="Como conheceu a J12?"
        value={form.estrategicas.comoConheceu}
        onChange={(value) =>
          updateSection("estrategicas", { comoConheceu: value }, ["estrategicas.comoConheceu"])
        }
        error={getFieldError("estrategicas.comoConheceu")}
      />
      <InputField
        label="Indicação de quem?"
        value={form.estrategicas.indicacaoQuem}
        onChange={(value) =>
          updateSection("estrategicas", { indicacaoQuem: value }, ["estrategicas.indicacaoQuem"])
        }
        error={getFieldError("estrategicas.indicacaoQuem")}
      />
      <TextareaField
        label="Observações gerais"
        value={form.estrategicas.observacoesGerais}
        onChange={(value) =>
          updateSection("estrategicas", { observacoesGerais: value }, [
            "estrategicas.observacoesGerais",
          ])
        }
        error={getFieldError("estrategicas.observacoesGerais")}
      />
    </div>
  );
}

function ComplementarySection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.025] open:border-[#ff6b00]/25 open:bg-[#ff6b00]/[0.035]">
      <summary className="flex min-h-[60px] cursor-pointer list-none items-center gap-3 px-4 py-3 outline-none transition hover:bg-white/[0.025] focus-visible:ring-2 focus-visible:ring-[#ff6b00]/70 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-white">{title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-white/45">{description}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-[#ff9f6b] transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-white/8 px-4 py-5">{children}</div>
    </details>
  );
}

function StepComplementary({
  form,
  updateSection,
  getFieldError,
  cepLookupStatus,
  cepLookupMessage,
  photoPreview,
  handlePhotoChange,
  handleDocumentChange,
  updateMedicalExpiry,
}: {
  form: FormState;
  updateSection: <K extends keyof FormState>(
    section: K,
    partial: Partial<FormState[K]>,
    fieldsToTouch?: string[],
  ) => void;
  getFieldError: (field: string) => string;
  cepLookupStatus: AsyncStatus;
  cepLookupMessage: string;
  photoPreview: string;
  handlePhotoChange: (file: File | null) => void;
  handleDocumentChange: (field: UploadedDocumentField, file: File | null) => void;
  updateMedicalExpiry: (value: string) => void;
}) {
  const attachedDocumentsCount = Object.values(form.documentos).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#ff6b00]/20 bg-[#ff6b00]/8 p-4">
        <h3 className="font-semibold text-white">Informações opcionais</h3>
        <p className="mt-1 text-sm leading-6 text-white/60">
          Você pode completar esses dados agora ou posteriormente.
        </p>
      </div>

      <ComplementarySection
        title="Dados pessoais e escolares"
        description="Documentos pessoais, escola e identificação complementar."
      >
        <div className="space-y-5">
          <StepStudentAdditional
            form={form}
            updateSection={updateSection}
            getFieldError={getFieldError}
          />
          <div className="border-t border-white/8 pt-5">
            <StepGuardianAdditional
              form={form}
              updateSection={updateSection}
              getFieldError={getFieldError}
            />
          </div>
        </div>
      </ComplementarySection>

      <ComplementarySection title="Endereço" description="CEP e dados de localização.">
        <StepAddress
          form={form}
          updateSection={updateSection}
          getFieldError={getFieldError}
          cepLookupStatus={cepLookupStatus}
          cepLookupMessage={cepLookupMessage}
        />
      </ComplementarySection>

      <ComplementarySection
        title="Saúde"
        description="Restrições, alergias, medicamentos e cuidados importantes."
      >
        <StepHealth form={form} updateSection={updateSection} getFieldError={getFieldError} />
      </ComplementarySection>

      <ComplementarySection
        title="Documentos"
        description={
          attachedDocumentsCount > 0
            ? `${attachedDocumentsCount} arquivo(s) selecionado(s).`
            : "Foto, documentos pessoais, comprovante e atestado."
        }
      >
        <StepDocuments
          form={form}
          photoPreview={photoPreview}
          handlePhotoChange={handlePhotoChange}
          handleDocumentChange={handleDocumentChange}
          updateMedicalExpiry={updateMedicalExpiry}
          getFieldError={getFieldError}
        />
      </ComplementarySection>

      <ComplementarySection
        title="Informações esportivas"
        description="Nível, experiência, característica e objetivo."
      >
        <StepSportsComplement
          form={form}
          updateSection={updateSection}
          getFieldError={getFieldError}
        />
      </ComplementarySection>

      <ComplementarySection
        title="Outras informações"
        description="Origem do contato e observações gerais."
      >
        <StepStrategy form={form} updateSection={updateSection} getFieldError={getFieldError} />
      </ComplementarySection>
    </div>
  );
}

function StepReview({
  form,
  trainingBlocks,
  horarioOptions,
}: {
  form: FormState;
  trainingBlocks: TrainingBlock[];
  horarioOptions: HorarioOption[];
}) {
  const sections = [
    {
      title: "Aluno",
      items: [
        ["Nome completo", form.dadosAluno.nomeCompleto],
        ["Data de nascimento", form.dadosAluno.dataNascimento],
        ["Idade", form.dadosAluno.idade],
        ["Sexo", form.dadosAluno.sexo],
      ],
    },
    {
      title: "Responsável",
      items: [
        ["Nome completo", form.responsavel.nomeCompleto],
        ["WhatsApp", form.responsavel.whatsapp],
        ["E-mail", form.responsavel.email],
        ["Parentesco", form.responsavel.parentesco],
      ],
    },
  ];

  const trainingSummaries = trainingBlocks
    .map((training) => {
      const option = horarioOptions.find(
        (candidate) =>
          candidate.turmaId === training.turmaId &&
          candidate.modalidade === training.modalidade &&
          candidate.unidade === training.unidade,
      );

      if (!option) return null;

      return {
        id: training.id,
        text: [option.modalidade, option.unidade, option.turmaNome, option.horarioLabel].join(
          " • ",
        ),
      };
    })
    .filter((training): training is { id: number; text: string } => Boolean(training));

  const docs = [
    form.documentos.fotoPerfilAluno?.name,
    form.documentos.rgCpfAluno?.name,
    form.documentos.rgCpfResponsavel?.name,
    form.documentos.comprovanteEndereco?.name,
    form.documentos.atestadoMedico?.name,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#ff6b00]/20 bg-[#ff6b00]/8 px-4 py-4 text-sm leading-6 text-[#ffd2bb]">
        Confira os dados principais. Se precisar corrigir algo, use o botão Voltar.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <h3 className="mb-4 text-lg font-semibold text-white">{section.title}</h3>
            <div className="space-y-3 text-sm text-white/72">
              {section.items.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 border-b border-white/6 pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="text-white/45">{label}</span>
                  <span className="text-right text-white">{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-[#ff6b00]/25 bg-[#ff6b00]/[0.035] p-4 md:col-span-2">
          <h3 className="text-lg font-semibold text-white">Treino principal</h3>
          <p className="mt-2 text-sm leading-6 text-white/75">
            {trainingSummaries[0]?.text || "—"}
          </p>

          {trainingSummaries.length > 1 ? (
            <div className="mt-5 border-t border-white/8 pt-4">
              <h4 className="text-sm font-semibold text-white">Treinos adicionais</h4>
              <div className="mt-3 space-y-3">
                {trainingSummaries.slice(1).map((training, index) => (
                  <div
                    key={training.id}
                    className="rounded-xl border border-white/8 bg-black/20 px-3 py-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#ff9f6b]">
                      Treino adicional {index + 1}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/70">{training.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-base font-semibold text-white">Informações adicionais</h3>
        {docs.length > 0 ? (
          <p className="text-sm text-white/60">{docs.length} documento(s) selecionado(s).</p>
        ) : (
          <p className="text-sm text-white/55">
            Nenhum documento selecionado. Os dados opcionais poderão ser completados depois.
          </p>
        )}
      </div>
    </div>
  );
}
