"use strict";

const CLASSES_FOUNDATION_MIGRATION = "20260713100000_create_classes_foundation_table";

const legacyColumns = Object.freeze({
  id: Object.freeze({
    position: 1,
    columnType: "int(11)",
    nullable: false,
    default: null,
    autoIncrement: true,
    extra: "auto_increment",
    charset: null,
    collation: null,
  }),

  nome: Object.freeze({
    position: 2,
    columnType: "varchar(255)",
    nullable: false,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),

  modalidade: Object.freeze({
    position: 3,
    columnType: "varchar(100)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),

  unidade: Object.freeze({
    position: 4,
    columnType: "varchar(100)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),

  professor_id: Object.freeze({
    position: 5,
    columnType: "int(11)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: null,
    collation: null,
  }),

  dias_semana: Object.freeze({
    position: 6,
    columnType: "varchar(100)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),

  horario: Object.freeze({
    position: 7,
    columnType: "varchar(100)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),

  capacidade: Object.freeze({
    position: 8,
    columnType: "int(11)",
    nullable: true,
    default: "20",
    autoIncrement: false,
    extra: "",
    charset: null,
    collation: null,
  }),

  status: Object.freeze({
    position: 9,
    columnType: "enum('ativa','inativa')",
    nullable: true,
    default: "ativa",
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),

  created_at: Object.freeze({
    position: 10,
    columnType: "timestamp",
    nullable: false,
    default: "CURRENT_TIMESTAMP",
    autoIncrement: false,
    extra: "",
    charset: null,
    collation: null,
  }),

  professor_nome: Object.freeze({
    position: 11,
    columnType: "varchar(191)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),

  modalidade_id: Object.freeze({
    position: 12,
    columnType: "int(11)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: null,
    collation: null,
  }),

  unidade_id: Object.freeze({
    position: 13,
    columnType: "int(11)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: null,
    collation: null,
  }),

  dias_semana_json: Object.freeze({
    position: 14,
    columnType: "longtext",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),

  horario_inicio: Object.freeze({
    position: 15,
    columnType: "varchar(20)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),

  horario_fim: Object.freeze({
    position: 16,
    columnType: "varchar(20)",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),

  aluno_ids_json: Object.freeze({
    position: 17,
    columnType: "longtext",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),

  presencas_json: Object.freeze({
    position: 18,
    columnType: "longtext",
    nullable: true,
    default: null,
    autoIncrement: false,
    extra: "",
    charset: "utf8",
    collation: "utf8_unicode_ci",
  }),
});

const legacyIndexes = Object.freeze({
  PRIMARY: Object.freeze({
    unique: true,
    columns: Object.freeze(["id"]),
  }),

  idx_j12_turmas_nome: Object.freeze({
    unique: false,
    columns: Object.freeze(["nome"]),
  }),

  idx_j12_turmas_professor_id: Object.freeze({
    unique: false,
    columns: Object.freeze(["professor_id"]),
  }),

  idx_j12_turmas_status: Object.freeze({
    unique: false,
    columns: Object.freeze(["status"]),
  }),
});

const acceptedLegacyDifferences = Object.freeze([
  "id/professor_id/modalidade_id/unidade_id: signed INT legado em vez de BIGINT canônico",
  "nome: varchar(255) legado em vez de varchar(191)",
  "modalidade/unidade/dias_semana: varchar(100) legado em vez de varchar(191)",
  "horario: varchar(100) legado em vez de varchar(50)",
  "capacidade: default legado 20",
  "status: ENUM('ativa','inativa') nullable legado em vez de varchar(30) NOT NULL",
  "created_at: TIMESTAMP legado em vez de DATETIME",
  "updated_at: coluna canônica ainda ausente no legado",
  "utf8/utf8_unicode_ci em vez de utf8mb4/utf8mb4_unicode_ci",
]);

const classesFoundationBaselineAdoption = Object.freeze({
  version: "CLASSES_FOUNDATION_LEGACY_V1",
  decisionDate: "2026-08-24",

  migrationId: CLASSES_FOUNDATION_MIGRATION,

  migrationChecksum: "831c913c9670ac4b42bb2a62821379276acfdc55b516758be9746d7aed4bee0f",

  role: "LEGACY_ACTIVE_DOMAIN_TABLE",
  classification: "LEGACY_READ_WRITE",
  acceptedState: "LEGACY_CLASSES_STRUCTURE_ACCEPTED",
  requiredState: "LEGACY_CLASSES_ADOPTION_REQUIRED",
  informationalReason: "AUDITED_LEGACY_CLASSES_ADOPTION",

  legacyTable: Object.freeze({
    name: "j12_turmas",
    engine: "InnoDB",
    charset: "utf8",
    collation: "utf8_unicode_ci",
    rowFormat: "Dynamic",
    createOptions: null,
    columns: legacyColumns,
    indexes: legacyIndexes,
    foreignKeys: Object.freeze({}),
  }),

  acceptedLegacyDifferences,

  acceptedTemporaryTableOptionDifferences: Object.freeze([
    Object.freeze({
      table: "j12_turmas",
      property: "charset",
      actual: "utf8",
      expected: "utf8mb4",
    }),
    Object.freeze({
      table: "j12_turmas",
      property: "collation",
      actual: "utf8_unicode_ci",
      expected: "utf8mb4_unicode_ci",
    }),
  ]),

  mandatoryCorrectiveMigrationId: null,

  restrictions: Object.freeze([
    "NO_AUTOMATIC_ID_TYPE_CONVERSION",
    "NO_AUTOMATIC_ENUM_CONVERSION",
    "NO_AUTOMATIC_TIMESTAMP_CONVERSION",
    "NO_AUTOMATIC_VARCHAR_SHRINK",
    "NO_AUTOMATIC_UPDATED_AT_DDL",
    "NO_AUTOMATIC_CHARSET_CONVERSION",
    "NO_SCHEMA_WRITE_DURING_BASELINE_ADOPTION",
  ]),

  evidence:
    "Snapshot read-only de j12_turmas em 2026-08-24 confirmou shape legado ativo, 18 colunas, quatro indices e ausencia de foreign keys.",

  preflight:
    "7 registros auditados; nenhum valor excede os limites canonicos observados; status atual exclusivamente 'ativa'.",
});

module.exports = {
  CLASSES_FOUNDATION_MIGRATION,
  acceptedLegacyDifferences,
  classesFoundationBaselineAdoption,
  legacyColumns,
  legacyIndexes,
};
