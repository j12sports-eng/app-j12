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
