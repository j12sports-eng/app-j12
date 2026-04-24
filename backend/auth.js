const { randomBytes, randomUUID, scryptSync, timingSafeEqual } = require("node:crypto");
const { query, transaction } = require("./db");

const SESSION_TTL_DAYS = Number(process.env.AUTH_SESSION_TTL_DAYS || 30);
const RESET_TTL_MINUTES = Number(process.env.AUTH_RESET_TTL_MINUTES || 30);
const PASSWORD_RULE_MESSAGE =
  "A senha deve ter no minimo 8 caracteres, incluindo letra maiuscula, minuscula e numero.";

function safeJsonParse(value, fallback) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function nowDate() {
  return new Date();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function formatSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeIdentifier(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString("hex"),
  };
}

function verifyPassword(password, salt, expectedHash) {
  const candidate = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
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
    const error = new Error(PASSWORD_RULE_MESSAGE);
    error.statusCode = 400;
    throw error;
  }
}

function sanitizeUser(row) {
  const classScope = safeJsonParse(row.class_scope_json, []);
  return {
    id: String(row.id),
    nome: String(row.name ?? ""),
    email: String(row.email ?? ""),
    login: String(row.login ?? row.email ?? ""),
    role: String(row.role ?? "aluno"),
    studentId: row.linked_aluno_id ?? row.aluno_id ?? null,
    teacherId: row.professor_id ?? null,
    responsavelId: row.responsavel_id ?? null,
    status: String(row.status ?? "ativo"),
    classScope: Array.isArray(classScope)
      ? classScope.filter((item) => typeof item === "string" && item.trim())
      : [],
  };
}

async function cleanupExpiredSessions() {
  await query("DELETE FROM user_sessions WHERE expires_at <= NOW()");
}

async function cleanupExpiredPasswordResetTokens() {
  await query("DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at <= NOW()");
}

