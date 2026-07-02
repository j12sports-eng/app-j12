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
