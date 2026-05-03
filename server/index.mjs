import { createServer } from "node:http";
import {
  ALLOWED_COLLECTIONS,
  authenticateUser,
  changeUserPassword,
  completeStudentFirstAccess,
  createPublicEnrollment,
  createPasswordResetToken,
  createSession,
  deleteSession,
  findUserBySessionToken,
  getNextEnrollmentNumberPreview,
  purgeExpiredPasswordResetTokens,
  resetUserPassword,
  validatePasswordResetToken,
  getCollection,
  getDatabasePath,
  putCollection,
} from "./database.mjs";
import { sendPasswordResetEmail } from "./email.mjs";

const NODE_ENV = process.env.NODE_ENV || "development";
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || "4001");
const SHOW_HEALTH_DETAILS = process.env.HEALTH_SHOW_DETAILS === "true";
const DEFAULT_PRODUCTION_ORIGINS = ["https://app.j12sports.com.br"];
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
const APP_BASE_URL = process.env.APP_BASE_URL?.trim() || "";

/**
 * Em desenvolvimento, libera leitura das coleções mesmo sem token.
 * Em produção, continua exigindo login.
 */
const DEV_AUTH_BYPASS = process.env.DEV_AUTH_BYPASS === "true" && NODE_ENV !== "production";

const COLLECTION_ALIASES = {
  "/alunos": "alunos",
  "/financeiro": "financeiro",
  "/turmas": "turmas",
  "/professores": "professores",
  "/planos": "planos",
  "/contratos": "contratos",
  "/settings": "settings",
};

const DEV_ADMIN_USER = {
  id: "dev-admin",
  nome: "Administrador J12",
  email: "admin@j12.local",
  role: "admin",
};
const COLLECTION_ITEM_ROUTES = new Set(["alunos", "financeiro"]);
const PERIODICIDADE_MONTHS = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

function parseAllowedOrigins(rawValue) {
  if (rawValue?.trim()) {
    return rawValue
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return NODE_ENV === "production" ? DEFAULT_PRODUCTION_ORIGINS : ["*"];
}

function getAllowedOrigin(req) {
  const requestOrigin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (!requestOrigin) return null;
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : null;
}

function isOriginAllowed(req) {
  if (ALLOWED_ORIGINS.includes("*")) return true;
  if (!req.headers.origin) return true;
  return ALLOWED_ORIGINS.includes(req.headers.origin);
}

function setCorsHeaders(req, res) {
  const allowedOrigin = getAllowedOrigin(req);

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }

  if (allowedOrigin && allowedOrigin !== "*") {
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
}

function sendJson(req, res, status, payload) {
  setCorsHeaders(req, res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendHtml(req, res, status, html) {
  setCorsHeaders(req, res);
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024 * 4) {
        reject(new Error("Payload excede o limite de 4MB"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON invalido"));
      }
    });

    req.on("error", reject);
  });
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length);
}

function getAuthenticatedUser(req) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return findUserBySessionToken(token);
}

function getUserOrDevAdmin(req) {
  const user = getAuthenticatedUser(req);

  if (user) return user;

  if (DEV_AUTH_BYPASS) {
    return DEV_ADMIN_USER;
  }

  return null;
}

function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isPrivilegedUser(user) {
  return user?.role === "admin" || user?.role === "coordenador";
}

function getTurmasCollection() {
  const record = getCollection("turmas");
  return Array.isArray(record?.data) ? record.data : [];
}

function getSettingsCollection() {
  const record = getCollection("settings");
  return record?.data ?? null;
}

function getProfessorAccessContext(user) {
  const turmas = getTurmasCollection();
  const settings = getSettingsCollection();
  const users = Array.isArray(settings?.users) ? settings.users : [];
  const configuredUser = users.find((item) => String(item?.id ?? "") === String(user?.id ?? ""));

  let classIds = Array.isArray(configuredUser?.classIds)
    ? configuredUser.classIds.filter((item) => typeof item === "string" && item.trim())
    : [];

  if (classIds.length === 0) {
    classIds = turmas
      .filter((turma) => {
        if (!turma) return false;
        if (user?.teacherId && turma.professorId && turma.professorId === user.teacherId) {
          return true;
        }

        return normalizeComparable(turma.professor) === normalizeComparable(user?.nome);
      })
      .map((turma) => turma.id)
      .filter((item) => typeof item === "string" && item.trim());
  }

  const allowedClassIds = new Set(classIds);
  const allowedTurmas = turmas.filter((turma) => allowedClassIds.has(turma?.id));
  const allowedStudentIds = new Set(
    allowedTurmas.flatMap((turma) =>
      Array.isArray(turma?.alunoIds)
        ? turma.alunoIds.filter((item) => typeof item === "string" && item.trim())
        : [],
    ),
  );

  return {
    settings,
    configuredUser,
    allowedClassIds,
    allowedTurmas,
    allowedStudentIds,
  };
}

