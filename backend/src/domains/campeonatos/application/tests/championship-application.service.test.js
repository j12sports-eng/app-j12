const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipApplicationService } = require("../services/index.js");

test("ChampionshipApplicationService creates and lists championships through repository", async () => {
  const repository = createMemoryRepository();
  const service = new ChampionshipApplicationService({
    championshipRepository: repository,
  });

  const created = await service.create(
    {
      category: "Livre",
      endDate: "2026-10-31",
      logo: {
        fileId: "file-liga-j12",
        storageKey: "campeonatos/liga-j12.png",
      },
      modality: "Futsal",
      name: "Liga J12",
      startDate: "2026-10-01",
    },
    { auth: { email: "admin@j12.test" } },
  );
  const list = await service.findAll();

  assert.equal(created.name, "Liga J12");
  assert.equal(created.createdBy, "admin@j12.test");
  assert.equal(created.logo.fileId, "file-liga-j12");
  assert.equal(created.logo.storageKey, "campeonatos/liga-j12.png");
  assert.equal(list.total, 1);
  assert.equal(list.items[0].id, created.id);
});

test("ChampionshipApplicationService updates, publishes, archives and removes", async () => {
  const repository = createMemoryRepository();
  const service = new ChampionshipApplicationService({
    championshipRepository: repository,
  });
  const created = await service.create({
    category: "Livre",
    endDate: "2026-10-31",
    modality: "Futsal",
    name: "Liga J12",
    startDate: "2026-10-01",
  });

  const updated = await service.update(created.id, { name: "Liga J12 Atualizada" });
  const published = await service.publish(created.id);
  const archived = await service.archive(created.id);
  const removed = await service.remove(created.id);

  assert.equal(updated.name, "Liga J12 Atualizada");
  assert.equal(published.status, "PUBLISHED");
  assert.equal(archived.status, "ARCHIVED");
  assert.equal(removed.status, "REMOVED");
});

test("ChampionshipApplicationService rejects partial date update with invalid persisted range", async () => {
  const repository = createMemoryRepository();
  const service = new ChampionshipApplicationService({
    championshipRepository: repository,
  });
  const created = await service.create({
    category: "Livre",
    endDate: "2026-10-31",
    modality: "Futsal",
    name: "Liga J12",
    startDate: "2026-10-01",
  });

  await assert.rejects(
    () => service.update(created.id, { startDate: "2026-11-01" }),
    /Data final deve ser igual ou posterior/,
  );
});

function createMemoryRepository() {
  const records = new Map();

  return {
    async archive(id, values) {
      return updateRecord(id, { status: values.status, updatedBy: values.updatedBy });
    },
    async create(values) {
      const id = values.id || `camp-${records.size + 1}`;
      const record = {
        archivedAt: null,
        createdAt: "2026-07-04T00:00:00.000Z",
        deletedAt: null,
        id,
        publishedAt: null,
        updatedAt: "2026-07-04T00:00:00.000Z",
        ...values,
      };
      records.set(id, record);
      return record;
    },
    async findAll() {
      return Array.from(records.values()).filter((item) => !item.deletedAt);
    },
    async findById(id) {
      return records.get(id) || null;
    },
    async publish(id, values) {
      return updateRecord(id, { status: values.status, updatedBy: values.updatedBy });
    },
    async remove(id, values) {
      return updateRecord(id, {
        deletedAt: "2026-07-04T00:00:00.000Z",
        status: "REMOVED",
        updatedBy: values.updatedBy,
      });
    },
    async update(id, values) {
      return updateRecord(id, values);
    },
  };

  function updateRecord(id, values) {
    const current = records.get(id);
    if (!current) return null;
    const next = { ...current, ...values, updatedAt: "2026-07-04T00:00:00.000Z" };
    records.set(id, next);
    return next;
  }
}
