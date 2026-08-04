"use strict";

const table = (name, columns = {}, indexes = {}, foreignKeys = {}, options = {}) => ({
  name,
  columns,
  indexes,
  foreignKeys,
  ...options,
});
const column = (columnType, nullable, options = {}) => ({ columnType, nullable, ...options });
const index = (columns, unique = false) => ({ columns, unique });
const foreignKey = (columns, referencedTable, referencedColumns = ["id"], options = {}) => ({
  columns,
  referencedTable,
  referencedColumns,
  ...options,
});

const manifests = [
  {
    id: "20260712183000_create_people_domain_tables",
    tables: [
      table(
        "people",
        {
          id: column("varchar(64)", false),
          nome: column("varchar(191)", false),
          ativo: column("tinyint(1)", false, { default: "1" }),
        },
        { PRIMARY: index(["id"], true), idx_people_cpf: index(["cpf"]) },
        {},
        { engine: "InnoDB", charset: "utf8mb4" },
      ),
      table(
        "person_profiles",
        {
          id: column("varchar(64)", false),
          person_id: column("varchar(64)", false),
          profile_type: column("varchar(50)", false),
        },
        { PRIMARY: index(["id"], true), idx_person_profiles_person: index(["person_id"]) },
      ),
      table(
        "person_relationships",
        {
          id: column("varchar(64)", false),
          person_id: column("varchar(64)", false),
          related_person_id: column("varchar(64)", false),
          relationship_type: column("varchar(50)", false),
        },
        { PRIMARY: index(["id"], true), idx_person_relationships_person: index(["person_id"]) },
      ),
      table(
        "pre_matriculas",
        {
          id: column("varchar(64)", false),
          status: column("enum('PENDENTE','EM_ANALISE','APROVADA','REJEITADA','CANCELADA')", false),
          aluno_nome: column("varchar(191)", false),
        },
        { PRIMARY: index(["id"], true) },
      ),
    ],
  },
  {
    id: "20260629134546_create_enrollments_table",
    tables: [
      table(
        "enrollments",
        {
          id: column("varchar(64)", false),
          student_person_id: column("varchar(64)", false),
          student_profile_id: column("varchar(64)", false),
          status: column("varchar(32)", false),
          start_date: column("date", false),
          deleted_at: column("datetime", true),
        },
        {
          PRIMARY: index(["id"], true),
          idx_enrollments_student_status: index(["student_person_id", "status"]),
        },
        {
          fk_enrollments_student_person: foreignKey(["student_person_id"], "people"),
          fk_enrollments_student_profile: foreignKey(["student_profile_id"], "person_profiles"),
        },
        { engine: "InnoDB", charset: "utf8mb4" },
      ),
    ],
  },
  {
    id: "20260629190607_add_active_draft_unique_constraint_to_enrollments",
    tables: [
      table(
        "enrollments",
        {
          active_draft_student_person_id: column("varchar(64)", true, { generated: true }),
          active_draft_student_profile_id: column("varchar(64)", true, { generated: true }),
        },
        {
          ux_enrollments_active_draft_student_profile: index(
            ["active_draft_student_person_id", "active_draft_student_profile_id"],
            true,
          ),
        },
      ),
    ],
  },
  {
    id: "20260629232350_add_enrollment_confirmation_audit_columns",
    tables: [
      table("enrollments", {
        confirmed_at: column("datetime", true),
        confirmed_by: column("varchar(191)", true),
      }),
    ],
  },
  {
    id: "20260717220000_add_people_normalized_identity_columns",
    tables: [
      table(
        "people",
        {
          celular_normalized: column("varchar(50)", true),
          cpf_normalized: column("varchar(11)", true),
          email_normalized: column("varchar(191)", true),
          telefone_normalized: column("varchar(50)", true),
        },
        {
          idx_people_cpf_normalized: index(["cpf_normalized"]),
          idx_people_email_normalized: index(["email_normalized"]),
        },
      ),
    ],
  },
  {
    id: "20260720120000_create_enrollment_digital_invitations_table",
    tables: [
      table(
        "enrollment_digital_invitations",
        {
          id: column("varchar(64)", false),
          enrollment_id: column("varchar(64)", false),
          token_hash: column("varchar(64)", false),
          status: column("varchar(32)", false),
          active_enrollment_id: column("varchar(64)", true, { generated: true }),
        },
        {
          PRIMARY: index(["id"], true),
          ux_edi_token_hash: index(["token_hash"], true),
          ux_edi_active_enrollment: index(["active_enrollment_id"], true),
        },
        { fk_edi_enrollment: foreignKey(["enrollment_id"], "enrollments") },
      ),
    ],
  },
  {
    id: "20260724120000_create_auth_identities_table",
    tables: [
      table(
        "auth_identities",
        {
          id: column("varchar(64)", false),
          source: column("varchar(32)", false),
          source_user_id: column("varchar(64)", false),
          status: column("varchar(32)", false),
        },
        {
          PRIMARY: index(["id"], true),
          ux_auth_identities_source_user: index(["source", "source_user_id"], true),
        },
      ),
    ],
  },
  {
    id: "20260724123000_create_user_unit_memberships_table",
    tables: [
      table(
        "user_unit_memberships",
        {
          id: column("varchar(64)", false),
          auth_identity_id: column("varchar(64)", false),
          unit_id: column("bigint", false),
          role: column("varchar(32)", false),
          active_default_key: column("varchar(64)", true, { generated: true }),
        },
        {
          PRIMARY: index(["id"], true),
          ux_user_unit_memberships_identity_unit: index(["auth_identity_id", "unit_id"], true),
          ux_user_unit_memberships_active_default: index(["active_default_key"], true),
        },
        {
          fk_user_unit_memberships_auth_identity: foreignKey(
            ["auth_identity_id"],
            "auth_identities",
          ),
          fk_user_unit_memberships_unit: foreignKey(["unit_id"], "j12_unidades"),
        },
      ),
    ],
  },
  {
    id: "20260724150000_create_digital_enrollment_progress",
    tables: [
      table(
        "digital_enrollment_progress",
        {
          id: column("varchar(64)", false),
          enrollment_id: column("varchar(64)", false),
          current_step: column("varchar(32)", false),
          completed_steps_json: column("longtext", false),
          revision: column("int unsigned", false),
        },
        { PRIMARY: index(["id"], true), ux_dep_enrollment: index(["enrollment_id"], true) },
        { fk_dep_enrollment: foreignKey(["enrollment_id"], "enrollments") },
      ),
      table("enrollments", {
        responsible_person_id: column("varchar(64)", true),
        responsible_profile_id: column("varchar(64)", true),
        responsible_relationship_id: column("varchar(64)", true),
      }),
    ],
  },
  {
    id: "20260725120000_create_digital_enrollment_documents",
    tables: [
      table(
        "digital_enrollment_documents",
        {
          id: column("varchar(64)", false),
          enrollment_id: column("varchar(64)", false),
          type: column(
            "enum('CPF','RG','CERTIDAO_NASCIMENTO','COMPROVANTE_RESIDENCIA','FOTO','OUTRO')",
            false,
          ),
          status: column("enum('PENDING','APPROVED','REJECTED')", false),
          sha256: column("char(64)", false),
          storage_key: column("varchar(64)", false),
        },
        {
          PRIMARY: index(["id"], true),
          ux_ded_enrollment_hash: index(["enrollment_id", "sha256"], true),
          ux_ded_storage_key: index(["storage_key"], true),
        },
        { fk_ded_enrollment: foreignKey(["enrollment_id"], "enrollments") },
      ),
    ],
  },
  {
    id: "20260725160000_create_digital_enrollment_contract_foundation",
    tables: [
      table(
        "digital_enrollment_contract_templates",
        {
          id: column("varchar(64)", false),
          unit_id: column("varchar(64)", false),
          name: column("varchar(191)", false),
          version: column("varchar(32)", false),
        },
        { ux_dect_unit_name_version: index(["unit_id", "name", "version"], true) },
      ),
      table(
        "digital_enrollment_contracts",
        {
          id: column("varchar(64)", false),
          enrollment_id: column("varchar(64)", false),
          template_id: column("varchar(64)", false),
          status: column("enum('PENDING_ACCEPTANCE','ACCEPTED','SUPERSEDED','CANCELLED')", false),
        },
        {
          ux_dec_enrollment_template_version: index(
            ["enrollment_id", "template_id", "template_version"],
            true,
          ),
        },
      ),
      table(
        "digital_enrollment_contract_acceptances",
        {
          id: column("varchar(64)", false),
          enrollment_contract_id: column("varchar(64)", false),
          enrollment_id: column("varchar(64)", false),
        },
        { ux_deca_contract: index(["enrollment_contract_id"], true) },
      ),
    ],
  },
  {
    id: "20260727150000_create_digital_enrollment_administrative_review",
    tables: [
      table(
        "digital_enrollment_administrative_reviews",
        {
          id: column("varchar(64)", false),
          enrollment_id: column("varchar(64)", false),
          status: column("varchar(40)", false),
        },
        { ux_dear_enrollment: index(["enrollment_id"], true) },
      ),
      table(
        "digital_enrollment_administrative_review_decisions",
        {
          id: column("varchar(64)", false),
          review_id: column("varchar(64)", false),
          enrollment_id: column("varchar(64)", false),
          status: column("varchar(40)", false),
        },
        { idx_deard_review: index(["review_id"]) },
      ),
      table(
        "digital_enrollment_administrative_review_commands",
        {
          command_id: column("varchar(64)", false),
          enrollment_id: column("varchar(64)", false),
          review_id: column("varchar(64)", false),
        },
        { PRIMARY: index(["command_id"], true) },
      ),
    ],
  },
  {
    id: "20260729120000_add_enrollment_unit_ownership_to_enrollments",
    tables: [
      table(
        "enrollments",
        { unit_id: column("bigint", true) },
        {
          idx_enrollments_unit_student_status: index([
            "unit_id",
            "student_person_id",
            "student_profile_id",
            "status",
            "deleted_at",
          ]),
        },
      ),
    ],
  },
  {
    id: "20260729150000_add_enrollment_unit_foreign_key",
    tables: [
      table(
        "enrollments",
        {},
        {},
        { fk_enrollments_unit: foreignKey(["unit_id"], "j12_unidades") },
      ),
    ],
  },
  {
    id: "20260729180000_enforce_enrollment_multiunit_invariants",
    tables: [
      table(
        "enrollments",
        {
          active_draft_unit_id: column("bigint", true, { generated: true }),
          current_enrollment_unit_id: column("bigint", true, { generated: true }),
          current_enrollment_student_person_id: column("varchar(64)", true, { generated: true }),
          current_enrollment_student_profile_id: column("varchar(64)", true, { generated: true }),
        },
        {
          ux_enrollments_active_draft_student_profile: index(
            [
              "active_draft_unit_id",
              "active_draft_student_person_id",
              "active_draft_student_profile_id",
            ],
            true,
          ),
          ux_enrollments_current_unit_student_profile: index(
            [
              "current_enrollment_unit_id",
              "current_enrollment_student_person_id",
              "current_enrollment_student_profile_id",
            ],
            true,
          ),
        },
      ),
    ],
  },
  {
    id: "20260729210000_add_people_digital_enrollment_fields",
    tables: [
      table("people", {
        birth_city: column("varchar(191)", true),
        birth_state: column("varchar(50)", true),
        nationality: column("varchar(191)", true),
        blood_type: column("varchar(20)", true),
      }),
    ],
  },
];

