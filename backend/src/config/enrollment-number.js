"use strict";

const MIN_ENROLLMENT_SEQUENCE = 1;
const MAX_ENROLLMENT_SEQUENCE = 999999;
const PUBLIC_ENROLLMENT_NUMBER_PATTERN = /^(\d{8})-([1-9]\d*)$/u;
const ENROLLMENT_NUMBER_KINDS = Object.freeze({
  MODERN: "MODERN",
  HISTORICAL_NUMERIC: "HISTORICAL_NUMERIC",
  INVALID: "INVALID",
});
const ENROLLMENT_REGISTRY_STATE_SQL = `
  SELECT
    registry.numero,
    registry.status,
    registry.aluno_id AS alunoId,
    aluno.numero_matricula AS numeroMatricula
  FROM j12_matricula_numeros registry
  LEFT JOIN j12_alunos aluno ON aluno.id = registry.aluno_id
  WHERE registry.numero BETWEEN ? AND ?
`;

function createEnrollmentNumberError(code, message, statusCode = 500) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normalizeEffectiveEnrollmentDate(value) {
  let datePart = "";

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    datePart = value.toISOString().slice(0, 10);
  } else {
    const match = String(value ?? "")
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})$/u);
    if (!match) return null;
    datePart = `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== datePart) {
    return null;
  }

  return datePart;
}

function parseSequenceDigits(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/u.test(raw)) return null;

  const sequence = Number(raw);
  if (
    !Number.isSafeInteger(sequence) ||
    sequence < MIN_ENROLLMENT_SEQUENCE ||
    sequence > MAX_ENROLLMENT_SEQUENCE
  ) {
    return null;
  }

  return sequence;
}

function classifyEnrollmentNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { kind: ENROLLMENT_NUMBER_KINDS.INVALID, raw, sequence: null };

  const publicMatch = raw.match(PUBLIC_ENROLLMENT_NUMBER_PATTERN);
  if (publicMatch) {
    const compactDate = publicMatch[1];
    const effectiveDate = normalizeEffectiveEnrollmentDate(
      `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`,
    );
    const sequence = parseSequenceDigits(publicMatch[2]);
    if (effectiveDate && sequence !== null) {
      return { kind: ENROLLMENT_NUMBER_KINDS.MODERN, raw, sequence };
    }
  }

  const historicalIdentifier = parseSequenceDigits(raw);
  if (historicalIdentifier !== null) {
    return {
      kind: ENROLLMENT_NUMBER_KINDS.HISTORICAL_NUMERIC,
      raw,
      sequence: null,
      historicalIdentifier,
    };
  }

  return { kind: ENROLLMENT_NUMBER_KINDS.INVALID, raw, sequence: null };
}

function extractEnrollmentSequence(value, options = {}) {
  const classification = classifyEnrollmentNumber(value);
  if (classification.kind === ENROLLMENT_NUMBER_KINDS.MODERN) {
    return classification.sequence;
  }

  if (
    options.allowLegacyNumericSequence === true &&
    classification.kind === ENROLLMENT_NUMBER_KINDS.HISTORICAL_NUMERIC
  ) {
    return classification.historicalIdentifier;
  }

  return null;
}

function extractLegacyRegistrySequence(value) {
  return extractEnrollmentSequence(value, { allowLegacyNumericSequence: true });
}

function partitionEnrollmentRowsForRegistry(rows = []) {
  const partition = {
    modernRows: [],
    historicalRows: [],
    invalidRows: [],
  };

  for (const row of rows) {
    const classification = classifyEnrollmentNumber(row?.numero_matricula);
    if (classification.kind === ENROLLMENT_NUMBER_KINDS.MODERN) {
      partition.modernRows.push({ row, sequence: classification.sequence });
    } else if (classification.kind === ENROLLMENT_NUMBER_KINDS.HISTORICAL_NUMERIC) {
      partition.historicalRows.push(row);
    } else {
      partition.invalidRows.push(row);
    }
  }

  return partition;
}

function formatEnrollmentNumber(sequence, effectiveDate) {
  const normalizedSequence = extractLegacyRegistrySequence(sequence);
  if (normalizedSequence === null) {
    throw createEnrollmentNumberError(
      "ENROLLMENT_SEQUENCE_INVALID",
      "Sequencia de matricula invalida.",
      400,
    );
  }

  const normalizedDate = normalizeEffectiveEnrollmentDate(effectiveDate);
  if (!normalizedDate) {
    throw createEnrollmentNumberError(
      "ENROLLMENT_DATE_INVALID",
      "Data efetiva da matricula invalida.",
      400,
    );
  }

  return `${normalizedDate.replace(/-/gu, "")}-${normalizedSequence}`;
}

function ensureNextEnrollmentSequence(currentSequence) {
  const normalizedCurrent = extractLegacyRegistrySequence(currentSequence);
  if (normalizedCurrent === null || normalizedCurrent >= MAX_ENROLLMENT_SEQUENCE) {
    throw createEnrollmentNumberError(
      "ENROLLMENT_SEQUENCE_STATE_UNTRUSTED",
      "Nao foi possivel determinar a proxima sequencia de matricula com seguranca.",
      503,
    );
  }

  return normalizedCurrent + 1;
}

function isModernEnrollmentRegistryRow(row) {
  const registrySequence = extractLegacyRegistrySequence(row?.numero);
  if (registrySequence === null) return false;

  const publicSequence = extractEnrollmentSequence(row?.numeroMatricula ?? row?.numero_matricula);
  if (publicSequence !== null) return publicSequence === registrySequence;

  const alunoId = String(row?.alunoId ?? row?.aluno_id ?? "").trim();
  return (
    !alunoId &&
    String(row?.status ?? "")
      .trim()
      .toLowerCase() === "reservado"
  );
}

function getModernEnrollmentRegistryState(registryRows = []) {
  const modernRows = registryRows.filter(isModernEnrollmentRegistryRow);
  const reusableRows = modernRows
    .filter((row) => row.status === "inativo" || row.status === "excluido")
    .sort((left, right) => Number(left.numero) - Number(right.numero));
  const maxSequence = modernRows.reduce(
    (maximum, row) => Math.max(maximum, extractLegacyRegistrySequence(row.numero)),
    0,
  );

  return {
    modernRows,
    reusableRows,
    maxSequence: maxSequence || null,
  };
}

function buildEnrollmentNumberPreview({ registryRows = [], effectiveDate }) {
  const { reusableRows, maxSequence } = getModernEnrollmentRegistryState(registryRows);
  const reusable = reusableRows[0];

  if (reusable) {
    const sequence = extractLegacyRegistrySequence(reusable.numero);
    return {
      numeroMatricula: formatEnrollmentNumber(sequence, effectiveDate),
      sequence,
      strategy: "reused",
      reusedFrom: reusable.status,
    };
  }

  const sequence = ensureNextEnrollmentSequence(maxSequence);
  return {
    numeroMatricula: formatEnrollmentNumber(sequence, effectiveDate),
    sequence,
    strategy: "sequential",
    reusedFrom: null,
  };
}

async function allocateEnrollmentSequence(connection) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [registryRows] = await connection.execute(`${ENROLLMENT_REGISTRY_STATE_SQL} FOR UPDATE`, [
      MIN_ENROLLMENT_SEQUENCE,
      MAX_ENROLLMENT_SEQUENCE,
    ]);
    const { reusableRows, maxSequence } = getModernEnrollmentRegistryState(registryRows);

    if (Array.isArray(reusableRows) && reusableRows.length > 0) {
      const candidate = extractLegacyRegistrySequence(reusableRows[0].numero);
      if (candidate === null) {
        throw createEnrollmentNumberError(
          "ENROLLMENT_SEQUENCE_STATE_UNTRUSTED",
          "O registro de sequencias reutilizaveis esta inconsistente.",
          503,
        );
      }

      const [updateResult] = await connection.execute(
        `
          UPDATE j12_matricula_numeros
          SET
            aluno_id = NULL,
            aluno_nome = NULL,
            status = 'reservado',
            last_assigned_at = CURRENT_TIMESTAMP,
            released_at = NULL
          WHERE numero = ?
            AND status IN ('inativo', 'excluido')
        `,
        [candidate],
      );

      if (updateResult?.affectedRows === 1) {
        return {
          sequence: candidate,
          strategy: "reused",
          reusedFrom: reusableRows[0].status,
        };
      }

      continue;
    }

    const candidate = ensureNextEnrollmentSequence(maxSequence);

    try {
      await connection.execute(
        `
          INSERT INTO j12_matricula_numeros (
            numero,
            aluno_id,
            aluno_nome,
            status,
            last_assigned_at,
            released_at
          ) VALUES (?, NULL, NULL, 'reservado', CURRENT_TIMESTAMP, NULL)
        `,
        [candidate],
      );

      return {
        sequence: candidate,
        strategy: "sequential",
        reusedFrom: null,
      };
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        continue;
      }

      throw error;
    }
  }

  throw createEnrollmentNumberError(
    "ENROLLMENT_SEQUENCE_RESERVATION_FAILED",
    "Nao foi possivel reservar a proxima sequencia de matricula.",
    503,
  );
}

module.exports = {
  ENROLLMENT_NUMBER_KINDS,
  ENROLLMENT_REGISTRY_STATE_SQL,
  MIN_ENROLLMENT_SEQUENCE,
  MAX_ENROLLMENT_SEQUENCE,
  allocateEnrollmentSequence,
  buildEnrollmentNumberPreview,
  classifyEnrollmentNumber,
  createEnrollmentNumberError,
  extractEnrollmentSequence,
  extractLegacyRegistrySequence,
  formatEnrollmentNumber,
  getModernEnrollmentRegistryState,
  isModernEnrollmentRegistryRow,
  normalizeEffectiveEnrollmentDate,
  partitionEnrollmentRowsForRegistry,
};
