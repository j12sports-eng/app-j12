import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SERVER_DIR, "..");
const DATA_DIR = resolve(ROOT_DIR, "data");
const DATABASE_PATH = resolve(DATA_DIR, "j12.sqlite");
const SESSION_DURATION_DAYS = 30;

export const ALLOWED_COLLECTIONS = new Set([
  "alunos",
  "professores",
  "planos",
  "turmas",
  "financeiro",
  "financeiro-recorrencias",
  "contratos",
  "trial-classes",
  "settings",
]);

mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DATABASE_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    teacher_id TEXT,
    student_id TEXT,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS public_enrollments (
    id TEXT PRIMARY KEY,
    protocol TEXT NOT NULL,
    student_name TEXT NOT NULL,
    guardian_name TEXT NOT NULL,
    guardian_email TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS collections (
    name TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS enrollment_numbers (
    numero INTEGER PRIMARY KEY,
    aluno_id TEXT,
    student_name TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_assigned_at TEXT NOT NULL,
    released_at TEXT
  );
`);

function ensureTableColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

ensureTableColumn("public_enrollments", "aluno_id", "TEXT");
ensureTableColumn("public_enrollments", "trial_class_id", "TEXT");
ensureTableColumn("public_enrollments", "synced_at", "TEXT");
ensureTableColumn("users", "student_id", "TEXT");

const countUsersStatement = db.prepare("SELECT COUNT(*) AS total FROM users");
const insertUserStatement = db.prepare(`
  INSERT INTO users (
    id,
    nome,
    email,
    role,
    teacher_id,
    student_id,
    password_hash,
    password_salt,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const findUserByEmailStatement = db.prepare(`
  SELECT
    id,
    nome,
    email,
    role,
    teacher_id,
    student_id,
    password_hash,
    password_salt
  FROM users
  WHERE lower(email) = lower(?)
  LIMIT 1
`);
const findUserByIdStatement = db.prepare(`
  SELECT
    id,
    nome,
    email,
    role,
    teacher_id,
    student_id,
    password_hash,
    password_salt
  FROM users
  WHERE id = ?
  LIMIT 1
`);
const findUserByStudentIdStatement = db.prepare(`
  SELECT
    id,
    nome,
    email,
    role,
    teacher_id,
    student_id,
    password_hash,
    password_salt
  FROM users
  WHERE student_id = ?
  LIMIT 1
`);
const insertSessionStatement = db.prepare(`
  INSERT INTO sessions (token, user_id, created_at, expires_at)
  VALUES (?, ?, ?, ?)
`);
const findSessionUserStatement = db.prepare(`
  SELECT
    sessions.token,
    sessions.expires_at,
    users.id,
    users.nome,
    users.email,
    users.role,
    users.teacher_id,
    users.student_id
  FROM sessions
  INNER JOIN users ON users.id = sessions.user_id
  WHERE sessions.token = ?
  LIMIT 1
`);
const deleteSessionStatement = db.prepare("DELETE FROM sessions WHERE token = ?");
const deleteExpiredSessionsStatement = db.prepare("DELETE FROM sessions WHERE expires_at <= ?");
const updateUserPasswordStatement = db.prepare(`
  UPDATE users
  SET password_hash = ?, password_salt = ?
  WHERE id = ?
`);
const updateUserFirstAccessStatement = db.prepare(`
  UPDATE users
  SET nome = ?, email = ?, role = ?, student_id = ?, password_hash = ?, password_salt = ?
  WHERE id = ?
`);
const insertPasswordResetTokenStatement = db.prepare(`
  INSERT INTO password_reset_tokens (
    token,
    user_id,
    email,
    created_at,
    expires_at,
    used_at
  )
  VALUES (?, ?, ?, ?, ?, NULL)
`);
const findPasswordResetTokenStatement = db.prepare(`
  SELECT
    token,
    user_id,
    email,
    created_at,
    expires_at,
    used_at
  FROM password_reset_tokens
  WHERE token = ?
  LIMIT 1
`);
const markPasswordResetTokenUsedStatement = db.prepare(`
  UPDATE password_reset_tokens
  SET used_at = ?
  WHERE token = ?
`);
const invalidatePasswordResetTokensByUserStatement = db.prepare(`
  UPDATE password_reset_tokens
  SET used_at = ?
  WHERE user_id = ? AND used_at IS NULL
`);
const deleteExpiredPasswordResetTokensStatement = db.prepare(`
  DELETE FROM password_reset_tokens
  WHERE expires_at <= ? OR used_at IS NOT NULL
`);
const insertPublicEnrollmentStatement = db.prepare(`
  INSERT INTO public_enrollments (
    id,
    protocol,
    student_name,
    guardian_name,
    guardian_email,
    status,
    payload,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const updatePublicEnrollmentSyncStatement = db.prepare(`
  UPDATE public_enrollments
  SET aluno_id = ?, trial_class_id = ?, synced_at = ?
  WHERE id = ?
`);
const findCollectionStatement = db.prepare(`
  SELECT name, data, updated_at
  FROM collections
  WHERE name = ?
  LIMIT 1
`);
const upsertCollectionStatement = db.prepare(`
  INSERT INTO collections (name, data, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET
    data = excluded.data,
    updated_at = excluded.updated_at
`);
const listEnrollmentNumbersStatement = db.prepare(`
  SELECT
    numero,
    aluno_id,
    student_name,
    status,
    created_at,
    updated_at,
    last_assigned_at,
    released_at
  FROM enrollment_numbers
  ORDER BY numero ASC
`);
const findEnrollmentNumberStatement = db.prepare(`
  SELECT
    numero,
    aluno_id,
    student_name,
    status,
    created_at,
    updated_at,
    last_assigned_at,
    released_at
  FROM enrollment_numbers
  WHERE numero = ?
  LIMIT 1
`);
const findReusableEnrollmentNumberStatement = db.prepare(`
  SELECT numero, status
  FROM enrollment_numbers
  WHERE status IN ('inativo', 'excluido')
  ORDER BY numero ASC
  LIMIT 1
`);
const findMaxEnrollmentNumberStatement = db.prepare(`
  SELECT MAX(numero) AS numero
  FROM enrollment_numbers
`);
const upsertEnrollmentNumberStatement = db.prepare(`
  INSERT INTO enrollment_numbers (
    numero,
    aluno_id,
    student_name,
    status,
    created_at,
    updated_at,
    last_assigned_at,
    released_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(numero) DO UPDATE SET
    aluno_id = excluded.aluno_id,
    student_name = excluded.student_name,
    status = excluded.status,
    updated_at = excluded.updated_at,
    last_assigned_at = excluded.last_assigned_at,
    released_at = excluded.released_at
`);

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, salt, expectedHash) {
  const candidate = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function assertStrongPassword(password) {
  const normalized = String(password ?? "");
  const valid =
    normalized.length >= 8 &&
    /[A-Z]/.test(normalized) &&
    /[a-z]/.test(normalized) &&
    /\d/.test(normalized);

  if (!valid) {
    throw new Error(
      "A senha deve ter no minimo 8 caracteres, incluindo letra maiuscula, minuscula e numero.",
    );
  }
}

function sanitizeUser(row) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    role: row.role,
    teacherId: row.teacher_id ?? null,
    studentId:
      row.student_id ?? (String(row.email ?? "").toLowerCase() === "aluno@j12.com" ? "a1" : null),
    responsavelId: row.role === "responsavel" ? (row.student_id ?? null) : null,
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEnrollmentNumber(value) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .trim();
  if (!digits) return null;

  const numero = Number.parseInt(digits, 10);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function normalizeComparable(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function slug(value) {
  return normalizeComparable(value)
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function createCollectionRecordId(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function createHistoryEntry(title, description, at = new Date().toISOString()) {
  return {
    id: `th${Date.now()}${Math.floor(Math.random() * 1000)}`,
    title,
    description,
    at,
  };
}

const MODALITY_SUGGESTIONS = {
  futebol: {
    modalidade: "Futebol",
    unidade: "Unidade Centro",
    turma: "Sub-11 Tarde",
    professor: "Prof. Ricardo Mendes",
    time: "14:00",
  },
  futsal: {
    modalidade: "Futsal",
    unidade: "Unidade Zona Sul",
    turma: "Sub-15 Noite",
    professor: "Prof. Andre Silva",
    time: "19:00",
  },
  volei: {
    modalidade: "Volei",
    unidade: "Unidade Centro",
    turma: "Sub-13 Tarde",
    professor: "Profa. Camila Rocha",
    time: "15:00",
  },
};

function getCollectionArray(name) {
  if (!ALLOWED_COLLECTIONS.has(name)) return [];

  const row = findCollectionStatement.get(name);
  if (!row) return [];

  try {
    const parsed = JSON.parse(row.data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function putCollectionWithTimestamp(name, data, updatedAt) {
  if (!ALLOWED_COLLECTIONS.has(name)) {
    throw new Error(`Colecao invalida: ${name}`);
  }

  upsertCollectionStatement.run(name, JSON.stringify(data), updatedAt);
}

function mapPublicModality(rawValue, turmas) {
  const normalized = normalizeComparable(rawValue);
  const key = normalized.includes("futsal")
    ? "futsal"
    : normalized.includes("society") || normalized.includes("ambos")
      ? "futebol"
      : normalized.includes("volei")
        ? "volei"
        : "futebol";

  const match = turmas.find((turma) => normalizeComparable(turma?.modalidade) === key);
  const fallback = MODALITY_SUGGESTIONS[key] ?? MODALITY_SUGGESTIONS.futebol;

  return {
    key,
    modalidade: normalizeText(match?.modalidade) || fallback.modalidade,
    unidade: normalizeText(match?.unidade) || fallback.unidade,
    turma: normalizeText(match?.nome) || fallback.turma,
    professor: normalizeText(match?.professor) || fallback.professor,
    time: normalizeText(match?.horarioInicio) || fallback.time,
  };
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeAlunoCascadeData(aluno) {
  const esportivas = aluno?.matricula?.esportivas ?? {};

  return {
    modalidades: normalizeStringList(
      esportivas.modalidades?.length ? esportivas.modalidades : [aluno?.modalidade],
    ),
    unidades: normalizeStringList([
      ...(Array.isArray(aluno?.unidades) ? aluno.unidades : []),
      ...(Array.isArray(esportivas.unidades) ? esportivas.unidades : []),
    ]),
    turmas: normalizeStringList([
      ...(Array.isArray(aluno?.turmas) ? aluno.turmas : []),
      ...(typeof aluno?.turma === "string" ? [aluno.turma] : []),
      ...(Array.isArray(esportivas.turmas) ? esportivas.turmas : []),
    ]),
    planos: normalizeStringList([
      ...(Array.isArray(aluno?.planos) ? aluno.planos : []),
      ...(typeof aluno?.plano === "string" ? [aluno.plano] : []),
    ]),
  };
}

function validateAlunoCascadeRelationships(alunos) {
  const turmas = getCollectionArray("turmas");
  const planos = getCollectionArray("planos");

  const turmasAtivas = turmas.filter((turma) => turma && turma.ativa !== false);
  const turmaByName = new Map(
    turmasAtivas
      .filter((turma) => typeof turma?.nome === "string" && turma.nome.trim())
      .map((turma) => [normalizeComparable(turma.nome), turma]),
  );
  const planoByName = new Map(
    planos
      .filter((plano) => typeof plano?.nome === "string" && plano.nome.trim())
      .map((plano) => [normalizeComparable(plano.nome), plano]),
  );

  for (const aluno of Array.isArray(alunos) ? alunos : []) {
    const {
      modalidades,
      unidades,
      turmas: turmasAluno,
      planos: planosAluno,
    } = normalizeAlunoCascadeData(aluno);

    const modalidadesNormalizadas = new Set(modalidades.map((item) => normalizeComparable(item)));
    const unidadesNormalizadas = new Set(unidades.map((item) => normalizeComparable(item)));
    const turmasResolvidas = [];

    for (const turmaNome of turmasAluno) {
      const turma = turmaByName.get(normalizeComparable(turmaNome));
      if (!turma) {
        throw new Error(
          `A turma "${turmaNome}" do aluno "${aluno?.nome ?? "sem nome"}" não está disponível.`,
        );
      }

      turmasResolvidas.push(turma);

      if (
        modalidadesNormalizadas.size > 0 &&
        !modalidadesNormalizadas.has(normalizeComparable(turma.modalidade))
      ) {
        throw new Error(
          `A turma "${turma.nome}" não corresponde à modalidade selecionada para o aluno "${aluno?.nome ?? "sem nome"}".`,
        );
      }

      if (
        unidadesNormalizadas.size > 0 &&
        !unidadesNormalizadas.has(normalizeComparable(turma.unidade))
      ) {
        throw new Error(
          `A turma "${turma.nome}" não corresponde à unidade selecionada para o aluno "${aluno?.nome ?? "sem nome"}".`,
        );
      }
    }

    for (const planoNome of planosAluno) {
      const plano = planoByName.get(normalizeComparable(planoNome));
      if (!plano) continue;

      if (normalizeComparable(plano.status) !== "ativo") {
        throw new Error(`O plano "${plano.nome}" não está ativo para novas matrículas.`);
      }

      const modalidadesPlano = new Set(
        normalizeStringList(plano.modalidades).map((item) => normalizeComparable(item)),
      );

      if (
        modalidadesPlano.size > 0 &&
        modalidadesNormalizadas.size > 0 &&
        ![...modalidadesNormalizadas].some((modalidade) => modalidadesPlano.has(modalidade))
      ) {
        throw new Error(
          `O plano "${plano.nome}" não pertence à modalidade selecionada para o aluno "${aluno?.nome ?? "sem nome"}".`,
        );
      }

      const aulasPorSemana = Number(plano.aulasPorSemana ?? 0);
      if (
        Number.isFinite(aulasPorSemana) &&
        aulasPorSemana > 0 &&
        turmasResolvidas.length > 0 &&
        aulasPorSemana > turmasResolvidas.length
      ) {
        throw new Error(
          `O plano "${plano.nome}" exige mais horários do que os selecionados para o aluno "${aluno?.nome ?? "sem nome"}".`,
        );
      }
    }
  }
}

function getAlunoEnrollmentStatus(aluno) {
  const status = normalizeComparable(aluno?.status);
  if (status === "inativo") return "inativo";
  if (status === "excluido") return "excluido";
  if (status === "experimental") return "experimental";
  return "ativo";
}

function isReusableEnrollmentStatus(status) {
  return status === "inativo" || status === "excluido";
}

function getAlunoEnrollmentEntry(aluno) {
  const numero =
    normalizeEnrollmentNumber(aluno?.numeroMatricula) ||
    normalizeEnrollmentNumber(aluno?.matricula?.dadosAluno?.numeroMatricula);

  if (!numero) return null;

  return {
    numero,
    alunoId: normalizeText(aluno?.id) || null,
    studentName:
      normalizeText(aluno?.matricula?.dadosAluno?.nomeCompleto) ||
      normalizeText(aluno?.nome) ||
      null,
    status: getAlunoEnrollmentStatus(aluno),
  };
}

function syncEnrollmentNumberRegistry(alunos, updatedAt = new Date().toISOString()) {
  const registryRows = listEnrollmentNumbersStatement.all();
  const grouped = new Map();

  for (const aluno of Array.isArray(alunos) ? alunos : []) {
    const entry = getAlunoEnrollmentEntry(aluno);
    if (!entry) continue;

    const entries = grouped.get(entry.numero) ?? [];
    entries.push(entry);
    grouped.set(entry.numero, entries);
  }

  for (const [numero, entries] of grouped) {
    const blocking = entries.filter((entry) => !isReusableEnrollmentStatus(entry.status));

    if (blocking.length > 1) {
      throw new Error(
        `Conflito de matrícula detectado para o número ${numero}. Ajuste os alunos ativos antes de salvar.`,
      );
    }

    const registryRow = registryRows.find((row) => row.numero === numero);
    const winner = blocking[0] ?? entries[0];
    const reusableOnly = blocking.length === 0;

    upsertEnrollmentNumberStatement.run(
      numero,
      reusableOnly ? null : winner.alunoId,
      winner.studentName,
      reusableOnly ? "inativo" : winner.status,
      registryRow?.created_at ?? updatedAt,
      updatedAt,
      reusableOnly ? (registryRow?.last_assigned_at ?? updatedAt) : updatedAt,
      reusableOnly ? updatedAt : null,
    );
  }

  for (const row of registryRows) {
    if (grouped.has(row.numero)) continue;

    upsertEnrollmentNumberStatement.run(
      row.numero,
      null,
      row.student_name ?? null,
      "excluido",
      row.created_at ?? updatedAt,
      updatedAt,
      row.last_assigned_at ?? updatedAt,
      updatedAt,
    );
  }
}

function findNextEnrollmentNumberCandidate() {
  const reusable = findReusableEnrollmentNumberStatement.get();
  if (reusable?.numero) {
    return {
      numero: reusable.numero,
      strategy: "reused",
      reusedFrom: reusable.status,
    };
  }

  const maxRow = findMaxEnrollmentNumberStatement.get();
  return {
    numero: Number(maxRow?.numero ?? 0) + 1,
    strategy: "sequential",
    reusedFrom: null,
  };
}

function reserveEnrollmentNumber(numero, updatedAt) {
  const existing = findEnrollmentNumberStatement.get(numero);

  upsertEnrollmentNumberStatement.run(
    numero,
    null,
    existing?.student_name ?? null,
    "reservado",
    existing?.created_at ?? updatedAt,
    updatedAt,
    updatedAt,
    null,
  );
}

function confirmEnrollmentNumberAssignment(numero, aluno, updatedAt) {
  const existing = findEnrollmentNumberStatement.get(numero);
  const status = getAlunoEnrollmentStatus(aluno);

  upsertEnrollmentNumberStatement.run(
    numero,
    normalizeText(aluno?.id) || null,
    normalizeText(aluno?.nome) || null,
    status,
    existing?.created_at ?? updatedAt,
    updatedAt,
    updatedAt,
    isReusableEnrollmentStatus(status) ? updatedAt : null,
  );
}

function normalizeEnrollmentDocument(value) {
  if (!value || typeof value !== "object") return null;

  const name = normalizeText(value.name);
  if (!name) return null;

  return {
    name,
    size: typeof value.size === "number" ? value.size : 0,
    type: normalizeText(value.type),
    uploadedAt: normalizeText(value.uploadedAt) || null,
    expiresAt: normalizeText(value.expiresAt) || null,
  };
}

function mapEnrollmentSports(payload, turmas) {
  const fallback = mapPublicModality(
    payload?.esportivas?.modalidade || payload?.esportivas?.modalidades?.[0],
    turmas,
  );
  const selectedTurmas = normalizeStringList(payload?.esportivas?.turmas);
  const matchedTurmas = turmas.filter((turma) =>
    selectedTurmas.some((item) => normalizeComparable(item) === normalizeComparable(turma?.nome)),
  );
  const primaryTurma =
    matchedTurmas[0] ??
    turmas.find(
      (turma) =>
        normalizeComparable(turma?.modalidade) === normalizeComparable(fallback.modalidade),
    ) ??
    null;

  const modalidades = normalizeStringList(payload?.esportivas?.modalidades);
  const unidades = normalizeStringList(payload?.esportivas?.unidades);
  const horarios = normalizeStringList(payload?.esportivas?.horarios);

  return {
    modalidades: [
      ...new Set([
        ...modalidades,
        ...matchedTurmas.map((turma) => normalizeText(turma?.modalidade)),
        fallback.modalidade,
      ]),
    ].filter(Boolean),
    unidades: [
      ...new Set([
        ...unidades,
        ...matchedTurmas.map((turma) => normalizeText(turma?.unidade)),
        fallback.unidade,
      ]),
    ].filter(Boolean),
    turmas: [
      ...new Set([
        ...selectedTurmas,
        ...matchedTurmas.map((turma) => normalizeText(turma?.nome)),
        primaryTurma ? normalizeText(primaryTurma.nome) : "",
      ]),
    ].filter(Boolean),
    horarios: [
      ...new Set([
        ...horarios,
        ...matchedTurmas.map(
          (turma) => `${normalizeText(turma?.horarioInicio)} - ${normalizeText(turma?.horarioFim)}`,
        ),
        primaryTurma
          ? `${normalizeText(primaryTurma.horarioInicio)} - ${normalizeText(primaryTurma.horarioFim)}`
          : "",
      ]),
    ].filter(Boolean),
    primary: {
      modalidade: modalidades[0] || normalizeText(primaryTurma?.modalidade) || fallback.modalidade,
      unidade: unidades[0] || normalizeText(primaryTurma?.unidade) || fallback.unidade,
      turma: normalizeText(primaryTurma?.nome) || fallback.turma,
      professor: normalizeText(primaryTurma?.professor) || fallback.professor,
      time: normalizeText(primaryTurma?.horarioInicio) || fallback.time,
    },
  };
}

function createMatriculaSnapshot(payload, sports) {
  const fotoPerfilAluno = normalizeEnrollmentDocument(
    payload?.documentos?.fotoPerfilAluno || payload?.documentos?.fotoAluno,
  );
  const rgCpfAluno = normalizeEnrollmentDocument(
    payload?.documentos?.rgCpfAluno ||
      payload?.documentos?.documentoAlunoRg ||
      payload?.documentos?.documentoAlunoCpf,
  );
  const rgCpfResponsavel = normalizeEnrollmentDocument(
    payload?.documentos?.rgCpfResponsavel ||
      payload?.documentos?.documentoResponsavelRg ||
      payload?.documentos?.documentoResponsavelCpf,
  );
  const comprovanteEndereco = normalizeEnrollmentDocument(
    payload?.documentos?.comprovanteEndereco ||
      payload?.documentos?.documentoResponsavelComprovante,
  );
  const atestadoMedico = normalizeEnrollmentDocument(
    payload?.documentos?.atestadoMedico || payload?.documentos?.documentoAlunoExame,
  );

  return {
    dadosAluno: {
      numeroMatricula: normalizeText(payload?.dadosAluno?.numeroMatricula),
      nomeCompleto: normalizeText(payload?.dadosAluno?.nomeCompleto),
      dataNascimento: normalizeText(payload?.dadosAluno?.dataNascimento),
      idade: normalizeText(payload?.dadosAluno?.idade),
      cpf: normalizeText(payload?.dadosAluno?.cpf),
      rg: normalizeText(payload?.dadosAluno?.rg),
      sexo: normalizeText(payload?.dadosAluno?.sexo),
      colegio: normalizeText(payload?.dadosAluno?.colegio),
      periodoEscolar: normalizeText(payload?.dadosAluno?.periodoEscolar),
    },
    responsavel: {
      nomeCompleto: normalizeText(payload?.responsavel?.nomeCompleto),
      cpf: normalizeText(payload?.responsavel?.cpf),
      rg: normalizeText(payload?.responsavel?.rg),
      whatsapp: normalizeText(payload?.responsavel?.whatsapp),
      email:
        normalizeText(payload?.responsavel?.email) ||
        normalizeText(payload?.contato?.emailResponsavel),
      parentesco: normalizeText(payload?.responsavel?.parentesco),
    },
    endereco: {
      cep: normalizeText(payload?.endereco?.cep),
      rua: normalizeText(payload?.endereco?.rua),
      numero: normalizeText(payload?.endereco?.numero),
      complemento: normalizeText(payload?.endereco?.complemento),
      bairro: normalizeText(payload?.endereco?.bairro),
      cidade: normalizeText(payload?.endereco?.cidade),
      estado: normalizeText(payload?.endereco?.estado),
    },
    documentos: {
      fotoPerfilAluno,
      rgCpfAluno,
      rgCpfResponsavel,
      comprovanteEndereco,
      atestadoMedico,
    },
    esportivas: {
      modalidades: sports.modalidades,
      unidades: sports.unidades,
      horarios: sports.horarios,
      turmas: sports.turmas,
      nivel: normalizeText(payload?.esportivas?.nivel),
      treinouAntes: normalizeText(payload?.esportivas?.treinouAntes),
      caracteristica: normalizeText(payload?.esportivas?.caracteristica),
      objetivo: normalizeText(payload?.esportivas?.objetivo),
    },
    saude: {
      restricaoMedica: normalizeText(payload?.saude?.restricaoMedica),
      medicamentos: normalizeText(payload?.saude?.medicamentos),
      alergias: normalizeText(payload?.saude?.alergias),
      lesoes: normalizeText(payload?.saude?.lesoes),
      planoSaude: normalizeText(payload?.saude?.planoSaude),
      observacoesImportantes: normalizeText(payload?.saude?.observacoesImportantes),
    },
    estrategicas: {
      comoConheceu: normalizeText(payload?.estrategicas?.comoConheceu),
      indicacaoQuem: normalizeText(payload?.estrategicas?.indicacaoQuem),
      observacoesGerais: normalizeText(payload?.estrategicas?.observacoesGerais),
    },
  };
}

function createInternalAlunoFromEnrollment(payload, protocol, createdAt) {
  const turmas = getCollectionArray("turmas");
  const sports = mapEnrollmentSports(payload, turmas);
  const matricula = createMatriculaSnapshot(payload, sports);
  const emailContato =
    matricula.responsavel.email ||
    `${slug(payload?.dadosAluno?.nomeCompleto || payload?.responsavel?.nomeCompleto || "lead")}@matricula-publica.j12.local`;
  const telefoneContato =
    normalizeText(payload?.contato?.telefonePrincipal) || matricula.responsavel.whatsapp;

  return {
    id: createCollectionRecordId("a"),
    nome: matricula.dadosAluno.nomeCompleto,
    email: emailContato,
    telefone: telefoneContato,
    dataNascimento: matricula.dadosAluno.dataNascimento,
    responsavel: matricula.responsavel.nomeCompleto,
    telefoneResponsavel: matricula.responsavel.whatsapp || telefoneContato,
    modalidade: sports.primary.modalidade,
    unidades: sports.unidades,
    turmas: sports.turmas,
    planos: [],
    horarios: sports.horarios,
    turma: sports.primary.turma,
    plano: "",
    status: "experimental",
    matriculaEm: createdAt.slice(0, 10),
    numeroMatricula: matricula.dadosAluno.numeroMatricula,
    cpf: matricula.dadosAluno.cpf,
    rg: matricula.dadosAluno.rg,
    sexo: matricula.dadosAluno.sexo,
    matricula,
    origemCadastro: "Matricula publica",
    matriculaPublicaProtocolo: protocol,
  };
}

function createLeadNotes(payload, protocol, createdAt, sports) {
  const parts = [
    `Lead criado automaticamente a partir da matricula publica ${protocol}.`,
    `Origem declarada: ${normalizeText(payload?.estrategicas?.comoConheceu) || "Nao informada"}.`,
    `Modalidades desejadas: ${sports.modalidades.join(", ") || "Nao informado"}.`,
    `Unidades desejadas: ${sports.unidades.join(", ") || "Nao informado"}.`,
    `Horarios desejados: ${sports.horarios.join(", ") || "Nao informado"}.`,
    `Objetivo: ${normalizeText(payload?.esportivas?.objetivo) || "Nao informado"}.`,
    `Responsavel financeiro: ${normalizeText(payload?.responsavel?.nomeCompleto) || "Nao informado"}.`,
    `Observacoes gerais: ${normalizeText(payload?.estrategicas?.observacoesGerais) || "Nao informado"}.`,
    `Recebido em: ${new Date(createdAt).toLocaleString("pt-BR")}.`,
  ];

  return parts.join("\n");
}

function createInternalTrialClassFromEnrollment(payload, protocol, createdAt) {
  const turmas = getCollectionArray("turmas");
  const sports = mapEnrollmentSports(payload, turmas);
  const leadSource =
    normalizeText(payload?.estrategicas?.comoConheceu) ||
    normalizeText(payload?.estrategicas?.indicacaoQuem) ||
    "Site";

  const history = [
    createHistoryEntry(
      "Lead importado da matricula publica",
      `Protocolo ${protocol} sincronizado automaticamente com o pipeline comercial.`,
      createdAt,
    ),
    createHistoryEntry(
      "Lead cadastrado",
      `Aluno ${normalizeText(payload?.dadosAluno?.nomeCompleto)} entrou no fluxo comercial publico.`,
      createdAt,
    ),
  ];

  return {
    id: createCollectionRecordId("tc"),
    studentName: normalizeText(payload?.dadosAluno?.nomeCompleto),
    birthDate: normalizeText(payload?.dadosAluno?.dataNascimento),
    notes: createLeadNotes(payload, protocol, createdAt, sports),
    guardianName: normalizeText(payload?.responsavel?.nomeCompleto),
    phone:
      normalizeText(payload?.contato?.telefonePrincipal) ||
      normalizeText(payload?.responsavel?.whatsapp),
    whatsapp:
      normalizeText(payload?.contato?.whatsappDiferente) ||
      normalizeText(payload?.responsavel?.whatsapp),
    email:
      normalizeText(payload?.responsavel?.email) ||
      normalizeText(payload?.contato?.emailResponsavel),
    modality: sports.primary.modalidade,
    unit: sports.primary.unidade || "A definir",
    turma: sports.primary.turma || "A definir",
    professor: sports.primary.professor || "A definir",
    date: createdAt.slice(0, 10),
    time: sports.primary.time || "A definir",
    status: "Confirmada",
    leadSource,
    convertedAlunoId: null,
    history,
    createdAt,
    updatedAt: createdAt,
    origemCadastro: "Matricula publica",
    matriculaPublicaProtocolo: protocol,
  };
}

function syncEnrollmentTurmas(turmas, selectedTurmas, alunoId) {
  const selectedNames = new Set(selectedTurmas.map((item) => normalizeComparable(item)));
  if (selectedNames.size === 0) return turmas;

  return turmas.map((turma) => {
    if (!selectedNames.has(normalizeComparable(turma?.nome))) return turma;

    const alunoIds = Array.isArray(turma?.alunoIds) ? turma.alunoIds : [];
    if (alunoIds.includes(alunoId)) return turma;

    return {
      ...turma,
      alunoIds: [...alunoIds, alunoId],
    };
  });
}

const AUTH_SEED_PASSWORD_ENV_BY_ROLE = Object.freeze({
  admin: "AUTH_SEED_ADMIN_PASSWORD",
  coordenador: "AUTH_SEED_COORDENADOR_PASSWORD",
  professor: "AUTH_SEED_PROFESSOR_PASSWORD",
  aluno: "AUTH_SEED_ALUNO_PASSWORD",
  responsavel: "AUTH_SEED_RESPONSAVEL_PASSWORD",
});

function isAuthSeedEnabled(env = process.env) {
  return (
    String(env.AUTH_SEED_ENABLED || "")
      .trim()
      .toLowerCase() === "true"
  );
}

function getAuthSeedPassword(role, env = process.env) {
  const envName = AUTH_SEED_PASSWORD_ENV_BY_ROLE[role];
  const password = envName ? env[envName] : null;
  if (!envName || typeof password !== "string" || password.length < 16) {
    const error = new Error("Bootstrap de autenticacao requer password externa valida.");
    error.code = "AUTH_SEED_PASSWORD_MISSING";
    throw error;
  }
  if (
    /change|replace|configure|example|dummy|fake|test|placeholder|not[-_ ]a[-_ ]real/i.test(
      password,
    )
  ) {
    const error = new Error("Bootstrap de autenticacao rejeitou password insegura.");
    error.code = "AUTH_SEED_PASSWORD_INVALID";
    throw error;
  }
  return password;
}

function seedUsers() {
  // O banco local nao cria contas previsiveis sem opt-in e secrets externos.
  if (!isAuthSeedEnabled()) return;

  const now = new Date().toISOString();
  const defaults = [
    {
      id: "1",
      nome: "Admin J12",
      email: "admin@j12.com",
      role: "admin",
      teacherId: null,
      studentId: null,
      password: getAuthSeedPassword("admin"),
    },
    {
      id: "2",
      nome: "Coord. Marina",
      email: "coord@j12.com",
      role: "coordenador",
      teacherId: null,
      studentId: null,
      password: getAuthSeedPassword("coordenador"),
    },
    {
      id: "3",
      nome: "Ricardo Mendes",
      email: "prof@j12.com",
      role: "professor",
      teacherId: "pr1",
      studentId: null,
      password: getAuthSeedPassword("professor"),
    },
    {
      id: "4",
      nome: "Aluno Joao",
      email: "aluno@j12.com",
      role: "aluno",
      teacherId: null,
      studentId: "a1",
      password: getAuthSeedPassword("aluno"),
    },
    {
      id: "5",
      nome: "Carla Almeida",
      email: "responsavel@j12.com",
      role: "responsavel",
      teacherId: null,
      studentId: "a1",
      password: getAuthSeedPassword("responsavel"),
    },
  ];

  db.exec("BEGIN");

  try {
    for (const user of defaults) {
      const existing = findUserByEmailStatement.get(user.email);
      if (existing) continue;

      const salt = randomBytes(16).toString("hex");
      const passwordHash = hashPassword(user.password, salt);
      insertUserStatement.run(
        user.id,
        user.nome,
        user.email,
        user.role,
        user.teacherId,
        user.studentId,
        passwordHash,
        salt,
        now,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

seedUsers();

export function purgeExpiredSessions() {
  deleteExpiredSessionsStatement.run(new Date().toISOString());
}

export function purgeExpiredPasswordResetTokens() {
  deleteExpiredPasswordResetTokensStatement.run(new Date().toISOString());
}

export function authenticateUser(email, password) {
  purgeExpiredSessions();

  const row = findUserByEmailStatement.get(email);
  if (!row) return null;

  const valid = verifyPassword(password, row.password_salt, row.password_hash);
  if (!valid) return null;

  return sanitizeUser(row);
}

export function findUserByEmail(email) {
  const row = findUserByEmailStatement.get(email);
  return row ? sanitizeUser(row) : null;
}

export function changeUserPassword(userId, currentPassword, nextPassword) {
  assertStrongPassword(nextPassword);

  const row = findUserByIdStatement.get(String(userId));
  if (!row) {
    throw new Error("Usuario nao encontrado.");
  }

  if (!verifyPassword(currentPassword, row.password_salt, row.password_hash)) {
    throw new Error("A senha atual esta incorreta.");
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(nextPassword, salt);
  updateUserPasswordStatement.run(passwordHash, salt, String(userId));

  return sanitizeUser(row);
}

export function createSession(userId) {
  purgeExpiredSessions();

  const token = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  insertSessionStatement.run(token, userId, createdAt, expiresAt);
  return token;
}

export function findUserBySessionToken(token) {
  purgeExpiredSessions();

  const row = findSessionUserStatement.get(token);
  if (!row) return null;

  if (row.expires_at <= new Date().toISOString()) {
    deleteSessionStatement.run(token);
    return null;
  }

  return sanitizeUser(row);
}

export function deleteSession(token) {
  deleteSessionStatement.run(token);
}

export function createPasswordResetToken(email) {
  purgeExpiredPasswordResetTokens();

  const row = findUserByEmailStatement.get(email);
  if (!row) return null;

  const token = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

  insertPasswordResetTokenStatement.run(token, row.id, row.email, createdAt, expiresAt);

  return {
    token,
    user: sanitizeUser(row),
    expiresAt,
  };
}

export function validatePasswordResetToken(token) {
  purgeExpiredPasswordResetTokens();

  const row = findPasswordResetTokenStatement.get(token);
  if (!row) return { ok: false, reason: "Token invalido ou expirado" };
  if (row.used_at) return { ok: false, reason: "Token invalido ou expirado" };
  if (row.expires_at <= new Date().toISOString()) {
    return { ok: false, reason: "Token invalido ou expirado" };
  }

  return {
    ok: true,
    data: {
      token: row.token,
      userId: row.user_id,
      email: row.email,
      expiresAt: row.expires_at,
    },
  };
}

export function resetUserPassword(token, password) {
  purgeExpiredPasswordResetTokens();

  const validation = validatePasswordResetToken(token);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const usedAt = new Date().toISOString();

  db.exec("BEGIN");

  try {
    updateUserPasswordStatement.run(passwordHash, salt, validation.data.userId);
    markPasswordResetTokenUsedStatement.run(usedAt, token);
    invalidatePasswordResetTokensByUserStatement.run(usedAt, validation.data.userId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    userId: validation.data.userId,
    email: validation.data.email,
  };
}

export function completeStudentFirstAccess(payload) {
  const numeroMatricula = normalizeEnrollmentNumber(payload?.numeroMatricula);
  const dataNascimento = normalizeText(payload?.dataNascimento);
  const email = normalizeText(payload?.email).toLowerCase();
  const password = String(payload?.senha ?? "");
  const confirmPassword = String(payload?.confirmarSenha ?? "");

  if (!numeroMatricula || !dataNascimento) {
    throw new Error("Informe numero de matricula e data de nascimento.");
  }

  if (!email) {
    throw new Error("Informe um e-mail para concluir o primeiro acesso.");
  }

  if (!isValidEmail(email)) {
    throw new Error("Informe um e-mail valido.");
  }

  if (password !== confirmPassword) {
    throw new Error("A confirmacao da senha nao confere.");
  }

  assertStrongPassword(password);

  const alunos = getCollectionArray("alunos");
  const aluno = alunos.find((item) => {
    const itemEnrollmentNumber = normalizeEnrollmentNumber(
      item?.numeroMatricula ?? item?.matricula?.dadosAluno?.numeroMatricula,
    );
    const itemBirthDate = normalizeText(
      item?.dataNascimento ?? item?.matricula?.dadosAluno?.dataNascimento,
    );

    return itemEnrollmentNumber === numeroMatricula && itemBirthDate === dataNascimento;
  });

  if (!aluno?.id) {
    throw new Error("Nao encontramos um aluno com esses dados para primeiro acesso.");
  }

  const existingByEmail = findUserByEmailStatement.get(email);
  if (existingByEmail && String(existingByEmail.student_id ?? "") !== String(aluno.id)) {
    throw new Error("Este e-mail ja esta vinculado a outro usuario.");
  }

  const existingByStudent =
    findUserByStudentIdStatement.get(String(aluno.id)) ?? existingByEmail ?? null;
  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const nomeAluno =
    normalizeText(aluno?.nome) ||
    normalizeText(aluno?.matricula?.dadosAluno?.nomeCompleto) ||
    "Aluno J12";
  const createdAt = new Date().toISOString();

  if (existingByStudent) {
    updateUserFirstAccessStatement.run(
      nomeAluno,
      email,
      "aluno",
      String(aluno.id),
      passwordHash,
      salt,
      String(existingByStudent.id),
    );
  } else {
    insertUserStatement.run(
      `usr-${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      nomeAluno,
      email,
      "aluno",
      null,
      String(aluno.id),
      passwordHash,
      salt,
      createdAt,
    );
  }

  const storedUser = findUserByEmailStatement.get(email);
  return storedUser ? sanitizeUser(storedUser) : null;
}

export function createPublicEnrollment(payload) {
  const id = randomUUID();
  const protocol = `MAT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(
    Math.floor(Math.random() * 9000) + 1000,
  )}`;
  const createdAt = new Date().toISOString();
  let aluno;
  let trialClass;
  db.exec("BEGIN IMMEDIATE");

  try {
    const alunos = getCollectionArray("alunos");
    syncEnrollmentNumberRegistry(alunos, createdAt);

    const nextEnrollmentNumber = findNextEnrollmentNumberCandidate();
    reserveEnrollmentNumber(nextEnrollmentNumber.numero, createdAt);

    const payloadWithAssignedNumber = {
      ...payload,
      dadosAluno: {
        ...(payload?.dadosAluno ?? {}),
        numeroMatricula: String(nextEnrollmentNumber.numero),
      },
    };

    aluno = createInternalAlunoFromEnrollment(payloadWithAssignedNumber, protocol, createdAt);
    trialClass = createInternalTrialClassFromEnrollment(
      payloadWithAssignedNumber,
      protocol,
      createdAt,
    );
    const turmas = getCollectionArray("turmas");
    const trialClasses = getCollectionArray("trial-classes");
    const turmasAtualizadas = syncEnrollmentTurmas(
      turmas,
      aluno.matricula?.esportivas?.turmas ?? aluno.turmas ?? [],
      aluno.id,
    );

    insertPublicEnrollmentStatement.run(
      id,
      protocol,
      payloadWithAssignedNumber.dadosAluno.nomeCompleto,
      payloadWithAssignedNumber.responsavel.nomeCompleto,
      payloadWithAssignedNumber.responsavel.email ||
        payloadWithAssignedNumber?.contato?.emailResponsavel ||
        "",
      "recebida",
      JSON.stringify(payloadWithAssignedNumber),
      createdAt,
    );

    confirmEnrollmentNumberAssignment(nextEnrollmentNumber.numero, aluno, createdAt);
    putCollectionWithTimestamp("alunos", [aluno, ...alunos], createdAt);
    putCollectionWithTimestamp("turmas", turmasAtualizadas, createdAt);
    putCollectionWithTimestamp("trial-classes", [trialClass, ...trialClasses], createdAt);
    updatePublicEnrollmentSyncStatement.run(aluno.id, trialClass.id, createdAt, id);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    id,
    protocol,
    createdAt,
    status: "recebida",
    alunoId: aluno.id,
    trialClassId: trialClass.id,
    numeroMatricula: aluno.numeroMatricula,
  };
}

export function getCollection(name) {
  if (!ALLOWED_COLLECTIONS.has(name)) return null;

  const row = findCollectionStatement.get(name);
  if (!row) return null;

  return {
    name: row.name,
    data: JSON.parse(row.data),
    updatedAt: row.updated_at,
  };
}

export function putCollection(name, data) {
  if (!ALLOWED_COLLECTIONS.has(name)) {
    throw new Error(`Colecao invalida: ${name}`);
  }

  const updatedAt = new Date().toISOString();
  if (name === "alunos") {
    validateAlunoCascadeRelationships(data);
    syncEnrollmentNumberRegistry(data, updatedAt);
  }
  upsertCollectionStatement.run(name, JSON.stringify(data), updatedAt);
  return updatedAt;
}

export function getNextEnrollmentNumberPreview() {
  const updatedAt = new Date().toISOString();
  const alunos = getCollectionArray("alunos");
  syncEnrollmentNumberRegistry(alunos, updatedAt);
  const candidate = findNextEnrollmentNumberCandidate();

  return {
    numeroMatricula: String(candidate.numero),
    strategy: candidate.strategy,
    reusedFrom: candidate.reusedFrom,
  };
}

export function getDatabasePath() {
  return DATABASE_PATH;
}

export default db;
