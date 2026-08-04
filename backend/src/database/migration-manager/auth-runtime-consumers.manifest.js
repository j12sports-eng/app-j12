"use strict";

const { AUTH_RUNTIME_CLASSIFICATION } = require("../auth-runtime-legacy-contract");

const J12_USUARIOS_RUNTIME_CONSUMERS = Object.freeze([
  Object.freeze({
    file: "backend/auth.js",
    access: Object.freeze(["READ", "WRITE"]),
    classification: "LEGACY_AUTH_ORCHESTRATOR",
    useCases: Object.freeze([
      "login dual-read com prioridade legada",
      "fallback JWT por source",
      "espelhamento bidirecional users/j12_usuarios",
      "troca de senha legada",
      "seed opt-in",
    ]),
  }),
  Object.freeze({
    file: "backend/src/routes/auth.routes.js",
    access: Object.freeze(["READ"]),
    classification: "LEGACY_DIRECT_LOGIN_ROUTE",
    useCases: Object.freeze(["login bcrypt direto em j12_usuarios"]),
  }),
  Object.freeze({
    file: "backend/src/services/portal-schema.service.js",
    access: Object.freeze(["READ", "WRITE", "DDL_BOOTSTRAP"]),
    classification: "LEGACY_PORTAL_COMPATIBILITY_SYNC",
    useCases: Object.freeze(["provisionamento e sincronizacao do portal do aluno"]),
  }),
  Object.freeze({
    file: "backend/src/config/db.js",
    access: Object.freeze(["READ", "DDL_BOOTSTRAP"]),
    classification: "LEGACY_SCHEMA_BOOTSTRAP",
    useCases: Object.freeze(["compatibilidade de schema", "vinculo responsavel/aluno"]),
  }),
  Object.freeze({
    file: "backend/scripts/criar-usuarios-completos.js",
    access: Object.freeze(["WRITE"]),
    classification: "LEGACY_MANUAL_SEED",
    useCases: Object.freeze(["bootstrap manual de usuario aluno"]),
  }),
  Object.freeze({
    file: "backend/src/domains/auth/infrastructure/auth-identity.composition.js",
    access: Object.freeze(["READ"]),
    classification: "AUTH_SOURCE_ADAPTER",
    useCases: Object.freeze(["validacao da origem legada por source_user_id"]),
  }),
  Object.freeze({
    file: "backend/src/domains/auth/application/services/auth-identity-application.service.js",
    access: Object.freeze(["REFERENCE"]),
    classification: "CANONICAL_IDENTITY_SOURCE_DISPATCH",
    useCases: Object.freeze(["despacho para o adapter de origem legado"]),
  }),
  Object.freeze({
    file: "backend/src/domains/auth/domain/entities/auth-identity.entity.js",
    access: Object.freeze(["REFERENCE"]),
    classification: "CANONICAL_IDENTITY_VALUE_OBJECT",
    useCases: Object.freeze(["normalizacao de source_user_id conforme a origem"]),
  }),
  Object.freeze({
    file: "backend/src/domains/auth/domain/enums/auth-identity-source.enum.js",
    access: Object.freeze(["REFERENCE"]),
    classification: "CANONICAL_IDENTITY_SOURCE_ENUM",
    useCases: Object.freeze(["declaracao da origem j12_usuarios"]),
  }),
]);

const AUTH_RUNTIME_TABLE_ROLES = Object.freeze({
  j12_usuarios: Object.freeze({
    role: "LEGACY_AUTH_TABLE",
    access: AUTH_RUNTIME_CLASSIFICATION.legacyAccess,
    idContract: "NUMERIC_INT_EXPOSED_AS_STRING_AT_CANONICAL_BOUNDARY",
  }),
  users: Object.freeze({
    role: "PRIMARY_AUTH_USER",
    access: "READ_WRITE",
    idContract: "VARCHAR_64",
  }),
  user_sessions: Object.freeze({
    role: "OPAQUE_SESSION_SUPPORT_FOR_USERS",
    access: "READ_WRITE_CLEANUP",
    idContract: "user_id references users.id implicitly",
  }),
  password_reset_tokens: Object.freeze({
    role: "PASSWORD_RESET_SUPPORT_FOR_USERS",
    access: "READ_WRITE_CLEANUP",
    idContract: "user_id references users.id implicitly",
  }),
  auth_identities: Object.freeze({
    role: "CANONICAL_IDENTITY_BRIDGE",
    access: "READ_WRITE",
    idContract: "source + source_user_id; no physical FK to legacy source",
  }),
  user_unit_memberships: Object.freeze({
    role: "CANONICAL_AUTHORIZATION_CONTEXT",
    access: "READ_WRITE",
    idContract: "FK auth_identity_id -> auth_identities.id",
  }),
});

module.exports = {
  AUTH_RUNTIME_TABLE_ROLES,
  J12_USUARIOS_RUNTIME_CONSUMERS,
};