async function findUserByIdentifier(identifier) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return null;

  const rows = await query(
    `
      SELECT *
      FROM users
      WHERE LOWER(email) = ? OR LOWER(login) = ?
      LIMIT 1
    `,
    [normalized, normalized],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function findUserById(userId) {
  const rows = await query("SELECT * FROM users WHERE id = ? LIMIT 1", [String(userId)]);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function seedBaseData() {
  const [alunosCount] = await query("SELECT COUNT(*) AS total FROM alunos");
  if (Number(alunosCount?.total || 0) === 0) {
    await transaction(async (connection) => {
      await connection.execute(
        `
          INSERT INTO alunos (
            id, nome, email, telefone, data_nascimento, responsavel, telefone_responsavel,
            responsavel_email, responsavel_whatsapp, modalidade, turma, plano, status,
            matricula_em, numero_matricula, cpf, rg, sexo, turmas_json, planos_json,
            unidades_json, horarios_json
          ) VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          "a1",
          "Lucas Almeida",
          "lucas.almeida@email.com",
          "(11) 98123-4567",
          "2014-03-12",
          "Carla Almeida",
          "(11) 99888-1122",
          "carla.almeida@email.com",
          "(11) 99888-1122",
          "Futebol",
          "Sub-11 Tarde",
          "Mensal Plus",
          "ativo",
          "2024-02-10",
          "1",
          "123.456.789-10",
          "45.678.912-1",
          "Masculino",
          JSON.stringify(["Sub-11 Tarde", "Sub-9 Manha"]),
          JSON.stringify(["Mensal Plus", "Trimestral"]),
          JSON.stringify(["Unidade Centro", "Unidade Zona Norte"]),
          JSON.stringify(["Seg 14:00", "Sab 09:00"]),
          "a2",
          "Mariana Souza",
          "mari.souza@email.com",
          "(11) 97777-3344",
          "2012-07-22",
          "Paulo Souza",
          "(11) 98765-1010",
          "paulo.souza@email.com",
          "(11) 98765-1010",
          "Volei",
          "Sub-13 Tarde",
          "Trimestral",
          "ativo",
          "2023-11-05",
          "2",
          "987.654.321-00",
          "33.222.111-9",
          "Feminino",
          JSON.stringify(["Sub-13 Tarde"]),
          JSON.stringify(["Trimestral"]),
          JSON.stringify(["Unidade Centro"]),
          JSON.stringify(["Ter 15:00", "Qui 15:00"]),
        ],
      );
    });
  }

  const [financeiroCount] = await query("SELECT COUNT(*) AS total FROM financeiro");
  if (Number(financeiroCount?.total || 0) === 0) {
    await transaction(async (connection) => {
      await connection.execute(
        `
          INSERT INTO financeiro (
            id, aluno_id, aluno_nome, descricao, tipo, valor, vencimento, responsavel_financeiro,
            responsavel_cpf, telefone_whatsapp, email, unidade, modalidade, turma, plano_id,
            plano_nome, periodicidade, competencia, valor_original, desconto_valor,
            desconto_percentual, bolsa_valor, bolsa_percentual, multa_percentual,
            juros_dia_percentual, valor_final, data_geracao, status, tipo_cobranca, origem, ativo
          ) VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          "fin-a1-2026-04",
          "a1",
          "Lucas Almeida",
          "Mensalidade Abril/2026",
          "mensalidade",
          329.9,
          "2026-04-10",
          "Carla Almeida",
          "123.456.789-10",
          "(11) 99888-1122",
          "carla.almeida@email.com",
          "Unidade Centro",
          "Futebol",
          "Sub-11 Tarde",
          "plano-mensal-plus",
          "Mensal Plus",
          "mensal",
          "2026-04",
          329.9,
          0,
          0,
          0,
          0,
          2,
          0.33,
          329.9,
          "2026-04-01",
          "pendente",
          "recorrente",
          "automatica",
          1,
        ],
      );
    });
  }

  const [presencasCount] = await query("SELECT COUNT(*) AS total FROM student_presencas");
  if (Number(presencasCount?.total || 0) === 0) {
    await transaction(async (connection) => {
      await connection.execute(
        `
          INSERT INTO student_presencas (
            id, aluno_id, turma, modalidade, data_aula, presente, observacao
          ) VALUES
          (?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          "pres-a1-1",
          "a1",
          "Sub-11 Tarde",
          "Futebol",
          "2026-04-07",
          1,
          "Treino tecnico concluido.",
          "pres-a1-2",
          "a1",
          "Sub-11 Tarde",
          "Futebol",
          "2026-04-09",
          1,
          "Bom rendimento no coletivo.",
          "pres-a1-3",
          "a1",
          "Sub-9 Manha",
          "Futebol",
          "2026-04-12",
          0,
          "Falta justificada pelo responsavel.",
        ],
      );
    });
  }

  const [contractsCount] = await query("SELECT COUNT(*) AS total FROM student_contracts");
  if (Number(contractsCount?.total || 0) === 0) {
    await transaction(async (connection) => {
      await connection.execute(
        `
          INSERT INTO student_contracts (
            id, aluno_id, tipo_documento, titulo, status, template_html, data_emissao, data_assinatura, observacoes
          ) VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          "ctr-a1-1",
          "a1",
          "contrato_principal",
          "Contrato esportivo J12",
          "assinado",
          "<h1>Contrato esportivo J12</h1><p>Aluno Lucas Almeida vinculado ao plano Mensal Plus.</p>",
          "2026-03-01",
          "2026-03-02",
          "Contrato assinado digitalmente pelo responsavel.",
        ],
      );
    });
  }

  const [notificationsCount] = await query("SELECT COUNT(*) AS total FROM student_notifications");
  if (Number(notificationsCount?.total || 0) === 0) {
    await transaction(async (connection) => {
      await connection.execute(
        `
          INSERT INTO student_notifications (
            id, aluno_id, titulo, mensagem, canal, tipo, lida
          ) VALUES
          (?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          "ntf-a1-1",
          "a1",
          "Boas-vindas a area do aluno",
          "Seu acesso foi liberado. Aqui voce acompanha plano, financeiro, presenca e contrato.",
          "painel",
          "info",
          0,
          "ntf-a1-2",
          "a1",
          "Mensalidade em aberto",
          "Sua mensalidade de abril esta pendente com vencimento em 10/04/2026.",
          "dashboard",
          "warning",
          0,
          "ntf-a1-3",
          "a1",
          "Contrato disponivel",
          "Seu contrato principal esta assinado e disponivel para consulta.",
          "painel",
          "success",
          1,
        ],
      );
    });
  }
}

async function ensureAuthSeedData() {
  await seedBaseData();

  const defaults = [
    {
      id: "usr-admin",
      name: "Admin J12",
      email: "admin@j12.com",
      login: "admin@j12.com",
      role: "admin",
      alunoId: null,
      professorId: null,
      responsavelId: null,
      linkedAlunoId: null,
      classScope: [],
      phoneWhatsapp: null,
      status: "ativo",
      password: "123456",
    },
    {
      id: "usr-coord",
      name: "Coord. Marina",
      email: "coord@j12.com",
      login: "coord@j12.com",
      role: "coordenador",
      alunoId: null,
      professorId: null,
      responsavelId: null,
      linkedAlunoId: null,
      classScope: [],
      phoneWhatsapp: null,
      status: "ativo",
      password: "123456",
    },
    {
      id: "usr-prof-ricardo",
      name: "Ricardo Mendes",
      email: "prof@j12.com",
      login: "prof@j12.com",
      role: "professor",
      alunoId: null,
      professorId: "pr1",
      responsavelId: null,
      linkedAlunoId: null,
      classScope: ["Sub-11 Tarde", "Sub-9 Manha"],
      phoneWhatsapp: null,
      status: "ativo",
      password: "123456",
    },
    {
      id: "usr-aluno-lucas",
      name: "Lucas Almeida",
      email: "aluno@j12.com",
      login: "aluno@j12.com",
      role: "aluno",
      alunoId: "a1",
      professorId: null,
      responsavelId: null,
      linkedAlunoId: null,
      classScope: [],
      phoneWhatsapp: "(11) 98123-4567",
      status: "ativo",
      password: "123456",
    },
    {
      id: "usr-resp-carla",
      name: "Carla Almeida",
      email: "responsavel@j12.com",
      login: "responsavel@j12.com",
      role: "responsavel",
      alunoId: null,
      professorId: null,
      responsavelId: "resp-a1",
      linkedAlunoId: "a1",
      classScope: [],
      phoneWhatsapp: "(11) 99888-1122",
      status: "ativo",
      password: "123456",
    },
  ];

  await transaction(async (connection) => {
    for (const user of defaults) {
      const [existing] = await connection.execute(
        "SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(login) = ? LIMIT 1",
        [String(user.email).toLowerCase(), String(user.login).toLowerCase()],
      );
      if (Array.isArray(existing) && existing.length > 0) {
        continue;
      }

      const { hash, salt } = hashPassword(user.password);
      await connection.execute(
        `
          INSERT INTO users (
            id, name, email, login, password_hash, password_salt, role, aluno_id,
            professor_id, responsavel_id, linked_aluno_id, class_scope_json, phone_whatsapp, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          user.id,
          user.name,
          user.email,
          user.login,
          hash,
          salt,
          user.role,
          user.alunoId,
          user.professorId,
          user.responsavelId,
          user.linkedAlunoId,
          JSON.stringify(user.classScope),
          user.phoneWhatsapp,
          user.status,
        ],
      );
    }
  });
}

