#!/usr/bin/env node
const mysql = require("mysql2/promise");

const { assertSprint2311Environment } = require("./sprint-23-11-environment.cjs");

const DATA = Object.freeze({
  prefix: "[E2E-SYNTHETIC-23.11B]",
  professorId: 9231101,
  professorName: "[E2E-SYNTHETIC-23.11B] Professor Ricardo",
  responsibleId: 9231101,
  responsibleName: "[E2E-SYNTHETIC-23.11B] Responsavel Carla",
  planId: 9231101,
  portalStudentId: "e2e-portal-aluno-2311b",
  portalStudentName: "[E2E-SYNTHETIC-23.11B] Aluno Portal",
  journeyStudentName: "[E2E-SYNTHETIC-23.11B] Aluno Jornada",
  journeyResponsibleName: "[E2E-SYNTHETIC-23.11B] Responsavel Jornada",
  journeyResponsibleWhatsapp: "11923112311",
  enrollmentId: "e2e-enrollment-2311b",
  profileId: "e2e-profile-aluno-2311b",
  classLinkId: "e2e-class-link-2311b",
  obligationId: "e2e-obligation-2311b",
  turmaId: 9231101,
  turmaName: "[E2E-SYNTHETIC-23.11B] Turma Base",
});

async function connect() {
  assertSprint2311Environment(process.env);
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

async function setupFoundation() {
  const connection = await connect();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO j12_modalidades (id, nome, descricao, status)
       VALUES (9231101, "Futebol", "Catalogo sintetico local E2E", "ativo")
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), status = "ativo"`,
    );
    await connection.execute(
      `INSERT INTO j12_unidades (id, nome, endereco, cidade, estado, status)
       VALUES (9231101, "Unidade E2E", "Endereco local E2E", "Sao Paulo", "SP", "ativo")
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), status = "ativo"`,
    );
    await connection.execute(
      `INSERT INTO j12_planos
         (id, nome, valor, modalidade, unidade, dias_horarios, frequencia, status, categoria)
       VALUES (9231101, "Plano E2E", 231.10, "Futebol", "Unidade E2E",
         "Segunda e Quarta | 19:00 - 20:00", "Mensal", "ativo", "Base")
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), valor = VALUES(valor),
         modalidade = VALUES(modalidade), unidade = VALUES(unidade), status = "ativo"`,
    );
    await connection.execute(
      `INSERT INTO j12_professores
         (id, nome, email, telefone, modalidades_json, unidades_json, turmas_json, status)
       VALUES (?, ?, 'prof@j12.com', '11923110001', '["Futebol"]', '["Unidade E2E"]', ?, 'ativo')
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), email = VALUES(email),
         modalidades_json = VALUES(modalidades_json), unidades_json = VALUES(unidades_json),
         turmas_json = VALUES(turmas_json), status = 'ativo'`,
      [DATA.professorId, DATA.professorName, JSON.stringify([DATA.turmaName])],
    );
    await connection.execute(
      `INSERT INTO j12_turmas
         (id, nome, modalidade, unidade, professor_id, professor_nome, dias_semana,
          dias_semana_json, horario, horario_inicio, horario_fim, capacidade, status,
          aluno_ids_json, presencas_json)
       VALUES (?, ?, 'Futebol', 'Unidade E2E', ?, ?, 'segunda,quarta', '["segunda","quarta"]',
         '19:00 - 20:00', '19:00', '20:00', 20, 'ativa', '[]', '[]')
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), professor_id = VALUES(professor_id),
         professor_nome = VALUES(professor_nome), status = 'ativa',
         presencas_json = VALUES(presencas_json)`,
      [DATA.turmaId, DATA.turmaName, DATA.professorId, DATA.professorName],
    );
    await connection.execute(
      `INSERT INTO j12_responsaveis
         (id, nome, cpf, telefone, email, endereco, rg, parentesco)
       VALUES (?, ?, '92311000001', '11923110002', 'responsavel@j12.com',
         'Endereco local E2E', 'E2E2311', 'Responsavel legal')
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), telefone = VALUES(telefone),
         email = VALUES(email), parentesco = VALUES(parentesco)`,
      [DATA.responsibleId, DATA.responsibleName],
    );
    await connection.execute(
      `INSERT INTO j12_alunos
         (id, numero_matricula, nome_completo, data_nascimento, email_contato,
          telefone_contato, status, modalidade_principal, turma_principal,
          plano_principal, origem_cadastro, plano_id, plano_valor, turma_id, responsavel_id)
       VALUES (?, 'E2E-2311B-PORTAL', ?, '2012-03-11', 'aluno@j12.com', '11923110003',
          'ativo', 'Futebol', ?, 'Plano E2E', 'e2e-local', ?, 231.10, ?, ?)
       ON DUPLICATE KEY UPDATE nome_completo = VALUES(nome_completo),
         email_contato = VALUES(email_contato), status = 'ativo',
         turma_principal = VALUES(turma_principal), plano_principal = VALUES(plano_principal),
         plano_id = VALUES(plano_id), plano_valor = VALUES(plano_valor),
         turma_id = VALUES(turma_id), responsavel_id = VALUES(responsavel_id)`,
      [
        DATA.portalStudentId,
        DATA.portalStudentName,
        DATA.turmaName,
        String(DATA.planId),
        DATA.turmaId,
        DATA.responsibleId,
      ],
    );
    await connection.execute(
      `INSERT INTO j12_alunos_responsaveis
         (aluno_id, nome_completo, cpf, whatsapp, email, parentesco)
       VALUES (?, ?, '92311000001', '11923110002', 'responsavel@j12.com', 'Responsavel legal')
       ON DUPLICATE KEY UPDATE nome_completo = VALUES(nome_completo),
         whatsapp = VALUES(whatsapp), email = VALUES(email)`,
      [DATA.portalStudentId, DATA.responsibleName],
    );
    await connection.execute(
      `INSERT INTO j12_responsavel_alunos (responsavel_id, aluno_id)
       VALUES (?, ?) ON DUPLICATE KEY UPDATE aluno_id = VALUES(aluno_id)`,
      [String(DATA.responsibleId), DATA.portalStudentId],
    );
    await connection.execute("UPDATE j12_turmas SET aluno_ids_json = ? WHERE id = ?", [
      JSON.stringify([DATA.portalStudentId]),
      DATA.turmaId,
    ]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

async function linkSeedAccounts() {
  const connection = await connect();
  try {
    const links = [
      ["prof@j12.com", "professor_id", String(DATA.professorId)],
      ["aluno@j12.com", "aluno_id", DATA.portalStudentId],
      ["responsavel@j12.com", "responsavel_id", String(DATA.responsibleId)],
      ["responsavel@j12.com", "linked_aluno_id", DATA.portalStudentId],
    ];
    for (const [email, column, value] of links) {
      const [result] = await connection.execute(
        `UPDATE users SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?`,
        [value, email],
      );
      if (result.affectedRows !== 1) throw new Error(`Missing seeded account ${email}.`);
    }
    await connection.execute("UPDATE users SET class_scope_json = ? WHERE email = 'prof@j12.com'", [
      JSON.stringify([DATA.turmaName]),
    ]);
    await connection.execute(
      `INSERT INTO j12_responsavel_alunos (responsavel_id, aluno_id)
       VALUES (?, ?) ON DUPLICATE KEY UPDATE aluno_id = VALUES(aluno_id)`,
      [String(DATA.responsibleId), DATA.portalStudentId],
    );
  } finally {
    await connection.end();
  }
}

async function prepareJourneyEnrollment() {
  return withJourneyStudent(async (connection, student) => {
    await connection.beginTransaction();
    try {
      await connection.execute(
        `INSERT INTO people (id, nome, email, telefone, ativo)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE nome = VALUES(nome), email = VALUES(email), ativo = 1`,
        [student.id, student.nome_completo, student.email_contato, student.telefone_contato],
      );
      await connection.execute(
        `INSERT INTO person_profiles (id, person_id, profile_type, status)
         VALUES (?, ?, 'aluno', 'ativo')
         ON DUPLICATE KEY UPDATE person_id = VALUES(person_id), status = 'ativo'`,
        [DATA.profileId, student.id],
      );
      await connection.execute(
        `INSERT INTO enrollments
           (id, student_person_id, student_profile_id, status, start_date)
         VALUES (?, ?, ?, 'DRAFT', CURRENT_DATE)
         ON DUPLICATE KEY UPDATE student_person_id = VALUES(student_person_id),
           student_profile_id = VALUES(student_profile_id),
           status = IF(status = 'ACTIVE', status, 'DRAFT'), deleted_at = NULL`,
        [DATA.enrollmentId, student.id, DATA.profileId],
      );
      await connection.commit();
      return student;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

async function activateJourneyClassLink() {
  return withJourneyStudent(async (connection, student) => {
    const [enrollments] = await connection.execute(
      "SELECT status FROM enrollments WHERE id = ? LIMIT 1",
      [DATA.enrollmentId],
    );
    if (enrollments[0]?.status !== "ACTIVE") {
      throw new Error("Journey enrollment must be ACTIVE before linking a class.");
    }
    await connection.beginTransaction();
    try {
      await connection.execute(
        `UPDATE j12_alunos
         SET turma_id = ?, turma_principal = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [DATA.turmaId, DATA.turmaName, student.id],
      );
      await connection.execute(
        `INSERT INTO enrollment_class_links
           (id, enrollment_id, class_id, status, linked_at, linked_by, origin, metadata_json)
         VALUES (?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, 'e2e-local', 'E2E_FIXTURE', ?)
         ON DUPLICATE KEY UPDATE status = 'ACTIVE', unlinked_at = NULL,
           unlinked_by = NULL, metadata_json = VALUES(metadata_json)`,
        [
          DATA.classLinkId,
          DATA.enrollmentId,
          DATA.turmaId,
          JSON.stringify({ synthetic: true, sprint: "23.11B" }),
        ],
      );
      const [rows] = await connection.execute(
        "SELECT id FROM j12_alunos WHERE turma_id = ? ORDER BY id",
        [DATA.turmaId],
      );
      await connection.execute("UPDATE j12_turmas SET aluno_ids_json = ? WHERE id = ?", [
        JSON.stringify(rows.map((row) => String(row.id))),
        DATA.turmaId,
      ]);
      await connection.commit();
      return student;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

