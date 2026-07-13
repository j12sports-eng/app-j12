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
});

module.exports = { MIGRATION_DEPENDENCIES };
