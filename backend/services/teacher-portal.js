const { randomUUID } = require("node:crypto");

const { query, tableExists } = require("../db.js");

const ACTIVE_CLASS_STATUSES = new Set(["", "ativa", "ativo", "active", "scheduled", "planned"]);
const ATTENDANCE_STATUSES = new Set(["presente", "falta", "atraso", "justificada"]);
const AGENDA_STATUS_VALUES = new Set([
  "ACTIVE",
  "CANCELLED",
  "COMPLETED",
  "INACTIVE",
  "PLANNED",
  "SCHEDULED",
]);

function text(value, max = 65535) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function nullableText(value, max = 65535) {
  const normalized = text(value, max);
  return normalized || null;
}

function number(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function safeJsonParse(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value ?? fallback;

  try {
    const parsed = JSON.parse(String(value));
    if (parsed == null) return fallback;
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
    if (typeof fallback === "object") return typeof parsed === "object" ? parsed : fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function uniqueValues(values) {
  return Array.from(new Set((values || []).map((value) => text(value, 191)).filter(Boolean)));
}

async function safeTableExists(tableName) {
  try {
    return Boolean(await tableExists(tableName));
  } catch {
    return false;
  }
}

async function ensureTeacherPortalSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS teacher_agenda_statuses (
      id VARCHAR(64) PRIMARY KEY,
      professor_id VARCHAR(64) NOT NULL,
      agenda_item_id VARCHAR(64) NULL,
      class_id VARCHAR(64) NULL,
      schedule_date DATE NULL,
      start_time VARCHAR(20) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
      notes TEXT NULL,
      updated_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      unique_key VARCHAR(255) NOT NULL,
      UNIQUE INDEX ux_teacher_agenda_statuses_key (unique_key),
      INDEX idx_teacher_agenda_statuses_professor (professor_id, schedule_date),
      INDEX idx_teacher_agenda_statuses_class (class_id, schedule_date)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teacher_student_evaluations (
      id VARCHAR(64) PRIMARY KEY,
      professor_id VARCHAR(64) NOT NULL,
      turma_id VARCHAR(64) NULL,
      aluno_id VARCHAR(64) NOT NULL,
      tecnica_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      fisica_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      observacoes TEXT NULL,
      created_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_teacher_evaluations_professor (professor_id, created_at),
      INDEX idx_teacher_evaluations_aluno (aluno_id, created_at),
      INDEX idx_teacher_evaluations_turma (turma_id, created_at)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teacher_occurrences (
      id VARCHAR(64) PRIMARY KEY,
      professor_id VARCHAR(64) NOT NULL,
      turma_id VARCHAR(64) NULL,
      aluno_id VARCHAR(64) NULL,
      occurrence_type VARCHAR(32) NOT NULL,
      title VARCHAR(191) NOT NULL,
      description TEXT NULL,
      severity VARCHAR(32) NOT NULL DEFAULT 'media',
      event_date DATE NOT NULL,
      created_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_teacher_occurrences_professor (professor_id, event_date),
      INDEX idx_teacher_occurrences_turma (turma_id, event_date),
      INDEX idx_teacher_occurrences_aluno (aluno_id, event_date)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teacher_lesson_plans (
      id VARCHAR(64) PRIMARY KEY,
      professor_id VARCHAR(64) NOT NULL,
      turma_id VARCHAR(64) NULL,
      agenda_item_id VARCHAR(64) NULL,
      plan_date DATE NOT NULL,
      objetivos TEXT NULL,
      exercicios_json LONGTEXT NULL,
      conteudo_aplicado TEXT NULL,
      observacoes TEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'planejado',
      created_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_teacher_lesson_plans_professor (professor_id, plan_date),
      INDEX idx_teacher_lesson_plans_turma (turma_id, plan_date),
      INDEX idx_teacher_lesson_plans_agenda (agenda_item_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teacher_messages (
      id VARCHAR(64) PRIMARY KEY,
      professor_id VARCHAR(64) NOT NULL,
      turma_id VARCHAR(64) NULL,
      title VARCHAR(191) NOT NULL,
      message TEXT NOT NULL,
      audience VARCHAR(32) NOT NULL DEFAULT 'both',
      channels_json LONGTEXT NULL,
      recipients_json LONGTEXT NULL,
      notification_event_id VARCHAR(64) NULL,
      created_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_teacher_messages_professor (professor_id, created_at),
      INDEX idx_teacher_messages_turma (turma_id, created_at)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teacher_preferences (
      professor_id VARCHAR(64) PRIMARY KEY,
      notification_preferences_json LONGTEXT NULL,
      idioma VARCHAR(16) NOT NULL DEFAULT 'pt-BR',
      tema VARCHAR(32) NOT NULL DEFAULT 'dark',
      foto_url VARCHAR(500) NULL,
      updated_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  if (await safeTableExists("student_presencas")) {
    await ensureColumnIfMissing("student_presencas", "status", "VARCHAR(30) NULL");
    await ensureColumnIfMissing("student_presencas", "justificativa", "TEXT NULL");
    await ensureColumnIfMissing("student_presencas", "turma_id", "VARCHAR(64) NULL");
    await ensureColumnIfMissing("student_presencas", "professor_id", "VARCHAR(64) NULL");
    await ensureColumnIfMissing("student_presencas", "agenda_item_id", "VARCHAR(64) NULL");
    await ensureColumnIfMissing("student_presencas", "registered_by", "VARCHAR(191) NULL");
    await ensureIndexIfMissing(
      "student_presencas",
      "idx_student_presencas_turma_data",
      "INDEX `idx_student_presencas_turma_data` (`turma_id`, `data_aula`)",
    );
    await ensureIndexIfMissing(
      "student_presencas",
      "idx_student_presencas_professor_data",
      "INDEX `idx_student_presencas_professor_data` (`professor_id`, `data_aula`)",
    );
  }
}

async function ensureColumnIfMissing(tableName, columnName, definition) {
  const rows = await query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );

  if (Array.isArray(rows) && rows.length > 0) return;
  await query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function ensureIndexIfMissing(tableName, indexName, definition) {
  const rows = await query(
    `
      SELECT INDEX_NAME
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1
    `,
    [tableName, indexName],
  );

  if (Array.isArray(rows) && rows.length > 0) return;
  await query(`ALTER TABLE \`${tableName}\` ADD ${definition}`);
}

async function resolveTeacherScope(authUser = {}, input = {}) {
  const role = text(authUser.role || authUser.perfil, 32).toLowerCase();
  const requestedTeacherId = nullableText(input.teacherId ?? input.professorId, 64);

  if (role === "professor") {
    const professorId = nullableText(
      authUser.teacherId ?? authUser.professor_id ?? authUser.professorId,
      64,
    );

    if (!professorId) {
      throw httpError("Seu usuario nao possui vinculo com um professor.", 403);
    }

    return {
      canManage: false,
      professorId,
      requestedBy: text(authUser.email || authUser.login || authUser.id, 191),
      role,
    };
  }

  if (role !== "admin" && role !== "coordenador") {
    throw httpError("Acesso permitido apenas para professor, admin ou coordenador.", 403);
  }

  const professorId =
    requestedTeacherId ||
    nullableText(authUser.teacherId ?? authUser.professor_id ?? authUser.professorId, 64) ||
    (await findFirstProfessorId());

  if (!professorId) {
    throw httpError("Nenhum professor cadastrado para abrir o aplicativo.", 404);
  }

  return {
    canManage: true,
    professorId,
    requestedBy: text(authUser.email || authUser.login || authUser.id, 191),
    role,
  };
}

async function findFirstProfessorId() {
  if (!(await safeTableExists("j12_professores"))) return null;

  const rows = await query(
    `
      SELECT id
      FROM j12_professores
      ORDER BY CASE WHEN LOWER(COALESCE(status, 'ativo')) = 'ativo' THEN 0 ELSE 1 END, nome ASC
      LIMIT 1
    `,
  );

  return Array.isArray(rows) && rows.length > 0 ? String(rows[0].id) : null;
}

async function loadTeacherProfile(professorId) {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);

  if (!(await safeTableExists("j12_professores"))) {
    throw httpError("Cadastro de professores nao encontrado.", 404);
  }

  const rows = await query(
    `
      SELECT professor.*, preferencias.foto_url, preferencias.idioma, preferencias.tema
      FROM j12_professores professor
      LEFT JOIN teacher_preferences preferencias
        ON preferencias.professor_id = CAST(professor.id AS CHAR)
      WHERE CAST(professor.id AS CHAR) = ?
      LIMIT 1
    `,
    [normalizedProfessorId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    throw httpError("Professor nao encontrado.", 404);
  }

  return mapProfessorRow(rows[0]);
}

async function updateTeacherProfile(professorId, payload = {}, actor = "") {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const current = await loadTeacherProfile(normalizedProfessorId);
  const email = nullableText(payload.email ?? payload.email_contato ?? current.email, 191);
  const telefone = nullableText(
    payload.telefone ?? payload.telefone_contato ?? current.telefone,
    50,
  );
  const fotoUrl = nullableText(payload.fotoUrl ?? payload.foto_url ?? current.fotoUrl, 500);

  await query(
    `
      UPDATE j12_professores
      SET email = ?, telefone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE CAST(id AS CHAR) = ?
    `,
    [email, telefone, normalizedProfessorId],
  );

  await query(
    `
      INSERT INTO teacher_preferences (professor_id, foto_url, updated_by)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        foto_url = VALUES(foto_url),
        updated_by = VALUES(updated_by),
        updated_at = CURRENT_TIMESTAMP
    `,
    [normalizedProfessorId, fotoUrl, nullableText(actor, 191)],
  );

  return loadTeacherProfile(normalizedProfessorId);
}

async function loadTeacherClasses(professorId) {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);

  if (!(await safeTableExists("j12_turmas"))) return [];

  const professor = await loadTeacherProfile(normalizedProfessorId).catch(() => null);
  const conditions = ["CAST(turma.professor_id AS CHAR) = ?"];
  const params = [normalizedProfessorId];

  if (professor?.nome) {
    conditions.push("LOWER(COALESCE(turma.professor_nome, professor.nome, '')) = LOWER(?)");
    params.push(professor.nome);
  }

  const rows = await query(
    `
      SELECT
        turma.*,
        COALESCE(professor.nome, turma.professor_nome) AS professor_nome_rel,
        (
          SELECT JSON_ARRAYAGG(CAST(aluno.id AS CHAR))
          FROM j12_alunos aluno
          WHERE CAST(aluno.turma_id AS CHAR) = CAST(turma.id AS CHAR)
             OR LOWER(COALESCE(aluno.turma_principal, '')) = LOWER(COALESCE(turma.nome, ''))
        ) AS aluno_ids_json_resolved,
        (
          SELECT COUNT(*)
          FROM j12_alunos aluno
          WHERE CAST(aluno.turma_id AS CHAR) = CAST(turma.id AS CHAR)
             OR LOWER(COALESCE(aluno.turma_principal, '')) = LOWER(COALESCE(turma.nome, ''))
        ) AS aluno_count
      FROM j12_turmas turma
      LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
      WHERE ${conditions.join(" OR ")}
      ORDER BY turma.nome ASC
    `,
    params,
  );

  return (Array.isArray(rows) ? rows : []).map(mapClassRow);
}

async function loadTeacherClassDetail(professorId, turmaId, options = {}) {
  const normalizedClassId = nullableText(turmaId, 64);
  if (!normalizedClassId) throw httpError("Turma invalida.", 400);

  const classes = await loadTeacherClasses(professorId);
  const turma = classes.find((item) => String(item.id) === normalizedClassId);

  if (!turma) {
    throw httpError("Turma nao encontrada para este professor.", 404);
  }

  if (options.includeStudents === false) {
    return turma;
  }

  const alunos = await loadTeacherClassStudents(professorId, normalizedClassId);

  return {
    ...turma,
    alunos,
  };
}

async function loadTeacherClassStudents(professorId, turmaId) {
  const turma = await loadTeacherClassDetail(professorId, turmaId, { includeStudents: false });
  const studentIds = uniqueValues(turma.alunoIds);

  if (await safeTableExists("j12_alunos")) {
    const params = [String(turma.id), turma.nome];
    const extraConditions = [];

    if (studentIds.length > 0) {
      const clause = inClause(studentIds);
      extraConditions.push(`CAST(aluno.id AS CHAR) IN (${clause.placeholders})`);
      params.push(...clause.params);
    }

    const rows = await query(
      `
        SELECT
          aluno.id,
          aluno.nome_completo,
          aluno.email_contato,
          aluno.telefone_contato,
          aluno.status,
          aluno.modalidade_principal,
          aluno.turma_principal,
          aluno.plano_principal,
          responsavel.nome_completo AS responsavel_nome,
          responsavel.whatsapp AS responsavel_whatsapp,
          responsavel.email AS responsavel_email
        FROM j12_alunos aluno
        LEFT JOIN j12_alunos_responsaveis responsavel
          ON CAST(responsavel.aluno_id AS CHAR) = CAST(aluno.id AS CHAR)
        WHERE (
          CAST(aluno.turma_id AS CHAR) = ?
          OR LOWER(COALESCE(aluno.turma_principal, '')) = LOWER(?)
          ${extraConditions.length ? `OR ${extraConditions.join(" OR ")}` : ""}
        )
        ORDER BY aluno.nome_completo ASC
      `,
      params,
    );

    return (Array.isArray(rows) ? rows : []).map(mapStudentRow);
  }

  if (await safeTableExists("alunos")) {
    const rows = await query(
      `
        SELECT id, nome, email, telefone, status, modalidade, turma, plano,
          responsavel AS responsavel_nome,
          responsavel_whatsapp,
          responsavel_email
        FROM alunos
        WHERE LOWER(COALESCE(turma, '')) = LOWER(?)
        ORDER BY nome ASC
      `,
      [turma.nome],
    );

    return (Array.isArray(rows) ? rows : []).map(mapLegacyStudentRow);
  }

  return [];
}

async function assertTeacherStudentInClass(professorId, turmaId, alunoId) {
  const normalizedStudentId = nullableText(alunoId, 64);
  if (!normalizedStudentId) throw httpError("Aluno invalido.", 400);

  const students = await loadTeacherClassStudents(professorId, turmaId);
  if (!students.some((student) => String(student.id) === normalizedStudentId)) {
    throw httpError("Aluno nao pertence a uma turma autorizada para este professor.", 403);
  }

  return normalizedStudentId;
}

async function loadTeacherAgenda(professorId, options = {}) {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const view = normalizeAgendaView(options.view);
  const period = buildAgendaPeriod(view, options.date);
  const classes = await loadTeacherClasses(normalizedProfessorId);
  const classIds = classes.map((item) => String(item.id));
  const [persisted, recurrences, statusRows] = await Promise.all([
    loadPersistedAgendaOccurrences(normalizedProfessorId, classes, period),
    loadTeacherRecurrenceOccurrences(normalizedProfessorId, classIds, period),
    loadTeacherAgendaStatuses(normalizedProfessorId, period),
  ]);
  const classOccurrences = buildClassScheduleOccurrences(classes, period);
  const overlays = new Map(statusRows.map((item) => [buildAgendaStatusLookupKey(item), item]));
  const schedules = dedupeSchedules([...persisted, ...recurrences, ...classOccurrences])
    .map((item) => applyAgendaStatusOverlay(item, overlays))
    .sort(compareSchedules);
  const recurrencesSummary = recurrences
    .filter((item) => item.recurrenceSeriesId)
    .map((item) => ({
      classId: item.classId,
      className: item.className,
      endDate: item.recurrenceEndDate,
      frequency: item.recurrenceFrequency,
      id: item.recurrenceSeriesId,
      startDate: item.recurrenceStartDate,
      startTime: item.startTime,
      status: item.status,
    }));

  return {
    agendaSource: persisted.length > 0 ? "enrollment_agenda_items" : "j12_turmas",
    period: {
      endDate: period.endDate,
      label: period.label,
      startDate: period.startDate,
      view,
    },
    readOnly: false,
    recurrences: dedupeById(recurrencesSummary),
    schedules,
    summary: summarizeAgenda(schedules),
    view,
  };
}

async function updateTeacherAgendaStatus(professorId, agendaItemId, payload = {}, actor = "") {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const normalizedAgendaItemId = nullableText(agendaItemId ?? payload.agendaItemId, 64);
  const classId = nullableText(payload.classId ?? payload.turmaId, 64);
  const scheduleDate = nullableText(payload.scheduleDate ?? payload.date, 10);
  const startTime = nullableText(payload.startTime, 20);
  const status = normalizeAgendaStatus(payload.status);
  const notes = nullableText(payload.notes ?? payload.observacoes, 65535);

  if (!normalizedAgendaItemId && (!classId || !scheduleDate || !startTime)) {
    throw httpError("Informe agendaItemId ou turma/data/horario para alterar o status.", 400);
  }

  let authorizedClassId = classId;
  if (normalizedAgendaItemId && !authorizedClassId) {
    if (!(await safeTableExists("enrollment_agenda_items"))) {
      throw httpError("Item de agenda nao encontrado.", 404);
    }

    const agendaRows = await query(
      "SELECT class_id FROM enrollment_agenda_items WHERE id = ? LIMIT 1",
      [normalizedAgendaItemId],
    );
    authorizedClassId = nullableText(agendaRows?.[0]?.class_id, 64);
    if (!authorizedClassId) throw httpError("Item de agenda nao encontrado.", 404);
  }

  if (authorizedClassId) {
    await loadTeacherClassDetail(normalizedProfessorId, authorizedClassId, {
      includeStudents: false,
    });
  }

  const id = createId("tas");
  const uniqueKey = buildAgendaStatusUniqueKey({
    agendaItemId: normalizedAgendaItemId,
    classId: authorizedClassId,
    professorId: normalizedProfessorId,
    scheduleDate,
    startTime,
  });

  await query(
    `
      INSERT INTO teacher_agenda_statuses (
        id,
        professor_id,
        agenda_item_id,
        class_id,
        schedule_date,
        start_time,
        status,
        notes,
        updated_by,
        unique_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        notes = VALUES(notes),
        updated_by = VALUES(updated_by),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      id,
      normalizedProfessorId,
      normalizedAgendaItemId,
      authorizedClassId,
      scheduleDate,
      startTime,
      status,
      notes,
      nullableText(actor, 191),
      uniqueKey,
    ],
  );

  if (
    normalizedAgendaItemId &&
    !normalizedAgendaItemId.startsWith("class-") &&
    (await safeTableExists("enrollment_agenda_items"))
  ) {
    await query(
      `
        UPDATE enrollment_agenda_items
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND CAST(class_id AS CHAR) = ?
      `,
      [status, normalizedAgendaItemId, authorizedClassId],
    );
  }

  return {
    agendaItemId: normalizedAgendaItemId,
    classId: authorizedClassId,
    noAttendanceCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    scheduleDate,
    startTime,
    status,
  };
}

async function loadTeacherPresence(professorId, options = {}) {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const date = normalizeDate(options.date) || todayISO();
  const classes = await loadTeacherClasses(normalizedProfessorId);
  const selectedClassId = nullableText(options.turmaId ?? options.classId, 64) || classes[0]?.id;

  if (!selectedClassId) {
    return {
      date,
      registros: [],
      summary: summarizeAttendanceRecords([]),
      turma: null,
      turmas: classes,
    };
  }

  const turma = await loadTeacherClassDetail(normalizedProfessorId, selectedClassId, {
    includeStudents: false,
  });
  const alunos = await loadTeacherClassStudents(normalizedProfessorId, selectedClassId);
  const rows = await query(
    `
      SELECT *
      FROM student_presencas
      WHERE aluno_id IS NOT NULL
        AND data_aula = ?
        AND (
          turma_id = ?
          OR turma = ?
        )
      ORDER BY updated_at DESC, created_at DESC
    `,
    [date, String(turma.id), turma.nome],
  );
  const presenceByStudent = new Map(
    (Array.isArray(rows) ? rows : []).map((row) => [String(row.aluno_id), mapPresenceRow(row)]),
  );
  const registros = alunos.map((aluno) => ({
    aluno,
    justificativa: presenceByStudent.get(aluno.id)?.justificativa || "",
    observacao: presenceByStudent.get(aluno.id)?.observacao || "",
    registroId: presenceByStudent.get(aluno.id)?.id || null,
    status: presenceByStudent.get(aluno.id)?.status || "presente",
  }));

  return {
    date,
    registros,
    summary: summarizeAttendanceRecords(registros),
    turma,
    turmas: classes,
  };
}

async function saveTeacherAttendance(professorId, payload = {}, actor = "") {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const turmaId = nullableText(payload.turmaId ?? payload.turma_id ?? payload.classId, 64);
  const date = normalizeDate(payload.date ?? payload.data_aula) || todayISO();
  const records = Array.isArray(payload.records ?? payload.registros)
    ? (payload.records ?? payload.registros)
    : [];

  if (!turmaId) {
    throw httpError("Selecione uma turma para salvar a chamada.", 400);
  }

  if (records.length === 0) {
    throw httpError("Informe ao menos um registro de presenca.", 400);
  }

  const turma = await loadTeacherClassDetail(normalizedProfessorId, turmaId, {
    includeStudents: false,
  });
  const authorizedStudents = new Set(
    (await loadTeacherClassStudents(normalizedProfessorId, turmaId)).map((student) =>
      String(student.id),
    ),
  );
  const saved = [];

  for (const record of records) {
    const alunoId = nullableText(record.alunoId ?? record.aluno_id ?? record.studentId, 64);
    const status = normalizeAttendanceStatus(record.status);
    const observacao = nullableText(record.observacao ?? record.observations, 65535);
    const justificativa = nullableText(record.justificativa ?? record.justification, 65535);

    if (!alunoId) continue;
    if (!authorizedStudents.has(alunoId)) {
      throw httpError("Aluno nao pertence a uma turma autorizada para este professor.", 403);
    }

    const existingRows = await query(
      `
        SELECT id
        FROM student_presencas
        WHERE aluno_id = ?
          AND data_aula = ?
          AND (
            turma_id = ?
            OR turma = ?
          )
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
      [alunoId, date, String(turma.id), turma.nome],
    );
    const existingId =
      Array.isArray(existingRows) && existingRows.length > 0 ? String(existingRows[0].id) : null;
    const presente = status === "presente" || status === "atraso" ? 1 : 0;

    if (existingId) {
      await query(
        `
          UPDATE student_presencas
          SET
            turma = ?,
            modalidade = ?,
            presente = ?,
            observacao = ?,
            status = ?,
            justificativa = ?,
            turma_id = ?,
            professor_id = ?,
            agenda_item_id = ?,
            registered_by = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          turma.nome,
          turma.modalidade || null,
          presente,
          observacao,
          status,
          justificativa,
          String(turma.id),
          normalizedProfessorId,
          nullableText(payload.agendaItemId, 64),
          nullableText(actor, 191),
          existingId,
        ],
      );
      saved.push({ alunoId, id: existingId, status });
      continue;
    }

    const id = createId("pres");
    await query(
      `
        INSERT INTO student_presencas (
          id,
          aluno_id,
          turma,
          modalidade,
          data_aula,
          presente,
          observacao,
          status,
          justificativa,
          turma_id,
          professor_id,
          agenda_item_id,
          registered_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        alunoId,
        turma.nome,
        turma.modalidade || null,
        date,
        presente,
        observacao,
        status,
        justificativa,
        String(turma.id),
        normalizedProfessorId,
        nullableText(payload.agendaItemId, 64),
        nullableText(actor, 191),
      ],
    );
    saved.push({ alunoId, id, status });
  }

  if (global.io && typeof global.io.emit === "function") {
    global.io.emit("presenca_atualizada", {
      date,
      professorId: normalizedProfessorId,
      turmaId: String(turma.id),
    });
  }

  return {
    date,
    registros: saved,
    summary: summarizeAttendanceRecords(saved),
    turma,
  };
}

async function loadTeacherDashboard(professorId, scope = {}) {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const [profile, classes, agenda, notifications] = await Promise.all([
    loadTeacherProfile(normalizedProfessorId),
    loadTeacherClasses(normalizedProfessorId),
    loadTeacherAgenda(normalizedProfessorId, { date: todayISO(), view: "day" }).catch(() => ({
      schedules: [],
      summary: {},
    })),
    loadTeacherNotifications(normalizedProfessorId).catch(() => []),
  ]);
  const today = todayISO();
  const todayAttendance = await loadPresenceRowsForTeacher(normalizedProfessorId, today);
  const summary = summarizeAttendanceRows(todayAttendance);
  const completedClasses = agenda.schedules.filter(
    (item) => normalizeAgendaStatus(item.status) === "COMPLETED",
  ).length;

  return {
    avisos: notifications.slice(0, 5),
    financeiro: {
      allowed: Boolean(scope.canManage),
      consulta: scope.canManage ? "consulta_disponivel" : "restrito_por_perfil",
    },
    indicadores: {
      aulasConcluidas: completedClasses,
      faltas: summary.faltas,
      presentes: summary.presentes,
      atrasos: summary.atrasos,
      turmasAtivas: classes.filter((item) => item.ativa).length,
    },
    professor: profile,
    proximasAulas: await loadTeacherAgenda(normalizedProfessorId, {
      date: today,
      view: "week",
    })
      .then((data) => data.schedules.filter((item) => item.scheduleDate >= today).slice(0, 8))
      .catch(() => []),
    turmasHoje: agenda.schedules,
    resumo: {
      aulasHoje: agenda.schedules.length,
      notificacoesNaoLidas: notifications.filter((item) => !item.lida).length,
      totalTurmas: classes.length,
    },
  };
}

async function loadTeacherEvaluations(professorId, options = {}) {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const params = [normalizedProfessorId];
  const filters = ["avaliacao.professor_id = ?"];

  if (options.alunoId) {
    filters.push("avaliacao.aluno_id = ?");
    params.push(String(options.alunoId));
  }

  if (options.turmaId) {
    filters.push("avaliacao.turma_id = ?");
    params.push(String(options.turmaId));
  }

  const rows = await query(
    `
      SELECT
        avaliacao.*,
        aluno.nome_completo AS aluno_nome,
        turma.nome AS turma_nome
      FROM teacher_student_evaluations avaliacao
      LEFT JOIN j12_alunos aluno ON CAST(aluno.id AS CHAR) = avaliacao.aluno_id
      LEFT JOIN j12_turmas turma ON CAST(turma.id AS CHAR) = avaliacao.turma_id
      WHERE ${filters.join(" AND ")}
      ORDER BY avaliacao.created_at DESC
      LIMIT ?
    `,
    [...params, normalizeLimit(options.limit, 80)],
  );

  return (Array.isArray(rows) ? rows : []).map(mapEvaluationRow);
}

async function createTeacherEvaluation(professorId, payload = {}, actor = "") {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const turmaId = nullableText(payload.turmaId ?? payload.turma_id, 64);
  const alunoId = nullableText(payload.alunoId ?? payload.aluno_id, 64);

  if (!turmaId || !alunoId) {
    throw httpError("Informe turma e aluno para registrar a avaliacao.", 400);
  }

  await loadTeacherClassDetail(normalizedProfessorId, turmaId, { includeStudents: false });
  await assertTeacherStudentInClass(normalizedProfessorId, turmaId, alunoId);

  const id = createId("eval");
  await query(
    `
      INSERT INTO teacher_student_evaluations (
        id,
        professor_id,
        turma_id,
        aluno_id,
        tecnica_score,
        fisica_score,
        observacoes,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      normalizedProfessorId,
      turmaId,
      alunoId,
      clampScore(payload.tecnicaScore ?? payload.tecnica_score),
      clampScore(payload.fisicaScore ?? payload.fisica_score),
      nullableText(payload.observacoes, 65535),
      nullableText(actor, 191),
    ],
  );

  return (await loadTeacherEvaluations(normalizedProfessorId, { limit: 1 }))[0];
}

async function loadTeacherOccurrences(professorId, options = {}) {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const rows = await query(
    `
      SELECT
        ocorrencia.*,
        aluno.nome_completo AS aluno_nome,
        turma.nome AS turma_nome
      FROM teacher_occurrences ocorrencia
      LEFT JOIN j12_alunos aluno ON CAST(aluno.id AS CHAR) = ocorrencia.aluno_id
      LEFT JOIN j12_turmas turma ON CAST(turma.id AS CHAR) = ocorrencia.turma_id
      WHERE ocorrencia.professor_id = ?
      ORDER BY ocorrencia.event_date DESC, ocorrencia.created_at DESC
      LIMIT ?
    `,
    [normalizedProfessorId, normalizeLimit(options.limit, 80)],
  );

  return (Array.isArray(rows) ? rows : []).map(mapOccurrenceRow);
}

async function createTeacherOccurrence(professorId, payload = {}, actor = "") {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const turmaId = nullableText(payload.turmaId ?? payload.turma_id, 64);
  const title = nullableText(payload.title ?? payload.titulo, 191);

  if (!turmaId || !title) {
    throw httpError("Informe turma e titulo para registrar a ocorrencia.", 400);
  }

  await loadTeacherClassDetail(normalizedProfessorId, turmaId, { includeStudents: false });
  const alunoId = nullableText(payload.alunoId ?? payload.aluno_id, 64);
  if (alunoId) {
    await assertTeacherStudentInClass(normalizedProfessorId, turmaId, alunoId);
  }

  const id = createId("occ");
  await query(
    `
      INSERT INTO teacher_occurrences (
        id,
        professor_id,
        turma_id,
        aluno_id,
        occurrence_type,
        title,
        description,
        severity,
        event_date,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      normalizedProfessorId,
      turmaId,
      alunoId,
      normalizeOccurrenceType(payload.type ?? payload.tipo),
      title,
      nullableText(payload.description ?? payload.descricao, 65535),
      normalizeSeverity(payload.severity ?? payload.gravidade),
      normalizeDate(payload.eventDate ?? payload.data) || todayISO(),
      nullableText(actor, 191),
    ],
  );

  return (await loadTeacherOccurrences(normalizedProfessorId, { limit: 1 }))[0];
}

async function loadTeacherLessonPlans(professorId, options = {}) {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const rows = await query(
    `
      SELECT plano.*, turma.nome AS turma_nome
      FROM teacher_lesson_plans plano
      LEFT JOIN j12_turmas turma ON CAST(turma.id AS CHAR) = plano.turma_id
      WHERE plano.professor_id = ?
      ORDER BY plano.plan_date DESC, plano.updated_at DESC
      LIMIT ?
    `,
    [normalizedProfessorId, normalizeLimit(options.limit, 80)],
  );

  return (Array.isArray(rows) ? rows : []).map(mapLessonPlanRow);
}

async function upsertTeacherLessonPlan(professorId, payload = {}, actor = "") {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const turmaId = nullableText(payload.turmaId ?? payload.turma_id, 64);
  const planDate = normalizeDate(payload.planDate ?? payload.data) || todayISO();

  if (!turmaId) {
    throw httpError("Informe a turma do planejamento.", 400);
  }

  await loadTeacherClassDetail(normalizedProfessorId, turmaId, { includeStudents: false });

  const requestedId = nullableText(payload.id, 64);
  if (requestedId) {
    const existingRows = await query(
      "SELECT professor_id FROM teacher_lesson_plans WHERE id = ? LIMIT 1",
      [requestedId],
    );
    const ownerId = nullableText(existingRows?.[0]?.professor_id, 64);
    if (ownerId && ownerId !== normalizedProfessorId) {
      throw httpError("Planejamento nao pertence a este professor.", 403);
    }
  }

  const id = requestedId || createId("plan");
  const exercises = Array.isArray(payload.exercicios)
    ? payload.exercicios.map((item) => text(item, 500)).filter(Boolean)
    : text(payload.exercicios, 2000)
        .split(/\n|;/g)
        .map((item) => item.trim())
        .filter(Boolean);

  await query(
    `
      INSERT INTO teacher_lesson_plans (
        id,
        professor_id,
        turma_id,
        agenda_item_id,
        plan_date,
        objetivos,
        exercicios_json,
        conteudo_aplicado,
        observacoes,
        status,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        agenda_item_id = VALUES(agenda_item_id),
        plan_date = VALUES(plan_date),
        objetivos = VALUES(objetivos),
        exercicios_json = VALUES(exercicios_json),
        conteudo_aplicado = VALUES(conteudo_aplicado),
        observacoes = VALUES(observacoes),
        status = VALUES(status),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      id,
      normalizedProfessorId,
      turmaId,
      nullableText(payload.agendaItemId, 64),
      planDate,
      nullableText(payload.objetivos, 65535),
      JSON.stringify(exercises),
      nullableText(payload.conteudoAplicado ?? payload.conteudo_aplicado, 65535),
      nullableText(payload.observacoes, 65535),
      normalizeLessonPlanStatus(payload.status),
      nullableText(actor, 191),
    ],
  );

  const rows = await query(
    `
      SELECT plano.*, turma.nome AS turma_nome
      FROM teacher_lesson_plans plano
      LEFT JOIN j12_turmas turma ON CAST(turma.id AS CHAR) = plano.turma_id
      WHERE plano.id = ? AND plano.professor_id = ?
      LIMIT 1
    `,
    [id, normalizedProfessorId],
  );

  return Array.isArray(rows) && rows.length > 0 ? mapLessonPlanRow(rows[0]) : null;
}

async function loadTeacherMessages(professorId, options = {}) {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const rows = await query(
    `
      SELECT mensagem.*, turma.nome AS turma_nome
      FROM teacher_messages mensagem
      LEFT JOIN j12_turmas turma ON CAST(turma.id AS CHAR) = mensagem.turma_id
      WHERE mensagem.professor_id = ?
      ORDER BY mensagem.created_at DESC
      LIMIT ?
    `,
    [normalizedProfessorId, normalizeLimit(options.limit, 80)],
  );

  return (Array.isArray(rows) ? rows : []).map(mapMessageRow);
}

async function sendTeacherMessage(professorId, payload = {}, actor = "") {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const turmaId = nullableText(payload.turmaId ?? payload.turma_id, 64);
  const title = nullableText(payload.title ?? payload.titulo, 191);
  const message = nullableText(payload.message ?? payload.mensagem, 2000);
  const audience = normalizeAudience(payload.audience ?? payload.publico);
  const channels = normalizeChannels(payload.channels ?? payload.canais);

  if (!turmaId || !title || !message) {
    throw httpError("Informe turma, titulo e mensagem para enviar o aviso.", 400);
  }

  const turma = await loadTeacherClassDetail(normalizedProfessorId, turmaId, {
    includeStudents: false,
  });
  const alunos = await loadTeacherClassStudents(normalizedProfessorId, turmaId);
  const recipients = await persistTeacherMessageNotifications({
    actor,
    alunos,
    audience,
    channels,
    message,
    professorId: normalizedProfessorId,
    title,
    turma,
  });
  const id = createId("msg");

  await query(
    `
      INSERT INTO teacher_messages (
        id,
        professor_id,
        turma_id,
        title,
        message,
        audience,
        channels_json,
        recipients_json,
        notification_event_id,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      normalizedProfessorId,
      String(turma.id),
      title,
      message,
      audience,
      JSON.stringify(channels),
      JSON.stringify(recipients.recipients),
      recipients.eventId,
      nullableText(actor, 191),
    ],
  );

  if (global.io && typeof global.io.emit === "function") {
    global.io.emit("nova_notificacao", {
      message,
      professorId: normalizedProfessorId,
      title,
      turmaId: String(turma.id),
    });
  }

  return (await loadTeacherMessages(normalizedProfessorId, { limit: 1 }))[0];
}

async function loadTeacherPreferences(professorId) {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const rows = await query(
    `
      SELECT *
      FROM teacher_preferences
      WHERE professor_id = ?
      LIMIT 1
    `,
    [normalizedProfessorId],
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

  return {
    fotoUrl: row?.foto_url ?? null,
    idioma: row?.idioma || "pt-BR",
    notificacoes: safeJsonParse(row?.notification_preferences_json, {
      email: false,
      inApp: true,
      push: false,
      whatsapp: false,
    }),
    tema: row?.tema || "dark",
  };
}

async function updateTeacherPreferences(professorId, payload = {}, actor = "") {
  await ensureTeacherPortalSchema();
  const normalizedProfessorId = requiredProfessorId(professorId);
  const current = await loadTeacherPreferences(normalizedProfessorId);
  const next = {
    fotoUrl: nullableText(payload.fotoUrl ?? payload.foto_url ?? current.fotoUrl, 500),
    idioma: normalizeLanguage(payload.idioma ?? current.idioma),
    notificacoes:
      payload.notificacoes && typeof payload.notificacoes === "object"
        ? {
            ...current.notificacoes,
            ...payload.notificacoes,
          }
        : current.notificacoes,
    tema: normalizeTheme(payload.tema ?? current.tema),
  };

  await query(
    `
      INSERT INTO teacher_preferences (
        professor_id,
        notification_preferences_json,
        idioma,
        tema,
        foto_url,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        notification_preferences_json = VALUES(notification_preferences_json),
        idioma = VALUES(idioma),
        tema = VALUES(tema),
        foto_url = VALUES(foto_url),
        updated_by = VALUES(updated_by),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      normalizedProfessorId,
      JSON.stringify(next.notificacoes),
      next.idioma,
      next.tema,
      next.fotoUrl,
      nullableText(actor, 191),
    ],
  );

  return loadTeacherPreferences(normalizedProfessorId);
}

async function loadTeacherNotifications(professorId) {
  if (!(await safeTableExists("agenda_notifications"))) return [];

  const rows = await query(
    `
      SELECT id, title, message, notification_type, status, read_at, created_at, updated_at
      FROM agenda_notifications
      WHERE recipient_type = 'PROFESSOR'
        AND recipient_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 30
    `,
    [String(professorId)],
  );

  return (Array.isArray(rows) ? rows : []).map((row) => ({
    createdAt: row.created_at,
    id: String(row.id),
    lida: Boolean(row.read_at || row.status === "READ"),
    mensagem: row.message,
    notificationType: row.notification_type,
    status: row.status,
    titulo: row.title,
    updatedAt: row.updated_at,
  }));
}

async function loadPersistedAgendaOccurrences(professorId, classes, period) {
  if (!(await safeTableExists("enrollment_agenda_items"))) return [];

  const classIds = classes.map((item) => String(item.id));
  if (classIds.length === 0) return [];

  const clause = inClause(classIds);
  const rows = await query(
    `
      SELECT
        item.*,
        turma.nome AS class_name,
        turma.modalidade,
        turma.unidade,
        turma.professor_nome,
        turma.status AS class_status
      FROM enrollment_agenda_items item
      LEFT JOIN j12_turmas turma ON CAST(turma.id AS CHAR) = CAST(item.class_id AS CHAR)
      WHERE (
        CAST(item.class_id AS CHAR) IN (${clause.placeholders})
        OR CAST(item.created_by AS CHAR) = ?
      )
        AND UPPER(COALESCE(item.status, 'ACTIVE')) NOT IN ('CANCELLED', 'INACTIVE')
      ORDER BY item.updated_at DESC, item.created_at DESC
      LIMIT 500
    `,
    [...clause.params, String(professorId)],
  );

  return (Array.isArray(rows) ? rows : []).flatMap((row) =>
    buildOccurrencesForDayPattern(
      {
        agendaItemId: String(row.id),
        agendaSource: "enrollment_agenda_items",
        classId: row.class_id == null ? null : String(row.class_id),
        className: row.class_name || "Aula J12",
        classStatus: row.class_status || null,
        dayOfWeek: row.day_of_week,
        endTime: row.end_time,
        modality: row.modalidade,
        professorId,
        professorName: row.professor_nome,
        recurrenceFrequency: row.recurrence_type,
        recurrenceStartDate: null,
        recurrenceType: row.recurrence_type,
        startTime: row.start_time,
        status: row.status || "ACTIVE",
        turmaName: row.class_name || "Aula J12",
        unitName: row.unidade,
      },
      period,
    ),
  );
}

async function loadTeacherRecurrenceOccurrences(professorId, classIds, period) {
  if (!(await safeTableExists("agenda_recurrence_series"))) return [];

  const params = [String(professorId)];
  const filters = ["CAST(professor_id AS CHAR) = ?"];

  if (classIds.length > 0) {
    const clause = inClause(classIds);
    filters.push(`CAST(class_id AS CHAR) IN (${clause.placeholders})`);
    params.push(...clause.params);
  }

  const rows = await query(
    `
      SELECT series.*, turma.nome AS class_name, turma.modalidade, turma.unidade
      FROM agenda_recurrence_series series
      LEFT JOIN j12_turmas turma ON CAST(turma.id AS CHAR) = CAST(series.class_id AS CHAR)
      WHERE (${filters.join(" OR ")})
        AND UPPER(COALESCE(series.status, 'ACTIVE')) NOT IN ('CANCELLED', 'INACTIVE')
      ORDER BY series.start_date ASC, series.start_time ASC
      LIMIT 500
    `,
    params,
  );

  return (Array.isArray(rows) ? rows : []).flatMap((row) =>
    buildOccurrencesForRecurrence(row, period),
  );
}

async function loadTeacherAgendaStatuses(professorId, period) {
  const rows = await query(
    `
      SELECT *
      FROM teacher_agenda_statuses
      WHERE professor_id = ?
        AND (
          schedule_date IS NULL
          OR schedule_date BETWEEN ? AND ?
        )
    `,
    [String(professorId), period.startDate, period.endDate],
  );

  return (Array.isArray(rows) ? rows : []).map((row) => ({
    agendaItemId: row.agenda_item_id == null ? null : String(row.agenda_item_id),
    classId: row.class_id == null ? null : String(row.class_id),
    notes: row.notes || "",
    scheduleDate: row.schedule_date || null,
    startTime: row.start_time || null,
    status: row.status || "SCHEDULED",
  }));
}

async function loadPresenceRowsForTeacher(professorId, date) {
  if (!(await safeTableExists("student_presencas"))) return [];

  const rows = await query(
    `
      SELECT *
      FROM student_presencas
      WHERE professor_id = ?
        AND data_aula = ?
    `,
    [String(professorId), date],
  );

  return Array.isArray(rows) ? rows.map(mapPresenceRow) : [];
}

async function persistTeacherMessageNotifications({
  actor,
  alunos,
  audience,
  channels,
  message,
  professorId,
  title,
  turma,
}) {
  const recipients = [];
  const includeStudents = audience === "students" || audience === "both";
  const includeResponsibles = audience === "responsibles" || audience === "both";

  if (includeStudents && (await safeTableExists("student_notifications"))) {
    for (const aluno of alunos) {
      const id = createId("ntf");
      await query(
        `
          INSERT INTO student_notifications (id, aluno_id, titulo, mensagem, canal, tipo, lida)
          VALUES (?, ?, ?, ?, 'painel', 'professor', 0)
        `,
        [id, aluno.id, title, message],
      );
      recipients.push({ id: aluno.id, notificationId: id, type: "STUDENT" });
    }
  }

  const notificationCenterReady =
    (await safeTableExists("agenda_notification_events")) &&
    (await safeTableExists("agenda_notifications"));

  if (!notificationCenterReady) {
    return {
      eventId: null,
      recipients,
    };
  }

  const eventId = createId("tmsg_evt");
  await query(
    `
      INSERT INTO agenda_notification_events (
        id,
        event_type,
        class_id,
        payload_json,
        actor_id,
        idempotency_key,
        status,
        occurred_at
      ) VALUES (?, 'PROFESSOR_MESSAGE', ?, ?, ?, ?, 'RECORDED', CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
    `,
    [
      eventId,
      String(turma.id),
      JSON.stringify({ audience, channels, professorId, turma: turma.nome }),
      nullableText(actor, 191) || `professor:${professorId}`,
      `teacher-message:${professorId}:${turma.id}:${Date.now()}:${randomUUID()}`,
    ],
  );

  if (includeStudents) {
    for (const aluno of alunos) {
      const notificationId = createId("tmsg_ntf");
      await insertNotificationCenterRecord({
        eventId,
        message,
        notificationId,
        notificationType: "PROFESSOR_MESSAGE",
        recipientId: aluno.id,
        recipientType: "STUDENT",
        title,
      });
      recipients.push({ id: aluno.id, notificationId, type: "STUDENT_CENTER" });
    }
  }

  if (includeResponsibles) {
    const responsibleIds = await resolveResponsibleRecipientIds(alunos);

    for (const recipientId of responsibleIds) {
      const notificationId = createId("tmsg_ntf");
      await insertNotificationCenterRecord({
        eventId,
        message,
        notificationId,
        notificationType: "PROFESSOR_MESSAGE",
        recipientId,
        recipientType: "RESPONSIBLE",
        title,
      });
      recipients.push({ id: recipientId, notificationId, type: "RESPONSIBLE" });
    }
  }

  return {
    eventId,
    recipients,
  };
}

async function insertNotificationCenterRecord({
  eventId,
  message,
  notificationId,
  notificationType,
  recipientId,
  recipientType,
  title,
}) {
  await query(
    `
      INSERT INTO agenda_notifications (
        id,
        event_id,
        queue_id,
        recipient_type,
        recipient_id,
        title,
        message,
        notification_type,
        status
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'UNREAD')
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
    `,
    [
      notificationId,
      eventId,
      recipientType,
      String(recipientId),
      title,
      message.slice(0, 500),
      notificationType,
    ],
  );
}

async function resolveResponsibleRecipientIds(alunos) {
  const studentIds = alunos.map((item) => String(item.id)).filter(Boolean);
  const recipientIds = new Set(studentIds.map((id) => `resp-${id}`));

  if (studentIds.length === 0 || !(await safeTableExists("users"))) {
    return Array.from(recipientIds);
  }

  const clause = inClause(studentIds);
  const rows = await query(
    `
      SELECT responsavel_id, linked_aluno_id, id
      FROM users
      WHERE role = 'responsavel'
        AND linked_aluno_id IN (${clause.placeholders})
    `,
    clause.params,
  );

  for (const row of Array.isArray(rows) ? rows : []) {
    recipientIds.add(String(row.responsavel_id || row.id || `resp-${row.linked_aluno_id}`));
  }

  return Array.from(recipientIds);
}

function mapProfessorRow(row) {
  return {
    atualizadoEm: row.updated_at ?? row.created_at ?? null,
    cpf: text(row.cpf, 20),
    cref: text(row.cref, 50),
    criadoEm: row.created_at ?? null,
    dataInicioContrato: text(row.data_inicio_contrato, 10),
    email: text(row.email, 191),
    formaPagamentoProfessor: text(row.forma_pagamento_professor, 50),
    fotoUrl: row.foto_url ?? null,
    id: String(row.id),
    idioma: row.idioma || "pt-BR",
    jornadaProfessor: text(row.jornada_professor, 191),
    modalidades: uniqueValues(safeJsonParse(row.modalidades_json, [])),
    nome: text(row.nome, 191),
    observacoesContrato: text(row.observacoes_contrato, 65535),
    status: text(row.status, 30) || "ativo",
    telefone: text(row.telefone, 50),
    tema: row.tema || "dark",
    tipoContrato: text(row.tipo_contrato, 100),
    turmas: uniqueValues(safeJsonParse(row.turmas_json, [])),
    unidades: uniqueValues(safeJsonParse(row.unidades_json, [])),
    valorContrato: number(row.valor_contrato ?? row.valor_hora, 0),
  };
}

function mapClassRow(row) {
  const alunoIds = uniqueValues(
    safeJsonParse(row.aluno_ids_json_resolved ?? row.aluno_ids_json, []),
  );
  const status = text(row.status, 30).toLowerCase();

  return {
    alunoCount: integer(row.aluno_count, alunoIds.length),
    alunoIds,
    ativa: ACTIVE_CLASS_STATUSES.has(status),
    capacidadeMaxima: integer(row.capacidade, 0),
    criadaEm: row.created_at ?? null,
    diasSemana: parseDiasSemana(row.dias_semana_json ?? row.dias_semana),
    horarioFim: text(row.horario_fim, 20),
    horarioInicio: text(row.horario_inicio ?? row.horario, 20),
    id: String(row.id),
    modalidade: text(row.modalidade, 191),
    nome: text(row.nome, 191),
    professor: text(row.professor_nome_rel ?? row.professor_nome, 191),
    professorId: row.professor_id == null ? null : String(row.professor_id),
    quadra: text(row.quadra_nome ?? row.quadra ?? row.court_name, 191),
    status: status || "ativa",
    unidade: text(row.unidade, 191),
  };
}

function mapStudentRow(row) {
  return {
    email: text(row.email_contato, 191),
    id: String(row.id),
    modalidade: text(row.modalidade_principal, 191),
    nome: text(row.nome_completo, 191) || "Aluno",
    plano: text(row.plano_principal, 191),
    responsavel: {
      email: text(row.responsavel_email, 191),
      nome: text(row.responsavel_nome, 191),
      telefone: text(row.responsavel_whatsapp, 50),
    },
    status: text(row.status, 30) || "ativo",
    telefone: text(row.telefone_contato, 50),
    turma: text(row.turma_principal, 191),
  };
}

function mapLegacyStudentRow(row) {
  return {
    email: text(row.email, 191),
    id: String(row.id),
    modalidade: text(row.modalidade, 191),
    nome: text(row.nome, 191) || "Aluno",
    plano: text(row.plano, 191),
    responsavel: {
      email: text(row.responsavel_email, 191),
      nome: text(row.responsavel_nome, 191),
      telefone: text(row.responsavel_whatsapp, 50),
    },
    status: text(row.status, 30) || "ativo",
    telefone: text(row.telefone, 50),
    turma: text(row.turma, 191),
  };
}

function mapPresenceRow(row) {
  const status = normalizeAttendanceStatus(row.status ?? (row.presente ? "presente" : "falta"));

  return {
    alunoId: String(row.aluno_id),
    dataAula: row.data_aula,
    id: String(row.id),
    justificativa: row.justificativa ?? "",
    modalidade: row.modalidade ?? "",
    observacao: row.observacao ?? "",
    presente: status === "presente" || status === "atraso",
    status,
    turma: row.turma ?? "",
    turmaId: row.turma_id == null ? null : String(row.turma_id),
  };
}

function mapEvaluationRow(row) {
  return {
    aluno: row.aluno_nome ? { id: String(row.aluno_id), nome: row.aluno_nome } : null,
    alunoId: String(row.aluno_id),
    createdAt: row.created_at,
    fisicaScore: number(row.fisica_score, 0),
    id: String(row.id),
    observacoes: row.observacoes || "",
    professorId: String(row.professor_id),
    tecnicaScore: number(row.tecnica_score, 0),
    turma: row.turma_nome ? { id: String(row.turma_id), nome: row.turma_nome } : null,
    turmaId: row.turma_id == null ? null : String(row.turma_id),
  };
}

function mapOccurrenceRow(row) {
  return {
    aluno: row.aluno_nome ? { id: String(row.aluno_id), nome: row.aluno_nome } : null,
    alunoId: row.aluno_id == null ? null : String(row.aluno_id),
    createdAt: row.created_at,
    description: row.description || "",
    eventDate: row.event_date,
    id: String(row.id),
    severity: row.severity || "media",
    title: row.title,
    turma: row.turma_nome ? { id: String(row.turma_id), nome: row.turma_nome } : null,
    turmaId: row.turma_id == null ? null : String(row.turma_id),
    type: row.occurrence_type,
  };
}

function mapLessonPlanRow(row) {
  return {
    agendaItemId: row.agenda_item_id ?? null,
    conteudoAplicado: row.conteudo_aplicado || "",
    createdAt: row.created_at,
    exercicios: safeJsonParse(row.exercicios_json, []),
    id: String(row.id),
    objetivos: row.objetivos || "",
    observacoes: row.observacoes || "",
    planDate: row.plan_date,
    status: row.status || "planejado",
    turma: row.turma_nome ? { id: String(row.turma_id), nome: row.turma_nome } : null,
    turmaId: row.turma_id == null ? null : String(row.turma_id),
    updatedAt: row.updated_at,
  };
}

function mapMessageRow(row) {
  return {
    audience: row.audience || "both",
    channels: safeJsonParse(row.channels_json, []),
    createdAt: row.created_at,
    id: String(row.id),
    message: row.message,
    notificationEventId: row.notification_event_id ?? null,
    recipients: safeJsonParse(row.recipients_json, []),
    title: row.title,
    turma: row.turma_nome ? { id: String(row.turma_id), nome: row.turma_nome } : null,
    turmaId: row.turma_id == null ? null : String(row.turma_id),
  };
}

function parseDiasSemana(value) {
  const parsed = Array.isArray(value) ? value : safeJsonParse(value, []);
  const source =
    Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : text(value, 191)
          .replace(/\./g, "")
          .split(/[\/,;|]/g);

  return uniqueValues(source.map((item) => normalizeWeekdayLabel(item)).filter(Boolean));
}

function buildAgendaPeriod(view = "week", dateValue = null) {
  const viewName = normalizeAgendaView(view);
  const date = parseDate(dateValue) || parseDate(todayISO());

  if (viewName === "day") {
    const day = formatDate(date);
    return {
      endDate: day,
      label: formatPeriodLabel(day, day),
      startDate: day,
      view: viewName,
    };
  }

  if (viewName === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
      endDate: formatDate(end),
      label: start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      startDate: formatDate(start),
      view: viewName,
    };
  }

  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    endDate: formatDate(end),
    label: formatPeriodLabel(formatDate(start), formatDate(end)),
    startDate: formatDate(start),
    view: viewName,
  };
}

function buildClassScheduleOccurrences(classes, period) {
  return classes.flatMap((turma) => {
    const days = turma.diasSemana.length > 0 ? turma.diasSemana : [""];
    return days.flatMap((dayOfWeek) =>
      buildOccurrencesForDayPattern(
        {
          agendaItemId: null,
          agendaSource: "j12_turmas",
          classId: String(turma.id),
          className: turma.nome,
          classStatus: turma.status,
          courtName: turma.quadra,
          dayOfWeek,
          endTime: turma.horarioFim,
          modality: turma.modalidade,
          professorId: turma.professorId,
          professorName: turma.professor,
          recurrenceFrequency: "WEEKLY",
          recurrenceType: "WEEKLY",
          startTime: turma.horarioInicio,
          status: turma.ativa ? "SCHEDULED" : "INACTIVE",
          turmaName: turma.nome,
          unitName: turma.unidade,
        },
        period,
      ),
    );
  });
}

function buildOccurrencesForDayPattern(schedule, period) {
  const targetWeekday = weekdayNumber(schedule.dayOfWeek);
  const dates = enumerateDates(period.startDate, period.endDate).filter((date) => {
    if (targetWeekday == null) return date === period.startDate;
    return parseDate(date).getDay() === targetWeekday;
  });

  return dates.map((date) => {
    const agendaItemId =
      schedule.agendaItemId ||
      `class-${schedule.classId || "sem-turma"}-${date}-${schedule.startTime || "sem-hora"}`;

    return {
      ...schedule,
      agendaItemId,
      date,
      id: agendaItemId,
      isToday: date === todayISO(),
      scheduleDate: date,
      status: normalizeAgendaStatus(schedule.status),
    };
  });
}

function buildOccurrencesForRecurrence(row, period) {
  const days = safeJsonParse(row.days_of_week_json, []).map(normalizeWeekdayLabel).filter(Boolean);
  const startDate = normalizeDate(row.start_date) || period.startDate;
  const endDate = normalizeDate(row.end_date) || period.endDate;
  const effectiveStart = startDate > period.startDate ? startDate : period.startDate;
  const effectiveEnd = endDate < period.endDate ? endDate : period.endDate;

  if (effectiveStart > effectiveEnd) return [];

  return enumerateDates(effectiveStart, effectiveEnd)
    .filter((date) => {
      const frequency = text(row.frequency, 32).toUpperCase();

      if (frequency === "DAILY") return true;

      if (frequency === "MONTHLY") {
        return parseDate(date).getDate() === parseDate(startDate).getDate();
      }

      if (days.length === 0) {
        return parseDate(date).getDay() === parseDate(startDate).getDay();
      }

      return days.some((day) => weekdayNumber(day) === parseDate(date).getDay());
    })
    .map((date) => {
      const occurrenceKey = `${row.id}:${date}:${row.start_time || ""}`;

      return {
        agendaItemId: row.agenda_item_id || `rec-${occurrenceKey}`,
        agendaSource: "agenda_recurrence_series",
        classId: row.class_id == null ? null : String(row.class_id),
        className: row.class_name || row.metadata_json?.className || "Aula J12",
        date,
        endTime: row.end_time || null,
        id: `rec-${occurrenceKey}`,
        isRecurringProjection: true,
        isToday: date === todayISO(),
        modality: row.modalidade || "",
        professorId: row.professor_id == null ? null : String(row.professor_id),
        professorName: row.professor_name || "",
        recurrenceEndDate: row.end_date || null,
        recurrenceFrequency: row.frequency,
        recurrenceOccurrenceKey: occurrenceKey,
        recurrenceSeriesId: String(row.id),
        recurrenceStartDate: row.start_date,
        scheduleDate: date,
        startTime: row.start_time || null,
        status: normalizeAgendaStatus(row.status),
        turmaName: row.class_name || "Aula J12",
        unitName: row.unidade || "",
      };
    });
}

function applyAgendaStatusOverlay(schedule, overlays) {
  const agendaKey = buildAgendaStatusLookupKey({
    agendaItemId: schedule.agendaItemId,
    classId: schedule.classId,
    scheduleDate: schedule.scheduleDate,
    startTime: schedule.startTime,
  });
  const classKey = buildAgendaStatusLookupKey({
    agendaItemId: null,
    classId: schedule.classId,
    scheduleDate: schedule.scheduleDate,
    startTime: schedule.startTime,
  });
  const overlay = overlays.get(agendaKey) || overlays.get(classKey);

  if (!overlay) return schedule;

  return {
    ...schedule,
    notes: overlay.notes,
    status: normalizeAgendaStatus(overlay.status),
  };
}

function buildAgendaStatusUniqueKey({
  agendaItemId,
  classId,
  professorId,
  scheduleDate,
  startTime,
}) {
  return [
    String(professorId || ""),
    String(agendaItemId || ""),
    String(classId || ""),
    String(scheduleDate || ""),
    String(startTime || ""),
  ].join("|");
}

function buildAgendaStatusLookupKey({ agendaItemId, classId, scheduleDate, startTime }) {
  return [
    String(agendaItemId || ""),
    String(classId || ""),
    String(scheduleDate || ""),
    String(startTime || ""),
  ].join("|");
}

function dedupeSchedules(items) {
  const seen = new Set();
  const priority = {
    agenda_recurrence_series: 0,
    enrollment_agenda_items: 1,
    j12_turmas: 2,
  };

  return [...items]
    .sort((left, right) => (priority[left.agendaSource] ?? 9) - (priority[right.agendaSource] ?? 9))
    .filter((item) => {
      const key = [item.classId, item.scheduleDate, item.startTime].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function summarizeAgenda(schedules) {
  return {
    aulas: schedules.length,
    canceladas: schedules.filter((item) => normalizeAgendaStatus(item.status) === "CANCELLED")
      .length,
    concluidas: schedules.filter((item) => normalizeAgendaStatus(item.status) === "COMPLETED")
      .length,
    planejadas: schedules.filter((item) => normalizeAgendaStatus(item.status) !== "COMPLETED")
      .length,
  };
}

function summarizeAttendanceRows(rows) {
  const statuses = rows.map((row) => normalizeAttendanceStatus(row.status));
  const total = statuses.length;
  const presentes = statuses.filter((status) => status === "presente").length;
  const atrasos = statuses.filter((status) => status === "atraso").length;
  const faltas = statuses.filter((status) => status === "falta").length;
  const justificadas = statuses.filter((status) => status === "justificada").length;

  return {
    atrasos,
    faltas,
    justificadas,
    percentualPresenca: total > 0 ? Math.round(((presentes + atrasos) / total) * 100) : 0,
    presentes,
    total,
  };
}

function summarizeAttendanceRecords(records) {
  return summarizeAttendanceRows(records.map((item) => ({ status: item.status })));
}

function normalizeAttendanceStatus(value) {
  const normalized = text(value, 30).toLowerCase();
  if (normalized === "late" || normalized === "atrasado") return "atraso";
  if (normalized === "justified" || normalized === "justificado") return "justificada";
  if (normalized === "absent" || normalized === "ausente") return "falta";
  if (ATTENDANCE_STATUSES.has(normalized)) return normalized;
  return "presente";
}

function normalizeAgendaStatus(value) {
  const normalized = text(value, 32).toUpperCase();
  if (normalized === "CANCELADO" || normalized === "CANCELADA") return "CANCELLED";
  if (normalized === "CONCLUIDA" || normalized === "CONCLUIDO") return "COMPLETED";
  if (normalized === "ATIVA" || normalized === "ATIVO") return "ACTIVE";
  return AGENDA_STATUS_VALUES.has(normalized) ? normalized : "SCHEDULED";
}

function normalizeAgendaView(value) {
  const normalized = text(value, 20).toLowerCase();
  if (normalized === "day" || normalized === "daily" || normalized === "dia") return "day";
  if (normalized === "month" || normalized === "mensal" || normalized === "mes") return "month";
  return "week";
}

function normalizeOccurrenceType(value) {
  const normalized = text(value, 32).toLowerCase();
  if (["lesao", "lesao_medica", "injury"].includes(normalized)) return "lesao";
  if (["comunicado", "communication"].includes(normalized)) return "comunicado";
  return "disciplinar";
}

function normalizeSeverity(value) {
  const normalized = text(value, 32).toLowerCase();
  if (["alta", "grave", "high"].includes(normalized)) return "alta";
  if (["baixa", "low"].includes(normalized)) return "baixa";
  return "media";
}

function normalizeLessonPlanStatus(value) {
  const normalized = text(value, 32).toLowerCase();
  if (["aplicado", "concluido", "done"].includes(normalized)) return "aplicado";
  if (["cancelado", "cancelled"].includes(normalized)) return "cancelado";
  return "planejado";
}

function normalizeAudience(value) {
  const normalized = text(value, 32).toLowerCase();
  if (["students", "alunos", "student"].includes(normalized)) return "students";
  if (["responsibles", "responsaveis", "responsavel"].includes(normalized)) return "responsibles";
  return "both";
}

function normalizeChannels(value) {
  const raw = Array.isArray(value) && value.length > 0 ? value : ["IN_APP"];
  return uniqueValues(raw.map((item) => text(item, 32).toUpperCase()));
}

function normalizeLanguage(value) {
  const normalized = text(value, 16);
  return normalized || "pt-BR";
}

function normalizeTheme(value) {
  const normalized = text(value, 32).toLowerCase();
  if (normalized === "system" || normalized === "light") return normalized;
  return "dark";
}

function clampScore(value) {
  const parsed = number(value, 0);
  return Math.min(Math.max(parsed, 0), 10);
}

function normalizeLimit(value, fallback = 80) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.trunc(parsed), 200) : fallback;
}

function normalizeDate(value) {
  const normalized = text(value, 32);
  if (!normalized) return null;

  const match = normalized.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function parseDate(value) {
  const normalized = normalizeDate(value);
  if (!normalized) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function enumerateDates(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || start > end) return [];

  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(formatDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function normalizeWeekdayLabel(value) {
  const normalized = text(value, 32)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (["dom", "domingo", "0"].includes(normalized)) return "dom";
  if (["seg", "segunda", "segunda-feira", "1"].includes(normalized)) return "seg";
  if (["ter", "terca", "terca-feira", "2"].includes(normalized)) return "ter";
  if (["qua", "quarta", "quarta-feira", "3"].includes(normalized)) return "qua";
  if (["qui", "quinta", "quinta-feira", "4"].includes(normalized)) return "qui";
  if (["sex", "sexta", "sexta-feira", "5"].includes(normalized)) return "sex";
  if (["sab", "sabado", "sabado-feira", "6"].includes(normalized)) return "sab";
  return "";
}

function weekdayNumber(value) {
  const normalized = normalizeWeekdayLabel(value);
  const map = {
    dom: 0,
    seg: 1,
    ter: 2,
    qua: 3,
    qui: 4,
    sex: 5,
    sab: 6,
  };
  return Object.prototype.hasOwnProperty.call(map, normalized) ? map[normalized] : null;
}

function compareSchedules(left, right) {
  return [left.scheduleDate || "9999-12-31", left.startTime || ""]
    .join(" ")
    .localeCompare([right.scheduleDate || "9999-12-31", right.startTime || ""].join(" "));
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = String(item.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function inClause(values) {
  const params = values.map((value) => String(value));
  return {
    params,
    placeholders: params.map(() => "?").join(", "),
  };
}

function createId(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatPeriodLabel(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return "";

  return `${start.toLocaleDateString("pt-BR")} - ${end.toLocaleDateString("pt-BR")}`;
}

function requiredProfessorId(value) {
  const normalized = nullableText(value, 64);
  if (!normalized) {
    throw httpError("Seu usuario nao possui vinculo com um professor.", 403);
  }
  return normalized;
}

function httpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  buildAgendaPeriod,
  buildClassScheduleOccurrences,
  createTeacherEvaluation,
  createTeacherOccurrence,
  ensureTeacherPortalSchema,
  loadTeacherAgenda,
  loadTeacherClassDetail,
  loadTeacherClassStudents,
  loadTeacherClasses,
  loadTeacherDashboard,
  loadTeacherEvaluations,
  loadTeacherLessonPlans,
  loadTeacherMessages,
  loadTeacherOccurrences,
  loadTeacherPreferences,
  loadTeacherPresence,
  loadTeacherProfile,
  normalizeAgendaStatus,
  normalizeAttendanceStatus,
  resolveTeacherScope,
  saveTeacherAttendance,
  sendTeacherMessage,
  summarizeAttendanceRecords,
  updateTeacherAgendaStatus,
  updateTeacherPreferences,
  updateTeacherProfile,
  upsertTeacherLessonPlan,
};
