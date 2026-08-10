const MIGRATION_DEPENDENCIES = Object.freeze({
  "20260629134546_create_enrollments_table": Object.freeze([
    "20260712183000_create_people_domain_tables",
  ]),
  "20260629190607_add_active_draft_unique_constraint_to_enrollments": Object.freeze([
    "20260629134546_create_enrollments_table",
  ]),
  "20260629232350_add_enrollment_confirmation_audit_columns": Object.freeze([
    "20260629134546_create_enrollments_table",
  ]),
  "20260701103000_add_enrollment_class_links_table": Object.freeze([
    "20260629134546_create_enrollments_table",
    "20260713100000_create_classes_foundation_table",
  ]),
  "20260701120000_add_enrollment_class_links_table": Object.freeze([
    "20260713101500_reconcile_enrollment_class_links_indexes",
  ]),
  "20260702120000_create_enrollment_financial_obligations_table": Object.freeze([
    "20260629134546_create_enrollments_table",
  ]),
  "20260702133000_create_enrollment_agenda_items_table": Object.freeze([
    "20260629134546_create_enrollments_table",
    "20260713100000_create_classes_foundation_table",
  ]),
  "20260703130000_create_agenda_recurrence_tables": Object.freeze([
    "20260702133000_create_enrollment_agenda_items_table",
  ]),
  "20260703143000_create_agenda_notification_tables": Object.freeze([
    "20260703130000_create_agenda_recurrence_tables",
  ]),
  "20260713101500_reconcile_enrollment_class_links_indexes": Object.freeze([
    "20260701103000_add_enrollment_class_links_table",
  ]),
  "20260715143000_create_enrollment_financial_bridges_table": Object.freeze([
    "20260702120000_create_enrollment_financial_obligations_table",
  ]),
  "20260717220000_add_people_normalized_identity_columns": Object.freeze([
    "20260712183000_create_people_domain_tables",
  ]),
  "20260718200000_create_crm_lead_student_conversions": Object.freeze([
    "20260712183000_create_people_domain_tables",
    "20260717150000_create_crm_foundation_tables",
  ]),
  "20260718220000_create_crm_lead_enrollment_conversions": Object.freeze([
    "20260629134546_create_enrollments_table",
    "20260718200000_create_crm_lead_student_conversions",
  ]),
  "20260719200000_add_pre_enrollment_integrity_constraints": Object.freeze([
    "20260712183000_create_people_domain_tables",
  ]),
  "20260720120000_create_enrollment_digital_invitations_table": Object.freeze([
    "20260629134546_create_enrollments_table",
    "20260629190607_add_active_draft_unique_constraint_to_enrollments",
  ]),
  "20260724120000_create_auth_identities_table": Object.freeze([
    "20260803133000_reconcile_auth_runtime_charset_collation",
  ]),
  "20260810171000_reconcile_j12_unidades_id_bigint": Object.freeze([]),
  "20260724123000_create_user_unit_memberships_table": Object.freeze([
    "20260724120000_create_auth_identities_table",
    "20260810171000_reconcile_j12_unidades_id_bigint",
  ]),
  // People owns people/person_profiles/person_relationships; invitations owns
  // the transitive enrollment dependency required by the progress foreign keys.
  "20260724150000_create_digital_enrollment_progress": Object.freeze([
    "20260803120000_prepare_enrollment_draft_ownership",
    "20260803130000_reconcile_enrollment_digital_invitation_unit_type",
  ]),
  "20260725120000_create_digital_enrollment_documents": Object.freeze([
    "20260724150000_create_digital_enrollment_progress",
  ]),
  "20260725160000_create_digital_enrollment_contract_foundation": Object.freeze([
    "20260724120000_create_auth_identities_table",
    "20260724150000_create_digital_enrollment_progress",
  ]),
  "20260729120000_add_enrollment_unit_ownership_to_enrollments": Object.freeze([
    "20260629134546_create_enrollments_table",
  ]),
  "20260729150000_add_enrollment_unit_foreign_key": Object.freeze([
    "20260729120000_add_enrollment_unit_ownership_to_enrollments",
  ]),
  "20260729180000_enforce_enrollment_multiunit_invariants": Object.freeze([
    "20260803123000_reconcile_enrollment_multiunit_invariants",
  ]),
  "20260803120000_prepare_enrollment_draft_ownership": Object.freeze([
    "20260629134546_create_enrollments_table",
    "20260719200000_add_pre_enrollment_integrity_constraints",
  ]),
  "20260803123000_reconcile_enrollment_multiunit_invariants": Object.freeze([
    "20260629190607_add_active_draft_unique_constraint_to_enrollments",
    "20260729150000_add_enrollment_unit_foreign_key",
    "20260803120000_prepare_enrollment_draft_ownership",
  ]),
  "20260803130000_reconcile_enrollment_digital_invitation_unit_type": Object.freeze([
    "20260720120000_create_enrollment_digital_invitations_table",
  ]),
  "20260803133000_reconcile_auth_runtime_charset_collation": Object.freeze([
    "20260712184500_create_auth_runtime_tables",
  ]),
});
module.exports = { MIGRATION_DEPENDENCIES };
