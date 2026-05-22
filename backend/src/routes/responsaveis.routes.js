const express = require("express");

const { canManageSystem, requireAuth, resolveScopedStudentId } = require("../../auth");
const { listCharges } = require("../../services/student-finance");
const { pool, tableExists } = require("../config/db");

const router = express.Router();

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .map((value) => text(value, 191))
        .filter(Boolean),
    ),
  ];
}

function longText(value, max = 5 * 1024 * 1024) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value ?? fallback;

  try {
    const parsed = JSON.parse(value);
    if (parsed == null) return fallback;
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
    if (typeof fallback === "object") return typeof parsed === "object" ? parsed : fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function parseArray(value) {
  if (Array.isArray(value)) return uniqueStrings(value);

  const parsed = safeJsonParse(value, null);
  if (Array.isArray(parsed)) return uniqueStrings(parsed);

  const normalized = text(value, 65535);
  if (!normalized) return [];

  return uniqueStrings(normalized.split(","));
}

function firstValue(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const first = value.map((item) => text(item, 191)).find(Boolean);
      if (first) return first;
      continue;
    }

    const normalized = text(value, 65535);
    if (normalized) return normalized;
  }

  return "";
}

function firstList(...values) {
  for (const value of values) {
    const items = parseArray(value);
    if (items.length > 0) return items;
  }

  return [];
}

function numeric(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function dateText(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return text(String(value), 32).slice(0, 10);
}

function calculateAge(value) {
  const isoDate = dateText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";

  const birthDate = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime())) return "";

  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = today.getUTCDate() - birthDate.getUTCDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age > 0 ? String(age) : "";
}

function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function safeTableExists(tableName) {
  try {
    return await tableExists(tableName);
  } catch {
    return false;
  }
}

function inClause(values) {
  const params = uniqueStrings(values);
  if (params.length === 0) return null;

  return {
    params,
    placeholders: params.map(() => "?").join(", "),
  };
}

function normalizePayload(payload) {
  const nome = text(payload.nome, 191);
  if (!nome) {
    const error = new Error("Informe o nome do responsavel.");
    error.statusCode = 400;
    throw error;
  }

  return {
    nome,
    cpf: text(payload.cpf, 20) || null,
    telefone: text(payload.telefone ?? payload.whatsapp, 50) || null,
    email: text(payload.email, 191) || null,
    endereco: text(payload.endereco, 255) || null,
    rg: text(payload.rg, 30) || null,
    parentesco: text(payload.parentesco, 100) || null,
  };
}

function mapRow(row) {
  return {
    id: String(row.id),
    nome: text(row.nome, 191),
    cpf: text(row.cpf, 20),
    telefone: text(row.telefone, 50),
    email: text(row.email, 191),
    endereco: text(row.endereco, 255),
    rg: text(row.rg, 30),
    parentesco: text(row.parentesco, 100),
  };
}

function mapStudentRow(row) {
  return {
    id: String(row.id),
    nome: text(row.nome ?? row.nome_completo, 191) || "Aluno",
    email: text(row.email ?? row.email_contato, 191),
    telefone: text(row.telefone ?? row.telefone_contato, 50),
    modalidade: firstValue(row.modalidade, row.modalidade_rel, row.modalidade_principal),
    turma: firstValue(row.turma, row.turma_nome_rel, row.turma_principal),
    plano: firstValue(row.plano, row.plano_nome_rel, row.plano_principal),
    unidade: firstValue(row.unidade, row.unidade_rel, row.unidade_principal),
    professor: firstValue(row.professor, row.professor_nome_rel),
    categoria: firstValue(row.categoria, row.plano_categoria_rel),
    numeroMatricula: text(row.numero_matricula, 50),
    status: text(row.status, 50) || "ativo",
  };
}

function addStudentRows(target, seen, rows) {
  for (const row of Array.isArray(rows) ? rows : []) {
    const student = mapStudentRow(row);
    if (!student.id || seen.has(student.id)) continue;

    seen.add(student.id);
    target.push(student);
  }
}

async function enrichPortalStudents(students) {
  const clause = inClause(students.map((student) => student.id));
  if (!clause) return students;

  const [rows] = await pool.query(
    `
      SELECT
        aluno.id,
        aluno.modalidade_principal,
        aluno.turma_principal,
        aluno.plano_principal,
        aluno.unidade_principal,
        COALESCE(turma.nome, aluno.turma_principal) AS turma_nome_rel,
        COALESCE(turma.modalidade, aluno.modalidade_principal) AS modalidade_rel,
        COALESCE(turma.unidade, aluno.unidade_principal) AS unidade_rel,
        COALESCE(professor.nome, turma.professor_nome) AS professor_nome_rel,
        plano.nome AS plano_nome_rel,
        plano.categoria AS plano_categoria_rel
      FROM j12_alunos aluno
      LEFT JOIN j12_turmas turma ON turma.id = aluno.turma_id
      LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
      LEFT JOIN j12_planos plano ON plano.id = aluno.plano_id
      WHERE CAST(aluno.id AS CHAR) IN (${clause.placeholders})
    `,
    clause.params,
  );
  const byId = new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row.id), row]));

  return students.map((student) => {
    const enrichment = byId.get(student.id);
    if (!enrichment) return student;

    return {
      ...student,
      modalidade: firstValue(enrichment.modalidade_rel, student.modalidade),
      turma: firstValue(enrichment.turma_nome_rel, student.turma),
      plano: firstValue(enrichment.plano_nome_rel, student.plano),
      unidade: firstValue(enrichment.unidade_rel, student.unidade),
      professor: firstValue(enrichment.professor_nome_rel, student.professor),
      categoria: firstValue(enrichment.plano_categoria_rel, student.categoria),
    };
  });
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM j12_responsaveis WHERE id = ? LIMIT 1", [id]);
  return Array.isArray(rows) && rows.length > 0 ? mapRow(rows[0]) : null;
}

