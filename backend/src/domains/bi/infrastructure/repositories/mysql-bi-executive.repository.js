const { BiReadRepositoryContract } = require("../../application/index.js");
const { EnrollmentStatus } = require("../../../enrollments/domain/enums/enrollment-status.enum.js");
const {
  InterPaymentStatus,
} = require("../../../financeiro/inter/entities/inter-payment.entity.js");

const ENROLLMENT_EXECUTIVE_SQL = `
  SELECT
    COUNT(DISTINCT CASE
      WHEN e.status = ? THEN e.student_person_id END
    ) AS active_students,
    COUNT(DISTINCT CASE
      WHEN e.confirmed_at >= ? AND e.confirmed_at < DATE_ADD(?, INTERVAL 1 DAY)
      THEN e.id END
    ) AS new_students,
    COUNT(DISTINCT CASE
      WHEN e.confirmed_at >= ? AND e.confirmed_at < DATE_ADD(?, INTERVAL 1 DAY)
      THEN e.id END
    ) AS previous_new_students,
  FROM enrollments e
  WHERE e.deleted_at IS NULL
    AND (
      ? IS NULL OR EXISTS (
        SELECT 1
        FROM enrollment_class_links ecl
        INNER JOIN j12_turmas turma ON turma.id = ecl.class_id
        WHERE ecl.enrollment_id = e.id
          AND CAST(turma.unidade_id AS CHAR) = ?
      )
    )
`;

const FINANCIAL_EXECUTIVE_SQL = `
  SELECT
    COALESCE(SUM(CASE
      WHEN LOWER(c.status) = ?
        AND COALESCE(c.data_pagamento, c.pago_em) BETWEEN ? AND ?
      THEN COALESCE(c.valor_final, c.valor, 0) ELSE 0 END), 0
    ) AS received_revenue,
    COALESCE(SUM(CASE
      WHEN c.vencimento BETWEEN ? AND ? AND LOWER(c.status) <> ?
      THEN COALESCE(c.valor_final, c.valor, 0) ELSE 0 END), 0
    ) AS expected_revenue,
    COALESCE(SUM(CASE
      WHEN c.vencimento BETWEEN ? AND ? AND LOWER(c.status) = ?
      THEN COALESCE(c.valor_final, c.valor, 0) ELSE 0 END), 0
    ) AS overdue_revenue,
    COUNT(DISTINCT CASE
      WHEN LOWER(c.status) = ?
        AND COALESCE(c.data_pagamento, c.pago_em) BETWEEN ? AND ?
      THEN c.aluno_id END
    ) AS paying_students,
    COALESCE(SUM(CASE
      WHEN LOWER(c.status) = ?
        AND COALESCE(c.data_pagamento, c.pago_em) BETWEEN ? AND ?
      THEN COALESCE(c.valor_final, c.valor, 0) ELSE 0 END), 0
    ) AS previous_received_revenue,
    COALESCE(SUM(CASE
      WHEN c.vencimento BETWEEN ? AND ? AND LOWER(c.status) <> ?
      THEN COALESCE(c.valor_final, c.valor, 0) ELSE 0 END), 0
    ) AS previous_expected_revenue,
    COALESCE(SUM(CASE
      WHEN c.vencimento BETWEEN ? AND ? AND LOWER(c.status) = ?
      THEN COALESCE(c.valor_final, c.valor, 0) ELSE 0 END), 0
    ) AS previous_overdue_revenue,
    COUNT(DISTINCT CASE
      WHEN LOWER(c.status) = ?
        AND COALESCE(c.data_pagamento, c.pago_em) BETWEEN ? AND ?
      THEN c.aluno_id END
    ) AS previous_paying_students
  FROM j12_financeiro_cobrancas c
  WHERE c.ativo = 1
    AND LOWER(c.tipo) NOT IN ('despesa', 'expense')
    AND (
      ? IS NULL OR EXISTS (
        SELECT 1 FROM j12_unidades unidade
        WHERE CAST(unidade.id AS CHAR) = ?
          AND (unidade.nome = c.unidade OR CAST(unidade.id AS CHAR) = c.unidade)
      )
    )
`;

class MySqlBiExecutiveRepository extends BiReadRepositoryContract {
  constructor(options = {}) {
    super();
    this.query = options.queryRunner || getDefaultQueryRunner();
  }

  async getExecutiveSnapshot({ current, previous }) {
    const [enrollmentResult, financialResult] = await Promise.all([
      this.query(ENROLLMENT_EXECUTIVE_SQL, enrollmentParams(current, previous)),
      this.query(FINANCIAL_EXECUTIVE_SQL, financialParams(current, previous)),
    ]);
    const enrollment = readRows(enrollmentResult)[0] || {};
    const financial = readRows(financialResult)[0] || {};
    return {
      current: {
        activeStudents: numeric(enrollment.active_students),
        expectedRevenue: numeric(financial.expected_revenue),
        newStudents: numeric(enrollment.new_students),
        overdueRevenue: numeric(financial.overdue_revenue),
        payingStudents: numeric(financial.paying_students),
        receivedRevenue: numeric(financial.received_revenue),
      },
      previous: {
        expectedRevenue: numeric(financial.previous_expected_revenue),
        newStudents: numeric(enrollment.previous_new_students),
        overdueRevenue: numeric(financial.previous_overdue_revenue),
        payingStudents: numeric(financial.previous_paying_students),
        receivedRevenue: numeric(financial.previous_received_revenue),
      },
    };
  }
}

function enrollmentParams(current, previous) {
  return [
    EnrollmentStatus.ACTIVE,
    current.startDate,
    current.endDate,
    previous.startDate,
    previous.endDate,
    current.unitId,
    current.unitId,
  ];
}

function financialParams(current, previous) {
  const paid = InterPaymentStatus.PAID.toLowerCase();
  const cancelled = InterPaymentStatus.CANCELLED.toLowerCase();
  return [
    paid,
    current.startDate,
    current.endDate,
    current.startDate,
    current.endDate,
    cancelled,
    current.startDate,
    current.endDate,
    "atrasado",
    paid,
    current.startDate,
    current.endDate,
    paid,
    previous.startDate,
    previous.endDate,
    previous.startDate,
    previous.endDate,
    cancelled,
    previous.startDate,
    previous.endDate,
    "atrasado",
    paid,
    previous.startDate,
    previous.endDate,
    current.unitId,
    current.unitId,
  ];
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readRows(result) {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? result[0] : result;
}

function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

module.exports = {
  ENROLLMENT_EXECUTIVE_SQL,
  FINANCIAL_EXECUTIVE_SQL,
  MySqlBiExecutiveRepository,
  enrollmentParams,
  financialParams,
};
