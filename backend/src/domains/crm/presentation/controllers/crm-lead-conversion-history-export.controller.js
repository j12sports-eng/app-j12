const ALLOWED_FILTERS = new Set([
  "leadId",
  "unitId",
  "convertedBy",
  "enrollmentStatus",
  "dateFrom",
  "dateTo",
]);

class CrmLeadConversionHistoryExportController {
  constructor({ exportService } = {}) {
    this.exportService = exportService;
    this.export = this.export.bind(this);
  }

  async export(req, res) {
    try {
      const filters = readFilters(req.query);
      const result = await this.exportService.export(filters, {
        correlationId: req.correlationId,
        userId: req.auth?.id || req.user?.id || null,
      });
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Length", result.buffer.length);
      res.setHeader("X-CRM-Export-Rows", String(result.rows));
      return res.status(200).send(result.buffer);
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      const code =
        error?.code === "CRM_EXPORT_INPUT_INVALID"
          ? error.code
          : error?.code === "CRM_EXPORT_LIMIT_EXCEEDED"
            ? error.code
            : "CRM_EXPORT_FAILED";
      return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
        code,
        success: false,
        error:
          code === "CRM_EXPORT_LIMIT_EXCEEDED"
            ? "O resultado excede o limite de exportação."
            : code === "CRM_EXPORT_INPUT_INVALID"
              ? "Parâmetros de exportação inválidos."
              : "Não foi possível exportar o histórico.",
      });
    }
  }
}

function readFilters(query) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw inputError();
  }
  const unknown = Object.keys(query).filter((key) => !ALLOWED_FILTERS.has(key));
  if (unknown.length) throw inputError();
  const filters = {};
  for (const key of ALLOWED_FILTERS) {
    if (query[key] == null || query[key] === "") continue;
    if (Array.isArray(query[key]) || typeof query[key] !== "string") throw inputError();
    filters[key] = query[key];
  }
  return filters;
}

function inputError() {
  return Object.assign(new Error("CRM export input is invalid."), {
    code: "CRM_EXPORT_INPUT_INVALID",
    expose: true,
    statusCode: 400,
  });
}

module.exports = {
  ALLOWED_FILTERS,
  CrmLeadConversionHistoryExportController,
  readFilters,
};
