const { query, tableExists } = require("../db.js");
const { listCharges } = require("./student-finance.js");

let QRCode = null;
try {
  QRCode = require("qrcode");
} catch {
  QRCode = null;
}

const CANCELLED_AGENDA_STATUSES = new Set([
  "CANCELLED",
  "CANCELADO",
  "CANCELADA",
  "COMPLETED",
  "ENCERRADO",
  "ENCERRADA",
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

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
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

function parseArray(value) {
  const parsed = safeJsonParse(value, []);
  const source = Array.isArray(parsed)
    ? parsed
    : text(value)
        .split(/[|,;]/g)
        .map((item) => item.trim());

  return Array.from(new Set(source.map((item) => text(item, 191)).filter(Boolean)));
}

function normalizeStatus(value, fallback = "ativo") {
  const normalized = text(value, 50).toLowerCase();
  return normalized || fallback;
}

async function safeTableExists(tableName) {
  try {
    return Boolean(await tableExists(tableName));
  } catch {
    return false;
  }
}

async function loadStudentProfile(studentId) {
  const normalizedStudentId = requiredStudentId(studentId);

  if (await safeTableExists("j12_alunos")) {
    const rows = await query(
      `
        SELECT
          aluno.*,
          resp.nome_completo AS responsavel_nome,
          resp.cpf AS responsavel_cpf,
          resp.rg AS responsavel_rg,
          resp.whatsapp AS responsavel_whatsapp,
          resp.email AS responsavel_email,
          resp.parentesco AS responsavel_parentesco,
          docs.foto_perfil_aluno_json,
          docs.rg_cpf_aluno_json,
          docs.rg_cpf_responsavel_json,
          docs.comprovante_endereco_json,
          docs.autorizacao_imagem_json,
          docs.atestado_medico_json,
          esporte.modalidades_json,
          esporte.unidades_json,
          esporte.horarios_json,
          esporte.turmas_json,
          esporte.nivel,
          esporte.treinou_antes,
          esporte.caracteristica,
          esporte.objetivo
        FROM j12_alunos aluno
        LEFT JOIN j12_alunos_responsaveis resp ON resp.aluno_id = aluno.id
        LEFT JOIN j12_alunos_documentos docs ON docs.aluno_id = aluno.id
        LEFT JOIN j12_alunos_esportes esporte ON esporte.aluno_id = aluno.id
        WHERE aluno.id = ?
        LIMIT 1
      `,
      [normalizedStudentId],
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return mapJ12Student(rows[0]);
    }
  }

  if (await safeTableExists("alunos")) {
    const rows = await query("SELECT * FROM alunos WHERE id = ? LIMIT 1", [normalizedStudentId]);

    if (Array.isArray(rows) && rows.length > 0) {
      return mapLegacyStudent(rows[0]);
    }
  }

  return null;
}

async function updateStudentProfile(studentId, payload = {}) {
  const normalizedStudentId = requiredStudentId(studentId);
  const emailContato = nullableText(payload.email_contato ?? payload.email, 191);
  const telefoneContato = nullableText(payload.telefone_contato ?? payload.telefone, 50);
  const fotoUrl = nullableText(payload.foto_url ?? payload.fotoUrl, 500);

  if (await safeTableExists("j12_alunos")) {
    await query(
      `
        UPDATE j12_alunos
        SET
          email_contato = COALESCE(?, email_contato),
          telefone_contato = COALESCE(?, telefone_contato),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [emailContato, telefoneContato, normalizedStudentId],
    );
  }

  if (fotoUrl && (await safeTableExists("j12_alunos_documentos"))) {
    const photoPayload = {
      name: "Foto do aluno",
      type: "url",
      uploadedAt: new Date().toISOString(),
      url: fotoUrl,
    };

    await query(
      `
        INSERT INTO j12_alunos_documentos (aluno_id, foto_perfil_aluno_json)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
          foto_perfil_aluno_json = VALUES(foto_perfil_aluno_json),
          updated_at = CURRENT_TIMESTAMP
      `,
      [normalizedStudentId, JSON.stringify(photoPayload)],
    );
  }

  return loadStudentProfile(normalizedStudentId);
}

async function loadStudentPresence(studentId) {
  const normalizedStudentId = requiredStudentId(studentId);
  let rows = [];

  if (await safeTableExists("j12_presencas")) {
    rows = await query(
      `
        SELECT
          presenca.id,
          presenca.aluno_id,
          presenca.data_aula,
          COALESCE(presenca.status, presenca.status_presenca, 'presente') AS status,
          presenca.observacao,
          turma.nome AS turma_nome,
          turma.modalidade,
          turma.unidade
        FROM j12_presencas presenca
        LEFT JOIN j12_turmas turma ON turma.id = presenca.turma_id
        WHERE presenca.aluno_id = ?
        ORDER BY presenca.data_aula DESC, presenca.id DESC
      `,
      [normalizedStudentId],
    );
  }

  if ((!Array.isArray(rows) || rows.length === 0) && (await safeTableExists("student_presencas"))) {
    rows = await query(
      `
        SELECT id, aluno_id, turma, modalidade, data_aula, presente, observacao
        FROM student_presencas
        WHERE aluno_id = ?
        ORDER BY data_aula DESC, id DESC
      `,
      [normalizedStudentId],
    );
  }

  const presencas = (Array.isArray(rows) ? rows : []).map(mapPresenceRow);
  const resumo = summarizePresence(presencas);

  return {
    presencas,
    resumo,
  };
}

async function loadStudentNotifications(studentId) {
  const normalizedStudentId = requiredStudentId(studentId);
  const notifications = [];

  if (await safeTableExists("j12_notificacoes")) {
    const rows = await query(
      `
        SELECT id, aluno_id, titulo, mensagem, tipo, lida, created_at
        FROM j12_notificacoes
        WHERE aluno_id = ?
        ORDER BY created_at DESC, id DESC
      `,
      [normalizedStudentId],
    );
    notifications.push(...(Array.isArray(rows) ? rows.map(mapJ12NotificationRow) : []));
  }

  if (await safeTableExists("student_notifications")) {
    const rows = await query(
      `
        SELECT id, aluno_id, titulo, mensagem, canal, tipo, lida, created_at, updated_at
        FROM student_notifications
        WHERE aluno_id = ?
        ORDER BY created_at DESC, updated_at DESC
      `,
      [normalizedStudentId],
    );
    notifications.push(...(Array.isArray(rows) ? rows.map(mapStudentNotificationRow) : []));
  }

  return dedupeById(notifications).sort((left, right) =>
    String(right.createdAt || "").localeCompare(String(left.createdAt || "")),
  );
}

async function markStudentNotificationRead(studentId, notificationId) {
  const normalizedStudentId = requiredStudentId(studentId);
  const normalizedNotificationId = nullableText(notificationId, 64);

  if (!normalizedNotificationId) {
    const error = new Error("Notificacao invalida.");
    error.statusCode = 400;
    throw error;
  }

  if (await safeTableExists("j12_notificacoes")) {
    await query(
      `
        UPDATE j12_notificacoes
        SET lida = 1
        WHERE id = ? AND aluno_id = ?
      `,
      [normalizedNotificationId, normalizedStudentId],
    );
  }

  if (await safeTableExists("student_notifications")) {
    await query(
      `
        UPDATE student_notifications
        SET lida = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND aluno_id = ?
      `,
      [normalizedNotificationId, normalizedStudentId],
    );
  }

  return {
    id: normalizedNotificationId,
    lida: true,
  };
}

async function loadStudentContract(studentId) {
  const normalizedStudentId = requiredStudentId(studentId);

  if (await safeTableExists("j12_contratos")) {
    const rows = await query(
      `
        SELECT id, aluno_id, titulo, status, url_arquivo, aceite_em, created_at
        FROM j12_contratos
        WHERE aluno_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [normalizedStudentId],
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return mapJ12ContractRow(rows[0]);
    }
  }

  if (await safeTableExists("student_contracts")) {
    const rows = await query(
      `
        SELECT *
        FROM student_contracts
        WHERE aluno_id = ?
        ORDER BY data_emissao DESC, updated_at DESC
        LIMIT 1
      `,
      [normalizedStudentId],
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return mapStudentContractRow(rows[0]);
    }
  }

  return null;
}

async function loadStudentAgenda(studentId, options = {}) {
  const normalizedStudentId = requiredStudentId(studentId);
  const limit = normalizeLimit(options.limit, 80);
  const profile = await loadStudentProfile(normalizedStudentId);
  const [persisted, classSchedules, presenceData] = await Promise.all([
    loadPersistedAgendaItems(normalizedStudentId, limit),
    loadClassSchedulesForStudent(normalizedStudentId, profile),
    loadStudentPresence(normalizedStudentId).catch(() => ({ presencas: [], resumo: {} })),
  ]);

  const schedules = dedupeAgendaSchedules([...persisted, ...classSchedules])
    .sort(compareAgendaSchedules)
    .slice(0, limit);
  const upcoming = schedules
    .filter((item) => !item.scheduleDate || item.scheduleDate >= todayISO())
    .slice(0, Math.min(limit, 12));
  const history = presenceData.presencas.slice(0, Math.min(limit, 30)).map(mapPresenceToAgendaHistory);

  return {
    agendaSource: persisted.length > 0 ? "enrollment_agenda_items" : "j12_turmas",
    aulas: schedules,
    eventos: schedules.filter((item) => item.type === "EVENT"),
    hasSchedules: schedules.length > 0,
    historico: history,
    noAttendanceCreated: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    proximasAulas: upcoming,
    readOnly: true,
    scheduleCount: schedules.length,
    summary: {
      historicoCount: history.length,
      proximasAulas: upcoming.length,
      totalAulas: schedules.length,
    },
  };
}

async function loadStudentDashboard(studentId) {
  const normalizedStudentId = requiredStudentId(studentId);
  const [profile, charges, presence, notifications, agenda] = await Promise.all([
    loadStudentProfile(normalizedStudentId),
    listCharges({ studentId: normalizedStudentId }).catch(() => []),
    loadStudentPresence(normalizedStudentId).catch(() => ({ presencas: [], resumo: {} })),
    loadStudentNotifications(normalizedStudentId).catch(() => []),
    loadStudentAgenda(normalizedStudentId, { limit: 20 }).catch(() => ({
      eventos: [],
      proximasAulas: [],
    })),
  ]);

  if (!profile) {
    const error = new Error("Aluno vinculado nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const financeSummary = summarizeFinance(charges);
  const unread = notifications.filter((item) => !item.lida).length;

  return {
    aluno: {
      id: profile.id,
      nome: profile.nome_completo,
      numeroMatricula: profile.numero_matricula,
      status: profile.status,
    },
    avisos: notifications.slice(0, 5),
    financeiro: {
      mensalidade: financeSummary.currentAmount,
      pendentes: financeSummary.pendingCount,
      status: financeSummary.status,
      totalAberto: financeSummary.totalOpen,
      totalPago: financeSummary.totalPaid,
    },
    indicadores: {
      avisosNaoLidos: unread,
      faltas: number(presence.resumo?.faltas),
      frequencia: number(presence.resumo?.percentual_presenca),
      presencas: number(presence.resumo?.presentes),
      situacaoFinanceira: financeSummary.status,
      statusMatricula: profile.status,
    },
    nome: profile.nome_completo,
    plano: {
      nome: profile.plano_principal || "Sem plano",
    },
    presenca: {
      faltas: number(presence.resumo?.faltas),
      percentual: number(presence.resumo?.percentual_presenca),
      presentes: number(presence.resumo?.presentes),
    },
    proximasAulas: agenda.proximasAulas || [],
    proximosEventos: agenda.eventos || [],
  };
}

async function loadStudentDigitalCard(studentId) {
  const normalizedStudentId = requiredStudentId(studentId);
  const profile = await loadStudentProfile(normalizedStudentId);

  if (!profile) {
    const error = new Error("Aluno vinculado nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const payload = {
    enrollmentNumber: profile.numero_matricula || null,
    issuedAt: new Date().toISOString(),
    status: profile.status || "ativo",
    studentId: profile.id,
    type: "J12_STUDENT_DIGITAL_CARD",
    version: 1,
  };
  const qrPayload = JSON.stringify(payload);
  const qrCodeDataUrl =
    QRCode && typeof QRCode.toDataURL === "function"
      ? await QRCode.toDataURL(qrPayload, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 240,
        })
      : null;

  return {
    aluno: {
      fotoUrl: profile.fotoUrl || null,
      id: profile.id,
      modalidade: profile.modalidade_principal || null,
      nome: profile.nome_completo,
      turma: profile.turma_principal || null,
    },
    matricula: {
      desde: profile.matricula_em || null,
      numero: profile.numero_matricula || null,
      plano: profile.plano_principal || null,
      status: profile.status || "ativo",
    },
    qrCodeDataUrl,
    qrPayload,
    responsavel: profile.responsavel_detalhes,
    statusMatricula: profile.status || "ativo",
  };
}

async function loadPersistedAgendaItems(studentId, limit) {
  if (!(await safeTableExists("enrollment_agenda_items"))) {
    return [];
  }

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
      LEFT JOIN j12_turmas turma ON turma.id = item.class_id
      LEFT JOIN enrollments enrollment_record ON enrollment_record.id = item.enrollment_id
      WHERE item.status NOT IN ('CANCELLED', 'CANCELADO', 'CANCELADA', 'COMPLETED', 'ENCERRADO', 'ENCERRADA')
        AND (
          item.student_person_id = ?
          OR item.student_profile_id = ?
          OR enrollment_record.student_person_id = ?
          OR enrollment_record.student_profile_id = ?
        )
      ORDER BY item.updated_at DESC, item.created_at DESC
      LIMIT ?
    `,
    [studentId, studentId, studentId, studentId, limit],
  );

  return (Array.isArray(rows) ? rows : []).map(mapPersistedAgendaRow);
}

async function loadClassSchedulesForStudent(studentId, profile) {
  if (!profile || !(await safeTableExists("j12_turmas"))) {
    return [];
  }

  const conditions = [];
  const params = [];
  const turmaId = nullableText(profile.turma_id, 64);
  const turmaNames = uniqueValues([
    profile.turma_principal,
    profile.turma,
    ...(profile.turmas || []),
  ]);

  if (turmaId && /^\d+$/.test(turmaId)) {
    conditions.push("turma.id = ?");
    params.push(Number(turmaId));
  }

  for (const turmaName of turmaNames.slice(0, 8)) {
    conditions.push("LOWER(turma.nome) = LOWER(?)");
    params.push(turmaName);
  }

  conditions.push("turma.aluno_ids_json LIKE ?");
  params.push(`%"${studentId}"%`);

  if (conditions.length === 0) {
    return [];
  }

  const rows = await query(
    `
      SELECT *
      FROM j12_turmas turma
      WHERE (${conditions.join(" OR ")})
        AND LOWER(COALESCE(turma.status, 'ativa')) NOT IN ('inativa', 'cancelada', 'encerrada')
      ORDER BY turma.nome ASC
      LIMIT 30
    `,
    params,
  );

  const classSchedules = (Array.isArray(rows) ? rows : []).flatMap(mapClassScheduleRow);

  if (classSchedules.length > 0) {
    return classSchedules;
  }

  return buildFallbackSchedulesFromProfile(profile);
}

function mapJ12Student(row) {
  const foto = safeJsonParse(row.foto_perfil_aluno_json, null);
  const modalidades = uniqueValues([
    row.modalidade_principal,
    ...parseArray(row.modalidades_json),
  ]);
  const turmas = uniqueValues([row.turma_principal, ...parseArray(row.turmas_json)]);
  const unidades = uniqueValues([row.unidade_principal, ...parseArray(row.unidades_json)]);
  const horarios = uniqueValues([
    ...parseArray(row.horarios_json),
    ...parseArray(row.dias_horarios_json),
  ]);

  return {
    ...row,
    email: row.email_contato ?? "",
    email_contato: row.email_contato ?? "",
    fotoUrl: extractPhotoUrl(foto),
    horarios,
    id: String(row.id),
    modalidade: row.modalidade_principal ?? modalidades[0] ?? "",
    modalidade_principal: row.modalidade_principal ?? modalidades[0] ?? "",
    modalidades,
    nome: row.nome_completo ?? "",
    nome_completo: row.nome_completo ?? "",
    numero_matricula: row.numero_matricula ?? "",
    plano: row.plano_principal ?? "",
    plano_principal: row.plano_principal ?? "",
    responsavel_detalhes:
      row.responsavel_nome || row.responsavel
        ? {
            cpf: row.responsavel_cpf ?? null,
            email: row.responsavel_email ?? null,
            nome: row.responsavel_nome ?? row.responsavel ?? null,
            parentesco: row.responsavel_parentesco ?? null,
            telefone: row.responsavel_whatsapp ?? row.telefone_responsavel ?? null,
          }
        : null,
    status: row.status ?? "ativo",
    telefone: row.telefone_contato ?? "",
    telefone_contato: row.telefone_contato ?? "",
    turma: row.turma_principal ?? turmas[0] ?? "",
    turma_principal: row.turma_principal ?? turmas[0] ?? "",
    turmas,
    unidades,
  };
}

function mapLegacyStudent(row) {
  const turmas = parseArray(row.turmas_json);
  const unidades = parseArray(row.unidades_json);
  const horarios = parseArray(row.horarios_json);

  return {
    ...row,
    email_contato: row.email ?? "",
    fotoUrl: row.foto_url ?? "",
    horarios,
    id: String(row.id),
    modalidade_principal: row.modalidade ?? "",
    modalidades: uniqueValues([row.modalidade]),
    nome_completo: row.nome ?? "",
    numero_matricula: row.numero_matricula ?? "",
    plano_principal: row.plano ?? "",
    responsavel_detalhes:
      row.responsavel || row.responsavel_email || row.responsavel_whatsapp
        ? {
            cpf: row.responsavel_cpf ?? null,
            email: row.responsavel_email ?? null,
            nome: row.responsavel ?? null,
            parentesco: null,
            telefone: row.responsavel_whatsapp ?? row.telefone_responsavel ?? null,
          }
        : null,
    status: row.status ?? "ativo",
    telefone_contato: row.telefone ?? "",
    turma_principal: row.turma ?? turmas[0] ?? "",
    turmas,
    unidades,
  };
}

function mapPresenceRow(row) {
  const status = normalizePresenceStatus(row.status ?? (row.presente ? "presente" : "falta"));

  return {
    alunoId: String(row.aluno_id ?? ""),
    data_aula: row.data_aula ?? row.dataAula ?? "",
    dataAula: row.data_aula ?? row.dataAula ?? "",
    id: String(row.id),
    modalidade: row.modalidade ?? "",
    observacao: row.observacao ?? "",
    presente: status === "presente",
    status,
    turma: row.turma_nome ?? row.turma ?? "Treino J12",
    turma_nome: row.turma_nome ?? row.turma ?? "Treino J12",
    unidade: row.unidade ?? "",
  };
}

function summarizePresence(items) {
  const total = items.length;
  const presentes = items.filter((item) => item.status === "presente").length;
  const faltas = items.filter((item) => item.status === "falta").length;
  const justificadas = items.filter((item) => item.status === "justificada").length;

  return {
    faltas,
    justificadas,
    percentual_presenca: total > 0 ? Number(((presentes / total) * 100).toFixed(2)) : 0,
    presentes,
    total_aulas: total,
  };
}

function mapJ12NotificationRow(row) {
  return {
    alunoId: String(row.aluno_id),
    canal: "painel",
    created_at: row.created_at,
    createdAt: row.created_at,
    id: String(row.id),
    lida: Boolean(row.lida),
    mensagem: row.mensagem,
    tipo: row.tipo ?? "info",
    titulo: row.titulo,
  };
}

function mapStudentNotificationRow(row) {
  return {
    alunoId: String(row.aluno_id),
    canal: row.canal ?? "painel",
    created_at: row.created_at,
    createdAt: row.created_at,
    id: String(row.id),
    lida: Boolean(row.lida),
    mensagem: row.mensagem,
    tipo: row.tipo ?? "info",
    titulo: row.titulo,
  };
}

function mapJ12ContractRow(row) {
  return {
    alunoId: String(row.aluno_id),
    arquivoPdf: row.url_arquivo ?? null,
    dataAssinatura: row.aceite_em ?? null,
    dataEmissao: row.created_at ?? null,
    id: String(row.id),
    observacoes: "",
    status: row.status,
    templateHtml: "",
    tipoDocumento: "contrato_aluno",
    titulo: row.titulo,
  };
}

function mapStudentContractRow(row) {
  return {
    alunoId: String(row.aluno_id),
    arquivoPdf: row.arquivo_pdf ?? null,
    dataAssinatura: row.data_assinatura ?? null,
    dataEmissao: row.data_emissao ?? null,
    id: String(row.id),
    observacoes: row.observacoes ?? "",
    status: row.status,
    templateHtml: row.template_html ?? "",
    tipoDocumento: row.tipo_documento,
    titulo: row.titulo,
  };
}

function mapPersistedAgendaRow(row) {
  const metadata = safeJsonParse(row.metadata_json, {});
  const dayLabel = text(row.day_of_week, 32);

  return {
    agendaItemId: String(row.id),
    agendaSource: "enrollment_agenda_items",
    classId: row.class_id == null ? null : String(row.class_id),
    className: row.class_name ?? metadata.className ?? "Aula J12",
    dayOfWeek: dayLabel,
    endTime: row.end_time ?? null,
    enrollmentId: row.enrollment_id ?? null,
    id: String(row.id),
    modality: row.modalidade ?? metadata.modality ?? "",
    professorName: row.professor_nome ?? metadata.professorName ?? "",
    scheduleDate: nextDateForDay(dayLabel),
    scheduleStatus: row.status ?? "ACTIVE",
    source: "enrollment_agenda_items",
    startTime: row.start_time ?? null,
    status: row.status ?? "ACTIVE",
    studentPersonId: row.student_person_id ?? null,
    studentProfileId: row.student_profile_id ?? null,
    turmaName: row.class_name ?? metadata.className ?? "Aula J12",
    type: normalizeAgendaType(metadata.type),
    unitName: row.unidade ?? metadata.unitName ?? "",
  };
}

function mapClassScheduleRow(row) {
  const days = parseClassDays(row);
  const time = parseClassTime(row);

  if (days.length === 0 && !time.startTime) {
    return [];
  }

  const normalizedDays = days.length > 0 ? days : [""];

  return normalizedDays.map((day, index) => ({
    agendaItemId: `class-${row.id}-${index}`,
    agendaSource: "j12_turmas",
    classId: String(row.id),
    className: row.nome ?? "Aula J12",
    dayOfWeek: day,
    endTime: time.endTime,
    id: `class-${row.id}-${index}`,
    modality: row.modalidade ?? "",
    professorName: row.professor_nome ?? "",
    scheduleDate: nextDateForDay(day),
    scheduleStatus: row.status ?? "ativa",
    source: "j12_turmas",
    startTime: time.startTime,
    status: row.status ?? "ativa",
    turmaName: row.nome ?? "Aula J12",
    type: "CLASS",
    unitName: row.unidade ?? "",
  }));
}

function buildFallbackSchedulesFromProfile(profile) {
  return (profile.horarios || []).map((horario, index) => {
    const parsed = parseScheduleLabel(horario);
    return {
      agendaItemId: `profile-${profile.id}-${index}`,
      agendaSource: "j12_alunos_esportes",
      classId: profile.turma_id == null ? null : String(profile.turma_id),
      className: profile.turma_principal || "Treino J12",
      dayOfWeek: parsed.dayLabel,
      endTime: parsed.endTime,
      id: `profile-${profile.id}-${index}`,
      modality: profile.modalidade_principal || "",
      professorName: "",
      scheduleDate: nextDateForDay(parsed.dayLabel),
      scheduleStatus: profile.status || "ativo",
      source: "j12_alunos_esportes",
      startTime: parsed.startTime || horario,
      status: profile.status || "ativo",
      turmaName: profile.turma_principal || "Treino J12",
      type: "CLASS",
      unitName: (profile.unidades || [])[0] || "",
    };
  });
}

function mapPresenceToAgendaHistory(item) {
  return {
    agendaItemId: item.id,
    attendanceStatus: item.status,
    className: item.turma,
    date: item.data_aula,
    id: item.id,
    modality: item.modalidade,
    observations: item.observacao,
    present: item.presente,
    scheduleDate: item.data_aula,
    source: "presencas",
    turmaName: item.turma,
  };
}

function summarizeFinance(charges) {
  const normalizedCharges = Array.isArray(charges) ? charges : [];
  const openCharges = normalizedCharges.filter(
    (item) => item.status !== "pago" && item.status !== "cancelada" && item.status !== "cancelado",
  );
  const paidCharges = normalizedCharges.filter((item) => item.status === "pago");
  const nextCharge = [...openCharges].sort((left, right) =>
    String(left.vencimento || "").localeCompare(String(right.vencimento || "")),
  )[0];
  const latestCharge = normalizedCharges[0] ?? null;

  return {
    currentAmount: number(nextCharge?.valorFinal ?? nextCharge?.valor ?? latestCharge?.valor ?? 0),
    pendingCount: openCharges.length,
    status: nextCharge?.status ?? latestCharge?.status ?? "sem_cobranca",
    totalOpen: number(openCharges.reduce((sum, item) => sum + number(item.valorFinal ?? item.valor), 0)),
    totalPaid: number(paidCharges.reduce((sum, item) => sum + number(item.valorFinal ?? item.valor), 0)),
  };
}

function extractPhotoUrl(photo) {
  if (!photo || typeof photo !== "object") return null;
  return nullableText(photo.url ?? photo.previewUrl ?? photo.href ?? photo.path, 500);
}

function parseClassDays(row) {
  const fromJson = parseArray(row.dias_semana_json);
  if (fromJson.length > 0) return fromJson;

  return parseArray(row.dias_semana);
}

function parseClassTime(row) {
  if (row.horario_inicio || row.horario_fim) {
    return {
      endTime: nullableText(row.horario_fim, 20),
      startTime: nullableText(row.horario_inicio, 20),
    };
  }

  return parseScheduleLabel(row.horario);
}

function parseScheduleLabel(value) {
  const normalized = text(value, 191);
  const timeMatches = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g) || [];
  const dayMatch = normalized.match(
    /\b(seg|segunda|ter|terca|terça|qua|quarta|qui|quinta|sex|sexta|sab|sábado|sabado|dom|domingo)\b/i,
  );

  return {
    dayLabel: dayMatch ? dayMatch[0] : "",
    endTime: timeMatches[1] || null,
    startTime: timeMatches[0] || null,
  };
}

function nextDateForDay(dayLabel) {
  const targetDay = weekdayNumber(dayLabel);
  if (targetDay == null) return null;

  const now = new Date();
  const today = now.getDay();
  const diff = (targetDay - today + 7) % 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next.toISOString().slice(0, 10);
}

function weekdayNumber(value) {
  const normalized = text(value, 32)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (["dom", "domingo", "0"].includes(normalized)) return 0;
  if (["seg", "segunda", "segunda-feira", "1"].includes(normalized)) return 1;
  if (["ter", "terca", "terca-feira", "2"].includes(normalized)) return 2;
  if (["qua", "quarta", "quarta-feira", "3"].includes(normalized)) return 3;
  if (["qui", "quinta", "quinta-feira", "4"].includes(normalized)) return 4;
  if (["sex", "sexta", "sexta-feira", "5"].includes(normalized)) return 5;
  if (["sab", "sabado", "sabado-feira", "6"].includes(normalized)) return 6;
  return null;
}

function normalizeAgendaType(value) {
  const normalized = text(value, 32).toUpperCase();
  return normalized === "EVENT" || normalized === "EVENTO" ? "EVENT" : "CLASS";
}

function normalizePresenceStatus(value) {
  const normalized = text(value, 30).toLowerCase();
  if (normalized === "justificada" || normalized === "justificado") return "justificada";
  if (normalized === "presente" || normalized === "present") return "presente";
  return "falta";
}

function compareAgendaSchedules(left, right) {
  return [left.scheduleDate || "9999-12-31", left.startTime || ""]
    .join(" ")
    .localeCompare([right.scheduleDate || "9999-12-31", right.startTime || ""].join(" "));
}

function dedupeAgendaSchedules(items) {
  const seen = new Set();

  return items.filter((item) => {
    const status = text(item.status || item.scheduleStatus, 32).toUpperCase();
    if (CANCELLED_AGENDA_STATUSES.has(status)) return false;

    const key = [
      item.agendaItemId || item.id,
      item.classId,
      item.dayOfWeek,
      item.scheduleDate,
      item.startTime,
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeById(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = String(item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueValues(values) {
  return Array.from(new Set((values || []).map((item) => text(item, 191)).filter(Boolean)));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeLimit(value, fallback = 80) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.trunc(parsed), 200) : fallback;
}

function requiredStudentId(studentId) {
  const normalized = nullableText(studentId, 64);
  if (!normalized) {
    const error = new Error("Seu usuario nao possui vinculo com um aluno.");
    error.statusCode = 403;
    throw error;
  }

  return normalized;
}

module.exports = {
  buildFallbackSchedulesFromProfile,
  loadStudentAgenda,
  loadStudentContract,
  loadStudentDashboard,
  loadStudentDigitalCard,
  loadStudentNotifications,
  loadStudentPresence,
  loadStudentProfile,
  markStudentNotificationRead,
  mapPresenceRow,
  parseScheduleLabel,
  summarizeFinance,
  summarizePresence,
  updateStudentProfile,
};
