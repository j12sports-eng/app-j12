const bcrypt = require("bcryptjs");
const { randomBytes, randomUUID, scryptSync, timingSafeEqual } = require("node:crypto");
const { ensureAuthSchema, query, tableExists, transaction } = require("./db.js");
const { signJwt, verifyJwt } = require("./src/utils/jwt.js");

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
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString("hex"),
  };
}

function verifyPassword(password, salt, expectedHash) {
  const normalizedPassword = String(password ?? "");
  const normalizedSalt = String(salt ?? "");
  const normalizedHash = String(expectedHash ?? "");

  if (!normalizedPassword || !normalizedSalt || !normalizedHash) {
    return false;
  }

  if (!/^[a-f0-9]+$/i.test(normalizedHash)) {
    return false;
  }

  const candidate = Buffer.from(
    scryptSync(normalizedPassword, normalizedSalt, 64).toString("hex"),
    "hex",
  );
  const expected = Buffer.from(normalizedHash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function verifyBcryptPassword(password, expectedHash) {
  const normalizedPassword = String(password ?? "");
  const normalizedHash = String(expectedHash ?? "");

  if (!normalizedPassword || !normalizedHash) {
    return false;
  }

  try {
    return bcrypt.compareSync(normalizedPassword, normalizedHash);
  } catch {
    return false;
  }
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
  const role = String(row.role ?? row.perfil ?? "aluno");
  const studentId = row.aluno_id ?? row.linked_aluno_id ?? null;
  const teacherId = row.professor_id ?? null;
  const responsavelId = row.responsavel_id ?? null;
  return {
    id: String(row.id),
    nome: String(row.name ?? row.nome ?? ""),
    email: String(row.email ?? ""),
    login: String(row.login ?? row.email ?? ""),
    role,
    perfil: role,
    studentId: studentId == null ? null : String(studentId),
    aluno_id: studentId == null ? null : Number(studentId) || String(studentId),
    alunoId: studentId == null ? null : String(studentId),
    teacherId: teacherId == null ? null : String(teacherId),
    professor_id: teacherId == null ? null : Number(teacherId) || String(teacherId),
    responsavelId: responsavelId == null ? null : String(responsavelId),
    responsavel_id: responsavelId == null ? null : Number(responsavelId) || String(responsavelId),
    status: String(row.status ?? "ativo"),
    source: row.__source || (row.perfil != null ? "j12_usuarios" : "users"),
    classScope: Array.isArray(classScope)
      ? classScope.filter((item) => typeof item === "string" && item.trim())
      : [],
  };
}

function normalizeLegacyRole(value) {
  const normalized = normalizeIdentifier(value);
  if (normalized === "admin") return "admin";
  if (normalized === "coordenador") return "coordenador";
  if (normalized === "professor") return "professor";
  if (normalized === "responsavel") return "responsavel";
  return "aluno";
}

function normalizeLegacyUserStatus(value) {
  const normalized = normalizeIdentifier(value);
  return normalized === "inativo" ? "inativo" : "ativo";
}

function buildLegacyMirrorId(j12UserId) {
  return `j12u-${String(j12UserId)}`;
}

async function cleanupExpiredSessions() {
  await ensureAuthSchema();
  await query("DELETE FROM user_sessions WHERE expires_at <= NOW()");
}

async function cleanupExpiredPasswordResetTokens() {
  await ensureAuthSchema();
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
      ORDER BY
        CASE WHEN LOWER(status) = 'ativo' THEN 0 ELSE 1 END,
        CASE WHEN LOWER(login) = ? THEN 0 ELSE 1 END,
        CASE WHEN LOWER(email) = ? THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at DESC
      LIMIT 1
    `,
    [normalized, normalized, normalized, normalized],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function findUserById(userId) {
  const rows = await query("SELECT * FROM users WHERE id = ? LIMIT 1", [String(userId)]);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function findJ12UserById(userId) {
  const normalizedId = String(userId ?? "").trim();
  if (!/^\d+$/.test(normalizedId)) {
    return null;
  }

  const rows = await query("SELECT * FROM j12_usuarios WHERE id = ? LIMIT 1", [
    Number(normalizedId),
  ]);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function findJ12UserByIdentifier(identifier) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return null;

  const rows = await query(
    `
      SELECT *
      FROM j12_usuarios
      WHERE LOWER(email) = ?
      LIMIT 1
    `,
    [normalized],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function maybeLinkJ12UserToStudent(userRow) {
  if (!userRow || normalizeLegacyRole(userRow.perfil) !== "aluno" || userRow.aluno_id != null) {
    return userRow;
  }

  const normalizedEmail = normalizeIdentifier(userRow.email);
  if (!normalizedEmail) {
    return userRow;
  }

  if (!(await tableExists("j12_alunos"))) {
    return userRow;
  }

  const alunoRows = await query(
    `
      SELECT id
      FROM j12_alunos
      WHERE LOWER(email_contato) = ?
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `,
    [normalizedEmail],
  );

  if (!Array.isArray(alunoRows) || alunoRows.length === 0) {
    return userRow;
  }

  await query("UPDATE j12_usuarios SET aluno_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
    Number(alunoRows[0].id),
    Number(userRow.id),
  ]);

  return {
    ...userRow,
    aluno_id: Number(alunoRows[0].id),
  };
}

async function upsertJ12UserFromAppUser(user, password) {
  const perfil = user?.role === "coordenador" ? "admin" : user?.role;
  if (!["admin", "professor", "responsavel", "aluno"].includes(perfil)) {
    return null;
  }

  const email = normalizeIdentifier(user?.email);
  if (!email) return null;

  const senhaHash = bcrypt.hashSync(String(password ?? ""), 10);
  const alunoId = user?.studentId == null ? null : Number(user.studentId);
  const professorId = user?.teacherId == null ? null : Number(user.teacherId);
  const responsavelId = user?.responsavelId == null ? null : Number(user.responsavelId);
  const lookupRows = await query(
    `
      SELECT *
      FROM j12_usuarios
      WHERE LOWER(email) = ? OR (perfil = 'aluno' AND aluno_id = ?)
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [email, alunoId == null ? -1 : alunoId],
  );
  const existing = Array.isArray(lookupRows) && lookupRows.length > 0 ? lookupRows[0] : null;

  await transaction(async (connection) => {
    if (existing) {
      await connection.execute(
        `
          UPDATE j12_usuarios
          SET
            nome = ?,
            email = ?,
            senha_hash = ?,
            perfil = ?,
            aluno_id = ?,
            professor_id = ?,
            responsavel_id = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          user.nome || "Usuario J12",
          email,
          senhaHash,
          perfil,
          alunoId,
          professorId,
          responsavelId,
          user.status === "inativo" ? "inativo" : "ativo",
          Number(existing.id),
        ],
      );
      return;
    }

    await connection.execute(
      `
        INSERT INTO j12_usuarios (
          nome,
          email,
          senha_hash,
          perfil,
          aluno_id,
          professor_id,
          responsavel_id,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        user.nome || "Usuario J12",
        email,
        senhaHash,
        perfil,
        alunoId,
        professorId,
        responsavelId,
        user.status === "inativo" ? "inativo" : "ativo",
      ],
    );
  });

  const row = await findJ12UserByIdentifier(email);
  return row ? sanitizeUser({ ...row, __source: "j12_usuarios" }) : null;
}

async function upsertLegacyMirrorUser(legacyUser, password) {
  const mirrorId = buildLegacyMirrorId(legacyUser.id);
  const desiredEmail = normalizeIdentifier(legacyUser.email) || `${mirrorId}@j12.local`;
  const desiredLogin = desiredEmail;
  const desiredName = String(legacyUser.nome ?? desiredEmail).trim() || "Usuario J12";
  const desiredRole = normalizeLegacyRole(legacyUser.perfil);
  const desiredStatus = normalizeLegacyUserStatus(legacyUser.status);
  const desiredAlunoId = legacyUser.aluno_id == null ? null : String(legacyUser.aluno_id);
  const desiredProfessorId =
    legacyUser.professor_id == null ? null : String(legacyUser.professor_id);
  const desiredResponsavelId =
    legacyUser.responsavel_id == null ? null : String(legacyUser.responsavel_id);
  const existingRows = await query(
    `
      SELECT *
      FROM users
      WHERE id = ? OR LOWER(email) = ? OR LOWER(login) = ?
      ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [mirrorId, desiredEmail, desiredLogin, mirrorId],
  );
  const existingUser =
    Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
  const nextPassword = String(password ?? "");
  const passwordPayload = nextPassword ? hashPassword(nextPassword) : null;

  await transaction(async (connection) => {
    if (existingUser) {
      const params = [
        desiredName,
        desiredEmail,
        desiredLogin,
        desiredRole,
        desiredAlunoId,
        desiredProfessorId,
        desiredResponsavelId,
        desiredStatus,
        String(existingUser.id),
      ];

      let sql = `
        UPDATE users
        SET
          name = ?,
          email = ?,
          login = ?,
          role = ?,
          aluno_id = ?,
          professor_id = ?,
          responsavel_id = ?,
          status = ?,
          updated_at = NOW()
      `;

      if (passwordPayload) {
        sql += `,
          password_hash = ?,
          password_salt = ?
        `;
        params.splice(8, 0, passwordPayload.hash, passwordPayload.salt);
      }

      sql += " WHERE id = ?";
      await connection.execute(sql, params);
      return;
    }

    const generatedPassword = passwordPayload ?? hashPassword(randomUUID());

    await connection.execute(
      `
        INSERT INTO users (
          id, name, email, login, password_hash, password_salt, role, aluno_id,
          professor_id, responsavel_id, linked_aluno_id, class_scope_json, phone_whatsapp, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '[]', NULL, ?)
      `,
      [
        mirrorId,
        desiredName,
        desiredEmail,
        desiredLogin,
        generatedPassword.hash,
        generatedPassword.salt,
        desiredRole,
        desiredAlunoId,
        desiredProfessorId,
        desiredResponsavelId,
        desiredStatus,
      ],
    );
  });

  return findUserById(existingUser?.id ?? mirrorId);
}

async function seedBaseData() {
  const [j12AlunosCount] = await query("SELECT COUNT(*) AS total FROM j12_alunos");
  const [legacyAlunosCount] = await query("SELECT COUNT(*) AS total FROM alunos");
  const shouldSeedDemo =
    Number(j12AlunosCount?.total || 0) === 0 && Number(legacyAlunosCount?.total || 0) === 0;

  if (shouldSeedDemo) {
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
  if (shouldSeedDemo && Number(financeiroCount?.total || 0) === 0) {
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
  if (shouldSeedDemo && Number(presencasCount?.total || 0) === 0) {
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
  if (shouldSeedDemo && Number(contractsCount?.total || 0) === 0) {
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
  if (shouldSeedDemo && Number(notificationsCount?.total || 0) === 0) {
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

async function ensureAuthSeedData() {
  await seedBaseData();

  // Contas bootstrap so podem ser criadas por opt-in explicito.
  if (!isAuthSeedEnabled()) return;

  const legacyAlunoRows = await query(
    `
      SELECT aluno_id
      FROM j12_usuarios
      WHERE perfil = 'aluno' AND status = 'ativo' AND aluno_id IS NOT NULL
      ORDER BY id ASC
      LIMIT 1
    `,
  );
  const legacyResponsavelRows = await query(
    `
      SELECT id, aluno_id
      FROM j12_usuarios
      WHERE perfil = 'responsavel' AND status = 'ativo'
      ORDER BY id ASC
      LIMIT 1
    `,
  );
  const professorRows = await query(
    `
      SELECT id
      FROM j12_professores
      ORDER BY id ASC
      LIMIT 1
    `,
  );
  const professorTurmasRows = await query(
    `
      SELECT nome
      FROM j12_turmas
      ORDER BY nome ASC
      LIMIT 2
    `,
  );

  const demoStudentRows = await query(
    `
      SELECT id, telefone_contato
      FROM j12_alunos
      WHERE LOWER(status) = 'ativo'
      ORDER BY id ASC
      LIMIT 1
    `,
  );
  const resolvedAlunoId = legacyAlunoRows?.[0]?.aluno_id ?? demoStudentRows?.[0]?.id ?? null;
  const resolvedResponsavelAlunoId =
    legacyResponsavelRows?.[0]?.aluno_id ?? resolvedAlunoId ?? null;
  const resolvedProfessorId = professorRows?.[0]?.id ?? null;
  const resolvedProfessorScope = Array.isArray(professorTurmasRows)
    ? professorTurmasRows.map((row) => String(row.nome || "").trim()).filter(Boolean)
    : [];

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
      password: getAuthSeedPassword("admin"),
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
      password: getAuthSeedPassword("coordenador"),
    },
  ];

  defaults.push({
    id: "usr-prof-ricardo",
    name: "Ricardo Mendes",
    email: "prof@j12.com",
    login: "prof@j12.com",
    role: "professor",
    alunoId: null,
    professorId: resolvedProfessorId == null ? null : String(resolvedProfessorId),
    responsavelId: null,
    linkedAlunoId: null,
    classScope: resolvedProfessorScope,
    phoneWhatsapp: null,
    status: "ativo",
    password: getAuthSeedPassword("professor"),
  });

  if (resolvedAlunoId != null) {
    defaults.push({
      id: "usr-aluno-lucas",
      name: "Lucas Almeida",
      email: "aluno@j12.com",
      login: "aluno@j12.com",
      role: "aluno",
      alunoId: String(resolvedAlunoId),
      professorId: null,
      responsavelId: null,
      linkedAlunoId: null,
      classScope: [],
      phoneWhatsapp: demoStudentRows?.[0]?.telefone_contato ?? null,
      status: "ativo",
      password: getAuthSeedPassword("aluno"),
    });
  }

  if (resolvedResponsavelAlunoId != null) {
    defaults.push({
      id: "usr-resp-carla",
      name: "Carla Almeida",
      email: "responsavel@j12.com",
      login: "responsavel@j12.com",
      role: "responsavel",
      alunoId: null,
      professorId: null,
      responsavelId:
        legacyResponsavelRows?.[0]?.id == null ? null : String(legacyResponsavelRows[0].id),
      linkedAlunoId: String(resolvedResponsavelAlunoId),
      classScope: [],
      phoneWhatsapp: null,
      status: "ativo",
      password: getAuthSeedPassword("responsavel"),
    });
  }

  await transaction(async (connection) => {
    for (const user of defaults) {
      const [existing] = await connection.execute(
        "SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(login) = ? LIMIT 1",
        [String(user.email).toLowerCase(), String(user.login).toLowerCase()],
      );

      const { hash, salt } = hashPassword(user.password);
      if (Array.isArray(existing) && existing.length > 0) {
        await connection.execute(
          `
            UPDATE users
            SET
              name = ?,
              email = ?,
              login = ?,
              password_hash = ?,
              password_salt = ?,
              role = ?,
              aluno_id = ?,
              professor_id = ?,
              responsavel_id = ?,
              linked_aluno_id = ?,
              class_scope_json = ?,
              phone_whatsapp = ?,
              status = ?,
              updated_at = NOW()
            WHERE id = ?
          `,
          [
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
            String(existing[0].id),
          ],
        );
        continue;
      }

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

function emitAuthStep(onStep, step, meta = {}) {
  if (typeof onStep !== "function") return;
  onStep(step, meta);
}

async function authenticateUserDetailed(identifier, password, options = {}) {
  const { onStep } = options;

  await cleanupExpiredSessions();

  emitAuthStep(onStep, "Buscando usuario", { source: "j12_usuarios" });
  const j12Row = await maybeLinkJ12UserToStudent(await findJ12UserByIdentifier(identifier));
  if (j12Row) {
    emitAuthStep(onStep, "Usuario encontrado", {
      source: "j12_usuarios",
      userId: String(j12Row.id),
      status: normalizeLegacyUserStatus(j12Row.status),
    });

    if (normalizeLegacyUserStatus(j12Row.status) === "ativo") {
      const legacyHash = String(j12Row.senha_hash ?? "");
      emitAuthStep(onStep, "Comparando senha", {
        source: "j12_usuarios",
        hasHash: Boolean(legacyHash),
      });

      if (verifyBcryptPassword(password, legacyHash)) {
        const mirroredUser = await upsertLegacyMirrorUser(j12Row, password).catch(() => null);
        return {
          user: sanitizeUser({
            ...(mirroredUser || {}),
            ...j12Row,
            __source: "j12_usuarios",
          }),
          found: true,
          source: "j12_usuarios",
          reason: null,
        };
      }
    }
  }

  emitAuthStep(onStep, "Buscando usuario", { source: "users" });
  const row = await findUserByIdentifier(identifier);
  if (row) {
    emitAuthStep(onStep, "Usuario encontrado", {
      source: "users",
      userId: String(row.id),
      status: String(row.status ?? ""),
    });

    if (String(row.status).toLowerCase() === "ativo") {
      emitAuthStep(onStep, "Comparando senha", {
        source: "users",
        hasHash: Boolean(row.password_hash),
        hasSalt: Boolean(row.password_salt),
      });

      if (verifyPassword(password, row.password_salt, row.password_hash)) {
        const sanitized = sanitizeUser({ ...row, __source: "users" });
        await upsertJ12UserFromAppUser(sanitized, password).catch(() => null);
        return {
          user: sanitized,
          found: true,
          source: "users",
          reason: null,
        };
      }
    }
  }

  return {
    user: null,
    found: Boolean(j12Row || row),
    source: j12Row ? "j12_usuarios" : row ? "users" : null,
    reason: j12Row || row ? "invalid_password_or_inactive" : "not_found",
  };
}

async function authenticateUser(identifier, password) {
  const result = await authenticateUserDetailed(identifier, password);
  return result.user;
}

async function resolveUserForTokenIssue(userOrId) {
  if (userOrId && typeof userOrId === "object") {
    return userOrId;
  }

  const appUser = await findUserById(userOrId);
  if (appUser) {
    return sanitizeUser({ ...appUser, __source: "users" });
  }

  const j12User = await findJ12UserById(userOrId);
  if (j12User) {
    return sanitizeUser({ ...j12User, __source: "j12_usuarios" });
  }

  return null;
}

function isJwtToken(token) {
  return String(token || "").split(".").length === 3;
}

async function createSession(userOrId) {
  const user = await resolveUserForTokenIssue(userOrId);
  if (!user) {
    const error = new Error("Usuario nao encontrado para autenticacao.");
    error.statusCode = 404;
    throw error;
  }

  return signJwt({
    sub: user.id,
    source: user.source || "users",
    role: user.role,
    perfil: user.perfil || user.role,
    nome: user.nome,
    email: user.email,
    aluno_id: user.aluno_id ?? user.studentId ?? null,
    studentId: user.studentId ?? user.aluno_id ?? null,
    teacherId: user.teacherId ?? null,
    responsavelId: user.responsavelId ?? null,
  });
}

async function getUserBySessionToken(token) {
  if (!token) return null;

  if (isJwtToken(token)) {
    try {
      const payload = verifyJwt(token);
      if (payload?.source === "j12_usuarios") {
        const j12User = await maybeLinkJ12UserToStudent(await findJ12UserById(payload.sub));
        return j12User ? sanitizeUser({ ...j12User, __source: "j12_usuarios" }) : null;
      }

      const user = await findUserById(payload.sub);
      if (user) {
        return sanitizeUser({ ...user, __source: "users" });
      }

      const j12Fallback = await maybeLinkJ12UserToStudent(await findJ12UserById(payload.sub));
      return j12Fallback ? sanitizeUser({ ...j12Fallback, __source: "j12_usuarios" }) : null;
    } catch {
      return null;
    }
  }

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
  return sanitizeUser({ ...rows[0], __source: "users" });
}

async function deleteSession(token) {
  if (!token) return;
  if (isJwtToken(token)) return;
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
    await connection.execute("UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ?", [
      String(token),
    ]);
  });

  return sanitizeUser(tokenRow);
}

async function changePassword(userId, currentPassword, nextPassword) {
  assertStrongPassword(nextPassword);
  const j12Row = await findJ12UserById(userId);
  if (j12Row && normalizeLegacyUserStatus(j12Row.status) === "ativo") {
    const legacyHash = String(j12Row.senha_hash ?? "");
    if (!verifyBcryptPassword(currentPassword, legacyHash)) {
      const error = new Error("A senha atual esta incorreta.");
      error.statusCode = 400;
      throw error;
    }

    const nextHash = bcrypt.hashSync(String(nextPassword ?? ""), 10);
    await query(
      "UPDATE j12_usuarios SET senha_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [nextHash, Number(userId)],
    );

    return sanitizeUser({ ...j12Row, senha_hash: nextHash, __source: "j12_usuarios" });
  }

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
      FROM j12_alunos
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
    name: String(aluno.nome_completo ?? "Aluno J12"),
    email,
    login,
    hash,
    salt,
    role: "aluno",
    alunoId: String(aluno.id),
    linkedAlunoId: null,
    phoneWhatsapp: String(aluno.telefone_contato ?? ""),
  };

  const nextBcryptHash = bcrypt.hashSync(password, 10);

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
    } else {
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
    }

    await connection.execute(
      `
        INSERT INTO j12_usuarios (
          nome, email, senha_hash, perfil, aluno_id, professor_id, responsavel_id, status
        ) VALUES (?, ?, ?, 'aluno', ?, NULL, NULL, 'ativo')
        ON DUPLICATE KEY UPDATE
          nome = VALUES(nome),
          email = VALUES(email),
          senha_hash = VALUES(senha_hash),
          perfil = 'aluno',
          aluno_id = VALUES(aluno_id),
          status = 'ativo',
          updated_at = CURRENT_TIMESTAMP
      `,
      [basePayload.name, basePayload.email, nextBcryptHash, Number(basePayload.alunoId)],
    );
  });

  const created =
    (await findJ12UserByIdentifier(login)) ||
    (await maybeLinkJ12UserToStudent(await findJ12UserByIdentifier(email))) ||
    (await findUserByIdentifier(login));
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
      return res.status(401).json({ message: "Token não informado ou inválido" });
    }

    const user = await getUserBySessionToken(token);
    if (!user) {
      return res.status(401).json({ message: "Token não informado ou inválido" });
    }

    req.user = user;
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
    const role = req.user?.role || req.auth?.role;
    if (!role || !allowed.has(role)) {
      return res.status(403).json({ message: "Acesso negado para este perfil." });
    }

    next();
  };
}

function resolveScopedStudentId(user) {
  if (!user) return null;
  if (user.role === "aluno") return user.studentId ?? user.aluno_id ?? null;
  if (user.role === "responsavel") return user.studentId ?? user.aluno_id ?? null;
  return null;
}

function canManageSystem(user) {
  return user?.role === "admin" || user?.role === "coordenador" || user?.perfil === "admin";
}

module.exports = {
  PASSWORD_RULE_MESSAGE,
  sanitizeUser,
  ensureAuthSeedData,
  authenticateUser,
  authenticateUserDetailed,
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
