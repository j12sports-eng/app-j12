-- Sprint 23.4 - Formalize the existing authentication runtime DDL.
-- Manual execution through the canonical migration runner only.

-- UP

CREATE TABLE IF NOT EXISTS j12_usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(191) NOT NULL,
  email VARCHAR(191) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(50) NOT NULL DEFAULT 'aluno',
  aluno_id VARCHAR(64) NULL,
  professor_id VARCHAR(64) NULL,
  responsavel_id VARCHAR(64) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ativo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_j12_usuarios_email (email),
  INDEX idx_j12_usuarios_perfil (perfil),
  INDEX idx_j12_usuarios_aluno (aluno_id),
  INDEX idx_j12_usuarios_professor (professor_id),
  INDEX idx_j12_usuarios_responsavel (responsavel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  email VARCHAR(191) NOT NULL,
  login VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  aluno_id VARCHAR(64) NULL,
  professor_id VARCHAR(64) NULL,
  responsavel_id VARCHAR(64) NULL,
  linked_aluno_id VARCHAR(64) NULL,
  class_scope_json LONGTEXT NULL,
  phone_whatsapp VARCHAR(50) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ativo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX uniq_users_email (email),
  UNIQUE INDEX uniq_users_login (login),
  INDEX idx_users_role (role),
  INDEX idx_users_aluno (aluno_id),
  INDEX idx_users_professor (professor_id),
  INDEX idx_users_responsavel (responsavel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_seen_at DATETIME NULL,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  channel VARCHAR(30) NOT NULL DEFAULT 'email',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  INDEX idx_password_reset_user (user_id),
  INDEX idx_password_reset_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN

-- No automatic DOWN is provided. Authentication tables may contain production
-- identities and sessions. Use an explicitly approved data/rollback plan.
