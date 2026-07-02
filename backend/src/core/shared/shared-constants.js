/**
 * Shared platform constants for future modules.
 *
 * These constants are intentionally generic and do not encode business rules.
 */
const SharedConstants = Object.freeze({
  DEFAULT_LOCALE: "pt-BR",
  DEFAULT_TIMEZONE: "America/Sao_Paulo",
  REQUEST_ID_HEADER: "x-request-id",
});

module.exports = {
  SharedConstants,
};
