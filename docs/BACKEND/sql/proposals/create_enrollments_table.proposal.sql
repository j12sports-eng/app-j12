-- Sprint 9.17 - Enrollment Persistence Contract
-- PROPOSTA DOCUMENTAL. NAO EXECUTAR COMO MIGRATION ATIVA.
-- Este arquivo define o contrato proposto para a tabela `enrollments`.
-- Nenhum banco foi alterado nesta sprint.

CREATE TABLE IF NOT EXISTS enrollments (
  id VARCHAR(64) PRIMARY KEY,
  student_person_id VARCHAR(64) NOT NULL,
  student_profile_id VARCHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  start_date DATE NOT NULL,
  end_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,

  CONSTRAINT fk_enrollments_student_person
    FOREIGN KEY (student_person_id)
    REFERENCES people (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_enrollments_student_profile
    FOREIGN KEY (student_profile_id)
    REFERENCES person_profiles (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  INDEX idx_enrollments_student_person (student_person_id),
  INDEX idx_enrollments_student_profile (student_profile_id),
  INDEX idx_enrollments_status (status),
  INDEX idx_enrollments_student_profile_status_deleted (
    student_profile_id,
    status,
    deleted_at
  ),
  INDEX idx_enrollments_student_person_deleted (
    student_person_id,
    deleted_at
  ),
  INDEX idx_enrollments_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback futuro, somente se uma migration real for executada em sprint futura:
-- DROP TABLE IF EXISTS enrollments;
