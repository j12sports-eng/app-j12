const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ACTIVE_LINK_UNIQUE_INDEX,
  MySqlEnrollmentClassLinkRepository,
} = require("./mysql-enrollment-class-link.repository.js");

test("MySqlEnrollmentClassLinkRepository reuses an existing ACTIVE link on duplicate insert", async () => {
  const existingLink = {
    id: "link-1",
    enrollment_id: "enrollment-1",
    class_id: 42,
    status: "ACTIVE",
    linked_at: "2026-07-01 10:00:00",
    linked_by: "user-1",
    created_at: "2026-07-01 10:00:00",
    updated_at: "2026-07-01 10:00:00",
  };

  let insertAttempted = false;
  const queryRunner = async (sql, params = []) => {
    if (sql.includes("INSERT INTO")) {
      insertAttempted = true;
      const error = new Error(`Duplicate entry for key '${ACTIVE_LINK_UNIQUE_INDEX}'`);
      error.code = "ER_DUP_ENTRY";
      error.errno = 1062;
      throw error;
    }

    assert.match(sql, /SELECT \*/);
    assert.deepEqual(params, ["enrollment-1", 42, "ACTIVE"]);
    return [existingLink];
  };

  const repository = new MySqlEnrollmentClassLinkRepository({ queryRunner });
  const result = await repository.createOrReuseActiveLink({
    enrollmentId: "enrollment-1",
    classId: 42,
    linkedBy: "user-1",
  });

  assert.equal(insertAttempted, true);
  assert.deepEqual(result, {
    classId: 42,
    createdAt: "2026-07-01 10:00:00",
    enrollmentId: "enrollment-1",
    id: "link-1",
    linkedAt: "2026-07-01 10:00:00",
    linkedBy: "user-1",
    metadata: {},
    origin: null,
    status: "ACTIVE",
    unlinkedAt: null,
    unlinkedBy: null,
    updatedAt: "2026-07-01 10:00:00",
  });
});
