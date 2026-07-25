const assert = require("node:assert/strict");
const test = require("node:test");
const { CREATE_DOCUMENTS_TABLE_SQL } = require("../20260725120000_create_digital_enrollment_documents.js");

test("modern document migration uses canonical ownership and progress foreign keys", () => {
  assert.match(CREATE_DOCUMENTS_TABLE_SQL, /digital_enrollment_documents/);
  assert.match(CREATE_DOCUMENTS_TABLE_SQL, /REFERENCES enrollments\(id\)/);
  assert.match(CREATE_DOCUMENTS_TABLE_SQL, /REFERENCES digital_enrollment_progress\(enrollment_id\)/);
  assert.match(CREATE_DOCUMENTS_TABLE_SQL, /REFERENCES person_relationships\(id\)/);
  assert.match(CREATE_DOCUMENTS_TABLE_SQL, /ENUM\('PENDING','APPROVED','REJECTED'\)/);
  assert.match(CREATE_DOCUMENTS_TABLE_SQL, /UNIQUE INDEX ux_ded_enrollment_hash \(enrollment_id, sha256\)/);
  assert.doesNotMatch(CREATE_DOCUMENTS_TABLE_SQL, /j12_alunos_documentos|student_documents|base64/i);
});
