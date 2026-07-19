const assert = require("node:assert/strict");
const test = require("node:test");

const { PreEnrollmentIntegrityAuditService } = require("./pre-enrollment-integrity-audit.js");

test("audit reports a clean dataset and executes SELECT only", async () => {
  const fixture = fakeDatabase();
  const report = await service().audit(fixture.query);

  assert.equal(report.readOnly, true);
  assert.deepEqual(report.duplicateGroups.profiles, []);
  assert.deepEqual(report.duplicateGroups.relationships, []);
  assert.deepEqual(report.duplicateGroups.draftEnrollments, []);
  assert.equal(report.migrationReadiness.normalizedIdentity.canApply, true);
  assert.equal(
    fixture.sql.every((sql) => /^SELECT\b/iu.test(sql)),
    true,
  );
});

test("audit identifies identity, profile and relationship blockers without raw PII", async () => {
  const fixture = fakeDatabase({
    drafts: [
      {
        ids: "draft-1,draft-2",
        student_person_id: "student-1",
        student_profile_id: "sp-1",
        total: 2,
      },
    ],
    people: [
      person("person-1", "529.982.247-25", "shared@example.test", "11999999999"),
      person("person-2", "52998224725", "shared@example.test", "(11) 99999-9999"),
    ],
    profiles: [
      { ids: "profile-1,profile-2", person_id: "person-1", profile_type: "aluno", total: 2 },
    ],
    relationships: [
      {
        ids: "rel-1,rel-2",
        person_id: "person-1",
        related_person_id: "person-2",
        relationship_type: "responsible",
        total: 2,
      },
    ],
  });
  const report = await service().audit(fixture.query);
  const serialized = JSON.stringify(report);

  assert.equal(report.identity.metrics.duplicateCpfGroups, 1);
  assert.equal(report.migrationReadiness.normalizedIdentity.canApply, false);
  assert.equal(report.migrationReadiness.profileUniqueness.canApply, false);
  assert.equal(report.migrationReadiness.relationshipUniqueness.canApply, false);
  assert.equal(report.migrationReadiness.enrollmentDraftConstraintHealthy, false);
  assert.doesNotMatch(serialized, /52998224725|shared@example\.test|11999999999/u);
  assert.match(serialized, /person-1|profile-1|rel-1|draft-1/u);
});

function service() {
  return new PreEnrollmentIntegrityAuditService({ clock: () => new Date("2026-07-19T12:00:00Z") });
}

function person(id, cpf, email, telefone) {
  return { ativo: 1, celular: null, cpf, email, id, telefone };
}

function fakeDatabase(options = {}) {
  const state = { sql: [] };
  state.query = async (sql, params = []) => {
    const compact = String(sql).replace(/\s+/gu, " ").trim();
    state.sql.push(compact);
    if (/SELECT id, cpf, email, telefone, celular, ativo FROM people/iu.test(compact)) {
      const cursor = String(params[0]);
      return (options.people || []).filter((row) => row.id > cursor).slice(0, params[1]);
    }
    if (/FROM person_profiles GROUP BY/iu.test(compact)) return options.profiles || [];
    if (/FROM person_relationships WHERE status = 'active'/iu.test(compact))
      return options.relationships || [];
    if (/FROM enrollments WHERE status = 'DRAFT'/iu.test(compact)) return options.drafts || [];
    if (/information_schema\.columns/iu.test(compact)) return columns();
    if (/information_schema\.statistics/iu.test(compact)) return indexes();
    throw new Error(`Unexpected SQL: ${compact}`);
  };
  return state;
}

function columns() {
  return [
    ...["celular_normalized", "cpf_normalized", "email_normalized", "telefone_normalized"].map(
      (column_name) => ({ column_name, table_name: "people" }),
    ),
  ];
}

function indexes() {
  return [
    {
      columns: "active_draft_student_person_id,active_draft_student_profile_id",
      index_name: "ux_enrollments_active_draft_student_profile",
      non_unique: 0,
      table_name: "enrollments",
    },
    ...["celular_normalized", "cpf_normalized", "email_normalized", "telefone_normalized"].map(
      (column) => ({
        columns: column,
        index_name: `idx_people_${column}`,
        non_unique: 1,
        table_name: "people",
      }),
    ),
  ];
}
