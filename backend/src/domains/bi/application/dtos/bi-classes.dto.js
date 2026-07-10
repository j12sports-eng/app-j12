const ACTIVE_STATUSES = new Set(["ativa", "ativo", "active"]);

function createBiClassesDto({ analytics = {}, filters, generatedAt }) {
  const classes = analytics.classes || [];
  const rows = classes.map(classRow);
  const active = rows.filter((row) => row.active);
  const valid = active.filter((row) => row.capacityValid);
  const totalCapacity = sum(valid, "capacity");
  const enrolledStudents = count(analytics.enrolledStudents);
  const validOccupancy = sum(valid, "occupancy");
  return Object.freeze({
    contractVersion: "21.5",
    dimensions: Object.freeze({
      categories: unavailable("NO_CANONICAL_CLASS_CATEGORY"),
      daysOfWeek: available(
        group(active.flatMap((row) => row.daysOfWeek.map((key) => ({ key, row })))),
      ),
      modalities: available(group(active.map((row) => ({ key: row.modality, row })))),
      schedules: available(group(active.map((row) => ({ key: row.startTime, row })))),
      units: available(group(active.map((row) => ({ key: row.unit, row })))),
    }),
    filters,
    generatedAt,
    kpis: Object.freeze({
      activeClasses: metric(active.length, "count"),
      availableSpots: metric(sum(valid, "availableSpots"), "count"),
      enrolledStudents: metric(enrolledStudents, "count"),
      fullClasses: metric(valid.filter((row) => row.full).length, "count"),
      occupancyRate:
        totalCapacity > 0
          ? metric(percent(validOccupancy, totalCapacity), "percentage")
          : unavailableMetric("percentage", "NO_VALID_CAPACITY"),
      totalCapacity: valid.length
        ? metric(totalCapacity, "count")
        : unavailableMetric("count", "NO_VALID_CAPACITY"),
      underutilizedClasses: metric(valid.filter((row) => row.underutilized).length, "count"),
    }),
    readOnly: true,
    table: Object.freeze(rows),
  });
}

function classRow(input) {
  const capacity = optionalCount(input.capacity);
  const occupancy = count(input.occupancy);
  const capacityValid = capacity !== null && capacity > 0;
  const occupancyRate = capacityValid ? percent(occupancy, capacity) : null;
  return Object.freeze({
    active: ACTIVE_STATUSES.has(String(input.status || "").toLowerCase()),
    availableSpots: capacityValid ? Math.max(capacity - occupancy, 0) : null,
    capacity,
    capacityValid,
    classId: text(input.classId),
    className: text(input.className) || "Turma sem nome",
    daysOfWeek: Object.freeze(input.daysOfWeek || []),
    endTime: input.endTime || null,
    full: capacityValid ? occupancy >= capacity : false,
    modality: input.modality || "nao_informado",
    occupancy,
    occupancyRate,
    professorName: input.professorName || null,
    startTime: input.startTime || null,
    status: input.status || null,
    underutilized: capacityValid ? occupancyRate < 50 : false,
    unit: input.unit || "nao_informado",
  });
}
function group(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.key || "nao_informado";
    const current = groups.get(key) || { capacity: 0, classes: 0, occupancy: 0 };
    current.capacity += item.row.capacityValid ? item.row.capacity : 0;
    current.classes += 1;
    current.occupancy += item.row.occupancy;
    groups.set(key, current);
  }
  return [...groups].map(([key, value]) =>
    Object.freeze({
      key,
      ...value,
      occupancyRate: value.capacity > 0 ? percent(value.occupancy, value.capacity) : null,
    }),
  );
}
function available(items) {
  return Object.freeze({ available: true, items: Object.freeze(items), reason: null });
}
function unavailable(reason) {
  return Object.freeze({ available: false, items: null, reason });
}
function metric(value, unit) {
  return Object.freeze({ available: true, reason: null, unit, value });
}
function unavailableMetric(unit, reason) {
  return Object.freeze({ available: false, reason, unit, value: null });
}
function sum(rows, field) {
  return rows.reduce((total, row) => total + (row[field] || 0), 0);
}
function percent(value, capacity) {
  return Number(((value / capacity) * 100).toFixed(2));
}
function count(value) {
  return optionalCount(value) ?? 0;
}
function optionalCount(value) {
  const parsed = Number(value);
  return value != null && value !== "" && Number.isFinite(parsed) && parsed >= 0
    ? Math.trunc(parsed)
    : null;
}
function text(value) {
  return value == null ? "" : String(value);
}

module.exports = { createBiClassesDto };
