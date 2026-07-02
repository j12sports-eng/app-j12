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
