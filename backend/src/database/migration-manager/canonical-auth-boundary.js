"use strict";

const LEGACY_AUTH_TABLE_PATTERN = /\bj12_usuarios\b/iu;
const CANONICAL_REPOSITORY_PATH_PATTERN =
  /^backend\/src\/domains\/[^/]+\/infrastructure\/repositories\/.*\.js$/u;

function findCanonicalLegacyAuthDependencies(files = []) {
  return files
    .filter((file) => CANONICAL_REPOSITORY_PATH_PATTERN.test(normalizePath(file.path)))
    .filter((file) => LEGACY_AUTH_TABLE_PATTERN.test(String(file.content || "")))
    .map((file) => normalizePath(file.path))
    .sort();
}

function assertCanonicalAuthBoundary(files = []) {
  const violations = findCanonicalLegacyAuthDependencies(files);
  if (violations.length > 0) {
    const error = new Error(
      "Canonical repositories must use auth_identities/source adapters instead of j12_usuarios.",
    );
    error.code = "CANONICAL_REPOSITORY_DEPENDS_ON_LEGACY_AUTH";
    error.violations = violations;
    throw error;
  }
  return {
    classification: "COMPATIBILITY_BOUNDARY",
    forbiddenTable: "j12_usuarios",
    violations,
  };
}

function normalizePath(value) {
  return String(value || "").replace(/\\/gu, "/").replace(/^\.\//u, "");
}

module.exports = {
  CANONICAL_REPOSITORY_PATH_PATTERN,
  LEGACY_AUTH_TABLE_PATTERN,
  assertCanonicalAuthBoundary,
  findCanonicalLegacyAuthDependencies,
  normalizePath,
};
