const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipBracketService } = require("../services/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");

test("ChampionshipBracketService generates automatic bracket from standings", async () => {
  const { bracketRepository, service } = createBracketHarness();

  const bracket = await service.generate(
    "camp-1",
    { includeThirdPlace: true, teamCount: 4 },
    { auth: { email: "admin@j12.test" } },
  );

  assert.equal(bracket.initialPhase, "SEMI_FINAL");
  assert.equal(bracket.mode, "AUTOMATIC");
  assert.equal(bracket.matches.length, 4);
  assert.equal(bracket.phases.find((phase) => phase.phase === "SEMI_FINAL").total, 2);
  assert.equal(bracket.phases.find((phase) => phase.phase === "FINAL").total, 1);
  assert.equal(bracket.phases.find((phase) => phase.phase === "THIRD_PLACE").total, 1);

  const semiFinals = bracketRepository.matches.filter((match) => match.phase === "SEMI_FINAL");
  const final = bracketRepository.matches.find((match) => match.phase === "FINAL");

  assert.equal(semiFinals[0].homeRegistrationId, "insc-1");
  assert.equal(semiFinals[0].awayRegistrationId, "insc-4");
  assert.equal(semiFinals[1].homeRegistrationId, "insc-2");
  assert.equal(semiFinals[1].awayRegistrationId, "insc-3");
  assert.equal(semiFinals[0].nextMatchId, final.id);
  assert.equal(semiFinals[1].nextMatchSlot, "AWAY");
});

test("ChampionshipBracketService generates manual bracket with placeholders", async () => {
  const { bracketRepository, service } = createBracketHarness();

  const bracket = await service.generate("camp-1", {
    initialPhase: "QUARTER_FINAL",
    manualMatches: [
      { awayRegistrationId: "insc-8", homeRegistrationId: "insc-1" },
      { awayRegistrationId: "insc-7", homeRegistrationId: "insc-2" },
    ],
    mode: "MANUAL",
  });

  const quarterFinals = bracketRepository.matches.filter(
    (match) => match.phase === "QUARTER_FINAL",
  );

  assert.equal(bracket.mode, "MANUAL");
  assert.equal(bracket.teamCount, 8);
  assert.equal(quarterFinals.length, 4);
  assert.equal(quarterFinals[0].homeRegistrationId, "insc-1");
  assert.equal(quarterFinals[2].homeRegistrationId, null);
});

test("ChampionshipBracketService advances winners and closes final results", async () => {
  const { bracketRepository, service } = createBracketHarness();
  const bracket = await service.generate("camp-1", { teamCount: 4 });
  const semiFinals = bracket.matches.filter((match) => match.phase === "SEMI_FINAL");
  const final = bracket.matches.find((match) => match.phase === "FINAL");

  await service.updateMatch(semiFinals[0].id, { awayScore: 0, homeScore: 2 });
  await service.advanceMatch(semiFinals[1].id, { winnerRegistrationId: "insc-2" });

  const finalAfterSemis = await bracketRepository.findMatchById(final.id);
  assert.equal(finalAfterSemis.homeRegistrationId, "insc-1");
  assert.equal(finalAfterSemis.awayRegistrationId, "insc-2");

  await service.updateMatch(final.id, { awayScore: 1, homeScore: 3 });

  const closed = await bracketRepository.findByChampionship("camp-1");
  assert.equal(closed.status, "FINISHED");
  assert.equal(closed.championRegistrationId, "insc-1");
  assert.equal(closed.runnerUpRegistrationId, "insc-2");
});

test("ChampionshipBracketService rejects repeated teams in manual bracket", async () => {
  const { service } = createBracketHarness();

  await assert.rejects(
    () =>
      service.generate("camp-1", {
        initialPhase: "SEMI_FINAL",
        manualMatches: [
          { awayRegistrationId: "insc-2", homeRegistrationId: "insc-1" },
          { awayRegistrationId: "insc-3", homeRegistrationId: "insc-1" },
        ],
        mode: "MANUAL",
      }),
    /Equipe repetida/,
  );
});

test("ChampionshipBracketService rejects duplicate matchup edits", async () => {
  const { service } = createBracketHarness();
  const bracket = await service.generate("camp-1", {
    initialPhase: "SEMI_FINAL",
    mode: "MANUAL",
  });
  const semiFinals = bracket.matches.filter((match) => match.phase === "SEMI_FINAL");

  await service.updateMatch(semiFinals[0].id, {
    awayRegistrationId: "insc-2",
    homeRegistrationId: "insc-1",
  });

  await assert.rejects(
    () =>
      service.updateMatch(semiFinals[1].id, {
        awayRegistrationId: "insc-2",
        homeRegistrationId: "insc-1",
      }),
    /Confronto duplicado/,
  );
});

