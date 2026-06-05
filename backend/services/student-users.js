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

function buildInitialPassword(student) {
  const cpf = digitsOnly(student.cpf);
  if (cpf.length >= 6) return cpf;

  const birthDate = text(student.data_nascimento, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    const [year, month, day] = birthDate.split("-");
    return `${day}${month}${year}`;
  }

  const enrollment = digitsOnly(student.numero_matricula);
  if (enrollment) return enrollment;

  return `Aluno${digitsOnly(student.id).slice(-6) || "J12"}`;
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: scryptSync(String(password ?? ""), salt, 64).toString("hex"),
  };
}

function buildBaseLogin(student) {
  const enrollment = digitsOnly(student.numero_matricula);
  if (enrollment) return enrollment;

  const cpf = digitsOnly(student.cpf);
  if (cpf) return cpf;

  const slug = slugify(student.nome_completo);
  if (slug) return slug;

  return `aluno.${text(student.id, 24).toLowerCase()}`;
}

function buildBaseEmail(student) {
  const email = normalizeEmail(student.email_contato);
  if (email) return email;

  const enrollment = digitsOnly(student.numero_matricula);
  if (enrollment) return `aluno.${enrollment}@j12.local`;

  return `aluno.${slugify(student.nome_completo) || text(student.id, 24).toLowerCase()}@j12.local`;
}

function resolveStudentUserStatus(student) {
  return text(student.status, 30).toLowerCase() === "ativo" ? "ativo" : "inativo";
}

async function userExistsByField(connection, field, value, excludeUserId) {
  const allowedField = field === "email" ? "email" : "login";
  const params = [String(value).toLowerCase()];
  let sql = `SELECT id FROM users WHERE LOWER(${allowedField}) = ?`;

  if (excludeUserId) {
    sql += " AND id <> ?";
    params.push(String(excludeUserId));
  }

  sql += " LIMIT 1";
  const [rows] = await connection.execute(sql, params);
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureUniqueLogin(connection, baseLogin, excludeUserId) {
  const fallback = text(baseLogin, 191) || `aluno.${randomUUID().slice(0, 8)}`;
  let candidate = fallback;
  let suffix = 2;

  while (await userExistsByField(connection, "login", candidate, excludeUserId)) {
    candidate = text(`${fallback}.${suffix}`, 191);
    suffix += 1;
  }

  return candidate;
}

async function ensureUniqueEmail(connection, baseEmail, excludeUserId) {
  const normalized = normalizeEmail(baseEmail) || `aluno.${randomUUID().slice(0, 8)}@j12.local`;
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

async function findStudentUser(connection, studentId) {
  const [rows] = await connection.execute(
    `
      SELECT *
      FROM users
      WHERE aluno_id = ? OR (role = 'aluno' AND linked_aluno_id = ?)
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `,
    [String(studentId), String(studentId)],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function upsertStudentUser(connection, student) {
  const existingUser = await findStudentUser(connection, student.id);
  const desiredName = text(student.nome_completo, 191) || "Aluno J12";
  const desiredPhone = text(student.telefone_contato, 50) || null;
  const desiredStatus = resolveStudentUserStatus(student);
  const desiredLogin = await ensureUniqueLogin(
    connection,
    existingUser?.login || buildBaseLogin(student),
    existingUser?.id,
  );
  const desiredEmail = await ensureUniqueEmail(
    connection,
    existingUser?.email || buildBaseEmail(student),
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
          role = 'aluno',
          aluno_id = ?,
          linked_aluno_id = NULL,
          responsavel_id = NULL,
          phone_whatsapp = ?,
          status = ?,
          updated_at = NOW()
        WHERE id = ?
      `,
      [
        desiredName,
        desiredEmail,
        desiredLogin,
        String(student.id),
        desiredPhone,
        desiredStatus,
        String(existingUser.id),
      ],
    );

    return { action: "updated", userId: String(existingUser.id), login: desiredLogin };
  }

  const initialPassword = buildInitialPassword(student);
  const { hash, salt } = hashPassword(initialPassword);
  const userId = `usr-${randomUUID().replace(/-/g, "").slice(0, 16)}`;

  await connection.execute(
    `
      INSERT INTO users (
        id, name, email, login, password_hash, password_salt, role, aluno_id,
        professor_id, responsavel_id, linked_aluno_id, class_scope_json, phone_whatsapp, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'aluno', ?, NULL, NULL, NULL, '[]', ?, ?)
    `,
    [
      userId,
      desiredName,
      desiredEmail,
      desiredLogin,
      hash,
      salt,
      String(student.id),
      desiredPhone,
      desiredStatus,
    ],
  );

  return { action: "created", userId, login: desiredLogin };
}

async function syncStudentUsers(options = {}) {
  const onlyStudentId = text(options.onlyStudentId, 64) || null;
  const params = [];
  let sql = `
    SELECT id, numero_matricula, nome_completo, data_nascimento, cpf, email_contato, telefone_contato, status
    FROM j12_alunos
  `;

  if (onlyStudentId) {
    sql += " WHERE id = ?";
    params.push(onlyStudentId);
  }

  sql += " ORDER BY updated_at DESC, nome_completo ASC";

  const students = await query(sql, params);
  const summary = {
    total: Array.isArray(students) ? students.length : 0,
    created: 0,
    updated: 0,
  };

  if (!Array.isArray(students) || students.length === 0) {
    return summary;
  }

  await transaction(async (connection) => {
    for (const student of students) {
      const result = await upsertStudentUser(connection, student);
      if (result.action === "created") summary.created += 1;
      if (result.action === "updated") summary.updated += 1;
    }
  });

  return summary;
}

async function deactivateStudentUsers(studentId) {
  const normalized = text(studentId, 64);
  if (!normalized) return;

  await query(
    `
      UPDATE users
      SET
        status = 'inativo',
        aluno_id = NULL,
        linked_aluno_id = CASE WHEN role = 'aluno' THEN NULL ELSE linked_aluno_id END,
        updated_at = NOW()
      WHERE aluno_id = ? OR (role = 'aluno' AND linked_aluno_id = ?)
    `,
    [normalized, normalized],
  );
}

async function deactivateOrphanStudentUsers() {
  const result = await query(
    `
      UPDATE users
      SET
        status = 'inativo',
        aluno_id = NULL,
        linked_aluno_id = NULL,
        updated_at = NOW()
      WHERE role = 'aluno'
        AND aluno_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM j12_alunos aluno
          WHERE aluno.id = users.aluno_id
        )
    `,
  );

  return Number(result?.affectedRows || 0);
}

module.exports = {
  syncStudentUsers,
  deactivateStudentUsers,
  deactivateOrphanStudentUsers,
};
