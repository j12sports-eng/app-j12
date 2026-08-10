"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { discoverMigrationCatalog } = require("../../migration-runner/migration-catalog");
const { MIGRATION_DEPENDENCIES } = require("../../migration-runner/migration-dependencies");
const { DRAFT_CHAIN_CLASSIFICATION, buildMinimumDraftChain } = require("../draft-chain");

const EXPECTED_DRAFT_CHAIN = Object.freeze([
  "20260712183000_create_people_domain_tables",
  "20260629134546_create_enrollments_table",
  "20260629190607_add_active_draft_unique_constraint_to_enrollments",
  "20260712184500_create_auth_runtime_tables",
  "20260717220000_add_people_normalized_identity_columns",
  "20260719200000_add_pre_enrollment_integrity_constraints",
  "20260803133000_reconcile_auth_runtime_charset_collation",
 "20260724120000_create_auth_identities_table",
"20260810171000_reconcile_j12_unidades_id_bigint",
"20260724123000_create_user_unit_memberships_table",
  "20260803120000_prepare_enrollment_draft_ownership",
  "20260729120000_add_enrollment_unit_ownership_to_enrollments",
  "20260729150000_add_enrollment_unit_foreign_key",
  "20260803123000_reconcile_enrollment_multiunit_invariants",
  "20260729180000_enforce_enrollment_multiunit_invariants",
]);

test("calcula a cadeia mínima exata e topologicamente válida para DRAFT", async () => {
  const chain = buildMinimumDraftChain(await discoverMigrationCatalog());
  assert.deepEqual(
    chain.map((entry) => entry.id),
    EXPECTED_DRAFT_CHAIN,
  );
  const position = new Map(chain.map((entry, index) => [entry.id, index]));
  for (const entry of chain) {
    for (const dependency of entry.dependencies) {
      assert.ok(position.has(dependency), `dependência ausente: ${dependency}`);
      assert.ok(position.get(dependency) < position.get(entry.id));
    }
  }
});

test("DRAFT não é acoplado a convite, progresso, documentos, contrato ou revisão", async () => {
  const ids = new Set(
    buildMinimumDraftChain(await discoverMigrationCatalog()).map((entry) => entry.id),
  );
  for (const deferred of [
    "20260720120000_create_enrollment_digital_invitations_table",
    "20260803130000_reconcile_enrollment_digital_invitation_unit_type",
    "20260724150000_create_digital_enrollment_progress",
    "20260725120000_create_digital_enrollment_documents",
    "20260725160000_create_digital_enrollment_contract_foundation",
    "20260727150000_create_digital_enrollment_administrative_review",
  ]) {
    assert.equal(ids.has(deferred), false, deferred);
  }
  assert.equal(
    DRAFT_CHAIN_CLASSIFICATION["20260720120000_create_enrollment_digital_invitations_table"],
    "DIGITAL_INVITATION_ONLY",
  );
  assert.equal(
    DRAFT_CHAIN_CLASSIFICATION["20260724150000_create_digital_enrollment_progress"],
    "POST_DRAFT_ONLY",
  );
});

test("dependências corrigidas preservam história e fecham drift por reconciliação", () => {
  assert.deepEqual(MIGRATION_DEPENDENCIES["20260724120000_create_auth_identities_table"], [
    "20260803133000_reconcile_auth_runtime_charset_collation",
  ]);
  assert.deepEqual(
    MIGRATION_DEPENDENCIES["20260729180000_enforce_enrollment_multiunit_invariants"],
    ["20260803123000_reconcile_enrollment_multiunit_invariants"],
  );
  assert.deepEqual(
    MIGRATION_DEPENDENCIES["20260803123000_reconcile_enrollment_multiunit_invariants"],
    [
      "20260629190607_add_active_draft_unique_constraint_to_enrollments",
      "20260729150000_add_enrollment_unit_foreign_key",
      "20260803120000_prepare_enrollment_draft_ownership",
    ],
  );
});

test("cálculo falha fechado para migration ausente e ciclo", () => {
  assert.throws(
    () => buildMinimumDraftChain([], ["missing"]),
    (error) => error.code === "DRAFT_CHAIN_MIGRATION_MISSING",
  );
  const cyclic = [
    { id: "a", dependencies: ["b"] },
    { id: "b", dependencies: ["a"] },
  ];
  assert.throws(
    () => buildMinimumDraftChain(cyclic, ["a"]),
    (error) => error.code === "DRAFT_CHAIN_DEPENDENCY_CYCLE",
  );
});

module.exports = { EXPECTED_DRAFT_CHAIN };
