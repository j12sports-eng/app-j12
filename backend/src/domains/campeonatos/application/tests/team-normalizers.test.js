const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  normalizeTeamShield,
  normalizeTechnicalCommission,
} = require("../../shared/utils/index.js");

test("normalizeTeamShield accepts future file references without upload payload", () => {
  const shield = normalizeTeamShield({
    fileId: "file-team-1",
    publicUrl: "https://cdn.j12.test/equipes/time-a.png",
    storageKey: "campeonatos/equipes/time-a.png",
  });

  assert.equal(shield.fileId, "file-team-1");
  assert.equal(shield.id, "file-team-1");
  assert.equal(shield.publicUrl, "https://cdn.j12.test/equipes/time-a.png");
  assert.equal(shield.storageKey, "campeonatos/equipes/time-a.png");
});

test("normalizeTeamShield rejects real upload payloads", () => {
  assert.throws(
    () => normalizeTeamShield({ file: { name: "escudo.png" } }),
    /Upload de escudo ainda nao esta disponivel/,
  );
});

test("normalizeTechnicalCommission keeps only prepared member structure", () => {
  const commission = normalizeTechnicalCommission([
    {
      email: "tecnico@j12.test",
      funcao: "Tecnico",
      nome: "Carlos J12",
      telefone: "(11) 99999-0000",
    },
    {},
  ]);

  assert.deepEqual(commission, [
    {
      email: "tecnico@j12.test",
      name: "Carlos J12",
      phone: "(11) 99999-0000",
      role: "Tecnico",
    },
  ]);
});