async function loadStudentsByIds(studentIds) {
  const clause = inClause(studentIds);
  if (!clause) return [];

  const [rows] = await pool.query(
    `
      SELECT
        id,
        numero_matricula,
        nome_completo AS nome,
        email_contato AS email,
        telefone_contato AS telefone,
        modalidade_principal AS modalidade,
        turma_principal AS turma,
        plano_principal AS plano,
        status
      FROM j12_alunos
      WHERE CAST(id AS CHAR) IN (${clause.placeholders})
      ORDER BY nome_completo ASC
    `,
    clause.params,
  );

  return Array.isArray(rows) ? rows : [];
}

async function loadLinkedStudents(authUser) {
  const students = [];
  const seen = new Set();
  const directStudentId = resolveScopedStudentId(authUser);
  const responsavelKeys = uniqueStrings([
    authUser?.responsavel_id,
    authUser?.responsavelId,
    authUser?.id,
  ]);
  const authEmail = text(authUser?.email, 191).toLowerCase();

  addStudentRows(students, seen, await loadStudentsByIds([directStudentId]));

  if (responsavelKeys.length > 0 && (await safeTableExists("j12_responsavel_alunos"))) {
    const clause = inClause(responsavelKeys);
    const [rows] = await pool.query(
      `
        SELECT
          aluno.id,
          aluno.numero_matricula,
          aluno.nome_completo AS nome,
          aluno.email_contato AS email,
          aluno.telefone_contato AS telefone,
          aluno.modalidade_principal AS modalidade,
          aluno.turma_principal AS turma,
          aluno.plano_principal AS plano,
          aluno.status
        FROM j12_responsavel_alunos vinculo
        INNER JOIN j12_alunos aluno ON CAST(aluno.id AS CHAR) = CAST(vinculo.aluno_id AS CHAR)
        WHERE CAST(vinculo.responsavel_id AS CHAR) IN (${clause.placeholders})
        ORDER BY aluno.nome_completo ASC
      `,
      clause.params,
    );

    addStudentRows(students, seen, rows);
  }

  if (responsavelKeys.length > 0) {
    const clause = inClause(responsavelKeys);
    const [rows] = await pool.query(
      `
        SELECT
          id,
          numero_matricula,
          nome_completo AS nome,
          email_contato AS email,
          telefone_contato AS telefone,
          modalidade_principal AS modalidade,
          turma_principal AS turma,
          plano_principal AS plano,
          status
        FROM j12_alunos
        WHERE responsavel_id IS NOT NULL
          AND CAST(responsavel_id AS CHAR) IN (${clause.placeholders})
        ORDER BY nome_completo ASC
      `,
      clause.params,
    );

    addStudentRows(students, seen, rows);
  }

  if (authEmail && (await safeTableExists("j12_alunos_responsaveis"))) {
    const [rows] = await pool.query(
      `
        SELECT
          aluno.id,
          aluno.numero_matricula,
          aluno.nome_completo AS nome,
          aluno.email_contato AS email,
          aluno.telefone_contato AS telefone,
          aluno.modalidade_principal AS modalidade,
          aluno.turma_principal AS turma,
          aluno.plano_principal AS plano,
          aluno.status
        FROM j12_alunos_responsaveis responsavel
        INNER JOIN j12_alunos aluno ON CAST(aluno.id AS CHAR) = CAST(responsavel.aluno_id AS CHAR)
        WHERE responsavel.email IS NOT NULL
          AND LOWER(responsavel.email) = LOWER(?)
        ORDER BY aluno.nome_completo ASC
      `,
      [authEmail],
    );

    addStudentRows(students, seen, rows);
  }

  if (authEmail) {
    const [rows] = await pool.query(
      `
        SELECT
          aluno.id,
          aluno.numero_matricula,
          aluno.nome_completo AS nome,
          aluno.email_contato AS email,
          aluno.telefone_contato AS telefone,
          aluno.modalidade_principal AS modalidade,
          aluno.turma_principal AS turma,
          aluno.plano_principal AS plano,
          aluno.status
        FROM j12_responsaveis responsavel
        INNER JOIN j12_alunos aluno ON aluno.responsavel_id = responsavel.id
        WHERE responsavel.email IS NOT NULL
          AND LOWER(responsavel.email) = LOWER(?)
        ORDER BY aluno.nome_completo ASC
      `,
      [authEmail],
    );

    addStudentRows(students, seen, rows);
  }

  return enrichPortalStudents(students);
}

function assertResponsavel(authUser) {
  const role = text(authUser?.role ?? authUser?.perfil, 50).toLowerCase();
  if (role !== "responsavel") {
    throw createHttpError("Acesso permitido apenas para responsavel.", 403);
  }
}

async function getResponsavelStudents(req) {
  assertResponsavel(req.auth);
  const students = await loadLinkedStudents(req.auth);

  if (students.length === 0) {
    throw createHttpError("Nenhum aluno vinculado ao responsavel.", 404);
  }

  return students;
}

