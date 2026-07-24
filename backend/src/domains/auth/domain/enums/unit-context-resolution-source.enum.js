const UnitContextResolutionSource = Object.freeze({
  DEFAULT_MEMBERSHIP: "DEFAULT_MEMBERSHIP",
  EXPLICIT_REQUEST: "EXPLICIT_REQUEST",
  RESOURCE_DERIVED: "RESOURCE_DERIVED",
  SINGLE_ACTIVE_MEMBERSHIP: "SINGLE_ACTIVE_MEMBERSHIP",
});

const UNIT_CONTEXT_RESOLUTION_SOURCE_VALUES = Object.freeze(
  Object.values(UnitContextResolutionSource),
);

function normalizeUnitContextResolutionSource(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return UNIT_CONTEXT_RESOLUTION_SOURCE_VALUES.includes(normalized) ? normalized : null;
}

function assertUnitContextResolutionSource(value) {
  const source = normalizeUnitContextResolutionSource(value);
  if (!source) {
    throw new TypeError("UnitContext resolvedBy is not supported.");
  }
  return source;
}

module.exports = {
  UNIT_CONTEXT_RESOLUTION_SOURCE_VALUES,
  UnitContextResolutionSource,
  assertUnitContextResolutionSource,
  normalizeUnitContextResolutionSource,
};
