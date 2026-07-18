/**
 * Application layer boundary for the Pessoas domain.
 *
 * This entrypoint is intentionally not imported by existing ERP modules in
 * Sprint 9.1. It exposes conceptual use cases, DTOs, contracts, interfaces and
 * event definitions for future integration.
 */
module.exports = Object.freeze({
  layer: "application",
  ...require("./contracts/index.js"),
  ...require("./dtos/index.js"),
  ...require("./events/index.js"),
  ...require("./interfaces/index.js"),
  ...require("./services/index.js"),
  ...require("./use-cases/index.js"),
});