function resolveRequestedStudent(req, students, { allowFamily = true } = {}) {
  const requestedStudentId = text(
    req.params.alunoId ?? req.query.alunoId ?? req.query.studentId,
    64,
  );

  if (!requestedStudentId) {
    if (!allowFamily && students.length === 1) return students[0];
    return null;
  }

  const student = students.find((item) => item.id === requestedStudentId);
  if (!student) {
    throw createHttpError("Aluno nao vinculado a este responsavel.", 403);
  }

  return student;
}

function getScopedStudents(req, students) {
  const selected = resolveRequestedStudent(req, students);
  return selected ? [selected] : students;
}

async function listChargesForStudents(students) {
  const rows = await Promise.all(
    students.map(async (student) => {
      const charges = await listCharges({ studentId: student.id });
      return (Array.isArray(charges) ? charges : []).map((charge) => ({
        ...charge,
        alunoId: String(charge.alunoId ?? charge.aluno_id ?? student.id),
        aluno_id: String(charge.alunoId ?? charge.aluno_id ?? student.id),
        alunoNome: text(charge.alunoNome ?? charge.aluno_nome, 191) || student.nome,
        aluno_nome: text(charge.alunoNome ?? charge.aluno_nome, 191) || student.nome,
      }));
    }),
  );

  return rows.flat();
}

async function loadPresenceRows(students) {
  const clause = inClause(students.map((student) => student.id));
  if (!clause) return [];

  const [rows] = await pool.query(
    `
      SELECT
        presenca.id,
        presenca.aluno_id,
        presenca.turma,
        presenca.modalidade,
        presenca.data_aula,
        presenca.presente,
        presenca.observacao,
        aluno.nome_completo AS aluno_nome
      FROM student_presencas presenca
      INNER JOIN j12_alunos aluno ON CAST(aluno.id AS CHAR) = CAST(presenca.aluno_id AS CHAR)
      WHERE CAST(presenca.aluno_id AS CHAR) IN (${clause.placeholders})
      ORDER BY presenca.data_aula DESC, presenca.id DESC
    `,
    clause.params,
  );

  return Array.isArray(rows) ? rows : [];
}

async function loadContractRows(students) {
  const clause = inClause(students.map((student) => student.id));
  if (!clause) return [];

  const [rows] = await pool.query(
    `
      SELECT
        contrato.*,
        aluno.nome_completo AS aluno_nome
      FROM student_contracts contrato
      INNER JOIN j12_alunos aluno ON CAST(aluno.id AS CHAR) = CAST(contrato.aluno_id AS CHAR)
      WHERE CAST(contrato.aluno_id AS CHAR) IN (${clause.placeholders})
      ORDER BY contrato.data_emissao DESC, contrato.updated_at DESC
    `,
    clause.params,
  );

  return Array.isArray(rows) ? rows : [];
}

async function loadNotificationRows(students) {
  const clause = inClause(students.map((student) => student.id));
  if (!clause) return [];

  const [rows] = await pool.query(
    `
      SELECT
        notificacao.*,
        aluno.nome_completo AS aluno_nome
      FROM student_notifications notificacao
      INNER JOIN j12_alunos aluno ON CAST(aluno.id AS CHAR) = CAST(notificacao.aluno_id AS CHAR)
      WHERE CAST(notificacao.aluno_id AS CHAR) IN (${clause.placeholders})
      ORDER BY notificacao.created_at DESC, notificacao.updated_at DESC
    `,
    clause.params,
  );

  return Array.isArray(rows) ? rows : [];
}

function summarizeCharges(charges) {
  return charges.reduce(
    (acc, charge) => {
      const valor = Number(charge.valorFinal ?? charge.valor ?? 0) || 0;
      const status = text(charge.status, 30).toLowerCase();

      if (status === "pago") {
        acc.totalPago += valor;
      } else if (status !== "cancelado" && status !== "cancelada") {
        acc.totalAberto += valor;
        acc.pendentes += 1;
      }

      return acc;
    },
    {
      totalAberto: 0,
      totalPago: 0,
      pendentes: 0,
    },
  );
}

function summarizePresence(rows) {
  const total = rows.length;
  const presentes = rows.filter((item) => Boolean(item.presente)).length;
  const faltas = Math.max(total - presentes, 0);

  return {
    percentual: total > 0 ? Math.round((presentes / total) * 100) : 0,
    presentes,
    faltas,
    total,
  };
}

function mapNextClasses(student) {
  if (!student.turma && !student.modalidade) return [];

  return [
    {
      alunoId: student.id,
      alunoNome: student.nome,
      turma: student.turma || "Turma J12",
      modalidade: student.modalidade || "Modalidade J12",
      unidade: student.unidade || "Unidade J12",
      professor: student.professor || "Professor a definir",
      horario: "A definir",
    },
  ];
}

async function buildDashboardForStudent(student) {
  const [charges, presencas, notificacoes] = await Promise.all([
    listChargesForStudents([student]),
    loadPresenceRows([student]),
    loadNotificationRows([student]),
  ]);
  const latestCharge = [...charges].sort((left, right) =>
    String(right.vencimento || "").localeCompare(String(left.vencimento || "")),
  )[0];
  const chargeSummary = summarizeCharges(charges);
  const presenceSummary = summarizePresence(presencas);

  return {
    familia: false,
    aluno: student,
    alunos: [student],
    financeiro: {
      mensalidade: latestCharge?.valorFinal ?? latestCharge?.valor ?? 0,
      status: latestCharge?.status ?? "sem_cobranca",
      ...chargeSummary,
    },
    presenca: presenceSummary,
    plano: {
      nome: student.plano || "Sem plano",
    },
    proximasAulas: mapNextClasses(student),
    notificacoes: notificacoes.slice(0, 5).map(mapNotification),
  };
}

