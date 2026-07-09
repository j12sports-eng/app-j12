const { FinancialFacade } = require("../../application/facades/financial.facade.js");

const FINANCIAL_ADMIN_INPUT_REQUIRED_CODE = "FINANCIAL_ADMIN_INPUT_REQUIRED";
const FINANCIAL_ADMIN_ERROR_CODE = "FINANCIAL_ADMIN_ERROR";
const FINANCIAL_ADMIN_SEARCH_QUERY_REQUIRED_CODE = "FINANCIAL_ADMIN_SEARCH_QUERY_REQUIRED";

const CONTROLLED_ERROR_STATUS_BY_CODE = Object.freeze({
  FINANCIAL_ADMIN_INPUT_REQUIRED: 400,
  FINANCIAL_ADMIN_SEARCH_QUERY_REQUIRED: 400,
  FINANCIAL_OBLIGATION_INPUT_REQUIRED: 400,
  FINANCIAL_OBLIGATION_INVALID_STATUS_TRANSITION: 409,
  FINANCIAL_OBLIGATION_NOT_FOUND: 404,
  FINANCIAL_STUDENT_SCOPE_SEARCH_INPUT_REQUIRED: 400,
});

/**
 * Administrative Financeiro controller for Enrollment-originated obligations.
 *
 * This boundary calls only FinancialFacade. It does not access repositories,
 * SQL, Prisma, legacy finance tables, gateways or private services.
 */
class FinancialAdminController {
  /**
   * @param {Object} [options]
   * @param {FinancialFacade} [options.financialFacade]
   * @param {FinancialFacade} [options.facade]
   */
  constructor(options = {}) {
    this.financialFacade =
      options.financialFacade || options.facade || new FinancialFacade(options);

    this.listEnrollmentObligations = this.listEnrollmentObligations.bind(this);
    this.searchStudentScopes = this.searchStudentScopes.bind(this);
    this.getStudentSummary = this.getStudentSummary.bind(this);
    this.markPaid = this.markPaid.bind(this);
    this.cancel = this.cancel.bind(this);
    this.markOverdue = this.markOverdue.bind(this);
  }

  /**
   * GET /admin/financial/students/search
   */
  async searchStudentScopes(req, res, next) {
    try {
      const input = readStudentScopeSearchInput(req);
      const validation = validateStudentScopeSearch(input);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().searchFinancialStudentScopes(input);
      return sendSuccess(res, data);
    } catch (error) {
      return handleFinancialAdminError(error, res, next);
    }
  }

  /**
   * GET /admin/financial/enrollments/:enrollmentId/obligations
   */
  async listEnrollmentObligations(req, res, next) {
    try {
      const input = readEnrollmentObligationsInput(req);
      const validation = validateRequired(input, ["enrollmentId"]);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().listEnrollmentFinancialObligations(input);
      return sendSuccess(res, data);
    } catch (error) {
      return handleFinancialAdminError(error, res, next);
    }
  }

  /**
   * GET /admin/financial/students/:studentPersonId/:studentProfileId/summary
   */
  async getStudentSummary(req, res, next) {
    try {
      const input = readStudentSummaryInput(req);
      const validation = validateRequired(input, ["studentPersonId", "studentProfileId"]);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().getStudentFinancialSummary(input);
      return sendSuccess(res, data);
    } catch (error) {
      return handleFinancialAdminError(error, res, next);
    }
  }

  /**
   * POST /admin/financial/obligations/:obligationId/mark-paid
   */
  async markPaid(req, res, next) {
    try {
      const data = await this.getFacade().markEnrollmentFinancialObligationAsPaid(
        readMarkPaidInput(req),
      );
      return sendSuccess(res, data);
    } catch (error) {
      return handleFinancialAdminError(error, res, next);
    }
  }

  /**
   * POST /admin/financial/obligations/:obligationId/cancel
   */
  async cancel(req, res, next) {
    try {
      const data = await this.getFacade().cancelEnrollmentFinancialObligation(readCancelInput(req));
      return sendSuccess(res, data);
    } catch (error) {
      return handleFinancialAdminError(error, res, next);
    }
  }

  /**
   * POST /admin/financial/obligations/:obligationId/mark-overdue
   */
  async markOverdue(req, res, next) {
    try {
      const data = await this.getFacade().markEnrollmentFinancialObligationAsOverdue(
        readMarkOverdueInput(req),
      );
      return sendSuccess(res, data);
    } catch (error) {
      return handleFinancialAdminError(error, res, next);
    }
  }

  /**
   * @returns {FinancialFacade}
   */
  getFacade() {
    const facade = this.financialFacade;

    if (!facade || typeof facade !== "object") {
      throw new TypeError("FinancialAdminController requires FinancialFacade.");
    }

    return facade;
  }
}

