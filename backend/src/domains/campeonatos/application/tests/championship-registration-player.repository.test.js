const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  MySqlChampionshipRegistrationPlayerRepository,
} = require("../../infrastructure/repositories/index.js");

test("MySqlChampionshipRegistrationPlayerRepository persists roster lifecycle with query runner", async () => {
  const { repository } = createRepositoryHarness([
    {
      active: 1,
      captain: 1,
      id: "player-1",
      name: "Ana",
      registration_id: "insc-1",
      shirt_number: 8,
    },
  ]);

  const created = await repository.create({
    name: "Bia",
    position: "Ala",
    registrationId: "insc-1",
    shirtNumber: 9,
  });
  assert.equal(created.name, "Bia");
  assert.equal(created.registrationId, "insc-1");

  const duplicate = await repository.findByRegistrationAndShirtNumber("insc-1", 9);
  assert.equal(duplicate.id, created.id);

  const updated = await repository.update("insc-1", created.id, {
    name: "Bia Souza",
    shirtNumber: 10,
    updatedBy: "admin@j12.test",
  });
  assert.equal(updated.name, "Bia Souza");
  assert.equal(updated.shirtNumber, 10);

  const captain = await repository.setCaptain("insc-1", created.id, {
    updatedBy: "admin@j12.test",
  });
  assert.equal(captain.captain, true);
  assert.equal((await repository.findByRegistrationAndId("insc-1", "player-1")).captain, false);

  const list = await repository.findAllByRegistration("insc-1", {
    active: true,
    limit: 20,
    page: 1,
    sortBy: "shirtNumber",
    sortDirection: "ASC",
  });
  assert.equal(list.total, 2);
  assert.equal(list.items[0].shirtNumber, 8);

  const deactivated = await repository.deactivate("insc-1", created.id, {
    updatedBy: "admin@j12.test",
  });
  assert.equal(deactivated.active, false);
  assert.equal(deactivated.captain, false);
});

function createRepositoryHarness(initialRows = []) {
  const rows = initialRows.map((row) => ({
    active: 1,
    athlete_id: null,
    birth_date: null,
    captain: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: null,
    document: null,
    position: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: null,
    ...row,
  }));

  async function queryRunner(sql, params = []) {
    return runFakeQuery(rows, sql, params);
  }

  const repository = new MySqlChampionshipRegistrationPlayerRepository({
    queryRunner,
    transactionRunner: async (work) =>
      work({
        execute: async (sql, params = []) => [await runFakeQuery(rows, sql, params)],
      }),
  });

  return { repository, rows };
}

function runFakeQuery(rows, sql, params = []) {
  const normalized = sql.replace(/\s+/g, " ").trim();

  if (normalized.startsWith("CREATE TABLE")) return [];

  if (normalized.startsWith("INSERT INTO")) {
    rows.push({
      active: params[9],
      athlete_id: params[2],
      birth_date: params[4],
      captain: params[8],
      created_at: "2026-01-01T00:00:00.000Z",
      created_by: params[10],
      document: params[5],
      id: params[0],
      name: params[3],
      position: params[7],
      registration_id: params[1],
      shirt_number: params[6],
      updated_at: "2026-01-01T00:00:00.000Z",
      updated_by: params[11],
    });
    return { affectedRows: 1 };
  }

  if (normalized.startsWith("SELECT COUNT(*) AS total")) {
    return [{ total: filterRows(rows, normalized, params).length }];
  }

  if (normalized.includes("WHERE player.registration_id = ? AND player.id = ?")) {
    return rows.filter((row) => row.registration_id === params[0] && row.id === params[1]);
  }

  if (normalized.includes("WHERE player.registration_id = ? AND player.shirt_number = ?")) {
    return rows.filter(
      (row) =>
        row.registration_id === params[0] &&
        Number(row.shirt_number) === Number(params[1]) &&
        Number(row.active) === 1 &&
        (!params[2] || row.id !== params[2]),
    );
  }

  if (normalized.includes("WHERE player.registration_id = ? AND player.captain = 1")) {
    return rows.filter(
      (row) =>
        row.registration_id === params[0] && Number(row.captain) === 1 && Number(row.active) === 1,
    );
  }

  if (normalized.includes("ORDER BY")) {
    return filterRows(rows, normalized, params).sort(
      (left, right) => Number(left.shirt_number) - Number(right.shirt_number),
    );
  }

  if (normalized.startsWith("UPDATE") && normalized.includes("SET active = 0")) {
    const row = rows.find((item) => item.registration_id === params[1] && item.id === params[2]);
    if (row) {
      row.active = 0;
      row.captain = 0;
      row.updated_by = params[0];
    }
    return { affectedRows: row ? 1 : 0 };
  }

  if (normalized.startsWith("UPDATE") && normalized.includes("SET captain = 0")) {
    const registrationId = params[1];
    const playerId = params[2];
    for (const row of rows) {
      const sameRegistration = row.registration_id === registrationId;
      const samePlayer = !playerId || row.id === playerId;
      if (sameRegistration && samePlayer && Number(row.active) === 1) {
        row.captain = 0;
        row.updated_by = params[0];
      }
    }
    return { affectedRows: 1 };
  }

  if (normalized.startsWith("UPDATE") && normalized.includes("SET captain = 1")) {
    const row = rows.find((item) => item.registration_id === params[1] && item.id === params[2]);
    if (row && Number(row.active) === 1) {
      row.captain = 1;
      row.updated_by = params[0];
    }
    return { affectedRows: row ? 1 : 0 };
  }

  if (normalized.startsWith("UPDATE")) {
    const registrationId = params.at(-2);
    const playerId = params.at(-1);
    const row = rows.find(
      (item) => item.registration_id === registrationId && item.id === playerId,
    );
    if (!row) return { affectedRows: 0 };

    let index = 0;
    if (normalized.includes("athlete_id = ?")) row.athlete_id = params[index++];
    if (normalized.includes("birth_date = ?")) row.birth_date = params[index++];
    if (normalized.includes("document = ?")) row.document = params[index++];
    if (normalized.includes("name = ?")) row.name = params[index++];
    if (normalized.includes("position = ?")) row.position = params[index++];
    if (normalized.includes("shirt_number = ?")) row.shirt_number = params[index++];
    if (normalized.includes("captain = ?")) row.captain = params[index++];
    if (normalized.includes("active = ?")) row.active = params[index++];
    row.updated_by = params[index];
    return { affectedRows: 1 };
  }

  return [];
}

function filterRows(rows, sql, params) {
  const registrationId = params[0];
  let active = null;

  if (sql.includes("player.active = ?")) {
    active = Number(params[1]);
  }

  return rows.filter(
    (row) =>
      row.registration_id === registrationId && (active === null || Number(row.active) === active),
  );
}