async function buildFamilyDashboard(students) {
  const [charges, presencas, notificacoes] = await Promise.all([
    listChargesForStudents(students),
    loadPresenceRows(students),
    loadNotificationRows(students),
  ]);
  const chargeSummary = summarizeCharges(charges);
  const presenceSummary = summarizePresence(presencas);

  return {
    familia: true,
    aluno: {
      id: "familia",
      nome: "Familia J12",
    },
    alunos: students,
    financeiro: {
      mensalidade: Number(chargeSummary.totalAberto.toFixed(2)),
      status: chargeSummary.pendentes > 0 ? "pendente" : "em_dia",
      ...chargeSummary,
    },
    presenca: presenceSummary,
    plano: {
      nome: `${students.length} aluno${students.length === 1 ? "" : "s"}`,
    },
    proximasAulas: students.flatMap(mapNextClasses),
    notificacoes: notificacoes.slice(0, 5).map(mapNotification),
  };
}

function mapPresence(row) {
  return {
    id: String(row.id),
    alunoId: String(row.aluno_id),
    alunoNome: text(row.aluno_nome, 191),
    aluno_nome: text(row.aluno_nome, 191),
    turma: text(row.turma, 191) || "Treino J12",
    modalidade: text(row.modalidade, 191),
    dataAula: row.data_aula,
    data_aula: row.data_aula,
    presente: Boolean(row.presente),
    status: Boolean(row.presente) ? "presente" : "falta",
    observacao: text(row.observacao, 65535),
  };
}

function mapContract(row) {
  return {
    id: String(row.id),
    alunoId: String(row.aluno_id),
    alunoNome: text(row.aluno_nome, 191),
    aluno_nome: text(row.aluno_nome, 191),
    tipoDocumento: text(row.tipo_documento, 50),
    titulo: text(row.titulo, 191),
    status: text(row.status, 30),
    arquivoPdf: row.arquivo_pdf ?? null,
    templateHtml: row.template_html ?? "",
    dataEmissao: row.data_emissao ?? null,
    dataAssinatura: row.data_assinatura ?? null,
    observacoes: row.observacoes ?? "",
  };
}

function mapNotification(row) {
  return {
    id: String(row.id),
    alunoId: String(row.aluno_id),
    alunoNome: text(row.aluno_nome, 191),
    aluno_nome: text(row.aluno_nome, 191),
    titulo: text(row.titulo, 191),
    mensagem: text(row.mensagem, 65535),
    canal: text(row.canal, 30),
    tipo: text(row.tipo, 30),
    lida: Boolean(row.lida),
    created_at: row.created_at,
    createdAt: row.created_at,
  };
}

const DOCUMENT_FIELDS = {
  fotoPerfilAluno: {
    column: "foto_perfil_aluno_json",
    title: "Foto do aluno",
    type: "imagem",
  },
  rgCpfAluno: {
    column: "rg_cpf_aluno_json",
    title: "RG/CPF do aluno",
    type: "documento",
  },
  rgCpfResponsavel: {
    column: "rg_cpf_responsavel_json",
    title: "RG/CPF do responsavel",
    type: "documento",
  },
  comprovanteEndereco: {
    column: "comprovante_endereco_json",
    title: "Comprovante de endereco",
    type: "comprovante",
  },
  atestadoMedico: {
    column: "atestado_medico_json",
    title: "Ficha medica",
    type: "saude",
  },
  autorizacaoImagem: {
    column: "autorizacao_imagem_json",
    title: "Autorizacao de imagem",
    type: "autorizacao",
  },
};

function normalizeDocument(documentId, definition, rawValue, options = {}) {
  const parsed =
    typeof rawValue === "object"
      ? (rawValue ?? {})
      : safeJsonParse(rawValue, rawValue ? { name: text(rawValue, 191) } : {});
  const dataUrl = longText(parsed.dataUrl ?? parsed.base64 ?? "");
  const url = text(
    parsed.url ?? parsed.href ?? parsed.path ?? parsed.fileUrl ?? parsed.arquivoPdf ?? "",
    1000,
  );
  const uploadedAt = firstValue(
    parsed.uploadedAt,
    parsed.enviadoEm,
    parsed.createdAt,
    options.uploadedAt,
  );
  const hasFile = Boolean(dataUrl || url || parsed.name || parsed.nome || rawValue);

  return {
    id: documentId,
    titulo: definition.title,
    nome: firstValue(parsed.name, parsed.nome, parsed.fileName, definition.title),
    tipo: firstValue(parsed.type, parsed.tipo, definition.type),
    tamanho: numeric(parsed.size ?? parsed.tamanho, 0),
    uploadedAt: uploadedAt || null,
    expiresAt: firstValue(parsed.expiresAt, parsed.validade) || null,
    status: hasFile ? "enviado" : "pendente",
    url: url || null,
    dataUrl: dataUrl || null,
    canUpload: options.canUpload !== false,
  };
}