function readEnrollmentObligationsInput(req = {}) {
  const params = readObject(req.params);
  const query = readObject(req.query);

  return {
    enrollmentId: nullableText(params.enrollmentId ?? query.enrollmentId, 64),
    limit: normalizeLimit(query.limit, 100),
  };
}

function readStudentSummaryInput(req = {}) {
  const params = readObject(req.params);
  const query = readObject(req.query);

  return {
    limit: normalizeLimit(query.limit, 250),
    studentPersonId: nullableText(params.studentPersonId ?? query.studentPersonId, 64),
    studentProfileId: nullableText(params.studentProfileId ?? query.studentProfileId, 64),
  };
}

function readStudentScopeSearchInput(req = {}) {
  const query = readObject(req.query);

  return {
    limit: normalizeLimit(query.limit, 25),
    query: nullableText(query.q ?? query.query ?? query.search, 100),
  };
}

function readMarkPaidInput(req = {}) {
  const params = readObject(req.params);
  const body = readObject(req.body);

  return {
    obligationId: nullableText(params.obligationId ?? body.obligationId, 64),
    paidAt: nullableText(body.paidAt ?? body.paid_at, 19),
    paidBy: nullableText(body.paidBy ?? body.paid_by ?? readActor(req), 191),
    paymentReference: nullableText(body.paymentReference ?? body.payment_reference, 191),
  };
}

function readCancelInput(req = {}) {
  const params = readObject(req.params);
  const body = readObject(req.body);

  return {
    cancelledAt: nullableText(body.cancelledAt ?? body.cancelled_at, 19),
    cancelledBy: nullableText(body.cancelledBy ?? body.cancelled_by ?? readActor(req), 191),
    obligationId: nullableText(params.obligationId ?? body.obligationId, 64),
    reason: nullableText(body.reason ?? body.motivo, 191),
  };
}

function readMarkOverdueInput(req = {}) {
  const params = readObject(req.params);
  const body = readObject(req.body);

  return {
    checkedAt: nullableText(body.checkedAt ?? body.checked_at, 19),
    obligationId: nullableText(params.obligationId ?? body.obligationId, 64),
  };
}

function readActor(req = {}) {
  const user = req?.auth || req?.user || {};
  return user.email || user.login || user.username || user.id || null;
}

function validateRequired(input = {}, fields = []) {
  const missingFields = fields.filter((field) => !nullableText(input[field], 191));

  return {
    code: FINANCIAL_ADMIN_INPUT_REQUIRED_CODE,
    message: `${fields.join(" and ")} are required.`,
    missingFields,
    valid: missingFields.length === 0,
  };
}

function validateStudentScopeSearch(input = {}) {
  const query = nullableText(input.query, 100);

  if (!query || query.length < 2) {
    return {
      code: FINANCIAL_ADMIN_SEARCH_QUERY_REQUIRED_CODE,
      message: "Informe ao menos 2 caracteres para buscar aluno.",
      missingFields: ["query"],
      valid: false,
    };
  }

  return {
    code: FINANCIAL_ADMIN_SEARCH_QUERY_REQUIRED_CODE,
    message: "",
    missingFields: [],
    valid: true,
  };
}

function successEnvelope(data) {
  return {
    data,
    success: true,
  };
}

function sendSuccess(res, data) {
  return res.json(successEnvelope(data));
}

function sendBadRequest(res, validation) {
  return res.status(400).json({
    code: validation.code,
    error: validation.message,
    missingFields: validation.missingFields || [],
    success: false,
  });
}

function handleFinancialAdminError(error, res, next) {
  const code = nullableText(error?.code, 100);

  if (code && CONTROLLED_ERROR_STATUS_BY_CODE[code]) {
    return res.status(CONTROLLED_ERROR_STATUS_BY_CODE[code]).json({
      code,
      error: error instanceof Error ? error.message : String(error ?? "Financial error."),
      success: false,
    });
  }

  return next(error);
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeLimit(value, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(50, max);
  }

  return Math.min(Math.trunc(parsed), max);
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  CONTROLLED_ERROR_STATUS_BY_CODE,
  FINANCIAL_ADMIN_ERROR_CODE,
  FINANCIAL_ADMIN_INPUT_REQUIRED_CODE,
  FINANCIAL_ADMIN_SEARCH_QUERY_REQUIRED_CODE,
  FinancialAdminController,
  handleFinancialAdminError,
  nullableText,
  normalizeLimit,
  readCancelInput,
  readEnrollmentObligationsInput,
  readMarkOverdueInput,
  readMarkPaidInput,
  readStudentSummaryInput,
  readStudentScopeSearchInput,
  successEnvelope,
  validateStudentScopeSearch,
  validateRequired,
};
