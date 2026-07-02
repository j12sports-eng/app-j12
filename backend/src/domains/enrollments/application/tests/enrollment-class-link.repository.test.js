const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACTIVE_LINK_UNIQUE_INDEX,
  MySqlEnrollmentClassLinkRepository,
} = require("../../infrastructure/repositories/mysql-enrollment-class-link.repository.js");

test("MySqlEnrollmentClassLinkRepository creates an active link and maps the saved row", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentClassLinkRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });

      if (sql.includes("INSERT INTO enrollment_class_links")) {
        return { affectedRows: 1 };
      }

      if (sql.includes("WHERE id = ?")) {
        return [
          {
            class_id: 10,
            created_at: "2026-07-01 10:00:00",
            enrollment_id: "enrollment-1",
            id: params[0],
            linked_at: "2026-07-01 10:00:00",
            linked_by: "admin@j12.local",
            metadata_json: "{\"source\":\"test\"}",
            origin: "ADMIN",
            status: "ACTIVE",
            updated_at: "2026-07-01 10:00:00",
          },
        ];
      }

      return [];
    },
  });

  const result = await repository.createActiveLinkIfNotExists({
    classId: 10,
    enrollmentId: "enrollment-1",
    linkedBy: "admin@j12.local",
    metadata: { source: "test" },
    origin: "ADMIN",
  });

  assert.equal(result.created, true);
  assert.equal(result.reused, false);
  assert.match(result.link.id, /^[0-9a-f-]{36}$/i);
  assert.equal(result.link.classId, 10);
  assert.equal(result.link.enrollmentId, "enrollment-1");
  assert.equal(result.link.metadata.source, "test");
  assert.equal(calls.length, 2);
});

test("MySqlEnrollmentClassLinkRepository reuses existing active link on unique duplicate", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentClassLinkRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });

      if (sql.includes("INSERT INTO enrollment_class_links")) {
        const error = new Error(`Duplicate entry for key '${ACTIVE_LINK_UNIQUE_INDEX}'`);
        error.code = "ER_DUP_ENTRY";
        error.errno = 1062;
        throw error;
      }

      return [
        {
          class_id: 10,
          enrollment_id: "enrollment-1",
          id: "link-8",
          linked_at: "2026-07-01 10:00:00",
          linked_by: "admin@j12.local",
          origin: "ADMIN",
          status: "ACTIVE",
        },
      ];
    },
  });

  const result = await repository.createActiveLinkIfNotExists({
    classId: 10,
    enrollmentId: "enrollment-1",
    linkedBy: "admin@j12.local",
  });

  assert.equal(result.created, false);
  assert.equal(result.reused, true);
  assert.equal(result.link.id, "link-8");
  assert.equal(result.link.status, "ACTIVE");
  assert.equal(calls.length, 2);
});

test("MySqlEnrollmentClassLinkRepository exposes a compatibility alias for create or reuse", async () => {
  const repository = new MySqlEnrollmentClassLinkRepository({
    async queryRunner(sql, params) {
      if (sql.includes("INSERT INTO enrollment_class_links")) {
        return { affectedRows: 1 };
      }

      if (sql.includes("WHERE id = ?")) {
        return [
          {
            class_id: 11,
            enrollment_id: "enrollment-2",
            id: params[0],
            linked_by: "admin@j12.local",
            status: "ACTIVE",
          },
        ];
      }

      return [];
    },
  });

  const result = await repository.createOrReuseActiveLink({
    classId: 11,
    enrollmentId: "enrollment-2",
    linkedBy: "admin@j12.local",
  });

  assert.equal(result.classId, 11);
  assert.equal(result.enrollmentId, "enrollment-2");
  assert.equal(result.status, "ACTIVE");
});

test("MySqlEnrollmentClassLinkRepository counts active class links without reading Turmas", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentClassLinkRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      return [{ active_link_count: 2 }];
    },
  });

  const result = await repository.getClassCapacitySnapshot({ classId: 12 });

  assert.deepEqual(result, {
    activeLinkCount: 2,
    availableCapacity: null,
    capacity: null,
    classId: 12,
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /COUNT\(\*\) AS active_link_count/);
  assert.doesNotMatch(calls[0].sql, /j12_turmas/);
  assert.deepEqual(calls[0].params, [12, "ACTIVE"]);
});

test("MySqlEnrollmentClassLinkRepository unlinks an active link without touching Turmas", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentClassLinkRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      return [];
    },
  });

  const result = await repository.unlinkActiveLink({
    classId: 10,
    enrollmentId: "enrollment-1",
    unlinkedBy: "admin@j12.local",
  });

  assert.equal(result, null);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /UPDATE enrollment_class_links/);
  assert.doesNotMatch(calls[0].sql, /j12_turmas/);
  assert.doesNotMatch(calls[0].sql, /j12_alunos/);
});