function latestContractDocument(contracts) {
  const contract = contracts.find((item) => text(item.arquivoPdf ?? item.arquivo_pdf, 1000));
  if (!contract) return null;

  return {
    name: text(contract.titulo, 191) || "Contrato",
    type: "application/pdf",
    url: text(contract.arquivoPdf ?? contract.arquivo_pdf, 1000),
    uploadedAt: contract.dataEmissao ?? contract.data_emissao ?? contract.created_at,
    status: contract.status,
  };
}

function buildDocumentList(row, contracts) {
  const documents = [
    normalizeDocument("contrato", { title: "Contrato", type: "contrato" }, latestContractDocument(contracts), {
      canUpload: false,
    }),
  ];

  for (const [documentId, definition] of Object.entries(DOCUMENT_FIELDS)) {
    documents.push(normalizeDocument(documentId, definition, row[definition.column]));
  }

  return documents;
}

function buildMonthlyPresence(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const date = dateText(row.data_aula);
    if (!date) continue;

    const month = date.slice(0, 7);
    const current = grouped.get(month) ?? {
      mes: month,
      presentes: 0,
      faltas: 0,
      total: 0,
      percentual: 0,
    };

    current.total += 1;
    if (Boolean(row.presente)) {
      current.presentes += 1;
    } else {
      current.faltas += 1;
    }

    current.percentual =
      current.total > 0 ? Math.round((current.presentes / current.total) * 100) : 0;
    grouped.set(month, current);
  }

  return [...grouped.values()].sort((left, right) => left.mes.localeCompare(right.mes)).slice(-6);
}

function buildEvaluations(row, presenceSummary) {
  const evaluations = [];
  const objetivo = firstValue(row.esporte_objetivo, row.snapshot_esportivas?.objetivo);
  const caracteristica = firstValue(
    row.esporte_caracteristica,
    row.snapshot_esportivas?.caracteristica,
  );
  const observacoes = firstValue(
    row.estrategico_observacoes_gerais,
    row.snapshot_estrategicas?.observacoesGerais,
  );

  if (objetivo) {
    evaluations.push({
      id: "objetivo",
      titulo: "Objetivo esportivo",
      descricao: objetivo,
      tipo: "tecnica",
    });
  }

  if (caracteristica) {
    evaluations.push({
      id: "caracteristica",
      titulo: "Perfil tecnico",
      descricao: caracteristica,
      tipo: "desempenho",
    });
  }

  if (observacoes) {
    evaluations.push({
      id: "observacoes",
      titulo: "Observacoes da equipe",
      descricao: observacoes,
      tipo: "observacao",
    });
  }

  evaluations.push({
    id: "frequencia",
    titulo: "Desempenho de frequencia",
    descricao:
      presenceSummary.total > 0
        ? `${presenceSummary.percentual}% de presenca registrada nas aulas lancadas.`
        : "Ainda nao ha presencas registradas para gerar uma avaliacao automatica.",
    tipo: "frequencia",
  });

  return evaluations;
}

async function loadStudentProfileRow(studentId) {
  const [rows] = await pool.query(
    `
      SELECT
        aluno.*,
        responsavel.nome_completo AS responsavel_nome_completo,
        responsavel.cpf AS responsavel_cpf,
        responsavel.rg AS responsavel_rg,
        responsavel.whatsapp AS responsavel_whatsapp,
        responsavel.email AS responsavel_email,
        responsavel.parentesco AS responsavel_parentesco,
        endereco.cep AS endereco_cep,
        endereco.rua AS endereco_rua,
        endereco.numero AS endereco_numero,
        endereco.complemento AS endereco_complemento,
        endereco.bairro AS endereco_bairro,
        endereco.cidade AS endereco_cidade,
        endereco.estado AS endereco_estado,
        documentos.foto_perfil_aluno_json,
        documentos.rg_cpf_aluno_json,
        documentos.rg_cpf_responsavel_json,
        documentos.comprovante_endereco_json,
        documentos.autorizacao_imagem_json,
        documentos.atestado_medico_json,
        esportes.modalidades_json AS esporte_modalidades_json,
        esportes.unidades_json AS esporte_unidades_json,
        esportes.horarios_json AS esporte_horarios_json,
        esportes.turmas_json AS esporte_turmas_json,
        esportes.nivel AS esporte_nivel,
        esportes.treinou_antes AS esporte_treinou_antes,
        esportes.caracteristica AS esporte_caracteristica,
        esportes.objetivo AS esporte_objetivo,
        saude.restricao_medica AS saude_restricao_medica,
        saude.medicamentos AS saude_medicamentos,
        saude.alergias AS saude_alergias,
        saude.lesoes AS saude_lesoes,
        saude.plano_saude AS saude_plano_saude,
        saude.observacoes_importantes AS saude_observacoes_importantes,
        estrategico.como_conheceu AS estrategico_como_conheceu,
        estrategico.indicacao_quem AS estrategico_indicacao_quem,
        estrategico.observacoes_gerais AS estrategico_observacoes_gerais,
        COALESCE(turma.nome, aluno.turma_principal) AS turma_nome_rel,
        COALESCE(turma.modalidade, aluno.modalidade_principal) AS turma_modalidade_rel,
        COALESCE(turma.unidade, aluno.unidade_principal) AS turma_unidade_rel,
        COALESCE(professor.nome, turma.professor_nome) AS professor_nome_rel,
        turma.horario AS turma_horario,
        turma.horario_inicio AS turma_horario_inicio,
        turma.horario_fim AS turma_horario_fim,
        turma.dias_semana AS turma_dias_semana,
        turma.dias_semana_json AS turma_dias_semana_json,
        plano.nome AS plano_nome_rel,
        plano.categoria AS plano_categoria_rel,
        COALESCE(plano.valor, plano.preco_mensal, aluno.plano_valor) AS plano_valor_rel
      FROM j12_alunos aluno
      LEFT JOIN j12_alunos_responsaveis responsavel
        ON CAST(responsavel.aluno_id AS CHAR) = CAST(aluno.id AS CHAR)
      LEFT JOIN j12_alunos_enderecos endereco
        ON CAST(endereco.aluno_id AS CHAR) = CAST(aluno.id AS CHAR)
      LEFT JOIN j12_alunos_documentos documentos
        ON CAST(documentos.aluno_id AS CHAR) = CAST(aluno.id AS CHAR)
      LEFT JOIN j12_alunos_esportes esportes
        ON CAST(esportes.aluno_id AS CHAR) = CAST(aluno.id AS CHAR)
      LEFT JOIN j12_alunos_saude saude
        ON CAST(saude.aluno_id AS CHAR) = CAST(aluno.id AS CHAR)
      LEFT JOIN j12_alunos_estrategico estrategico
        ON CAST(estrategico.aluno_id AS CHAR) = CAST(aluno.id AS CHAR)
      LEFT JOIN j12_turmas turma ON turma.id = aluno.turma_id
      LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
      LEFT JOIN j12_planos plano ON plano.id = aluno.plano_id
      WHERE CAST(aluno.id AS CHAR) = ?
      LIMIT 1
    `,
    [String(studentId)],
  );

  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows[0];
  const snapshot = safeJsonParse(row.matricula_snapshot_json, {});
  row.snapshot_dados_aluno = snapshot?.dadosAluno ?? {};
  row.snapshot_responsavel = snapshot?.responsavel ?? {};
  row.snapshot_endereco = snapshot?.endereco ?? {};
  row.snapshot_esportivas = snapshot?.esportivas ?? {};
  row.snapshot_saude = snapshot?.saude ?? {};
  row.snapshot_estrategicas = snapshot?.estrategicas ?? snapshot?.estrategias ?? {};

  return row;
}