const CREATED_TABLES = Object.freeze({
  "20260712183000_create_people_domain_tables": [
    "people",
    "person_profiles",
    "person_relationships",
    "pre_matriculas",
  ],
  "20260629134546_create_enrollments_table": ["enrollments"],
  "20260720120000_create_enrollment_digital_invitations_table": ["enrollment_digital_invitations"],
  "20260724120000_create_auth_identities_table": ["auth_identities"],
  "20260724123000_create_user_unit_memberships_table": ["user_unit_memberships"],
  "20260724150000_create_digital_enrollment_progress": ["digital_enrollment_progress"],
  "20260725120000_create_digital_enrollment_documents": ["digital_enrollment_documents"],
  "20260725160000_create_digital_enrollment_contract_foundation": [
    "digital_enrollment_contract_templates",
    "digital_enrollment_contracts",
    "digital_enrollment_contract_acceptances",
  ],
  "20260727150000_create_digital_enrollment_administrative_review": [
    "digital_enrollment_administrative_reviews",
    "digital_enrollment_administrative_review_decisions",
    "digital_enrollment_administrative_review_commands",
  ],
});

function exposeManifest(manifest) {
  const createdTables = new Set(CREATED_TABLES[manifest.id] || []);
  const tables = manifest.tables.map((expectedTable) => ({
    ...expectedTable,
    tableArtifact: createdTables.has(expectedTable.name),
  }));
  const requiredColumns = [];
  const requiredIndexes = [];
  const requiredForeignKeys = [];
  const requiredGeneratedColumns = [];
  for (const expectedTable of tables) {
    for (const [name, definition] of Object.entries(expectedTable.columns || {})) {
      const artifact = { table: expectedTable.name, name, ...definition };
      requiredColumns.push(artifact);
      if (definition.generated) requiredGeneratedColumns.push(artifact);
    }
    for (const [name, definition] of Object.entries(expectedTable.indexes || {})) {
      requiredIndexes.push({ table: expectedTable.name, name, ...definition });
    }
    for (const [name, definition] of Object.entries(expectedTable.foreignKeys || {})) {
      requiredForeignKeys.push({ table: expectedTable.name, name, ...definition });
    }
  }
  return Object.freeze({
    ...manifest,
    tables,
    migrationId: manifest.id,
    requiredTables: manifest.tables.map((item) => item.name),
    requiredColumns,
    requiredIndexes,
    requiredForeignKeys,
    requiredGeneratedColumns,
    optionalArtifacts: [],
  });
}

const criticalEnrollmentManifests = Object.freeze(manifests.map(exposeManifest));

module.exports = { criticalEnrollmentManifests };
