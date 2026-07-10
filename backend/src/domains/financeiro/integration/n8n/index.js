/**
 * Isolated n8n integration boundary.
 *
 * No runtime route, controller or real transport is mounted in Sprint 20.8.
 */
module.exports = Object.freeze({
  ...require("./adapters/index.js"),
  ...require("./contracts/index.js"),
  ...require("./services/index.js"),
});
