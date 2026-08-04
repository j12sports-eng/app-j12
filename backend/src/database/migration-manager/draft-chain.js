"use strict";

const DRAFT_CHAIN_TARGETS = Object.freeze([
  "20260717220000_add_people_normalized_identity_columns",
  "20260719200000_add_pre_enrollment_integrity_constraints",
  "20260724120000_create_auth_identities_table",
  "20260724123000_create_user_unit_memberships_table",
  "20260729120000_add_enrollment_unit_ownership_to_enrollments",
  "20260729150000_add_enrollment_unit_foreign_key",
  "20260803120000_prepare_enrollment_draft_ownership",
  "20260803123000_reconcile_enrollment_multiunit_invariants",
  "20260729180000_enforce_enrollment_multiunit_invariants",
]);

const DRAFT_CHAIN_CLASSIFICATION = Object.freeze({
  "20260717220000_add_people_normalized_identity_columns": "DRAFT_REQUIRED",
  "20260719200000_add_pre_enrollment_integrity_constraints": "DRAFT_REQUIRED",
  "20260720120000_create_enrollment_digital_invitations_table": "DIGITAL_INVITATION_ONLY",
  "20260724120000_create_auth_identities_table": "DRAFT_REQUIRED",
  "20260724123000_create_user_unit_memberships_table": "DRAFT_REQUIRED",
  "20260724150000_create_digital_enrollment_progress": "POST_DRAFT_ONLY",
  "20260729120000_add_enrollment_unit_ownership_to_enrollments": "DRAFT_REQUIRED",
  "20260729150000_add_enrollment_unit_foreign_key": "DRAFT_REQUIRED",
  "20260729180000_enforce_enrollment_multiunit_invariants": "FORMAL_CLOSURE_AFTER_RECONCILIATION",
  "20260803120000_prepare_enrollment_draft_ownership": "DRAFT_REQUIRED",
  "20260803123000_reconcile_enrollment_multiunit_invariants": "DRAFT_REQUIRED",
  "20260803130000_reconcile_enrollment_digital_invitation_unit_type": "DIGITAL_INVITATION_ONLY",
});

function buildMinimumDraftChain(catalog, targets = DRAFT_CHAIN_TARGETS) {
  const byId = new Map(catalog.map((migration) => [migration.id, migration]));
  const required = new Set();
  const visiting = new Set();

  function include(migrationId) {
    if (required.has(migrationId)) return;
    const migration = byId.get(migrationId);
    if (!migration) {
      const error = new Error(`DRAFT chain requires missing migration ${migrationId}.`);
      error.code = "DRAFT_CHAIN_MIGRATION_MISSING";
      error.migrationId = migrationId;
      throw error;
    }
    if (visiting.has(migrationId)) {
      const error = new Error(`DRAFT chain contains a dependency cycle at ${migrationId}.`);
      error.code = "DRAFT_CHAIN_DEPENDENCY_CYCLE";
      throw error;
    }
    visiting.add(migrationId);
    for (const dependencyId of migration.dependencies || []) include(dependencyId);
    visiting.delete(migrationId);
    required.add(migrationId);
  }

  for (const target of targets) include(target);
  return Object.freeze(
    catalog
      .filter((migration) => required.has(migration.id))
      .map((migration) =>
        Object.freeze({
          id: migration.id,
          dependencies: Object.freeze([...(migration.dependencies || [])]),
          classification:
            DRAFT_CHAIN_CLASSIFICATION[migration.id] || "TECHNICAL_TRANSITIVE_DEPENDENCY",
        }),
      ),
  );
}

module.exports = {
  DRAFT_CHAIN_CLASSIFICATION,
  DRAFT_CHAIN_TARGETS,
  buildMinimumDraftChain,
};