function mapProfileAluno(row) {
  const modalidades = firstList(row.esporte_modalidades_json, row.snapshot_esportivas?.modalidades);
  const unidades = firstList(row.esporte_unidades_json, row.snapshot_esportivas?.unidades);
  const turmas = firstList(row.esporte_turmas_json, row.snapshot_esportivas?.turmas);
  const horarios = firstList(
    row.esporte_horarios_json,
    row.dias_horarios_json,
    row.snapshot_esportivas?.horarios,
  );
  const dataNascimento = firstValue(
    dateText(row.data_nascimento),
    row.snapshot_dados_aluno?.dataNascimento,
  );
  const fotoDocument = normalizeDocument(
    "fotoPerfilAluno",
    DOCUMENT_FIELDS.fotoPerfilAluno,
    row.foto_perfil_aluno_json,
  );

  return {
    id: String(row.id),
    nome: firstValue(row.nome_completo, row.snapshot_dados_aluno?.nomeCompleto, "Aluno"),
    fotoUrl: firstValue(fotoDocument.url, fotoDocument.dataUrl),
    idade: firstValue(row.idade, row.snapshot_dados_aluno?.idade, calculateAge(dataNascimento)),
    dataNascimento,
    modalidade: firstValue(row.turma_modalidade_rel, row.modalidade_principal, modalidades),
    categoria: firstValue(row.plano_categoria_rel, row.esporte_nivel, row.snapshot_esportivas?.nivel),
    turma: firstValue(row.turma_nome_rel, row.turma_principal, turmas),
    professor: firstValue(row.professor_nome_rel, "Professor a definir"),
    unidade: firstValue(row.turma_unidade_rel, row.unidade_principal, unidades),
    statusMatricula: firstValue(row.status, "ativo"),
    numeroMatricula: firstValue(row.numero_matricula, row.snapshot_dados_aluno?.numeroMatricula),
    plano: firstValue(row.plano_nome_rel, row.plano_principal),
    horarios,
    cpf: firstValue(row.cpf, row.snapshot_dados_aluno?.cpf),
    rg: firstValue(row.rg, row.snapshot_dados_aluno?.rg),
    sexo: firstValue(row.sexo, row.snapshot_dados_aluno?.sexo),
    telefone: firstValue(row.telefone_contato, row.responsavel_whatsapp),
    email: firstValue(row.email_contato, row.responsavel_email),
    escola: firstValue(row.colegio, row.snapshot_dados_aluno?.colegio),
    serieEscolar: firstValue(row.periodo_escolar, row.snapshot_dados_aluno?.periodoEscolar),
    endereco: {
      cep: firstValue(row.endereco_cep, row.snapshot_endereco?.cep),
      rua: firstValue(row.endereco_rua, row.snapshot_endereco?.rua),
      numero: firstValue(row.endereco_numero, row.snapshot_endereco?.numero),
      complemento: firstValue(row.endereco_complemento, row.snapshot_endereco?.complemento),
      bairro: firstValue(row.endereco_bairro, row.snapshot_endereco?.bairro),
      cidade: firstValue(row.endereco_cidade, row.snapshot_endereco?.cidade),
      estado: firstValue(row.endereco_estado, row.snapshot_endereco?.estado),
    },
    responsavel: {
      nome: firstValue(row.responsavel_nome_completo, row.responsavel, row.snapshot_responsavel?.nomeCompleto),
      cpf: firstValue(row.responsavel_cpf, row.snapshot_responsavel?.cpf),
      rg: firstValue(row.responsavel_rg, row.snapshot_responsavel?.rg),
      whatsapp: firstValue(row.responsavel_whatsapp, row.telefone_responsavel, row.snapshot_responsavel?.whatsapp),
      email: firstValue(row.responsavel_email, row.snapshot_responsavel?.email),
      parentesco: firstValue(row.responsavel_parentesco, row.snapshot_responsavel?.parentesco),
    },
    saude: {
      alergias: firstValue(row.saude_alergias, row.snapshot_saude?.alergias),
      restricoesMedicas: firstValue(row.saude_restricao_medica, row.snapshot_saude?.restricaoMedica),
      medicamentos: firstValue(row.saude_medicamentos, row.snapshot_saude?.medicamentos),
      contatoEmergencia: firstValue(row.responsavel_whatsapp, row.telefone_responsavel, row.telefone_contato),
      planoSaude: firstValue(row.saude_plano_saude, row.snapshot_saude?.planoSaude),
      lesoes: firstValue(row.saude_lesoes, row.snapshot_saude?.lesoes),
      observacoes: firstValue(
        row.saude_observacoes_importantes,
        row.snapshot_saude?.observacoesImportantes,
      ),
    },
  };
}

