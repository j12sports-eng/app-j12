"use strict";

const c = (columnType, nullable, options = {}) => ({ columnType, nullable, ...options });
const i = (columns, unique = false) => ({ columns, unique });
const fk = (columns, referencedTable, options = {}) => ({
  columns,
  referencedTable,
  referencedColumns: ["id"],
  ...options,
});
const t = (name, columns, indexes = {}, foreignKeys = {}, options = {}) => ({
  name,
  columns,
  indexes,
  foreignKeys,
  ...options,
});

const raw = [
  {
    id: "20260712184500_create_auth_runtime_tables",
    createdTables: ["j12_usuarios", "users", "user_sessions", "password_reset_tokens"],
    tables: [
      t(
        "j12_usuarios",
        {
          id: c("bigint unsigned", false, { autoIncrement: true }),
          nome: c("varchar(191)", false),
          email: c("varchar(191)", false),
          senha_hash: c("varchar(255)", false),
          perfil: c("varchar(50)", false, { default: "aluno" }),
          aluno_id: c("varchar(64)", true),
          professor_id: c("varchar(64)", true),
          responsavel_id: c("varchar(64)", true),
          status: c("varchar(30)", false, { default: "ativo" }),
          created_at: c("datetime", false, { default: "CURRENT_TIMESTAMP" }),
          updated_at: c("datetime", false, {
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          }),
        },
        {
          PRIMARY: i(["id"], true),
          uniq_j12_usuarios_email: i(["email"], true),
          idx_j12_usuarios_perfil: i(["perfil"]),
          idx_j12_usuarios_aluno: i(["aluno_id"]),
          idx_j12_usuarios_professor: i(["professor_id"]),
          idx_j12_usuarios_responsavel: i(["responsavel_id"]),
        },
        {},
        { engine: "InnoDB", charset: "utf8mb4", collation: "utf8mb4_unicode_ci" },
      ),
      t(
        "users",
        {
          id: c("varchar(64)", false),
          name: c("varchar(191)", false),
          email: c("varchar(191)", false),
          login: c("varchar(191)", false),
          password_hash: c("varchar(255)", false),
          password_salt: c("varchar(255)", false),
          role: c("varchar(50)", false),
          aluno_id: c("varchar(64)", true),
          professor_id: c("varchar(64)", true),
          responsavel_id: c("varchar(64)", true),
          linked_aluno_id: c("varchar(64)", true),
          class_scope_json: c("longtext", true),
          phone_whatsapp: c("varchar(50)", true),
          status: c("varchar(30)", false, { default: "ativo" }),
          created_at: c("datetime", false, { default: "CURRENT_TIMESTAMP" }),
          updated_at: c("datetime", false, {
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          }),
        },
        {
          PRIMARY: i(["id"], true),
          uniq_users_email: i(["email"], true),
          uniq_users_login: i(["login"], true),
          idx_users_role: i(["role"]),
          idx_users_aluno: i(["aluno_id"]),
          idx_users_professor: i(["professor_id"]),
          idx_users_responsavel: i(["responsavel_id"]),
        },
        {},
        { engine: "InnoDB", charset: "utf8mb4", collation: "utf8mb4_unicode_ci" },
      ),
      t(
        "user_sessions",
        {
          token: c("varchar(128)", false),
          user_id: c("varchar(64)", false),
          created_at: c("datetime", false, { default: "CURRENT_TIMESTAMP" }),
          expires_at: c("datetime", false),
          last_seen_at: c("datetime", true),
        },
        {
          PRIMARY: i(["token"], true),
          idx_sessions_user: i(["user_id"]),
          idx_sessions_expires: i(["expires_at"]),
        },
        {},
        { engine: "InnoDB", charset: "utf8mb4", collation: "utf8mb4_unicode_ci" },
      ),
      t(
        "password_reset_tokens",
        {
          token: c("varchar(128)", false),
          user_id: c("varchar(64)", false),
          channel: c("varchar(30)", false, { default: "email" }),
          created_at: c("datetime", false, { default: "CURRENT_TIMESTAMP" }),
          expires_at: c("datetime", false),
          used_at: c("datetime", true),
        },
        {
          PRIMARY: i(["token"], true),
          idx_password_reset_user: i(["user_id"]),
          idx_password_reset_expires: i(["expires_at"]),
        },
        {},
        { engine: "InnoDB", charset: "utf8mb4", collation: "utf8mb4_unicode_ci" },
      ),
    ],
  },
  {
    id: "20260717220000_add_people_normalized_identity_columns",
    tables: [
      t(
        "people",
        {
          cpf_normalized: c("varchar(11)", true),
          email_normalized: c("varchar(191)", true),
          telefone_normalized: c("varchar(50)", true),
          celular_normalized: c("varchar(50)", true),
        },
        {
          idx_people_cpf_normalized: i(["cpf_normalized"]),
          idx_people_email_normalized: i(["email_normalized"]),
          idx_people_telefone_normalized: i(["telefone_normalized"]),
          idx_people_celular_normalized: i(["celular_normalized"]),
        },
      ),
    ],
  },
  {
    id: "20260719200000_add_pre_enrollment_integrity_constraints",
    tables: [
      t(
        "person_profiles",
        {},
        { ux_person_profiles_person_type: i(["person_id", "profile_type"], true) },
      ),
      t(
        "person_relationships",
        {
          active_person_id: c("varchar(64)", true, {
            generated: true,
            generationExpression: "CASE WHEN status = 'active' THEN person_id ELSE NULL END",
          }),
          active_related_person_id: c("varchar(64)", true, {
            generated: true,
            generationExpression:
              "CASE WHEN status = 'active' THEN related_person_id ELSE NULL END",
          }),
          active_relationship_type: c("varchar(50)", true, {
            generated: true,
            generationExpression:
              "CASE WHEN status = 'active' THEN relationship_type ELSE NULL END",
          }),
        },
        {
          ux_person_relationships_active_structure: i(
            ["active_person_id", "active_related_person_id", "active_relationship_type"],
            true,
          ),
        },
      ),
    ],
  },
  {
    id: "20260724120000_create_auth_identities_table",
    createdTables: ["auth_identities"],
    tables: [
      t(
        "auth_identities",
        {
          id: c("varchar(64)", false),
          source: c("varchar(32)", false),
          source_user_id: c("varchar(64)", false),
          status: c("varchar(32)", false, { default: "ACTIVE" }),
          disabled_at: c("datetime", true),
          created_at: c("datetime", false, { default: "CURRENT_TIMESTAMP" }),
          updated_at: c("datetime", false, { default: "CURRENT_TIMESTAMP" }),
        },
        {
          PRIMARY: i(["id"], true),
          ux_auth_identities_source_user: i(["source", "source_user_id"], true),
          idx_auth_identities_source: i(["source"]),
          idx_auth_identities_status: i(["status"]),
        },
        {},
        { engine: "InnoDB", charset: "utf8mb4", collation: "utf8mb4_unicode_ci" },
      ),
    ],
  },
  {
    id: "20260724123000_create_user_unit_memberships_table",
    createdTables: ["user_unit_memberships"],
    tables: [
      t(
        "user_unit_memberships",
        {
          id: c("varchar(64)", false),
          auth_identity_id: c("varchar(64)", false),
          unit_id: c("bigint", false),
          role: c("varchar(32)", false),
          status: c("varchar(32)", false, { default: "ACTIVE" }),
          is_default: c("tinyint(1)", false, { default: "0" }),
          active_default_key: c("varchar(64)", true, {
            generated: true,
            generationExpression:
              "CASE WHEN status = 'ACTIVE' AND is_default = 1 THEN auth_identity_id ELSE NULL END",
          }),
          created_by_auth_identity_id: c("varchar(64)", false),
          revoked_at: c("datetime", true),
          revoked_by_auth_identity_id: c("varchar(64)", true),
          created_at: c("datetime", false, { default: "CURRENT_TIMESTAMP" }),
          updated_at: c("datetime", false, { default: "CURRENT_TIMESTAMP" }),
        },
        {
          PRIMARY: i(["id"], true),
          ux_user_unit_memberships_identity_unit: i(["auth_identity_id", "unit_id"], true),
          ux_user_unit_memberships_active_default: i(["active_default_key"], true),
          idx_user_unit_memberships_auth_identity: i(["auth_identity_id"]),
          idx_user_unit_memberships_unit: i(["unit_id"]),
          idx_user_unit_memberships_status: i(["status"]),
        },
        {
          fk_user_unit_memberships_auth_identity: fk(["auth_identity_id"], "auth_identities"),
          fk_user_unit_memberships_created_by_auth_identity: fk(
            ["created_by_auth_identity_id"],
            "auth_identities",
          ),
          fk_user_unit_memberships_revoked_by_auth_identity: fk(
            ["revoked_by_auth_identity_id"],
            "auth_identities",
          ),
          fk_user_unit_memberships_unit: fk(["unit_id"], "j12_unidades"),
        },
        { engine: "InnoDB", charset: "utf8mb4", collation: "utf8mb4_unicode_ci" },
      ),
    ],
  },
  {
    id: "20260729120000_add_enrollment_unit_ownership_to_enrollments",
    tables: [
      t(
        "enrollments",
        { unit_id: c("bigint", true) },
        {
          idx_enrollments_unit_student_status: i([
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
    tables: [t("enrollments", {}, {}, { fk_enrollments_unit: fk(["unit_id"], "j12_unidades") })],
  },
  {
    id: "20260803120000_prepare_enrollment_draft_ownership",
    tables: [
      t(
        "enrollments",
        {
          responsible_person_id: c("varchar(64)", true),
          responsible_profile_id: c("varchar(64)", true),
          responsible_relationship_id: c("varchar(64)", true),
        },
        {
          idx_enrollments_responsible_person_id: i(["responsible_person_id"]),
          idx_enrollments_responsible_profile_id: i(["responsible_profile_id"]),
          idx_enrollments_responsible_relationship_id: i(["responsible_relationship_id"]),
        },
        {
          fk_enrollments_responsible_person_id: fk(["responsible_person_id"], "people"),
          fk_enrollments_responsible_profile_id: fk(["responsible_profile_id"], "person_profiles"),
          fk_enrollments_responsible_relationship_id: fk(
            ["responsible_relationship_id"],
            "person_relationships",
          ),
        },
      ),
    ],
  },
];

const DRAFT_EXPRESSION =
  "CASE WHEN status = 'DRAFT' AND deleted_at IS NULL THEN unit_id ELSE NULL END";
const CURRENT_UNIT_EXPRESSION =
  "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN unit_id ELSE NULL END";
const CURRENT_PERSON_EXPRESSION =
  "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN student_person_id ELSE NULL END";
const CURRENT_PROFILE_EXPRESSION =
  "CASE WHEN status IN ('DRAFT','ACTIVE') AND deleted_at IS NULL THEN student_profile_id ELSE NULL END";

const multiunitTable = () =>
  t(
    "enrollments",
    {
      active_draft_unit_id: c("bigint", true, {
        generated: true,
        generationExpression: DRAFT_EXPRESSION,
      }),
      current_enrollment_unit_id: c("bigint", true, {
        generated: true,
        generationExpression: CURRENT_UNIT_EXPRESSION,
      }),
      current_enrollment_student_person_id: c("varchar(64)", true, {
        generated: true,
        generationExpression: CURRENT_PERSON_EXPRESSION,
      }),
      current_enrollment_student_profile_id: c("varchar(64)", true, {
        generated: true,
        generationExpression: CURRENT_PROFILE_EXPRESSION,
      }),
    },
    {
      ux_enrollments_active_draft_student_profile: i(
        [
          "active_draft_unit_id",
          "active_draft_student_person_id",
          "active_draft_student_profile_id",
        ],
        true,
      ),
      ux_enrollments_current_unit_student_profile: i(
        [
          "current_enrollment_unit_id",
          "current_enrollment_student_person_id",
          "current_enrollment_student_profile_id",
        ],
        true,
      ),
    },
  );

raw.push(
  {
    id: "20260729180000_enforce_enrollment_multiunit_invariants",
    tables: [multiunitTable()],
  },
  {
    id: "20260803123000_reconcile_enrollment_multiunit_invariants",
    applyPolicy: {
      reconciliation: true,
      allowedPhysicalStates: ["PARTIALLY_PRESENT", "DRIFT_DETECTED", "PHYSICALLY_ABSENT"],
      reviewedFindingCodes: [
        "COLUMN_MISSING",
        "INDEX_MISSING",
        "INDEX_MISMATCH",
        "FORMAL_PHYSICAL_DRIFT",
      ],
      reviewedIndexMismatches: [
        {
          table: "enrollments",
          name: "ux_enrollments_active_draft_student_profile",
          unique: true,
          columns: ["active_draft_student_person_id", "active_draft_student_profile_id"],
        },
      ],
      plannedActions: [
        {
          kind: "INDEX",
          table: "enrollments",
          name: "ux_enrollments_active_draft_student_profile",
          action: "REPLACE_LEGACY_IF_EXACT",
        },
      ],
    },
    tables: [multiunitTable()],
  },
  {
    id: "20260810171000_reconcile_j12_unidades_id_bigint",
    applyPolicy: {
      reconciliation: true,
      allowedPhysicalStates: ["DRIFT_DETECTED"],
      reviewedFindingCodes: ["COLUMN_MISMATCH", "FORMAL_PHYSICAL_DRIFT"],
      reviewedColumnMismatches: [
        {
          table: "j12_unidades",
          name: "id",
          columnType: "int(11)",
          nullable: false,
        },
      ],
      plannedActions: [
        {
          kind: "COLUMN",
          table: "j12_unidades",
          name: "id",
          action: "CONVERT_SIGNED_INT_TO_SIGNED_BIGINT_IF_SAFE",
        },
      ],
    },
    tables: [
      t(
        "j12_unidades",
        {
          id: c("bigint", false, { autoIncrement: true }),
        },
        {
          PRIMARY: i(["id"], true),
        },
      ),
    ],
  },
  {
    id: "20260803130000_reconcile_enrollment_digital_invitation_unit_type",
    applyPolicy: {
      reconciliation: true,
      allowedPhysicalStates: ["PARTIALLY_PRESENT", "DRIFT_DETECTED"],
      reviewedFindingCodes: ["COLUMN_MISMATCH", "FOREIGN_KEY_MISSING", "FORMAL_PHYSICAL_DRIFT"],
      reviewedColumnMismatches: [
        {
          table: "enrollment_digital_invitations",
          name: "unit_id",
          columnType: "varchar(64)",
          nullable: false,
        },
      ],
      plannedActions: [
        {
          kind: "COLUMN",
          table: "enrollment_digital_invitations",
          name: "unit_id",
          action: "CONVERT_VARCHAR64_TO_SIGNED_BIGINT_IF_SAFE",
        },
      ],
    },
    tables: [
      t(
        "enrollment_digital_invitations",
        { unit_id: c("bigint", false) },
        { idx_edi_unit: i(["unit_id"]) },
        { fk_edi_unit: fk(["unit_id"], "j12_unidades") },
      ),
    ],
  },
  {
    id: "20260803133000_reconcile_auth_runtime_charset_collation",
    applyPolicy: {
      reconciliation: true,
      allowedPhysicalStates: ["TABLE_OPTION_DRIFT"],
      reviewedFindingCodes: ["TABLE_OPTION_MISMATCH", "FORMAL_PHYSICAL_DRIFT"],
      requiresTableConfirmation: true,
      operationalPreflight: "AUTH_RUNTIME_TABLE_OPTIONS",
      plannedActions: [
        {
          kind: "TABLE_OPTIONS",
          tables: ["users", "user_sessions", "password_reset_tokens"],
          action: "CONVERT_UTF8_TO_UTF8MB4_IF_SAFE",
        },
      ],
    },
    tables: [
      t(
        "users",
        {},
        {},
        {},
        {
          engine: "InnoDB",
          charset: "utf8mb4",
          collation: "utf8mb4_unicode_ci",
        },
      ),
      t(
        "user_sessions",
        {},
        {},
        {},
        {
          engine: "InnoDB",
          charset: "utf8mb4",
          collation: "utf8mb4_unicode_ci",
        },
      ),
      t(
        "password_reset_tokens",
        {},
        {},
        {},
        {
          engine: "InnoDB",
          charset: "utf8mb4",
          collation: "utf8mb4_unicode_ci",
        },
      ),
    ],
  },
);

function expose(manifest) {
  const created = new Set(manifest.createdTables || []);
  const tables = manifest.tables.map((table) => ({
    ...table,
    tableArtifact: created.has(table.name),
  }));
  const requiredColumns = [];
  const requiredIndexes = [];
  const requiredForeignKeys = [];
  const requiredGeneratedColumns = [];
  for (const table of tables) {
    for (const [name, definition] of Object.entries(table.columns || {})) {
      const artifact = { table: table.name, name, ...definition };
      requiredColumns.push(artifact);
      if (definition.generated) requiredGeneratedColumns.push(artifact);
    }
    for (const [name, definition] of Object.entries(table.indexes || {})) {
      requiredIndexes.push({ table: table.name, name, ...definition });
    }
    for (const [name, definition] of Object.entries(table.foreignKeys || {})) {
      requiredForeignKeys.push({ table: table.name, name, ...definition });
    }
  }
  return Object.freeze({
    ...manifest,
    migrationId: manifest.id,
    tables,
    requiredTables: tables.map((table) => table.name),
    requiredColumns,
    requiredIndexes,
    requiredForeignKeys,
    requiredGeneratedColumns,
    optionalArtifacts: [],
  });
}

const draftChainManifests = Object.freeze(raw.map(expose));

module.exports = { draftChainManifests };
