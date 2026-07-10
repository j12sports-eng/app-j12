const ACTIVE = new Set(["PUBLISHED"]);
const COMPLETED = new Set(["ARCHIVED"]);
const VALID_REGISTRATION = new Set(["CONFIRMED"]);
const FINISHED_MATCH = new Set(["FINISHED"]);
const PENDING_MATCH = new Set(["SCHEDULED", "POSTPONED"]);

function createBiChampionshipsDto({ analytics = {}, filters, generatedAt }) {
  const championships = analytics.championships || [];
  const registrations = analytics.registrations || [];
  const matches = analytics.matches || [];
  const confirmed = registrations.filter((item) => VALID_REGISTRATION.has(item.status));
  const uniqueTeams = new Set(confirmed.map((item) => item.team_id));
  const active = championships.filter((item) => ACTIVE.has(item.status));
  const completed = championships.filter((item) => COMPLETED.has(item.status));
  return Object.freeze({
    contractVersion: "21.8",
    filters,
    generatedAt,
    kpis: Object.freeze({
      activeChampionships: metric(active.length, "count"),
      averageTeams: championships.length
        ? metric(round(uniqueTeams.size / championships.length), "average")
        : unavailable("average", "NO_CHAMPIONSHIPS"),
      completedChampionships: metric(completed.length, "count"),
      finishedMatches: metric(
        matches.filter((item) => FINISHED_MATCH.has(item.status)).length,
        "count",
      ),
      participants: metric(Number(analytics.participants || 0), "count"),
      pendingMatches: metric(
        matches.filter((item) => PENDING_MATCH.has(item.status)).length,
        "count",
      ),
      registrationRevenue: unavailable("currency", "NO_CANONICAL_REGISTRATION_REVENUE"),
      registrations: metric(confirmed.length, "count"),
      teams: metric(uniqueTeams.size, "count"),
    }),
    rankings: Object.freeze({
      categories: Object.freeze(group(championships, (item) => item.category, "championships")),
      championships: Object.freeze(
        championships.map((item) => championshipRank(item, confirmed, matches)),
      ),
      registrationEvolution: Object.freeze(
        group(confirmed, (item) => dateKey(item.created_at), "registrations"),
      ),
      statuses: Object.freeze(group(championships, (item) => item.status, "championships")),
    }),
    readOnly: true,
  });
}
function championshipRank(championship, registrations, matches) {
  const scoped = registrations.filter((item) => item.championship_id === championship.id);
  return Object.freeze({
    category: championship.category,
    championshipId: String(championship.id),
    championshipName: championship.name,
    finishedMatches: matches.filter(
      (item) => item.championship_id === championship.id && FINISHED_MATCH.has(item.status),
    ).length,
    participants: null,
    registrations: scoped.length,
    status: championship.status,
    teams: new Set(scoped.map((item) => item.team_id)).size,
  });
}
function group(items, key, field) {
  const values = new Map();
  for (const item of items) {
    const label = String(key(item) || "nao_informado");
    values.set(label, (values.get(label) || 0) + 1);
  }
  return [...values.entries()].map(([keyValue, value]) =>
    Object.freeze({ key: keyValue, [field]: value }),
  );
}
function dateKey(value) {
  return String(value || "").slice(0, 10) || "nao_informado";
}
function round(value) {
  return Number(Number(value || 0).toFixed(2));
}
function metric(value, unit) {
  return Object.freeze({ available: true, reason: null, unit, value });
}
function unavailable(unit, reason) {
  return Object.freeze({ available: false, reason, unit, value: null });
}
module.exports = { createBiChampionshipsDto };