async function authenticateUser(identifier, password) {
  await cleanupExpiredSessions();
  const row = await findUserByIdentifier(identifier);
  if (!row || String(row.status).toLowerCase() !== "ativo") return null;
  if (!verifyPassword(password, row.password_salt, row.password_hash)) return null;
  return sanitizeUser(row);
}

async function createSession(userId) {
  await cleanupExpiredSessions();
  const token = randomBytes(48).toString("hex");
  const now = nowDate();
  const expiresAt = addDays(now, SESSION_TTL_DAYS);

  await query(
    `
      INSERT INTO user_sessions (token, user_id, created_at, expires_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      token,
      String(userId),
      formatSqlDateTime(now),
      formatSqlDateTime(expiresAt),
      formatSqlDateTime(now),
    ],
  );

  return token;
}

async function getUserBySessionToken(token) {
  await cleanupExpiredSessions();
  const rows = await query(
    `
      SELECT u.*
      FROM user_sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > NOW()
      LIMIT 1
    `,
    [String(token)],
  );

  if (!Array.isArray(rows) || rows.length === 0) return null;
  await query("UPDATE user_sessions SET last_seen_at = NOW() WHERE token = ?", [String(token)]);
  return sanitizeUser(rows[0]);
}

async function deleteSession(token) {
  if (!token) return;
  await query("DELETE FROM user_sessions WHERE token = ?", [String(token)]);
}

async function createPasswordResetToken(identifier, channel = "email") {
  await cleanupExpiredPasswordResetTokens();
  const row = await findUserByIdentifier(identifier);
  if (!row || String(row.status).toLowerCase() !== "ativo") return null;

  const token = randomBytes(32).toString("hex");
  const expiresAt = addMinutes(nowDate(), RESET_TTL_MINUTES);

  await query(
    `
      INSERT INTO password_reset_tokens (token, user_id, channel, created_at, expires_at, used_at)
      VALUES (?, ?, ?, NOW(), ?, NULL)
    `,
    [token, String(row.id), String(channel || "email"), formatSqlDateTime(expiresAt)],
  );

  return {
    token,
    user: sanitizeUser(row),
    expiresAt: expiresAt.toISOString(),
    channel,
  };
}

async function getValidPasswordResetToken(token) {
  await cleanupExpiredPasswordResetTokens();
  const rows = await query(
    `
      SELECT prt.token, prt.user_id, prt.channel, prt.expires_at, u.*
      FROM password_reset_tokens prt
      INNER JOIN users u ON u.id = prt.user_id
      WHERE prt.token = ? AND prt.used_at IS NULL AND prt.expires_at > NOW()
      LIMIT 1
    `,
    [String(token)],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function resetPassword(token, password) {
  assertStrongPassword(password);
  const tokenRow = await getValidPasswordResetToken(token);

  if (!tokenRow) {
    const error = new Error("Token invalido ou expirado.");
    error.statusCode = 400;
    throw error;
  }

  const { hash, salt } = hashPassword(password);

  await transaction(async (connection) => {
    await connection.execute(
      "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = NOW() WHERE id = ?",
      [hash, salt, String(tokenRow.user_id)],
    );
    await connection.execute(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ?",
      [String(token)],
    );
  });

  return sanitizeUser(tokenRow);
}

async function changePassword(userId, currentPassword, nextPassword) {
  assertStrongPassword(nextPassword);
  const row = await findUserById(userId);

  if (!row) {
    const error = new Error("Usuario nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  if (!verifyPassword(currentPassword, row.password_salt, row.password_hash)) {
    const error = new Error("A senha atual esta incorreta.");
    error.statusCode = 400;
    throw error;
  }

  const { hash, salt } = hashPassword(nextPassword);
  await query(
    "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = NOW() WHERE id = ?",
    [hash, salt, String(userId)],
  );

  return sanitizeUser(row);
}

async function completeStudentFirstAccess(payload) {
  const numeroMatricula = String(payload.numeroMatricula ?? "").trim();
  const dataNascimento = String(payload.dataNascimento ?? "").trim();
  const login = normalizeIdentifier(payload.login || payload.email);
  const email = normalizeIdentifier(payload.email || payload.login);
  const password = String(payload.senha ?? "");
  const confirmPassword = String(payload.confirmarSenha ?? "");

  if (!numeroMatricula || !dataNascimento) {
    const error = new Error("Informe numero de matricula e data de nascimento.");
    error.statusCode = 400;
    throw error;
  }

  if (!login || !email) {
    const error = new Error("Informe um login/e-mail para o primeiro acesso.");
    error.statusCode = 400;
    throw error;
  }

  if (password !== confirmPassword) {
    const error = new Error("A confirmacao da senha nao confere.");
    error.statusCode = 400;
    throw error;
  }

  assertStrongPassword(password);

  const alunos = await query(
    `
      SELECT *
      FROM alunos
      WHERE numero_matricula = ? AND data_nascimento = ?
      LIMIT 1
    `,
    [numeroMatricula, dataNascimento],
  );

  if (!Array.isArray(alunos) || alunos.length === 0) {
    const error = new Error("Nao encontramos um aluno com esses dados para primeiro acesso.");
    error.statusCode = 404;
    throw error;
  }

  const aluno = alunos[0];
  const existingByStudent = await query(
    "SELECT * FROM users WHERE aluno_id = ? OR linked_aluno_id = ? LIMIT 1",
    [String(aluno.id), String(aluno.id)],
  );
  const existingByIdentifier = await query(
    "SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(login) = ? LIMIT 1",
    [email, login],
  );

  if (Array.isArray(existingByIdentifier) && existingByIdentifier.length > 0) {
    const identified = existingByIdentifier[0];
    const identifiedStudent = identified.aluno_id ?? identified.linked_aluno_id ?? null;
    if (identifiedStudent && String(identifiedStudent) !== String(aluno.id)) {
      const error = new Error("Este login/e-mail ja esta vinculado a outro usuario.");
      error.statusCode = 409;
      throw error;
    }
  }

  const { hash, salt } = hashPassword(password);
  const basePayload = {
    name: String(aluno.nome ?? "Aluno J12"),
    email,
    login,
    hash,
    salt,
    role: "aluno",
    alunoId: String(aluno.id),
    linkedAlunoId: null,
    phoneWhatsapp: String(aluno.telefone ?? ""),
  };

  await transaction(async (connection) => {
    if (Array.isArray(existingByStudent) && existingByStudent.length > 0) {
      await connection.execute(
        `
          UPDATE users
          SET name = ?, email = ?, login = ?, password_hash = ?, password_salt = ?,
              role = 'aluno', aluno_id = ?, linked_aluno_id = NULL, status = 'ativo',
              phone_whatsapp = ?, updated_at = NOW()
          WHERE id = ?
        `,
        [
          basePayload.name,
          basePayload.email,
          basePayload.login,
          basePayload.hash,
          basePayload.salt,
          basePayload.alunoId,
          basePayload.phoneWhatsapp,
          String(existingByStudent[0].id),
        ],
      );
      return;
    }

    await connection.execute(
      `
        INSERT INTO users (
          id, name, email, login, password_hash, password_salt, role, aluno_id,
          professor_id, responsavel_id, linked_aluno_id, class_scope_json, phone_whatsapp, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'aluno', ?, NULL, NULL, NULL, '[]', ?, 'ativo')
      `,
      [
        `usr-${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        basePayload.name,
        basePayload.email,
        basePayload.login,
        basePayload.hash,
        basePayload.salt,
        basePayload.alunoId,
        basePayload.phoneWhatsapp,
      ],
    );
  });

  const created = await findUserByIdentifier(login);
  return created ? sanitizeUser(created) : null;
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