async function buildStudentProfile(student) {
  const [row, charges, presencas, contratos, notificacoes] = await Promise.all([
    loadStudentProfileRow(student.id),
    listChargesForStudents([student]),
    loadPresenceRows([student]),
    loadContractRows([student]),
    loadNotificationRows([student]),
  ]);

  if (!row) {
    throw createHttpError("Aluno nao encontrado.", 404);
  }

  const latestCharge = [...charges].sort((left, right) =>
    String(right.vencimento || "").localeCompare(String(left.vencimento || "")),
  )[0];
  const chargeSummary = summarizeCharges(charges);
  const presenceSummary = summarizePresence(presencas);
  const contracts = contratos.map(mapContract);
  const notifications = notificacoes.map(mapNotification);

  return {
    aluno: mapProfileAluno(row),
    financeiro: {
      mensalidade: latestCharge?.valorFinal ?? latestCharge?.valor ?? numeric(row.plano_valor_rel),
      vencimento: latestCharge?.vencimento ?? null,
      statusPagamento: latestCharge?.status ?? "sem_cobranca",
      totalAberto: chargeSummary.totalAberto,
      totalPago: chargeSummary.totalPago,
      pendentes: chargeSummary.pendentes,
      ultimasCobrancas: charges.slice(0, 8),
      historico: charges,
    },
    frequencia: {
      ...presenceSummary,
      ultimasPresencas: presencas.slice(0, 10).map(mapPresence),
      graficoMensal: buildMonthlyPresence(presencas),
    },
    avaliacoes: buildEvaluations(row, presenceSummary),
    documentos: buildDocumentList(row, contracts),
    contratos: contracts,
    mensagens: notifications.slice(0, 12),
    proximasAulas: mapNextClasses({
      ...student,
      modalidade: firstValue(row.turma_modalidade_rel, student.modalidade),
      turma: firstValue(row.turma_nome_rel, student.turma),
      unidade: firstValue(row.turma_unidade_rel, student.unidade),
      professor: firstValue(row.professor_nome_rel, student.professor),
    }),
    updatedAt: new Date().toISOString(),
  };
}

async function handleAlunoPerfil(req, res, next) {
  try {
    const students = await getResponsavelStudents(req);
    const selected = resolveRequestedStudent(req, students, { allowFamily: false });

    if (!selected) {
      throw createHttpError("Selecione um aluno para consultar o perfil.", 400);
    }

    res.json(await buildStudentProfile(selected));
  } catch (error) {
    next(error);
  }
}

async function handleUploadPerfilDocumento(req, res, next) {
  try {
    const students = await getResponsavelStudents(req);
    const selected = resolveRequestedStudent(req, students, { allowFamily: false });

    if (!selected) {
      throw createHttpError("Selecione um aluno para enviar documento.", 400);
    }

    const documentId = text(req.params.documentoId, 64);
    const definition = DOCUMENT_FIELDS[documentId];
    if (!definition) {
      throw createHttpError("Tipo de documento invalido.", 400);
    }

    const payload = req.body ?? {};
    const fileName = text(payload.name ?? payload.nome, 191);
    const fileType = text(payload.type ?? payload.tipo, 100);
    const fileSize = Number(payload.size ?? payload.tamanho ?? 0);
    const dataUrl = longText(payload.dataUrl ?? payload.base64 ?? "");
    const url = text(payload.url ?? "", 1000);

    if (!fileName) {
      throw createHttpError("Informe o nome do arquivo.", 400);
    }

    if (!dataUrl && !url) {
      throw createHttpError("Arquivo nao enviado.", 400);
    }

    if (fileSize > 4 * 1024 * 1024) {
      throw createHttpError("Documento acima do limite de 4MB.", 413);
    }

    const documentPayload = {
      name: fileName,
      type: fileType,
      size: Number.isFinite(fileSize) ? fileSize : 0,
      dataUrl: dataUrl || undefined,
      url: url || undefined,
      uploadedAt: new Date().toISOString(),
    };

    await pool.query(
      `
        INSERT INTO j12_alunos_documentos (aluno_id, ${definition.column})
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
          ${definition.column} = VALUES(${definition.column}),
          updated_at = CURRENT_TIMESTAMP
      `,
      [selected.id, JSON.stringify(documentPayload)],
    );

    res.json(await buildStudentProfile(selected));
  } catch (error) {
    next(error);
  }
}