function buildScopedSettings(data, user) {
  if (!data || typeof data !== "object") return data;
  if (isPrivilegedUser(user)) return data;

  const base = {
    ...data,
    general: data.general ?? {},
    appearance: data.appearance ?? {},
    notifications: data.notifications ?? {},
    permissions: Array.isArray(data.permissions)
      ? data.permissions.filter((item) => item?.role === user?.role)
      : [],
    integrations:
      user?.role === "professor"
        ? {
            ...data.integrations,
            automationToken: "",
          }
        : {
            whatsappEnabled: false,
            emailEnabled: false,
            paymentGateway: "",
            automationToken: "",
          },
  };

  if (user?.role === "professor") {
    return {
      ...base,
      users: Array.isArray(data.users)
        ? data.users.filter((item) => String(item?.id ?? "") === String(user.id))
        : [],
      teacherAssets: Array.isArray(data.teacherAssets)
        ? data.teacherAssets.filter((item) => item?.teacherId === user.teacherId)
        : [],
      units: Array.isArray(data.units) ? data.units : [],
      modalities: Array.isArray(data.modalities) ? data.modalities : [],
      contracts: [],
    };
  }

  return {
    ...base,
    users: Array.isArray(data.users)
      ? data.users.filter((item) => String(item?.studentId ?? "") === String(user?.studentId ?? ""))
      : [],
    teacherAssets: [],
    units: [],
    modalities: [],
    contracts: [],
  };
}

function filterCollectionForUser(collection, data, user) {
  if (!user) return data;
  if (isPrivilegedUser(user)) return data;

  if (collection === "settings") {
    return buildScopedSettings(data, user);
  }

  if (user.role === "professor") {
    if (!Array.isArray(data)) return [];

    const context = getProfessorAccessContext(user);

    switch (collection) {
      case "turmas":
        return data.filter((item) => context.allowedClassIds.has(item?.id));
      case "alunos":
        return data.filter((item) => context.allowedStudentIds.has(item?.id));
      case "professores":
        return data.filter(
          (item) =>
            item?.id === user.teacherId ||
            normalizeComparable(item?.nome) === normalizeComparable(user.nome),
        );
      case "planos":
        return [];
      case "financeiro":
      case "financeiro-recorrencias":
      case "contratos":
      case "trial-classes":
        return [];
      default:
        return [];
    }
  }

  const studentId = String(user.studentId ?? "").trim();
  if (!studentId) return Array.isArray(data) ? [] : data;
  if (!Array.isArray(data)) return data;

  switch (collection) {
    case "alunos":
      return data.filter((item) => item?.id === studentId);
    case "contratos":
      return data.filter((item) => item?.alunoId === studentId);
    case "financeiro":
      return data.filter((item) => item?.alunoId === studentId);
    case "turmas":
      return data.filter(
        (item) => Array.isArray(item?.alunoIds) && item.alunoIds.includes(studentId),
      );
    case "professores": {
      const ownTurmas = getTurmasCollection().filter(
        (item) => Array.isArray(item?.alunoIds) && item.alunoIds.includes(studentId),
      );
      const teacherIds = new Set(ownTurmas.map((item) => item?.professorId).filter(Boolean));
      return data.filter((item) => teacherIds.has(item?.id));
    }
    default:
      return [];
  }
}

function canWriteCollection(user, collection, payload) {
  if (!user) return false;
  if (isPrivilegedUser(user)) return true;

  if (user.role === "professor") {
    if (collection !== "turmas" || !Array.isArray(payload)) return false;

    const currentRecord = getCollection("turmas");
    const currentData = Array.isArray(currentRecord?.data) ? currentRecord.data : [];
    const currentById = new Map(currentData.map((item) => [item.id, item]));
    const nextById = new Map(payload.map((item) => [item?.id, item]));
    const { allowedClassIds } = getProfessorAccessContext(user);

    if (payload.length !== currentData.length) return false;

    for (const currentItem of currentData) {
      const nextItem = nextById.get(currentItem.id);
      if (!nextItem) return false;

      if (!allowedClassIds.has(currentItem.id)) {
        if (JSON.stringify(nextItem) !== JSON.stringify(currentItem)) {
          return false;
        }
        continue;
      }

      const currentBase = { ...currentItem, presencas: undefined };
      const nextBase = { ...nextItem, presencas: undefined };

      if (JSON.stringify(currentBase) !== JSON.stringify(nextBase)) {
        return false;
      }
    }

    return [...nextById.keys()].every((id) => currentById.has(id));
  }

  if (
    (user.role === "aluno" || user.role === "responsavel") &&
    collection === "alunos" &&
    Array.isArray(payload)
  ) {
    return payload.every((item) => item?.id === user.studentId);
  }

  return false;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return (
    password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
  );
}

