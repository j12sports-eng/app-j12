import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileImage,
  Loader2,
  ShieldCheck,
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

type UploadedDocumentField = keyof FormState["documentos"];

type AsyncStatus = "idle" | "loading" | "success" | "error";

const steps: StepDefinition[] = [
  {
    title: "Dados do Aluno",
    description: "Dados pessoais essenciais e categoria/turma da matricula.",
    fields: [
      "dadosAluno.nomeCompleto",
      "dadosAluno.dataNascimento",
      "dadosAluno.sexo",
      "esportivas.horarios",
    ],
  },
  {
    title: "Dados do Responsavel",
    description: "Contato principal e identificacao do responsavel.",
    fields: [
      "responsavel.nomeCompleto",
      "responsavel.cpf",
      "responsavel.whatsapp",
      "responsavel.parentesco",
    ],
  },
  {
    title: "Informacoes Complementares",
    description: "Campos opcionais para completar o cadastro agora ou depois.",
    fields: [],
  },
  {
    title: "Revisao e Finalizacao",
    description: "Conferencia final antes de registrar a matricula.",
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [protocol, setProtocol] = useState("");
  const [success, setSuccess] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [assignedEnrollmentNumber, setAssignedEnrollmentNumber] = useState("");
  const [enrollmentNumberStatus, setEnrollmentNumberStatus] = useState<AsyncStatus>("idle");
  const [enrollmentNumberMessage, setEnrollmentNumberMessage] = useState("");
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

  const filteredHorarioOptions = useMemo(() => {
    return horarioOptions.filter((option) => {
      const matchesModalidade =
        form.esportivas.modalidades.length === 0 ||
        form.esportivas.modalidades.includes(option.modalidade);
      const matchesUnidade =
        form.esportivas.unidades.length === 0 || form.esportivas.unidades.includes(option.unidade);
      return matchesModalidade && matchesUnidade;
    });
  }, [horarioOptions, form.esportivas.modalidades, form.esportivas.unidades]);
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
    console.log("Horários filtrados:", filteredHorarioOptions);
  }, [
    settings,
    turmas,
    consolidatedModalidades,
    consolidatedUnidades,
    consolidatedTurmas,
    modalityOptions,
    unitOptions,
    horarioOptions,
    filteredHorarioOptions,
    isLoadingCatalog,
    catalogError,
  ]);

  const allErrors = useMemo(
    () => validateMatriculaForm(form, hasAvailableTurmas),
    [form, hasAvailableTurmas],
  );
  const currentStepErrors = useMemo(
    () =>
      uniqueValues(
        steps[step].fields
          .map((field) => allErrors[field])
          .filter((message): message is string => Boolean(message)),
      ),
    [allErrors, step],
  );

  const attachedDocumentsCount = useMemo(
    () => Object.values(form.documentos).filter(Boolean).length,
    [form.documentos],
  );
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

  function toggleSimpleArray(key: "modalidades" | "unidades", value: string, fieldPath: string) {
    setForm((current) => {
      const currentValues = current.esportivas[key];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      const nextSports = {
        ...current.esportivas,
        [key]: uniqueValues(nextValues),
      };

      const allowedTurmas = new Set(
        horarioOptions
          .filter((option) => {
            const matchesModalidade =
              key === "modalidades"
                ? nextSports.modalidades.length === 0 ||
                  nextSports.modalidades.includes(option.modalidade)
                : nextSports.modalidades.length === 0 ||
                  nextSports.modalidades.includes(option.modalidade);
            const matchesUnidade =
              key === "unidades"
                ? nextSports.unidades.length === 0 || nextSports.unidades.includes(option.unidade)
                : nextSports.unidades.length === 0 || nextSports.unidades.includes(option.unidade);
            return matchesModalidade && matchesUnidade;
          })
          .map((option) => option.turmaNome),
      );

      const selectedTurmas = nextSports.turmas.filter((turma) => allowedTurmas.has(turma));
      const selectedHorarios = horarioOptions
        .filter((option) => selectedTurmas.includes(option.turmaNome))
        .map((option) => option.horarioLabel);

      return {
        ...current,
        esportivas: {
          ...nextSports,
          turmas: selectedTurmas,
          horarios: uniqueValues(selectedHorarios),
        },
      };
    });
    markTouched([fieldPath, "esportivas.horarios"]);
  }

  function selectTurma(turmaId: string) {
    const option = horarioOptions.find((item) => item.turmaId === turmaId);

    setForm((current) => {
      if (!option) {
        return {
          ...current,
          esportivas: {
            ...current.esportivas,
            turmas: [],
            horarios: [],
          },
        };
      }

      return {
        ...current,
        esportivas: {
          ...current.esportivas,
          modalidades: uniqueValues([...current.esportivas.modalidades, option.modalidade]),
          unidades: uniqueValues([...current.esportivas.unidades, option.unidade]),
          turmas: [option.turmaNome],
          horarios: [option.horarioLabel],
        },
      };
    });

    markTouched(["esportivas.modalidades", "esportivas.unidades", "esportivas.horarios"]);
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
              className="rounded-2xl border border-[#ff6b00]/35 bg-[#ff6b00]/12 px-5 py-3 text-sm font-semibold text-[#ffb07e] transition hover:bg-[#ff6b00]/18"
            >
              Nova matrícula
            </button>
            {user ? (
              <button
                type="button"
                onClick={() => navigate({ to: "/alunos" })}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-[#ff6b00]/35 hover:text-white"
              >
                Ir para alunos
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-[#ff6b00]/35 hover:text-white"
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
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,107,0,0.22),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,69,0,0.18),_transparent_28%),linear-gradient(180deg,_rgba(10,10,10,0.96),_rgba(4,4,4,1))]" />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/35 shadow-[0_0_35px_-16px_rgba(255,107,0,0.85)]">
              <img
                src={branding.logo}
                alt={`Logo ${branding.name}`}
                className="h-9 w-9 object-contain"
              />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ff9f6b]">
                Módulo de matrícula
              </div>
              <h1 className="text-2xl font-black">Cadastro completo do aluno J12</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: user ? "/alunos" : "/login" })}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-medium text-white/75 transition hover:border-[#ff6b00]/35 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {user ? "Voltar para alunos" : "Voltar ao login"}
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-[32px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur xl:sticky xl:top-6 xl:h-fit">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ff6b00]/20 bg-[#ff6b00]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#ff9f6b]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Fluxo existente aprimorado
              </span>
              <h2 className="text-3xl font-black">Matrícula em etapas com validação completa.</h2>
              <p className="text-sm leading-7 text-white/68">
                A estrutura original do fluxo foi mantida, agora com ortografia ajustada, campos
                obrigatórios, máscaras, múltiplas seleções esportivas e integração direta com o
                perfil do aluno.
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/25 p-4">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/40">
                <span>Progresso</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/8">
                <div
                  className="h-2 rounded-full bg-[linear-gradient(90deg,#ff6b00,#ff9248)] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {steps.map((item, index) => {
                const active = index === step;
                const complete = index < step;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      if (index > step) return;
                      setStep(index);
                    }}
                    className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                      active
                        ? "border-[#ff6b00]/45 bg-[#ff6b00]/12"
                        : complete
                          ? "border-emerald-500/25 bg-emerald-500/10"
                          : "border-white/8 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl text-xs font-bold ${
                          complete
                            ? "bg-emerald-500/20 text-emerald-300"
                            : active
                              ? "bg-[#ff6b00] text-white"
                              : "bg-white/10 text-white/60"
                        }`}
                      >
                        {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{item.title}</div>
                        <div className="mt-1 text-xs leading-5 text-white/50">
                          {item.description}
                        </div>
                      </div>
                      <ChevronRight className="ml-auto mt-1 h-4 w-4 text-white/30" />
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ff9f6b]">
                  Etapa {step + 1} de {steps.length}
                </div>
                <h2 className="mt-2 text-2xl font-black">{steps[step].title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-white/65">
                  {steps[step].description}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">
                  Documentos anexados
                </div>
                <div className="mt-1 text-lg font-bold text-white">{attachedDocumentsCount}</div>
              </div>
            </div>

            {/* Indicador de carregamento de catálogo */}
            {isLoadingCatalog && step === 0 && (
              <div className="mb-5 rounded-3xl border border-blue-500/25 bg-blue-500/10 px-4 py-4 text-sm text-blue-100 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Carregando categorias e turmas...</span>
              </div>
            )}

            {/* Indicador de erro de catálogo */}
            {catalogError && step === 0 && (
              <div className="mb-5 rounded-3xl border border-red-500/25 bg-red-500/10 px-4 py-4 text-sm text-red-100 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>Erro ao carregar dados cadastrados. Tentando novamente...</span>
              </div>
            )}

            {currentStepErrors.length > 0 && (
              <div className="mb-5 rounded-3xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                <div className="font-semibold">Revise os campos obrigatórios desta etapa.</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentStepErrors.map((message) => (
                    <span
                      key={message}
                      className="rounded-full border border-amber-500/25 bg-black/10 px-3 py-1 text-[11px]"
                    >
                      {message}
                    </span>
                  ))}
                </div>
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
                    enrollmentNumberMessage={enrollmentNumberMessage}
                  />
                  <StepClassSelection
                    form={form}
                    modalityOptions={modalityOptions}
                    unitOptions={unitOptions}
                    hasAnyTurma={hasAvailableTurmas}
                    filteredHorarioOptions={filteredHorarioOptions}
                    toggleSimpleArray={toggleSimpleArray}
                    selectTurma={selectTurma}
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
              {step === 3 && <StepReview form={form} />}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-white/80 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>

              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={step === 0 && isLoadingCatalog}
                  className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#ff6b00,#ff8f47)" }}
                >
                  {step === 0 && isLoadingCatalog ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando categorias...
                    </>
                  ) : (
                    <>
                      Próxima etapa
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
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
                      Finalizar matrícula
                    </>
                  )}
                </button>
              )}
            </div>
          </section>
        </div>
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

function MultiSelectCard({
  label,
  description,
  checked,
  onToggle,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`rounded-3xl border p-4 text-left transition ${
        disabled
          ? "border-white/5 bg-white/[0.02] cursor-not-allowed opacity-50"
          : checked
            ? "border-[#ff6b00]/50 bg-[#ff6b00]/12"
            : "border-white/10 bg-white/[0.03] hover:border-white/20"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-1 flex h-5 w-5 items-center justify-center rounded-md border ${
            checked ? "border-[#ff6b00] bg-[#ff6b00] text-white" : "border-white/20 bg-transparent"
          }`}
        >
          {checked ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{label}</div>
          {description ? (
            <div className="mt-1 text-xs leading-5 text-white/45">{description}</div>
          ) : null}
        </div>
      </div>
    </button>
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
  enrollmentNumberMessage,
}: {
  form: FormState;
  updateSection: <K extends keyof FormState>(
    section: K,
    partial: Partial<FormState[K]>,
    fieldsToTouch?: string[],
  ) => void;
  getFieldError: (field: string) => string;
  enrollmentNumberStatus: AsyncStatus;
  enrollmentNumberMessage: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InputField
        label="Número de matrícula"
        value={form.dadosAluno.numeroMatricula}
        onChange={() => undefined}
        readOnly
        helper={
          enrollmentNumberStatus === "loading"
            ? "Gerando automaticamente..."
            : enrollmentNumberMessage || "Gerado automaticamente com validação segura no backend."
        }
      />
      <InputField
        label="Nome completo"
        required
        value={form.dadosAluno.nomeCompleto}
        onChange={(value) =>
          updateSection("dadosAluno", { nomeCompleto: value }, ["dadosAluno.nomeCompleto"])
        }
        error={getFieldError("dadosAluno.nomeCompleto")}
      />
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
        disabled
        helper="Calculada automaticamente a partir da data de nascimento."
      />
      <InputField
        label="CPF"
        value={form.dadosAluno.cpf}
        onChange={(value) =>
          updateSection("dadosAluno", { cpf: maskCpf(value) }, ["dadosAluno.cpf"])
        }
        error={getFieldError("dadosAluno.cpf")}
      />
      <InputField
        label="RG"
        value={form.dadosAluno.rg}
        onChange={(value) => updateSection("dadosAluno", { rg: maskRg(value) }, ["dadosAluno.rg"])}
        error={getFieldError("dadosAluno.rg")}
      />
      <SelectField
        label="Sexo"
        required
        value={form.dadosAluno.sexo}
        onChange={(value) => updateSection("dadosAluno", { sexo: value }, ["dadosAluno.sexo"])}
        options={["Masculino", "Feminino", "Outro"]}
        error={getFieldError("dadosAluno.sexo")}
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
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#ff6b00]/20 bg-[#ff6b00]/8 px-4 py-4 text-sm leading-6 text-[#ffd2bb]">
        Este responsável ficará vinculado ao perfil do aluno, ao contrato e ao acompanhamento
        documental.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <InputField
          label="Nome completo do responsável"
          required
          value={form.responsavel.nomeCompleto}
          onChange={(value) =>
            updateSection("responsavel", { nomeCompleto: value }, ["responsavel.nomeCompleto"])
          }
          error={getFieldError("responsavel.nomeCompleto")}
        />
        <InputField
          label="CPF do responsável"
          required
          value={form.responsavel.cpf}
          onChange={(value) =>
            updateSection("responsavel", { cpf: maskCpf(value) }, ["responsavel.cpf"])
          }
          error={getFieldError("responsavel.cpf")}
        />
        <InputField
          label="RG do responsável"
          value={form.responsavel.rg}
          onChange={(value) =>
            updateSection("responsavel", { rg: maskRg(value) }, ["responsavel.rg"])
          }
          error={getFieldError("responsavel.rg")}
        />
        <InputField
          label="Telefone principal"
          required
          value={form.responsavel.whatsapp}
          onChange={(value) =>
            updateSection("responsavel", { whatsapp: maskWhatsapp(value) }, [
              "responsavel.whatsapp",
            ])
          }
          error={getFieldError("responsavel.whatsapp")}
        />
        <InputField
          label="E-mail"
          type="email"
          value={form.responsavel.email}
          onChange={(value) =>
            updateSection("responsavel", { email: value }, ["responsavel.email"])
          }
          error={getFieldError("responsavel.email")}
        />
        <SelectField
          label="Grau de parentesco"
          required
          value={form.responsavel.parentesco}
          onChange={(value) =>
            updateSection("responsavel", { parentesco: value }, ["responsavel.parentesco"])
          }
          options={["Mãe", "Pai", "Avó", "Avô", "Tia", "Tio", "Responsável legal"]}
          error={getFieldError("responsavel.parentesco")}
        />
      </div>
    </div>
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
  form,
  modalityOptions,
  unitOptions,
  hasAnyTurma,
  filteredHorarioOptions,
  toggleSimpleArray,
  selectTurma,
  getFieldError,
  isLoading,
}: {
  form: FormState;
  modalityOptions: string[];
  unitOptions: string[];
  hasAnyTurma: boolean;
  filteredHorarioOptions: HorarioOption[];
  toggleSimpleArray: (key: "modalidades" | "unidades", value: string, fieldPath: string) => void;
  selectTurma: (turmaId: string) => void;
  getFieldError: (field: string) => string;
  isLoading?: boolean;
}) {
  const selectedTurmaId =
    filteredHorarioOptions.find((option) => form.esportivas.turmas.includes(option.turmaNome))
      ?.turmaId ?? "";

  return (
    <div
      className="space-y-6 opacity-75 pointer-events-auto"
      style={isLoading ? { opacity: 0.6 } : {}}
    >
      <div>
        <div className="mb-3 text-sm font-medium text-white/88 flex items-center gap-2">
          Modalidades
          <span className="text-xs font-normal text-white/40">Opcional</span>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {modalityOptions.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55">
              {isLoading ? "Carregando modalidades..." : "Nenhuma modalidade disponível"}
            </div>
          ) : (
            modalityOptions.map((option) => (
              <MultiSelectCard
                key={option}
                label={option}
                checked={form.esportivas.modalidades.includes(option)}
                onToggle={() => toggleSimpleArray("modalidades", option, "esportivas.modalidades")}
                disabled={isLoading}
              />
            ))
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 text-sm font-medium text-white/88 flex items-center gap-2">
          Unidades
          <span className="text-xs font-normal text-white/40">Opcional</span>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {unitOptions.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55">
              {isLoading ? "Carregando unidades..." : "Nenhuma unidade disponível"}
            </div>
          ) : (
            unitOptions.map((option) => (
              <MultiSelectCard
                key={option}
                label={option}
                checked={form.esportivas.unidades.includes(option)}
                onToggle={() => toggleSimpleArray("unidades", option, "esportivas.unidades")}
                disabled={isLoading}
              />
            ))
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 text-sm font-medium text-white/88 flex items-center gap-2">
          Categoria/Turma
          {hasAnyTurma ? <span className="text-[#ff9f6b]">*</span> : null}
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        {isLoading ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55">
            Carregando categorias...
          </div>
        ) : !hasAnyTurma ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55">
            Nenhuma turma cadastrada no momento.
          </div>
        ) : filteredHorarioOptions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55">
            Nenhuma turma encontrada para os filtros selecionados. Remova modalidade ou unidade para
            ver todas as turmas ativas.
          </div>
        ) : (
          <label className="block space-y-2">
            <select
              value={selectedTurmaId}
              onChange={(event) => selectTurma(event.target.value)}
              aria-invalid={Boolean(getFieldError("esportivas.horarios"))}
              className={`h-[52px] w-full rounded-2xl border px-4 text-sm outline-none transition ${
                getFieldError("esportivas.horarios")
                  ? "border-rose-500/70 bg-rose-500/10 text-white focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10"
                  : "border-white/10 bg-[#101010] text-white focus:border-[#ff6b00] focus:ring-4 focus:ring-[#ff6b00]/15"
              }`}
            >
              <option value="">Selecione uma categoria</option>
              {filteredHorarioOptions.map((option) => (
                <option key={option.turmaId} value={option.turmaId}>
                  {option.turmaNome} - {option.horarioLabel} - {option.modalidade}
                </option>
              ))}
            </select>
            <p className="text-xs text-white/40">
              Selecione uma turma ativa. Sem filtros, todas as turmas cadastradas aparecem aqui.
            </p>
          </label>
        )}
        {filteredHorarioOptions.length > 0 ? (
          <div className="mt-3 grid gap-3">
            {filteredHorarioOptions.map((option) => (
              <MultiSelectCard
                key={option.turmaId}
                label={`${option.turmaNome} · ${option.horarioLabel}`}
                description={`${option.modalidade} · ${option.description}`}
                checked={form.esportivas.turmas.includes(option.turmaNome)}
                onToggle={() => selectTurma(option.turmaId)}
                disabled={isLoading}
              />
            ))}
          </div>
        ) : null}
        {getFieldError("esportivas.horarios") ? (
          <p className="mt-2 text-xs text-rose-300">{getFieldError("esportivas.horarios")}</p>
        ) : null}
      </div>
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
    <div className="rounded-[28px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ff9f6b]">
          Opcional
        </div>
        <h3 className="mt-1 text-lg font-bold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-white/55">{description}</p>
      </div>
      {children}
    </div>
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
  return (
    <div className="space-y-5">
      <ComplementarySection
        title="Endereco"
        description="Complete o endereco quando quiser vincular dados de localizacao ao cadastro."
      >
        <StepAddress
          form={form}
          updateSection={updateSection}
          getFieldError={getFieldError}
          cepLookupStatus={cepLookupStatus}
          cepLookupMessage={cepLookupMessage}
        />
      </ComplementarySection>

      <ComplementarySection
        title="Documentos e foto"
        description="Uploads sao opcionais e nao bloqueiam o salvamento da matricula."
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
        title="Informacoes esportivas"
        description="Detalhes de nivel e objetivo ajudam na operacao, mas nao sao obrigatorios."
      >
        <StepSportsComplement
          form={form}
          updateSection={updateSection}
          getFieldError={getFieldError}
        />
      </ComplementarySection>

      <ComplementarySection
        title="Saude"
        description="Registre cuidados medicos quando houver informacao disponivel."
      >
        <StepHealth form={form} updateSection={updateSection} getFieldError={getFieldError} />
      </ComplementarySection>

      <ComplementarySection
        title="Origem e observacoes"
        description="Dados comerciais e observacoes gerais para enriquecer o atendimento."
      >
        <StepStrategy form={form} updateSection={updateSection} getFieldError={getFieldError} />
      </ComplementarySection>
    </div>
  );
}

function StepReview({ form }: { form: FormState }) {
  const sections = [
    {
      title: "Dados do aluno",
      items: [
        ["Número de matrícula", form.dadosAluno.numeroMatricula],
        ["Nome completo", form.dadosAluno.nomeCompleto],
        ["Data de nascimento", form.dadosAluno.dataNascimento],
        ["Idade", form.dadosAluno.idade],
        ["CPF", form.dadosAluno.cpf],
        ["RG", form.dadosAluno.rg],
        ["Sexo", form.dadosAluno.sexo],
        ["Colégio", form.dadosAluno.colegio],
        ["Período escolar", form.dadosAluno.periodoEscolar],
      ],
    },
    {
      title: "Responsável",
      items: [
        ["Nome completo", form.responsavel.nomeCompleto],
        ["CPF", form.responsavel.cpf],
        ["RG", form.responsavel.rg],
        ["WhatsApp", form.responsavel.whatsapp],
        ["E-mail", form.responsavel.email],
        ["Parentesco", form.responsavel.parentesco],
      ],
    },
    {
      title: "Endereço",
      items: [
        ["CEP", form.endereco.cep],
        ["Rua", form.endereco.rua],
        ["Número", form.endereco.numero],
        ["Complemento", form.endereco.complemento],
        ["Bairro", form.endereco.bairro],
        ["Cidade", form.endereco.cidade],
        ["Estado", form.endereco.estado],
      ],
    },
    {
      title: "Informações esportivas",
      items: [
        ["Modalidades", uniqueValues(form.esportivas.modalidades).join(", ")],
        ["Unidades", uniqueValues(form.esportivas.unidades).join(", ")],
        ["Horários", uniqueValues(form.esportivas.horarios).join(", ")],
        ["Turmas", uniqueValues(form.esportivas.turmas).join(", ")],
        ["Nível", form.esportivas.nivel],
        ["Já treinou antes?", form.esportivas.treinouAntes],
        ["Característica", form.esportivas.caracteristica],
        ["Objetivo", form.esportivas.objetivo],
      ],
    },
    {
      title: "Saúde",
      items: [
        ["Restrição médica", form.saude.restricaoMedica],
        ["Medicamentos", form.saude.medicamentos],
        ["Alergias", form.saude.alergias],
        ["Lesões", form.saude.lesoes],
        ["Plano de saúde", form.saude.planoSaude],
        ["Observações importantes", form.saude.observacoesImportantes],
      ],
    },
    {
      title: "Informações estratégicas",
      items: [
        ["Como conheceu a J12?", form.estrategicas.comoConheceu],
        ["Indicação", form.estrategicas.indicacaoQuem],
        ["Observações gerais", form.estrategicas.observacoesGerais],
      ],
    },
  ];

  const docs = [
    form.documentos.fotoPerfilAluno?.name,
    form.documentos.rgCpfAluno?.name,
    form.documentos.rgCpfResponsavel?.name,
    form.documentos.comprovanteEndereco?.name,
    form.documentos.atestadoMedico?.name,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#ff6b00]/20 bg-[#ff6b00]/8 px-4 py-4 text-sm leading-6 text-[#ffd2bb]">
        Revise as informacoes antes de finalizar. Campos opcionais vazios serao salvos em branco e
        poderao ser preenchidos depois no perfil do aluno.
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
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
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-4 text-lg font-semibold text-white">Documentos</h3>
        {docs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {docs.map((doc) => (
              <span
                key={doc}
                className="rounded-full border border-[#ff6b00]/25 bg-[#ff6b00]/10 px-3 py-1 text-xs text-[#ffb07e]"
              >
                {doc}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/55">
            Nenhum documento anexado. Documentos sao opcionais e podem ser enviados depois.
          </p>
        )}
      </div>
    </div>
  );
}
