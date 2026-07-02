-- Sprint 9.20 - Create enrollments table
-- Manual execution only. Do not run from build, startup or deploy scripts.

-- UP

CREATE TABLE IF NOT EXISTS enrollments (
  id VARCHAR(64) NOT NULL,
  student_person_id VARCHAR(64) NOT NULL,
  student_profile_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
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
  INDEX idx_enrollments_student_person_id (student_person_id),
  INDEX idx_enrollments_student_profile_id (student_profile_id),
  INDEX idx_enrollments_status (status),
  INDEX idx_enrollments_deleted_at (deleted_at),
  INDEX idx_enrollments_student_status (student_person_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN

DROP TABLE IF EXISTS enrollments;
