"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { EXIT_CODES } = require("../../j12-doctor/constants");
const { main, parseArguments } = require("../cli");

function outputs() {
  let stdout = "";
  let stderr = "";
  return {
    output: {
      write(value) {
        stdout += value;
      },
    },
    errorOutput: {
      write(value) {
        stderr += value;
      },
    },
    read: () => ({ stdout, stderr }),
  };
}

test("baseline exige modo explícito --dry-run ou --write", () => {
  assert.throws(
    () => parseArguments(["baseline", "--confirm-database=j12"]),
    /baseline exige exatamente um modo/,
  );
  assert.equal(parseArguments(["baseline", "--dry-run", "--confirm-database=j12"]).dryRun, true);
});

test("apply e report ficam bloqueados", async () => {
  for (const command of ["apply", "report"]) {
    let created = false;
    const io = outputs();
    const code = await main([command], {
      env: {},
      createClient() {
        created = true;
      },
      ...io,
    });
    assert.equal(code, EXIT_CODES.USAGE);
    assert.equal(created, false);
    assert.match(io.read().stderr, /não implementado/);
  }
});

test("apply-one exige modo e migration antes de abrir conexão", async () => {
  for (const argv of [
    ["apply-one"],
    ["apply-one", "--dry-run"],
    ["apply-one", "--write", "--migration=m1"],
  ]) {
    let created = false;
    const io = outputs();
    const code = await main(argv, {
      env: {},
      createClient() {
        created = true;
      },
      ...io,
    });
    assert.equal(code, EXIT_CODES.USAGE);
    assert.equal(created, false);
  }
});

test("confirma o banco antes de criar cliente e bloqueia remoto sem autorização", async () => {
  for (const argv of [["plan"], ["plan", "--confirm-database=j12"]]) {
    let created = false;
    const io = outputs();
    const code = await main(argv, {
      env: { DB_HOST: "db.example", DB_NAME: "j12" },
      createClient() {
        created = true;
      },
      ...io,
    });
    assert.equal(code, EXIT_CODES.USAGE);
    assert.equal(created, false);
  }
});

test("execução com fakes fecha cliente e retorna relatório", async () => {
  let closed = false;
  const io = outputs();
  const result = {
    command: "plan",
    database: { host: "localhost", name: "j12", remote: false },
    summary: { total: 1, present: 1, absent: 0, drift: 0, baselineReady: 0, unknown: 0 },
    present: [{ id: "m1" }],
    absent: [],
    drift: [],
    baselineReady: [],
    doctorSummary: { severityCounts: { CRITICAL: 0, HIGH: 0, WARNING: 0 } },
  };
  const code = await main(["plan", "--confirm-database=j12", "--format=json"], {
    env: { DB_HOST: "localhost", DB_NAME: "j12" },
    createClient() {
      return {
        query() {},
        async close() {
          closed = true;
        },
      };
    },
    manager: {
      async run() {
        return result;
      },
    },
    ...io,
  });
  assert.equal(code, EXIT_CODES.CLEAN);
  assert.equal(closed, true);
  assert.equal(JSON.parse(io.read().stdout).command, "plan");
});