function normalizeCep(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .trim();
}

async function lookupAddressByCep(cep) {
  const normalizedCep = normalizeCep(cep);

  if (normalizedCep.length !== 8) {
    throw new Error("Informe um CEP valido com 8 numeros.");
  }

  let response;

  try {
    response = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("Nao foi possivel consultar o CEP no momento.");
  }

  if (!response.ok) {
    throw new Error("Nao foi possivel consultar o CEP no momento.");
  }

  const data = await response.json();

  if (data?.erro) {
    throw new Error("CEP nao encontrado. Confira os numeros e tente novamente.");
  }

  return {
    cep: normalizedCep,
    rua: String(data?.logradouro ?? "").trim(),
    bairro: String(data?.bairro ?? "").trim(),
    cidade: String(data?.localidade ?? "").trim(),
    estado: String(data?.uf ?? "")
      .trim()
      .toUpperCase(),
  };
}

function getAppBaseUrl(req) {
  if (APP_BASE_URL) {
    return APP_BASE_URL.replace(/\/+$/, "");
  }

  if (req.headers.origin) {
    return req.headers.origin.replace(/\/+$/, "");
  }

  return `http://${req.headers.host ?? `${HOST}:${PORT}`}`;
}

function getCollectionPayload(collection, user) {
  const record = getCollection(collection);

  if (!record) {
    const fallbackData = collection === "settings" ? {} : [];

    return {
      data: fallbackData,
      updatedAt: new Date().toISOString(),
      initialized: false,
    };
  }

  return {
    data: filterCollectionForUser(collection, record.data, user),
    updatedAt: record.updatedAt,
    initialized: true,
  };
}

function createCollectionRecordId(collection) {
  const prefix = collection === "alunos" ? "a" : collection === "financeiro" ? "f" : "r";
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function getCollectionArrayData(collection) {
  const record = getCollection(collection);
  return Array.isArray(record?.data) ? [...record.data] : [];
}

function createCollectionItem(collection, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Payload invalido para criar registro.");
  }

  const items = getCollectionArrayData(collection);
  const nextId = String(payload.id ?? "").trim() || createCollectionRecordId(collection);

  if (items.some((item) => String(item?.id ?? "") === nextId)) {
    throw new Error(`Ja existe um registro com o ID ${nextId}.`);
  }

  const nextItem = { ...payload, id: nextId };
  const updatedAt = putCollection(collection, [nextItem, ...items]);

  return {
    item: nextItem,
    updatedAt,
  };
}

function updateCollectionItem(collection, itemId, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Payload invalido para atualizar registro.");
  }

  const normalizedId = String(itemId ?? "").trim();
  const items = getCollectionArrayData(collection);
  const index = items.findIndex((item) => String(item?.id ?? "") === normalizedId);

  if (index < 0) {
    return null;
  }

  const nextItem = {
    ...items[index],
    ...payload,
    id: normalizedId,
  };
  const nextItems = items.map((item, currentIndex) => (currentIndex === index ? nextItem : item));
  const updatedAt = putCollection(collection, nextItems);

  return {
    item: nextItem,
    updatedAt,
  };
}

function deleteCollectionItem(collection, itemId) {
  const normalizedId = String(itemId ?? "").trim();
  const items = getCollectionArrayData(collection);
  const nextItems = items.filter((item) => String(item?.id ?? "") !== normalizedId);

  if (nextItems.length === items.length) {
    return null;
  }

  const updatedAt = putCollection(collection, nextItems);

  if (collection === "alunos") {
    const turmas = getCollectionArrayData("turmas");
    const nextTurmas = turmas.map((turma) => {
      if (!Array.isArray(turma?.alunoIds) || !turma.alunoIds.includes(normalizedId)) {
        return turma;
      }

      return {
        ...turma,
        alunoIds: turma.alunoIds.filter((alunoId) => alunoId !== normalizedId),
      };
    });

    if (JSON.stringify(nextTurmas) !== JSON.stringify(turmas)) {
      putCollection("turmas", nextTurmas);
    }
  }

  return { updatedAt };
}

function normalizeMoney(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function normalizeDay(value, fallback = 10) {
  const day = Number.parseInt(String(value ?? fallback), 10);

  if (!Number.isFinite(day)) return fallback;
  return Math.min(28, Math.max(1, day));
}

function normalizeReferenceMonth(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})/);

  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  return new Date().toISOString().slice(0, 7);
}

function getMonthStart(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return new Date(year, month - 1, 1);
}

