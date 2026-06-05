const bcrypt = require("bcryptjs");
const { query, tableExists, transaction } = require("../config/db.js");

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function normalizeEmail(value) {
  return text(value, 191).toLowerCase();
}

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function buildInitialStudentPassword(student) {
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

async function columnExists(tableName, columnName) {
  const safeColumnName = text(columnName, 64).replace(/'/g, "''");
  const rows = await query(`SHOW COLUMNS FROM \`${tableName}\` LIKE '${safeColumnName}'`);
  return Array.isArray(rows) && rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const safeIndexName = text(indexName, 64).replace(/'/g, "''");
  const rows = await query(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = '${safeIndexName}'`);
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureColumn(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) return;
  await query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function ensureIndex(tableName, indexName, ddl) {
  if (await indexExists(tableName, indexName)) return;
  await query(`ALTER TABLE \`${tableName}\` ADD ${ddl}`);
}

async function ensurePortalAlunoSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS j12_usuarios (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      perfil ENUM('admin','professor','responsavel','aluno') NOT NULL DEFAULT 'aluno',
      aluno_id INT NULL,
      professor_id INT NULL,
      responsavel_id INT NULL,
      status ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_j12_usuarios_email (email),
      KEY idx_j12_usuarios_perfil (perfil),
      KEY idx_j12_usuarios_aluno (aluno_id)
    )
  `);
  await ensureColumn(
    "j12_usuarios",
    "updated_at",
    "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );
  await ensureColumn("j12_usuarios", "professor_id", "INT NULL");
  await ensureColumn("j12_usuarios", "responsavel_id", "INT NULL");
  await ensureColumn("j12_usuarios", "status", "ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo'");
  await ensureIndex(
    "j12_usuarios",
    "idx_j12_usuarios_perfil",
    "INDEX `idx_j12_usuarios_perfil` (`perfil`)",
  );
  await ensureIndex(
    "j12_usuarios",
    "idx_j12_usuarios_aluno",
    "INDEX `idx_j12_usuarios_aluno` (`aluno_id`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_presencas (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      aluno_id VARCHAR(64) NOT NULL,
      turma_id INT NULL,
      data_aula DATE NOT NULL,
      status ENUM('presente','falta','justificada') NOT NULL DEFAULT 'presente',
      observacao TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_j12_presencas_aluno (aluno_id),
      KEY idx_j12_presencas_data (data_aula)
    )
  `);
  await ensureColumn("j12_presencas", "turma_id", "INT NULL");
  await ensureColumn("j12_presencas", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn(
    "j12_presencas",
    "updated_at",
    "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );
  await ensureColumn(
    "j12_presencas",
    "status",
    "ENUM('presente','falta','justificada') NOT NULL DEFAULT 'presente'",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_notificacoes (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      aluno_id VARCHAR(64) NOT NULL,
      titulo VARCHAR(191) NOT NULL,
      mensagem TEXT NOT NULL,
      tipo VARCHAR(50) NOT NULL DEFAULT 'info',
      lida TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_j12_notificacoes_aluno (aluno_id),
      KEY idx_j12_notificacoes_created (created_at)
    )
  `);
  await ensureColumn(
    "j12_notificacoes",
    "created_at",
    "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS j12_contratos (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      aluno_id VARCHAR(64) NOT NULL,
      titulo VARCHAR(191) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pendente',
      url_arquivo VARCHAR(500) NULL,
      aceite_em DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_j12_contratos_aluno (aluno_id),
      KEY idx_j12_contratos_status (status)
    )
  `);
  await ensureColumn(
    "j12_contratos",
    "updated_at",
    "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );
}

async function resolveUniqueStudentEmail(connection, student, existingId = null) {
  const baseEmail =
    normalizeEmail(student.email_contato) ||
    `aluno.${digitsOnly(student.numero_matricula) || digitsOnly(student.id) || student.id}@j12.local`;
  const normalizedBase = baseEmail || `aluno.${student.id}@j12.local`;
  const [baseLocalPart, baseDomain = "j12.local"] = normalizedBase.split("@");
  let candidate = normalizedBase;
  let suffix = 2;

  while (true) {
    const params = [candidate];
    let sql = "SELECT id FROM j12_usuarios WHERE LOWER(email) = LOWER(?)";

    if (existingId != null) {
      sql += " AND id <> ?";
      params.push(Number(existingId));
    }

    sql += " LIMIT 1";
    const [rows] = await connection.execute(sql, params);
    if (!Array.isArray(rows) || rows.length === 0) {
      return candidate;
    }

    candidate = `${baseLocalPart}+${suffix}@${baseDomain}`;
    suffix += 1;
  }
}

async function syncStudentPortalUsers() {
  const students = await query(`
    SELECT id, numero_matricula, nome_completo, data_nascimento, cpf, email_contato, status
    FROM j12_alunos
    WHERE LOWER(COALESCE(status, 'ativo')) = 'ativo'
    ORDER BY updated_at DESC, created_at DESC, nome_completo ASC
  `);

  if (!Array.isArray(students) || students.length === 0) {
    return { created: 0, updated: 0, total: 0 };
  }

  const summary = {
    created: 0,
    updated: 0,
    total: students.length,
  };

  await transaction(async (connection) => {
    for (const student of students) {
      const emailContato = normalizeEmail(student.email_contato);
      const lookupParams = [Number(student.id)];
      let lookupSql = `
        SELECT *
        FROM j12_usuarios
        WHERE perfil = 'aluno' AND aluno_id = ?
      `;

      if (emailContato) {
        lookupSql += " OR (perfil = 'aluno' AND LOWER(email) = LOWER(?))";
        lookupParams.push(emailContato);
      }

      lookupSql += " ORDER BY aluno_id DESC, created_at DESC LIMIT 1";
      const [rows] = await connection.execute(lookupSql, lookupParams);
      const existingUser = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      const nextEmail = await resolveUniqueStudentEmail(connection, student, existingUser?.id);
      const nextName = text(student.nome_completo, 150) || `Aluno ${student.id}`;

      if (existingUser) {
        await connection.execute(
          `
            UPDATE j12_usuarios
            SET
              nome = ?,
              email = ?,
              perfil = 'aluno',
              aluno_id = ?,
              status = 'ativo',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [nextName, nextEmail, Number(student.id), Number(existingUser.id)],
        );
        summary.updated += 1;
        continue;
      }

      const initialPassword = buildInitialStudentPassword(student);
      const senhaHash = bcrypt.hashSync(initialPassword, 10);

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
          ) VALUES (?, ?, ?, 'aluno', ?, NULL, NULL, 'ativo')
        `,
        [nextName, nextEmail, senhaHash, Number(student.id)],
      );
      summary.created += 1;
    }
  });

  return summary;
}

async function syncPortalAlunoCompatibilityData() {
  if (await tableExists("student_presencas")) {
    await query(`
      INSERT INTO j12_presencas (
        id,
        aluno_id,
        turma_id,
        data_aula,
        status,
        observacao,
        created_at,
        updated_at
      )
      SELECT
        sp.id,
        aluno_ref.id,
        turma.id,
        sp.data_aula,
        CASE
          WHEN sp.presente = 1 THEN 'presente'
          WHEN LOWER(COALESCE(sp.observacao, '')) LIKE '%justific%' THEN 'justificada'
          ELSE 'falta'
        END,
        sp.observacao,
        sp.created_at,
        sp.updated_at
      FROM student_presencas sp
      INNER JOIN j12_alunos aluno_ref ON CAST(aluno_ref.id AS CHAR) = CAST(sp.aluno_id AS CHAR)
      LEFT JOIN j12_turmas turma ON LOWER(turma.nome) = LOWER(sp.turma)
      ON DUPLICATE KEY UPDATE
        aluno_id = VALUES(aluno_id),
        turma_id = VALUES(turma_id),
        data_aula = VALUES(data_aula),
        status = VALUES(status),
        observacao = VALUES(observacao),
        updated_at = VALUES(updated_at)
    `);
  }

  if (await tableExists("student_notifications")) {
    await query(`
      INSERT INTO j12_notificacoes (
        id,
        aluno_id,
        titulo,
        mensagem,
        tipo,
        lida,
        created_at
      )
      SELECT
        sn.id,
        aluno_ref.id,
        sn.titulo,
        sn.mensagem,
        sn.tipo,
        sn.lida,
        sn.created_at
      FROM student_notifications sn
      INNER JOIN j12_alunos aluno_ref
        ON CAST(aluno_ref.id AS CHAR) = CAST(sn.aluno_id AS CHAR)
      ON DUPLICATE KEY UPDATE
        aluno_id = VALUES(aluno_id),
        titulo = VALUES(titulo),
        mensagem = VALUES(mensagem),
        tipo = VALUES(tipo),
        lida = VALUES(lida),
        created_at = VALUES(created_at)
    `);
  }

  if (await tableExists("student_contracts")) {
    await query(`
      INSERT INTO j12_contratos (
        id,
        aluno_id,
        titulo,
        status,
        url_arquivo,
        aceite_em,
        created_at,
        updated_at
      )
      SELECT
        sc.id,
        aluno_ref.id,
        sc.titulo,
        sc.status,
        sc.arquivo_pdf,
        CASE
          WHEN sc.data_assinatura IS NOT NULL THEN CONCAT(sc.data_assinatura, ' 00:00:00')
          ELSE NULL
        END,
        sc.created_at,
        sc.updated_at
      FROM student_contracts sc
      INNER JOIN j12_alunos aluno_ref
        ON CAST(aluno_ref.id AS CHAR) = CAST(sc.aluno_id AS CHAR)
      ON DUPLICATE KEY UPDATE
        aluno_id = VALUES(aluno_id),
        titulo = VALUES(titulo),
        status = VALUES(status),
        url_arquivo = VALUES(url_arquivo),
        aceite_em = VALUES(aceite_em),
        updated_at = VALUES(updated_at)
    `);
  }

  const usersSummary = await syncStudentPortalUsers();
  return usersSummary;
}

module.exports = {
  ensurePortalAlunoSchema,
  syncPortalAlunoCompatibilityData,
  syncStudentPortalUsers,
};