async function handleListPortalStudents(req, res, next) {
  try {
    res.json(await getResponsavelStudents(req));
  } catch (error) {
    next(error);
  }
}

async function handleDashboard(req, res, next) {
  try {
    const students = await getResponsavelStudents(req);
    const selected = resolveRequestedStudent(req, students);
    const data = selected
      ? await buildDashboardForStudent(selected)
      : await buildFamilyDashboard(students);

    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function handleFinanceiro(req, res, next) {
  try {
    const students = getScopedStudents(req, await getResponsavelStudents(req));
    res.json(await listChargesForStudents(students));
  } catch (error) {
    next(error);
  }
}

async function handlePresencas(req, res, next) {
  try {
    const students = getScopedStudents(req, await getResponsavelStudents(req));
    const rows = await loadPresenceRows(students);
    res.json(rows.map(mapPresence));
  } catch (error) {
    next(error);
  }
}

async function handleContratos(req, res, next) {
  try {
    const students = getScopedStudents(req, await getResponsavelStudents(req));
    const rows = await loadContractRows(students);
    res.json(rows.map(mapContract));
  } catch (error) {
    next(error);
  }
}

async function handleNotificacoes(req, res, next) {
  try {
    const students = getScopedStudents(req, await getResponsavelStudents(req));
    const rows = await loadNotificationRows(students);
    res.json(rows.map(mapNotification));
  } catch (error) {
    next(error);
  }
}

async function handleMarkNotificationRead(req, res, next) {
  try {
    const students = getScopedStudents(req, await getResponsavelStudents(req));
    const clause = inClause(students.map((student) => student.id));

    if (!clause) {
      throw createHttpError("Nenhum aluno vinculado ao responsavel.", 404);
    }

    await pool.query(
      `
        UPDATE student_notifications
        SET lida = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND CAST(aluno_id AS CHAR) IN (${clause.placeholders})
      `,
      [String(req.params.id), ...clause.params],
    );

    res.json({
      success: true,
      data: {
        id: String(req.params.id),
      },
    });
  } catch (error) {
    next(error);
  }
}

router.use(requireAuth);

router.get("/alunos", handleListPortalStudents);
router.get("/me/alunos", handleListPortalStudents);

router.get("/perfil", handleAlunoPerfil);
router.get("/me/perfil", handleAlunoPerfil);
router.get("/alunos/:alunoId/perfil", handleAlunoPerfil);
router.put("/alunos/:alunoId/documentos/:documentoId", handleUploadPerfilDocumento);

router.get("/dashboard", handleDashboard);
router.get("/me/dashboard", handleDashboard);
router.get("/alunos/:alunoId/dashboard", handleDashboard);

router.get("/financeiro", handleFinanceiro);
router.get("/me/financeiro", handleFinanceiro);
router.get("/alunos/:alunoId/financeiro", handleFinanceiro);

router.get("/presencas", handlePresencas);
router.get("/me/presencas", handlePresencas);
router.get("/alunos/:alunoId/presencas", handlePresencas);

router.get("/contratos", handleContratos);
router.get("/me/contratos", handleContratos);
router.get("/alunos/:alunoId/contratos", handleContratos);

router.get("/notificacoes", handleNotificacoes);
router.get("/me/notificacoes", handleNotificacoes);
router.get("/alunos/:alunoId/notificacoes", handleNotificacoes);
router.put("/notificacoes/:id/lida", handleMarkNotificationRead);
router.put("/alunos/:alunoId/notificacoes/:id/lida", handleMarkNotificationRead);

router.get("/", async (_req, res, next) => {
  try {
    if (!canManageSystem(_req.auth)) {
      return res.status(403).json({ message: "Sem permissao para listar responsaveis." });
    }

    const [rows] = await pool.query("SELECT * FROM j12_responsaveis ORDER BY nome ASC");
    res.json(Array.isArray(rows) ? rows.map(mapRow) : []);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para consultar responsaveis." });
    }

    const item = await findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Responsavel nao encontrado." });
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para criar responsaveis." });
    }

    const item = normalizePayload(req.body ?? {});
    const [result] = await pool.query(
      "INSERT INTO j12_responsaveis (nome, cpf, telefone, email, endereco, rg, parentesco) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [item.nome, item.cpf, item.telefone, item.email, item.endereco, item.rg, item.parentesco],
    );
    res.status(201).json(await findById(result.insertId));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para editar responsaveis." });
    }

    const item = normalizePayload(req.body ?? {});
    await pool.query(
      "UPDATE j12_responsaveis SET nome = ?, cpf = ?, telefone = ?, email = ?, endereco = ?, rg = ?, parentesco = ? WHERE id = ?",
      [
        item.nome,
        item.cpf,
        item.telefone,
        item.email,
        item.endereco,
        item.rg,
        item.parentesco,
        req.params.id,
      ],
    );

    const saved = await findById(req.params.id);
    if (!saved) {
      return res.status(404).json({ message: "Responsavel nao encontrado." });
    }

    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para excluir responsaveis." });
    }

    await pool.query("DELETE FROM j12_responsaveis WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