async function ensureJourneyObligation() {
  const connection = await connect();
  try {
    await connection.execute(
      `INSERT INTO enrollment_financial_obligations
         (id, enrollment_id, obligation_type, plan_id, amount, currency, due_date,
          status, source, created_by, metadata_json)
       VALUES (?, ?, 'MONTHLY_FEE', 'plano-e2e-2311b', 231.10, 'BRL',
         DATE_ADD(CURRENT_DATE, INTERVAL 10 DAY), 'PENDING', 'E2E_FIXTURE', 'e2e-local', ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount), due_date = VALUES(due_date),
         status = IF(status = 'PAID', status, 'PENDING'), metadata_json = VALUES(metadata_json)`,
      [DATA.obligationId, DATA.enrollmentId, JSON.stringify({ synthetic: true, sprint: "23.11B" })],
    );
  } finally {
    await connection.end();
  }
}

async function queryRows(sql, params = []) {
  const connection = await connect();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    await connection.end();
  }
}

async function withJourneyStudent(callback) {
  const connection = await connect();
  try {
    const [rows] = await connection.execute(
      "SELECT id, nome_completo, email_contato, telefone_contato FROM j12_alunos WHERE nome_completo = ? ORDER BY id LIMIT 1",
      [DATA.journeyStudentName],
    );
    if (!rows[0]) throw new Error(`Missing UI-created student: ${DATA.journeyStudentName}.`);
    return await callback(connection, rows[0]);
  } finally {
    await connection.end();
  }
}

async function main() {
  const command = process.argv[2];
  if (command === "setup") await setupFoundation();
  else if (command === "link-accounts") await linkSeedAccounts();
  else throw new Error("Use setup or link-accounts.");
  process.stdout.write(`FIXTURE_${command.toUpperCase().replace(/-/g, "_")}=OK\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DATA,
  activateJourneyClassLink,
  ensureJourneyObligation,
  linkSeedAccounts,
  prepareJourneyEnrollment,
  queryRows,
  setupFoundation,
};
