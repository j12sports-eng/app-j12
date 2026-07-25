const assert = require("node:assert/strict");
const test = require("node:test");
const { CREATE_CONTRACT_FOUNDATION_SQL } = require("../20260725160000_create_digital_enrollment_contract_foundation.js");

test("contract foundation migration declares separate modern immutable evidence tables", () => {
  for (const table of ["digital_enrollment_contract_templates","digital_enrollment_contracts","digital_enrollment_contract_acceptances"]) assert.match(CREATE_CONTRACT_FOUNDATION_SQL, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  for (const target of ["enrollments\\(id\\)","person_relationships\\(id\\)","enrollment_digital_invitations\\(id\\)","auth_identities\\(id\\)"]) assert.match(CREATE_CONTRACT_FOUNDATION_SQL, new RegExp(`REFERENCES ${target}`));
  assert.match(CREATE_CONTRACT_FOUNDATION_SQL, /UNIQUE INDEX ux_dect_unit_name_version/);
  assert.match(CREATE_CONTRACT_FOUNDATION_SQL, /UNIQUE INDEX ux_deca_contract/);
  assert.doesNotMatch(CREATE_CONTRACT_FOUNDATION_SQL, /student_contracts|j12_contratos|j12_matriculas_publicas|backfill|DROP TABLE/i);
});