test("ChampionshipBracketService rejects invalid phase input", async () => {
  const { service } = createBracketHarness();

  await assert.rejects(
    () => service.generate("camp-1", { initialPhase: "fase-invalida", mode: "MANUAL" }),
    /Fase do mata-mata invalida/,
  );
});

test("ChampionshipBracketService blocks delete after a bracket match starts", async () => {
  const { service } = createBracketHarness();
  const bracket = await service.generate("camp-1", { teamCount: 4 });
  const match = bracket.matches.find((item) => item.phase === "SEMI_FINAL");

  await service.updateMatch(match.id, { awayScore: 0, homeScore: 1 });

  await assert.rejects(() => service.deleteByChampionship("camp-1"), /iniciado nao pode/);
});

function createBracketHarness(options = {}) {
  const registrations =
    options.registrations ||
    Array.from({ length: 8 }, (_, index) =>
      createRegistration(`insc-${index + 1}`, `Equipe ${index + 1}`),
    );
  const championshipRepository = {
    async findById(id) {
      return id === "camp-1" ? { id, name: "Copa J12" } : null;
    },
  };
  const registrationRepository = {
    registrations,
    async findById(id) {
      return this.registrations.find((registration) => registration.id === id) || null;
    },
  };
  const standingService = {
    async recalculate() {
      return {
        items: registrations.map((registration, index) => ({
          overallPosition: index + 1,
          registrationId: registration.id,
          teamName: registration.teamName,
        })),
      };
    },
  };
  const bracketRepository = createInMemoryBracketRepository();

  return {
    bracketRepository,
    registrationRepository,
    service: new ChampionshipBracketService({
      bracketRepository,
      championshipRepository,
      registrationRepository,
      standingService,
    }),
  };
}

function createInMemoryBracketRepository() {
  return {
    bracket: null,
    matches: [],
    async deleteByChampionship() {
      const current = await this.findByChampionship("camp-1");
      this.bracket = null;
      this.matches = [];
      return current;
    },
    async findByChampionship(championshipId) {
      if (!this.bracket || this.bracket.championshipId !== championshipId) return null;
      return {
        ...this.bracket,
        matches: this.matches
          .filter((match) => match.championshipId === championshipId)
          .map((match) => ({ ...match })),
      };
    },
    async findByPhase(championshipId, phase) {
      const bracket = await this.findByChampionship(championshipId);
      if (!bracket) return null;
      return {
        ...bracket,
        matches: bracket.matches.filter((match) => match.phase === phase),
      };
    },
    async findMatchById(matchId) {
      const match = this.matches.find((item) => item.id === matchId);
      return match ? { ...match } : null;
    },
    async hasStarted(championshipId) {
      return this.matches.some(
        (match) =>
          match.championshipId === championshipId &&
          (match.status !== "SCHEDULED" ||
            match.homeScore !== null ||
            match.awayScore !== null ||
            Boolean(match.winnerRegistrationId)),
      );
    },
    async replaceByChampionship(championshipId, bracket, matches) {
      this.bracket = {
        championRegistrationId: null,
        runnerUpRegistrationId: null,
        thirdPlaceRegistrationId: null,
        ...bracket,
        championshipId,
      };
      this.matches = matches.map((match) => ({
        awayRegistrationId: null,
        awayScore: null,
        homeRegistrationId: null,
        homeScore: null,
        nextMatchId: null,
        nextMatchSlot: null,
        thirdPlaceMatchId: null,
        thirdPlaceSlot: null,
        winnerRegistrationId: null,
        ...match,
        bracketId: bracket.id,
        championshipId,
      }));
      return this.findByChampionship(championshipId);
    },
    async updateBracket(bracketId, input) {
      if (this.bracket?.id === bracketId) {
        Object.assign(this.bracket, input);
      }
      return this.findByChampionship(this.bracket?.championshipId);
    },
    async updateMatch(matchId, input) {
      const match = this.matches.find((item) => item.id === matchId);
      if (!match) return null;
      Object.assign(match, input);
      return this.findMatchById(matchId);
    },
  };
}

function createRegistration(id, teamName, status = RegistrationStatus.CONFIRMED) {
  return {
    championshipId: "camp-1",
    id,
    status,
    teamAcronym: teamName.replace("Equipe ", "E"),
    teamId: `team-${id}`,
    teamName,
  };
}
