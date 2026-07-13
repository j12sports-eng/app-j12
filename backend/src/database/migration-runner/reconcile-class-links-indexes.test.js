const assert = require("node:assert/strict");
const test = require("node:test");

const {
  INDEX_COLUMNS,
  assertCompatibleIndex,
  down,
} = require("../migrations/20260713101500_reconcile_enrollment_class_links_indexes.js");

test("class-link reconciliation accepts only the expected non-unique index", () => {
  assert.equal(INDEX_COLUMNS, "enrollment_id,status");
  assert.doesNotThrow(() =>
    assertCompatibleIndex({
      INDEX_NAME: "idx_enrollment_class_links_enrollment_status",
      NON_UNIQUE: 1,
      columns: INDEX_COLUMNS,
    }),
  );
  assert.throws(
    () => assertCompatibleIndex({ NON_UNIQUE: 0, columns: INDEX_COLUMNS }),
    /Incompatible existing index/,
  );
});

test("class-link reconciliation refuses destructive rollback", async () => {
  await assert.rejects(() => down(), /Refusing to drop/);
});
