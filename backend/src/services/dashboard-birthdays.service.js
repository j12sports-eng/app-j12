const { query } = require("../config/db.js");

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function startOfCurrentWeek(date) {
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(date), diffToMonday);
}

function enumerateDates(start, count) {
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

function toMonthDay(date) {
  return {
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateInput(value);
  }

  return String(value).slice(0, 10);
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function firstTextFromJson(value) {
  const parsed = safeJsonParse(value);

  if (Array.isArray(parsed)) {
    return String(parsed.find((item) => String(item ?? "").trim()) ?? "").trim();
  }

  if (typeof parsed === "string") {
    return parsed.trim();
  }

  return "";
}

function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function extractPhotoUrl(value) {
  const parsed = safeJsonParse(value);

  if (typeof parsed === "string") {
    return /^(https?:\/\/|data:image\/)/i.test(parsed) ? parsed : null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const candidates = [
    parsed.url,
    parsed.publicUrl,
    parsed.previewUrl,
    parsed.dataUrl,
    parsed.src,
    parsed.href,
    parsed.path,
    parsed.fileUrl,
    parsed.arquivoUrl,
    parsed.arquivo?.url,
    parsed.file?.url,
  ];

  const photo = candidates.find(
    (candidate) =>
      typeof candidate === "string" && /^(https?:\/\/|data:image\/|\/)/i.test(candidate.trim()),
  );

  return typeof photo === "string" ? photo.trim() : null;
}

function buildDatePredicate(dates) {
  const uniquePairs = Array.from(
    new Map(
      dates.map((date) => {
        const pair = toMonthDay(date);
        return [`${pair.month}-${pair.day}`, pair];
      }),
    ).values(),
  );

  return {
    clause: uniquePairs
      .map(() => "(MONTH(aluno.data_nascimento) = ? AND DAYOFMONTH(aluno.data_nascimento) = ?)")
      .join(" OR "),
    params: uniquePairs.flatMap((pair) => [pair.month, pair.day]),
  };
}

const BASE_BIRTHDAY_SELECT = `
  SELECT
    aluno.id,
    aluno.nome_completo AS nome,
    aluno.data_nascimento AS dataNascimento,
    aluno.turma_principal AS turmaPrincipal,
    aluno.unidade_principal AS unidadePrincipal,
    aluno.telefone_responsavel AS telefoneResponsavelDireto,
    turma.nome AS turmaNome,
    turma.unidade AS turmaUnidade,
    unidade.nome AS unidadeNome,
    resp.whatsapp AS responsavelWhatsapp,
    docs.foto_perfil_aluno_json AS fotoJson,
    esporte.turmas_json AS turmasJson,
    esporte.unidades_json AS unidadesJson
  FROM j12_alunos aluno
  LEFT JOIN j12_turmas turma ON turma.id = aluno.turma_id
  LEFT JOIN j12_unidades unidade ON unidade.id = aluno.unidade_id
  LEFT JOIN j12_alunos_responsaveis resp ON resp.aluno_id = aluno.id
  LEFT JOIN j12_alunos_documentos docs ON docs.aluno_id = aluno.id
  LEFT JOIN j12_alunos_esportes esporte ON esporte.aluno_id = aluno.id
  WHERE aluno.data_nascimento IS NOT NULL
    AND LOWER(COALESCE(aluno.status, 'ativo')) IN ('ativo', 'experimental')
`;

function buildBirthdayDate(dateValue, year) {
  const normalized = normalizeDate(dateValue);
  const [, month, day] = normalized.split("-");

  if (!month || !day) return "";

  return `${year}-${month}-${day}`;
}

function calculateTurningAge(dateValue, year) {
  const normalized = normalizeDate(dateValue);
  const [birthYear] = normalized.split("-");
  const parsedBirthYear = Number(birthYear);

  if (!Number.isFinite(parsedBirthYear) || parsedBirthYear <= 0) {
    return 0;
  }

  return Math.max(0, year - parsedBirthYear);
}

function mapBirthdayRow(row, year) {
  const dataNascimento = normalizeDate(row.dataNascimento);
  const turma = text(row.turmaNome, text(row.turmaPrincipal, firstTextFromJson(row.turmasJson)));
  const unidade = text(
    row.unidadeNome,
    text(row.unidadePrincipal, text(row.turmaUnidade, firstTextFromJson(row.unidadesJson))),
  );

  return {
    id: String(row.id),
    nome: text(row.nome, "Aluno sem nome"),
    foto: extractPhotoUrl(row.fotoJson),
    dataNascimento,
    dataAniversario: buildBirthdayDate(dataNascimento, year),
    idade: calculateTurningAge(dataNascimento, year),
    turma: turma || "Sem turma",
    unidade: unidade || "Sem unidade",
    telefoneResponsavel: text(row.responsavelWhatsapp, text(row.telefoneResponsavelDireto)),
  };
}

function birthdaySortKey(student) {
  const [, month = "00", day = "00"] = student.dataAniversario.split("-");
  return `${month}-${day}-${student.nome.toLocaleLowerCase("pt-BR")}`;
}

function sortBirthdays(students) {
  return [...students].sort((left, right) =>
    birthdaySortKey(left).localeCompare(birthdaySortKey(right), "pt-BR"),
  );
}

async function fetchBirthdaysByDates(dates, year) {
  if (!dates.length) return [];

  const predicate = buildDatePredicate(dates);
  const rows = await query(
    `
      ${BASE_BIRTHDAY_SELECT}
      AND (${predicate.clause})
      ORDER BY MONTH(aluno.data_nascimento), DAYOFMONTH(aluno.data_nascimento), aluno.nome_completo
    `,
    predicate.params,
  );

  return sortBirthdays((Array.isArray(rows) ? rows : []).map((row) => mapBirthdayRow(row, year)));
}

async function fetchBirthdaysByMonth(month, year) {
  const rows = await query(
    `
      ${BASE_BIRTHDAY_SELECT}
      AND MONTH(aluno.data_nascimento) = ?
      ORDER BY DAYOFMONTH(aluno.data_nascimento), aluno.nome_completo
    `,
    [month],
  );

  return sortBirthdays((Array.isArray(rows) ? rows : []).map((row) => mapBirthdayRow(row, year)));
}

async function getDashboardBirthdays(now = new Date()) {
  const today = startOfDay(now);
  const weekStart = startOfCurrentWeek(today);
  const weekDates = enumerateDates(weekStart, 7);
  const year = today.getFullYear();

  const [todayBirthdays, weekBirthdays, monthBirthdays] = await Promise.all([
    fetchBirthdaysByDates([today], year),
    fetchBirthdaysByDates(weekDates, year),
    fetchBirthdaysByMonth(today.getMonth() + 1, year),
  ]);

  return {
    today: todayBirthdays,
    week: weekBirthdays,
    month: monthBirthdays,
  };
}

module.exports = {
  getDashboardBirthdays,
};
