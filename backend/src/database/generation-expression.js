"use strict";

/**
 * Canonicalize generated-column expressions for structural comparison.
 *
 * MySQL 5.7 serializes `column IS NULL` as `isnull(column)` in
 * INFORMATION_SCHEMA. Keep this rewrite intentionally limited to a simple
 * identifier so unrelated functions and genuinely different expressions
 * remain distinguishable.
 */
function normalizeGenerationExpression(value) {
  return String(value || "")
    .replace(/isnull\(\s*`?([a-z0-9_]+)`?\s*\)/giu, "$1 IS NULL")
    .replace(/[`'()\s]/gu, "")
    .toLowerCase();
}

module.exports = { normalizeGenerationExpression };