function monthDiff(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function inferPeriodicidade(value) {
  const normalized = normalizeComparable(value);
  if (normalized.includes("bimes")) return "bimestral";
  if (normalized.includes("trimes")) return "trimestral";
  if (normalized.includes("semes")) return "semestral";
  if (normalized.includes("anual")) return "anual";
  return "mensal";
}

function resolveAlunoPlanoFinanceiro(planos, aluno) {
  const planosAluno = Array.isArray(aluno?.planos)
    ? aluno.planos.filter((item) => typeof item === "string" && item.trim())
    : [];
  const planoPrimario = String(aluno?.plano ?? planosAluno[0] ?? "").trim();
  const planoMatch =
    planos.find((plano) => String(plano?.id ?? "") === String(aluno?.financeiro?.planoId ?? "")) ??
    planos.find(
      (plano) =>
        normalizeComparable(plano?.nome) === normalizeComparable(planoPrimario) ||
        planosAluno.some(
          (nomePlano) => normalizeComparable(plano?.nome) === normalizeComparable(nomePlano),
        ),
    ) ??
    null;

  return {
    planId: aluno?.financeiro?.planoId ?? planoMatch?.id ?? null,
    planName: planoMatch?.nome ?? planoPrimario,
    valuePlan: normalizeMoney(aluno?.financeiro?.valorPlano ?? planoMatch?.precoMensal),
    periodicidade:
      aluno?.financeiro?.periodicidade ?? inferPeriodicidade(planoMatch?.nome ?? planoPrimario),
  };
}

function shouldGenerateChargeForReference(startDate, periodicidade, referenceMonth) {
  const start = getMonthStart(startDate);
  const reference = getMonthStart(referenceMonth);
  const step = PERIODICIDADE_MONTHS[periodicidade] ?? 1;

  if (!start || !reference) return false;

  const diff = monthDiff(start, reference);
  if (diff < 0) return false;

  return diff % step === 0;
}

function buildDueDate(referenceMonth, day) {
  const reference = getMonthStart(referenceMonth);
  if (!reference) {
    return `${referenceMonth}-01`;
  }

  const lastDay = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
  return toIsoDate(new Date(reference.getFullYear(), reference.getMonth(), Math.min(day, lastDay)));
}

function computeProRataAmount(value, startDate) {
  const raw = String(startDate ?? "").trim();
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return value;

  const daysInMonth = new Date(year, month, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - day + 1);
  return normalizeMoney((value / daysInMonth) * remainingDays);
}

function computeChargeValues(aluno, valuePlan, referenceMonth, startDate) {
  const cobrarProporcional =
    aluno?.financeiro?.cobrancaProporcional === true &&
    String(startDate ?? "").slice(0, 7) === referenceMonth &&
    String(startDate ?? "").slice(8, 10) !== "01";
  const valorOriginal = cobrarProporcional
    ? computeProRataAmount(valuePlan, startDate)
    : normalizeMoney(valuePlan);
  const descontoPercentual = normalizeMoney(aluno?.financeiro?.descontoPercentual);
  const descontoValor = normalizeMoney(
    aluno?.financeiro?.descontoValor + valorOriginal * (descontoPercentual / 100),
  );
  const bolsaPercentual = normalizeMoney(aluno?.financeiro?.bolsaPercentual);
  const bolsaValor = normalizeMoney(
    aluno?.financeiro?.bolsaValor + valorOriginal * (bolsaPercentual / 100),
  );
  const valorFinal = Math.max(0, normalizeMoney(valorOriginal - descontoValor - bolsaValor));

  return {
    valorOriginal,
    descontoPercentual,
    descontoValor,
    bolsaPercentual,
    bolsaValor,
    valorFinal,
  };
}

function generateMonthlyCharges(referenceInput) {
  const referenceMonth = normalizeReferenceMonth(referenceInput);
  const alunos = getCollectionArrayData("alunos");
  const planos = getCollectionArrayData("planos");
  const financeiro = getCollectionArrayData("financeiro");
  const nextFinanceiro = [...financeiro];
  let createdCount = 0;
  let skippedCount = 0;

  for (const aluno of alunos) {
    const statusAluno = normalizeComparable(aluno?.status);
    if (statusAluno && statusAluno !== "ativo" && statusAluno !== "experimental") {
      skippedCount += 1;
      continue;
    }

    const recorrenciaAtiva = aluno?.financeiro?.recorrenciaAtiva ?? true;
    const cobrancaAutomatica = aluno?.financeiro?.cobrancaAutomatica ?? recorrenciaAtiva;

    if (!recorrenciaAtiva || !cobrancaAutomatica) {
      skippedCount += 1;
      continue;
    }

    const planoFinanceiro = resolveAlunoPlanoFinanceiro(planos, aluno);
    if (!planoFinanceiro.planName || planoFinanceiro.valuePlan <= 0) {
      skippedCount += 1;
      continue;
    }

    const startDate = String(
      aluno?.financeiro?.dataInicioFinanceiro ?? aluno?.matriculaEm ?? `${referenceMonth}-01`,
    ).trim();

    if (
      !shouldGenerateChargeForReference(startDate, planoFinanceiro.periodicidade, referenceMonth)
    ) {
      skippedCount += 1;
      continue;
    }

    const competencia = `${referenceMonth}:${planoFinanceiro.periodicidade}`;
    const existingCharge = nextFinanceiro.some(
      (transacao) =>
        String(transacao?.alunoId ?? "") === String(aluno?.id ?? "") &&
        String(transacao?.competencia ?? "") === competencia &&
        String(transacao?.tipoCobranca ?? "avulsa") === "recorrente" &&
        normalizeComparable(transacao?.status) !== "cancelada",
    );

    if (existingCharge) {
      skippedCount += 1;
      continue;
    }

    const dueDate = buildDueDate(
      referenceMonth,
      normalizeDay(aluno?.financeiro?.diaVencimento ?? String(startDate).slice(8, 10) ?? 10),
    );
    const values = computeChargeValues(aluno, planoFinanceiro.valuePlan, referenceMonth, startDate);
    const responsavel = aluno?.matricula?.responsavel ?? {};
    const transacao = {
      id: createCollectionRecordId("financeiro"),
      alunoId: aluno.id,
      alunoNome: aluno.nome ?? "Aluno",
      descricao: `Mensalidade - ${planoFinanceiro.planName}`,
      tipo: "mensalidade",
      valor: values.valorFinal,
      vencimento: dueDate,
      pagoEm: null,
      formaPagamento: undefined,
      observacao: aluno?.financeiro?.observacoes ?? null,
      responsavelFinanceiro:
        responsavel.nomeCompleto ??
        aluno?.responsavel ??
        aluno?.nome ??
        "Responsavel nao informado",
      responsavelCpf: responsavel.cpf ?? null,
      telefoneWhatsapp:
        responsavel.whatsapp ?? aluno?.telefoneResponsavel ?? aluno?.telefone ?? null,
      email: responsavel.email ?? aluno?.email ?? null,
      unidade: Array.isArray(aluno?.unidades) ? (aluno.unidades[0] ?? "") : "",
      modalidade: aluno?.modalidade ?? "",
      turma: aluno?.turma ?? (Array.isArray(aluno?.turmas) ? (aluno.turmas[0] ?? "") : ""),
      planoId: planoFinanceiro.planId,
      planoNome: planoFinanceiro.planName,
      periodicidade: planoFinanceiro.periodicidade,
      competencia,
      valorOriginal: values.valorOriginal,
      descontoValor: values.descontoValor,
      descontoPercentual: values.descontoPercentual,
      bolsaValor: values.bolsaValor,
      bolsaPercentual: values.bolsaPercentual,
      multaPercentual: normalizeMoney(aluno?.financeiro?.multaPercentual),
      jurosDiaPercentual: normalizeMoney(aluno?.financeiro?.jurosDiaPercentual),
      valorFinal: values.valorFinal,
      dataGeracao: new Date().toISOString().slice(0, 10),
      dataPagamento: null,
      status: "pendente",
      tipoCobranca: "recorrente",
      origem: "automatica",
      ativo: true,
    };

    nextFinanceiro.unshift(transacao);
    createdCount += 1;
  }

  if (createdCount > 0) {
    putCollection("financeiro", nextFinanceiro);
  }

  return {
    competencia: referenceMonth,
    createdCount,
    skippedCount,
    message:
      createdCount > 0
        ? `${createdCount} mensalidade(s) gerada(s) e ${skippedCount} ignorada(s).`
        : `Nenhuma nova mensalidade foi criada. ${skippedCount} registro(s) foram ignorados.`,
  };
}

const server = createServer(async (req, res) => {
  setCorsHeaders(req, res);
  purgeExpiredPasswordResetTokens();

  if (!req.url || !req.method) {
    sendJson(req, res, 400, { message: "Requisicao invalida" });
    return;
  }

  if (!isOriginAllowed(req)) {
    sendJson(req, res, 403, { message: "Origem nao permitida" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
  const pathname = url.pathname;

  if (pathname === "/" && req.method === "GET") {
    sendJson(req, res, 200, {
      status: "J12 API ONLINE 🚀",
      port: PORT,
      authBypassDev: DEV_AUTH_BYPASS,
    });
    return;
  }

  if (pathname === "/health" && req.method === "GET") {
    const payload = {
      ok: true,
      service: "j12-persistent-api",
      timestamp: new Date().toISOString(),
    };

    if (SHOW_HEALTH_DETAILS) {
      payload.runtime = {
        host: HOST,
        port: PORT,
        databasePath: getDatabasePath(),
        collections: [...ALLOWED_COLLECTIONS],
        allowedOrigins: ALLOWED_ORIGINS,
        authBypassDev: DEV_AUTH_BYPASS,
      };
    }

    sendJson(req, res, 200, payload);
    return;
  }

  if (pathname === "/auth/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email ?? body.login ?? body.identifier ?? "")
        .trim()
        .toLowerCase();
      const senha = String(body.senha ?? "");

      const user = authenticateUser(email, senha);

      if (!user) {
        sendJson(req, res, 401, { message: "E-mail ou senha invalidos" });
        return;
      }

      const token = createSession(user.id);
      sendJson(req, res, 200, { token, user });
    } catch (error) {
      sendJson(req, res, 400, {
        message: error instanceof Error ? error.message : "Falha ao processar login",
      });
    }
    return;
  }

  if (pathname === "/auth/me" && req.method === "GET") {
    const user = getAuthenticatedUser(req);

    if (!user) {
      sendJson(req, res, 401, { message: "Sessao invalida ou expirada" });
      return;
    }

    sendJson(req, res, 200, user);
    return;
  }

  if (pathname === "/auth/logout" && req.method === "POST") {
    const token = getTokenFromRequest(req);
    if (!token || !getAuthenticatedUser(req)) {
      sendJson(req, res, 401, { message: "Sessao invalida ou expirada" });
      return;
    }

    deleteSession(token);
    sendJson(req, res, 200, { ok: true });
    return;
  }

  if (pathname === "/auth/change-password" && req.method === "POST") {
    try {
      const user = getAuthenticatedUser(req);

      if (!user) {
        sendJson(req, res, 401, { message: "Sessao invalida ou expirada" });
        return;
      }

      const body = await readJsonBody(req);
      const senhaAtual = String(body.senhaAtual ?? "");
      const novaSenha = String(body.novaSenha ?? "");
      const confirmarSenha = String(body.confirmarSenha ?? "");

      if (!senhaAtual || !novaSenha) {
        sendJson(req, res, 400, { message: "Preencha a senha atual e a nova senha." });
        return;
      }

      if (novaSenha !== confirmarSenha) {
        sendJson(req, res, 400, { message: "A confirmacao da nova senha nao confere." });
        return;
      }

      changeUserPassword(user.id, senhaAtual, novaSenha);
      sendJson(req, res, 200, { ok: true, message: "Senha alterada com sucesso." });
    } catch (error) {
      sendJson(req, res, 400, {
        message: error instanceof Error ? error.message : "Falha ao alterar senha",
      });
    }
    return;
  }

  if (pathname === "/auth/first-access" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const user = completeStudentFirstAccess(body);

      sendJson(req, res, 201, {
        ok: true,
        user,
        message: "Primeiro acesso configurado. Agora voce ja pode entrar com seu e-mail e senha.",
      });
    } catch (error) {
      sendJson(req, res, 400, {
        message: error instanceof Error ? error.message : "Falha ao concluir primeiro acesso",
      });
    }
    return;
  }

  if (pathname === "/auth/forgot-password" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();

      if (!isValidEmail(email)) {
        sendJson(req, res, 400, { message: "Informe um e-mail valido" });
        return;
      }

      const reset = createPasswordResetToken(email);

      if (!reset) {
        sendJson(req, res, 404, { message: "Nao encontramos um usuario com este e-mail" });
        return;
      }

      const resetUrl = `${getAppBaseUrl(req)}/reset-password/${reset.token}`;
      const delivery = await sendPasswordResetEmail({
        to: reset.user.email,
        resetUrl,
        expiresAt: reset.expiresAt,
      });

      sendJson(req, res, 200, {
        ok: true,
        message: "Enviamos o link de redefinicao para o e-mail informado.",
        expiresAt: reset.expiresAt,
        previewUrl: delivery.previewUrl ?? null,
        deliveryProvider: delivery.provider,
      });
    } catch (error) {
      sendJson(req, res, 400, {
        message: error instanceof Error ? error.message : "Falha ao iniciar recuperacao de senha",
      });
    }
    return;
  }

  if (pathname.startsWith("/auth/reset-password/") && req.method === "GET") {
    const token = pathname.slice("/auth/reset-password/".length);
    const validation = validatePasswordResetToken(token);

    if (!validation.ok) {
      sendJson(req, res, 400, { message: validation.reason, valid: false });
      return;
    }

    sendJson(req, res, 200, {
      valid: true,
      email: validation.data.email,
      expiresAt: validation.data.expiresAt,
    });
    return;
  }

  if (pathname === "/auth/reset-password" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const token = String(body.token ?? "").trim();
      const senha = String(body.senha ?? "");
      const confirmarSenha = String(body.confirmarSenha ?? "");

      if (!token) {
        sendJson(req, res, 400, { message: "Token de redefinicao obrigatorio" });
        return;
      }

      if (!isStrongPassword(senha)) {
        sendJson(req, res, 400, {
          message:
            "A senha deve ter no minimo 8 caracteres, incluindo letra maiuscula, minuscula e numero",
        });
        return;
      }

      if (senha !== confirmarSenha) {
        sendJson(req, res, 400, { message: "A confirmacao da senha nao confere" });
        return;
      }

      resetUserPassword(token, senha);

      sendJson(req, res, 200, {
        ok: true,
        message: "Senha alterada com sucesso.",
      });
    } catch (error) {
      sendJson(req, res, 400, {
        message: error instanceof Error ? error.message : "Falha ao redefinir senha",
      });
    }
    return;
  }

  if (pathname === "/public/enrollments" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);

      const requiredChecks = [
        body?.dadosAluno?.nomeCompleto,
        body?.dadosAluno?.dataNascimento,
        body?.dadosAluno?.cpf,
        body?.dadosAluno?.rg,
        body?.dadosAluno?.sexo,
        body?.responsavel?.nomeCompleto,
        body?.responsavel?.cpf,
        body?.responsavel?.rg,
        body?.responsavel?.whatsapp,
        body?.responsavel?.email,
        body?.responsavel?.parentesco,
        body?.endereco?.cep,
        body?.endereco?.rua,
        body?.endereco?.numero,
        body?.endereco?.bairro,
        body?.endereco?.cidade,
        body?.endereco?.estado,
      ];

      if (requiredChecks.some((value) => !String(value ?? "").trim())) {
        sendJson(req, res, 400, { message: "Preencha os dados obrigatorios da matricula" });
        return;
      }

      const result = createPublicEnrollment(body);

      sendJson(req, res, 201, {
        ok: true,
        protocol: result.protocol,
        status: result.status,
        createdAt: result.createdAt,
        numeroMatricula: result.numeroMatricula,
      });
    } catch (error) {
      sendJson(req, res, 400, {
        message: error instanceof Error ? error.message : "Falha ao registrar matricula",
      });
    }
    return;
  }

  if (pathname === "/public/enrollments/next-number" && req.method === "GET") {
    try {
      const result = getNextEnrollmentNumberPreview();
      sendJson(req, res, 200, { ok: true, ...result });
    } catch (error) {
      sendJson(req, res, 409, {
        message:
          error instanceof Error ? error.message : "Nao foi possivel gerar a proxima matricula.",
      });
    }
    return;
  }

  if (pathname === "/public/address/lookup" && req.method === "GET") {
    try {
      const cep = url.searchParams.get("cep");
      const address = await lookupAddressByCep(cep);
      sendJson(req, res, 200, { ok: true, ...address });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel localizar o endereco.";
      const status = message.includes("nao encontrado") ? 404 : 400;
      sendJson(req, res, status, { message });
    }
    return;
  }

  if (pathname === "/financeiro/gerar-mensalidades" && req.method === "POST") {
    const user = getUserOrDevAdmin(req);

    if (!user) {
      sendJson(req, res, 401, { message: "Sessao invalida ou expirada" });
      return;
    }

    if (!isPrivilegedUser(user)) {
      sendJson(req, res, 403, {
        message: "Apenas administradores e coordenadores podem gerar mensalidades.",
      });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = generateMonthlyCharges(body?.competencia ?? body?.referencia);
      sendJson(req, res, 200, result);
    } catch (error) {
      sendJson(req, res, 400, {
        message: error instanceof Error ? error.message : "Falha ao gerar mensalidades.",
      });
    }
    return;
  }

  const directCollectionItemMatch = pathname.match(/^\/(alunos|financeiro)\/([^/]+)$/);
  if (directCollectionItemMatch) {
    const [, collection, rawItemId] = directCollectionItemMatch;
    const itemId = decodeURIComponent(rawItemId);
    const user = getUserOrDevAdmin(req);

    if (!user) {
      sendJson(req, res, 401, { message: "Sessao invalida ou expirada" });
      return;
    }

    if (req.method === "GET") {
      const payload = getCollectionPayload(collection, user);
      const items = Array.isArray(payload.data) ? payload.data : [];
      const item = items.find((currentItem) => String(currentItem?.id ?? "") === itemId);

      if (!item) {
        sendJson(req, res, 404, { message: "Registro nao encontrado" });
        return;
      }

      sendJson(req, res, 200, item);
      return;
    }

    if (!isPrivilegedUser(user)) {
      sendJson(req, res, 403, {
        message: "Voce nao tem permissao para alterar este recurso.",
      });
      return;
    }

    if (req.method === "PUT") {
      try {
        const body = await readJsonBody(req);
        const result = updateCollectionItem(collection, itemId, body);

        if (!result) {
          sendJson(req, res, 404, { message: "Registro nao encontrado" });
          return;
        }

        sendJson(req, res, 200, result.item);
      } catch (error) {
        sendJson(req, res, 400, {
          message: error instanceof Error ? error.message : "Falha ao atualizar registro.",
        });
      }
      return;
    }

    if (req.method === "DELETE") {
      try {
        const result = deleteCollectionItem(collection, itemId);

        if (!result) {
          sendJson(req, res, 404, { message: "Registro nao encontrado" });
          return;
        }

        sendJson(req, res, 200, { ok: true });
      } catch (error) {
        sendJson(req, res, 400, {
          message: error instanceof Error ? error.message : "Falha ao remover registro.",
        });
      }
      return;
    }

    sendJson(req, res, 405, { message: "Metodo nao permitido" });
    return;
  }

  /**
   * Rotas diretas usadas pelo front:
   * /alunos
   * /financeiro
   * /turmas
   * /professores
   * /planos
   * /contratos
   * /settings
   */
  if (COLLECTION_ALIASES[pathname]) {
    const collection = COLLECTION_ALIASES[pathname];
    const user = getUserOrDevAdmin(req);

    if (!user) {
      sendJson(req, res, 401, { message: "Sessao invalida ou expirada" });
      return;
    }

    if (!ALLOWED_COLLECTIONS.has(collection)) {
      sendJson(req, res, 404, { message: "Colecao nao encontrada" });
      return;
    }

    if (req.method === "GET") {
      const payload = getCollectionPayload(collection, user);

      /**
       * Algumas partes do app esperam array direto em /alunos e /financeiro.
       */
      sendJson(req, res, 200, payload.data);
      return;
    }

    if (req.method === "POST" && COLLECTION_ITEM_ROUTES.has(collection)) {
      try {
        const body = await readJsonBody(req);
        const isWrappedCollectionPayload =
          body && typeof body === "object" && !Array.isArray(body) && "data" in body;

        if (
          !isWrappedCollectionPayload &&
          body &&
          typeof body === "object" &&
          !Array.isArray(body)
        ) {
          if (!isPrivilegedUser(user)) {
            sendJson(req, res, 403, {
              message: "Voce nao tem permissao para criar este recurso.",
            });
            return;
          }

          const result = createCollectionItem(collection, body);
          sendJson(req, res, 201, result.item);
          return;
        }
      } catch (error) {
        sendJson(req, res, 400, {
          message: error instanceof Error ? error.message : "Falha ao criar registro.",
        });
        return;
      }
    }

    if (req.method === "PUT" || req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        const nextData = "data" in body ? body.data : body;

        if (!canWriteCollection(user, collection, nextData)) {
          sendJson(req, res, 403, {
            message: "Voce nao tem permissao para alterar esta colecao",
          });
          return;
        }

        const updatedAt = putCollection(collection, nextData);
        sendJson(req, res, 200, { ok: true, updatedAt });
      } catch (error) {
        sendJson(req, res, 400, {
          message: error instanceof Error ? error.message : "Falha ao salvar colecao",
        });
      }
      return;
    }

    sendJson(req, res, 405, { message: "Metodo nao permitido" });
    return;
  }

  /**
   * Rotas padrão do app:
   * /api/state/settings
   * /api/state/turmas
   * /api/state/professores
   * /api/state/planos
   * /api/state/contratos
   */
  if (pathname.startsWith("/api/state/")) {
    const user = getUserOrDevAdmin(req);

    if (!user) {
      sendJson(req, res, 401, { message: "Sessao invalida ou expirada" });
      return;
    }

    const collection = pathname.slice("/api/state/".length);

    if (!ALLOWED_COLLECTIONS.has(collection)) {
      sendJson(req, res, 404, { message: "Colecao nao encontrada" });
      return;
    }

    if (req.method === "GET") {
      const payload = getCollectionPayload(collection, user);

      sendJson(req, res, 200, {
        data: payload.data,
        updatedAt: payload.updatedAt,
        initialized: payload.initialized,
      });
      return;
    }

    if (req.method === "PUT") {
      try {
        const body = await readJsonBody(req);

        if (!("data" in body)) {
          sendJson(req, res, 400, { message: "Campo data obrigatorio" });
          return;
        }

        if (!canWriteCollection(user, collection, body.data)) {
          sendJson(req, res, 403, {
            message: "Voce nao tem permissao para alterar esta colecao",
          });
          return;
        }

        const updatedAt = putCollection(collection, body.data);
        sendJson(req, res, 200, { ok: true, updatedAt });
      } catch (error) {
        sendJson(req, res, 400, {
          message: error instanceof Error ? error.message : "Falha ao salvar colecao",
        });
      }
      return;
    }

    sendJson(req, res, 405, { message: "Metodo nao permitido" });
    return;
  }

  sendJson(req, res, 404, {
    message: "Rota nao encontrada",
    path: pathname,
  });
});

server.listen(PORT, HOST, () => {
  console.log(`J12 API persistente pronta em http://${HOST}:${PORT}`);

  if (DEV_AUTH_BYPASS) {
    console.log("Modo desenvolvimento: leitura liberada sem token.");
  }
});
