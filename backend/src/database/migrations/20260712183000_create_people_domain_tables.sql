-- Sprint 23.4 - Formalize the existing Pessoas domain runtime DDL.
-- Manual execution through the canonical migration runner only.

-- UP

CREATE TABLE IF NOT EXISTS people (
  id VARCHAR(64) PRIMARY KEY,
  nome VARCHAR(191) NOT NULL,
  cpf VARCHAR(20) NULL,
  rg VARCHAR(30) NULL,
  sexo VARCHAR(30) NULL,
  data_nascimento DATE NULL,
  email VARCHAR(191) NULL,
  telefone VARCHAR(50) NULL,
  celular VARCHAR(50) NULL,
  cep VARCHAR(20) NULL,
  logradouro VARCHAR(191) NULL,
  numero VARCHAR(30) NULL,
  bairro VARCHAR(191) NULL,
  cidade VARCHAR(191) NULL,
  estado VARCHAR(50) NULL,
  complemento VARCHAR(191) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_people_nome (nome),
  INDEX idx_people_cpf (cpf),
  INDEX idx_people_email (email),
  INDEX idx_people_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS person_profiles (
  id VARCHAR(64) PRIMARY KEY,
  person_id VARCHAR(64) NOT NULL,
  profile_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ativo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_person_profiles_person (person_id),
  INDEX idx_person_profiles_type (profile_type),
  INDEX idx_person_profiles_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS person_relationships (
  id VARCHAR(64) PRIMARY KEY,
  person_id VARCHAR(64) NOT NULL,
  related_person_id VARCHAR(64) NOT NULL,
  relationship_type VARCHAR(50) NOT NULL,
  relationship_label VARCHAR(100) NULL,
  priority INT NULL,
  receives_notifications TINYINT(1) NOT NULL DEFAULT 0,
  financial_responsible TINYINT(1) NOT NULL DEFAULT 0,
  can_pick_up TINYINT(1) NOT NULL DEFAULT 0,
  emergency_contact TINYINT(1) NOT NULL DEFAULT 0,
  legal_guardian TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  valid_from DATE NULL,
  valid_until DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_person_relationships_person (person_id),
  INDEX idx_person_relationships_related_person (related_person_id),
  INDEX idx_person_relationships_type (relationship_type),
  INDEX idx_person_relationships_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pre_matriculas (
  id VARCHAR(64) PRIMARY KEY,
  status ENUM('PENDENTE', 'EM_ANALISE', 'APROVADA', 'REJEITADA', 'CANCELADA') NOT NULL DEFAULT 'PENDENTE',
  aluno_nome VARCHAR(191) NOT NULL,
  aluno_data_nascimento DATE NOT NULL,
  aluno_sexo VARCHAR(30) NULL,
  aluno_unidade_interesse VARCHAR(191) NOT NULL,
  aluno_modalidade VARCHAR(191) NOT NULL,
  aluno_observacoes TEXT NULL,
  responsavel_nome VARCHAR(191) NOT NULL,
  responsavel_cpf VARCHAR(20) NOT NULL,
  responsavel_telefone VARCHAR(50) NOT NULL,
  responsavel_whatsapp VARCHAR(50) NOT NULL,
  responsavel_email VARCHAR(191) NOT NULL,
  pessoa_aluno_id VARCHAR(64) NULL,
  pessoa_responsavel_id VARCHAR(64) NULL,
  origem VARCHAR(50) NOT NULL DEFAULT 'pre_matricula',
  metadata_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pre_matriculas_status (status),
  INDEX idx_pre_matriculas_responsavel_cpf (responsavel_cpf),
  INDEX idx_pre_matriculas_created_at (created_at),
  INDEX idx_pre_matriculas_pessoa_aluno (pessoa_aluno_id),
  INDEX idx_pre_matriculas_pessoa_responsavel (pessoa_responsavel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN

-- No automatic DOWN is provided. These tables predate the ledger and may contain
-- production data. Use an explicitly approved data migration/rollback plan.
