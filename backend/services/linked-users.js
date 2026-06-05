const { randomBytes, randomUUID, scryptSync } = require("node:crypto");
const { query, transaction } = require("../db.js");

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeEmail(value) {
  return text(value, 191).toLowerCase();
}

function slugify(value) {
  return text(value, 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function parseArray(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => text(item, 191)).filter(Boolean)));
  }

  const normalized = String(value ?? "").trim();
  if (!normalized) return [];

  try {
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.map((item) => text(item, 191)).filter(Boolean)))
      : [];
  } catch {
    return Array.from(
      new Set(
        normalized
          .split(/[;,|]/g)
          .map((item) => text(item, 191))
          .filter(Boolean),
      ),
    );
  }
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: scryptSync(String(password ?? ""), salt, 64).toString("hex"),
  };
}

function resolveActiveStatus(value) {
  return text(value, 30).toLowerCase() === "ativo" ? "ativo" : "inativo";
}

function buildPasswordFromIdentity(...candidates) {
  for (const candidate of candidates) {
    const digits = digitsOnly(candidate);
    if (digits.length >= 6) {
      return digits;
    }
  }

  return `J12${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

async function userExistsByField(connection, field, value, excludeUserId) {
  const column = field === "email" ? "email" : "login";
  const params = [String(value).toLowerCase()];
  let sql = `SELECT id FROM users WHERE LOWER(${column}) = ?`;

  if (excludeUserId) {
    sql += " AND id <> ?";
    params.push(String(excludeUserId));
  }

  sql += " LIMIT 1";
  const [rows] = await connection.execute(sql, params);
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureUniqueLogin(connection, baseLogin, excludeUserId) {
  const fallback = text(baseLogin, 191) || `usuario.${randomUUID().slice(0, 8)}`;
  let candidate = fallback;
  let suffix = 2;

  while (await userExistsByField(connection, "login", candidate, excludeUserId)) {
    candidate = text(`${fallback}.${suffix}`, 191);
    suffix += 1;
  }

  return candidate;
}

async function ensureUniqueEmail(connection, baseEmail, excludeUserId) {
  const normalized = normalizeEmail(baseEmail) || `usuario.${randomUUID().slice(0, 8)}@j12.local`;
  const atIndex = normalized.indexOf("@");
  const localPart = atIndex >= 0 ? normalized.slice(0, atIndex) : normalized;
  const domain = atIndex >= 0 ? normalized.slice(atIndex + 1) : "j12.local";
  let candidate = normalized;
  let suffix = 2;

  while (await userExistsByField(connection, "email", candidate, excludeUserId)) {
    candidate = `${text(localPart, 150)}+${suffix}@${text(domain, 80) || "j12.local"}`;
    suffix += 1;
  }

  return candidate;
}

async function findProfessorUser(connection, professorId) {
  const [rows] = await connection.execute(
    `
      SELECT *
      FROM users
      WHERE professor_id = ?
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `,
    [String(professorId)],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function resolveProfessorClassScope(connection, professor) {
  const classScope = new Set(parseArray(professor.turmas_json));
  const [rows] = await connection.execute(
    `
      SELECT nome
      FROM j12_turmas
      WHERE professor_id = ?
      ORDER BY nome ASC
    `,
    [String(professor.id)],
  );

  for (const row of Array.isArray(rows) ? rows : []) {
    const className = text(row?.nome, 191);
    if (className) {
      classScope.add(className);
    }
  }

  return Array.from(classScope);
}

function buildProfessorLogin(professor) {
  return (
    normalizeEmail(professor.email) ||
    digitsOnly(professor.cpf) ||
    `prof.${slugify(professor.nome) || text(professor.id, 24).toLowerCase()}`
  );
}

function buildProfessorEmail(professor) {
  return (
    normalizeEmail(professor.email) ||
    `prof.${slugify(professor.nome) || text(professor.id, 24).toLowerCase()}@j12.local`
  );
}

async function upsertProfessorUser(connection, professor) {
  const existingUser = await findProfessorUser(connection, professor.id);
  const desiredName = text(professor.nome, 191) || "Professor J12";
  const desiredPhone = text(professor.telefone, 50) || null;
  const desiredStatus = resolveActiveStatus(professor.status);
  const desiredClassScope = await resolveProfessorClassScope(connection, professor);
  const desiredLogin = await ensureUniqueLogin(
    connection,
    existingUser?.login || buildProfessorLogin(professor),
    existingUser?.id,
  );
  const desiredEmail = await ensureUniqueEmail(
    connection,
    existingUser?.email || buildProfessorEmail(professor),
    existingUser?.id,
  );

  if (existingUser) {
    await connection.execute(
      `
        UPDATE users
        SET
          name = ?,
          email = ?,
          login = ?,
          role = 'professor',
          professor_id = ?,
          aluno_id = NULL,
          linked_aluno_id = NULL,
          responsavel_id = NULL,
          class_scope_json = ?,
          phone_whatsapp = ?,
          status = ?,
          updated_at = NOW()
        WHERE id = ?
      `,
      [
        desiredName,
        desiredEmail,
        desiredLogin,
        String(professor.id),
        JSON.stringify(desiredClassScope),
        desiredPhone,
        desiredStatus,
        String(existingUser.id),
      ],
    );

    return { action: "updated", userId: String(existingUser.id) };
  }

  const password = buildPasswordFromIdentity(professor.cpf, professor.telefone, professor.id);
  const { hash, salt } = hashPassword(password);
  const userId = `usr-${randomUUID().replace(/-/g, "").slice(0, 16)}`;

  await connection.execute(
    `
      INSERT INTO users (
        id, name, email, login, password_hash, password_salt, role, aluno_id,
        professor_id, responsavel_id, linked_aluno_id, class_scope_json, phone_whatsapp, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'professor', NULL, ?, NULL, NULL, ?, ?, ?)
    `,
    [
      userId,
      desiredName,
      desiredEmail,
      desiredLogin,
      hash,
      salt,
      String(professor.id),
      JSON.stringify(desiredClassScope),
      desiredPhone,
      desiredStatus,
    ],
  );

  return { action: "created", userId };
}

async function syncProfessorUsers(options = {}) {
  const onlyProfessorId = text(options.onlyProfessorId, 64) || null;
  const params = [];
  let sql = `
    SELECT id, nome, email, telefone, cpf, turmas_json, status
    FROM j12_professores
  `;

  if (onlyProfessorId) {
    sql += " WHERE id = ?";
    params.push(onlyProfessorId);
  }

  sql += " ORDER BY nome ASC";

  const professores = await query(sql, params);
  const summary = {
    total: Array.isArray(professores) ? professores.length : 0,
    created: 0,
    updated: 0,
  };

  if (!Array.isArray(professores) || professores.length === 0) {
    return summary;
  }

  await transaction(async (connection) => {
    for (const professor of professores) {
      const result = await upsertProfessorUser(connection, professor);
      if (result.action === "created") summary.created += 1;
      if (result.action === "updated") summary.updated += 1;
    }
  });

  return summary;
}

async function deactivateProfessorUsers(professorId) {
  const normalized = text(professorId, 64);
  if (!normalized) return;

  await query(
    `
      UPDATE users
      SET
        status = 'inativo',
        professor_id = NULL,
        class_scope_json = '[]',
        updated_at = NOW()
      WHERE professor_id = ?
    `,
    [normalized],
  );
}

async function deactivateOrphanProfessorUsers() {
  const result = await query(
    `
      UPDATE users
      SET
        status = 'inativo',
        professor_id = NULL,
        class_scope_json = '[]',
        updated_at = NOW()
      WHERE role = 'professor'
        AND professor_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM j12_professores professor
          WHERE professor.id = users.professor_id
        )
    `,
  );

  return Number(result?.affectedRows || 0);
}

async function findGuardianUser(connection, studentId) {
  const [rows] = await connection.execute(
    `
      SELECT *
      FROM users
      WHERE role = 'responsavel' AND linked_aluno_id = ?
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `,
    [String(studentId)],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function buildGuardianLogin(record) {
  return (
    normalizeEmail(record.email) ||
    digitsOnly(record.cpf) ||
    digitsOnly(record.whatsapp) ||
    `responsavel.${digitsOnly(record.numero_matricula) || text(record.aluno_id, 24).toLowerCase()}`
  );
}

function buildGuardianEmail(record) {
  return (
    normalizeEmail(record.email) ||
    `responsavel.${digitsOnly(record.numero_matricula) || slugify(record.nome_aluno) || text(record.aluno_id, 24).toLowerCase()}@j12.local`
  );
}

async function upsertGuardianUser(connection, record) {
  const guardianName = text(record.nome_completo, 191);
  if (!guardianName) {
    return { action: "skipped", reason: "missing-name" };
  }

  const existingUser = await findGuardianUser(connection, record.aluno_id);
  const desiredPhone = text(record.whatsapp, 50) || null;
  const desiredStatus = resolveActiveStatus(record.status);
  const initialPassword = buildPasswordFromIdentity(
    record.cpf,
    record.whatsapp,
    record.numero_matricula,
    record.aluno_id,
  );
  const desiredLogin = await ensureUniqueLogin(
    connection,
    existingUser?.login || buildGuardianLogin(record),
    existingUser?.id,
  );
  const desiredEmail = await ensureUniqueEmail(
    connection,
    existingUser?.email || buildGuardianEmail(record),
    existingUser?.id,
  );
  const responsavelId = `resp-${text(record.aluno_id, 64)}`;

  if (existingUser) {
    const shouldResetPassword =
      text(existingUser.name, 191).toLowerCase() === "responsavel" ||
      guardianName.toLowerCase() === "responsavel";
    const passwordPayload = shouldResetPassword ? hashPassword(initialPassword) : null;
    const params = [
      guardianName,
      desiredEmail,
      desiredLogin,
      responsavelId,
      String(record.aluno_id),
      desiredPhone,
      desiredStatus,
      String(existingUser.id),
    ];

    let sql = `
      UPDATE users
      SET
        name = ?,
        email = ?,
        login = ?,
        role = 'responsavel',
        aluno_id = NULL,
        professor_id = NULL,
        responsavel_id = ?,
        linked_aluno_id = ?,
        class_scope_json = '[]',
        phone_whatsapp = ?,
        status = ?,
        updated_at = NOW()
    `;

    if (passwordPayload) {
      sql += `,
        password_hash = ?,
        password_salt = ?
      `;
      params.splice(7, 0, passwordPayload.hash, passwordPayload.salt);
    }

    sql += " WHERE id = ?";
    await connection.execute(sql, params);

    return { action: "updated", userId: String(existingUser.id) };
  }

  const { hash, salt } = hashPassword(initialPassword);
  const userId = `usr-${randomUUID().replace(/-/g, "").slice(0, 16)}`;

  await connection.execute(
    `
      INSERT INTO users (
        id, name, email, login, password_hash, password_salt, role, aluno_id,
        professor_id, responsavel_id, linked_aluno_id, class_scope_json, phone_whatsapp, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'responsavel', NULL, NULL, ?, ?, '[]', ?, ?)
    `,
    [
      userId,
      guardianName,
      desiredEmail,
      desiredLogin,
      hash,
      salt,
      responsavelId,
      String(record.aluno_id),
      desiredPhone,
      desiredStatus,
    ],
  );

  return { action: "created", userId };
}

async function syncResponsavelUsers(options = {}) {
  const onlyStudentId = text(options.onlyStudentId, 64) || null;
  const params = [];
  let sql = `
    SELECT
      aluno.id AS aluno_id,
      aluno.numero_matricula,
      aluno.nome_completo AS nome_aluno,
      aluno.status,
      resp.nome_completo,
      resp.cpf,
      resp.whatsapp,
      resp.email,
      resp.parentesco
    FROM j12_alunos aluno
    INNER JOIN j12_alunos_responsaveis resp ON resp.aluno_id = aluno.id
  `;

  if (onlyStudentId) {
    sql += " WHERE aluno.id = ?";
    params.push(onlyStudentId);
  }

  sql += " ORDER BY aluno.nome_completo ASC";

  const responsaveis = await query(sql, params);
  const summary = {
    total: Array.isArray(responsaveis) ? responsaveis.length : 0,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  if (!Array.isArray(responsaveis) || responsaveis.length === 0) {
    return summary;
  }

  await transaction(async (connection) => {
    for (const responsavel of responsaveis) {
      const result = await upsertGuardianUser(connection, responsavel);
      if (result.action === "created") summary.created += 1;
      if (result.action === "updated") summary.updated += 1;
      if (result.action === "skipped") summary.skipped += 1;
    }
  });

  return summary;
}

async function deactivateResponsavelUsersByStudent(studentId) {
  const normalized = text(studentId, 64);
  if (!normalized) return;

  await query(
    `
      UPDATE users
      SET
        status = 'inativo',
        responsavel_id = NULL,
        linked_aluno_id = NULL,
        updated_at = NOW()
      WHERE role = 'responsavel' AND linked_aluno_id = ?
    `,
    [normalized],
  );
}

async function deactivateOrphanResponsavelUsers() {
  const result = await query(
    `
      UPDATE users
      SET
        status = 'inativo',
        responsavel_id = NULL,
        linked_aluno_id = NULL,
        updated_at = NOW()
      WHERE role = 'responsavel'
        AND linked_aluno_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM j12_alunos aluno
          WHERE aluno.id = users.linked_aluno_id
        )
    `,
  );

  return Number(result?.affectedRows || 0);
}

module.exports = {
  syncProfessorUsers,
  deactivateProfessorUsers,
  deactivateOrphanProfessorUsers,
  syncResponsavelUsers,
  deactivateResponsavelUsersByStudent,
  deactivateOrphanResponsavelUsers,
};
