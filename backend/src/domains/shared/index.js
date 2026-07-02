/**
 * Domain boundary for Shared.
 *
 * This entrypoint intentionally exposes no business logic. It exists only to
 * reserve shared domain space without changing current runtime imports.
 */
module.exports = Object.freeze({
  domain: "shared",
});