async function requireAuth(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ message: "Sessao invalida ou expirada." });
    }

    const user = await getUserBySessionToken(token);
    if (!user) {
      return res.status(401).json({ message: "Sessao invalida ou expirada." });
    }

    req.auth = user;
    req.authToken = token;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(roles) {
  const allowed = new Set(roles);
  return (req, res, next) => {
    const role = req.auth?.role;
    if (!role || !allowed.has(role)) {
      return res.status(403).json({ message: "Acesso negado para este perfil." });
    }

    next();
  };
}

function resolveScopedStudentId(user) {
  if (!user) return null;
  if (user.role === "aluno") return user.studentId ?? null;
  if (user.role === "responsavel") return user.studentId ?? null;
  return null;
}

function canManageSystem(user) {
  return user?.role === "admin" || user?.role === "coordenador";
}

module.exports = {
  PASSWORD_RULE_MESSAGE,
  sanitizeUser,
  ensureAuthSeedData,
  authenticateUser,
  createSession,
  getUserBySessionToken,
  deleteSession,
  createPasswordResetToken,
  getValidPasswordResetToken,
  resetPassword,
  changePassword,
  completeStudentFirstAccess,
  requireAuth,
  requireRole,
  resolveScopedStudentId,
  canManageSystem,
  getTokenFromRequest,
};
