class ChampionshipRegistrationPlayer {
  constructor(input = {}) {
    this.id = input.id || null;
    this.registrationId = input.registrationId || null;
    this.athleteId = input.athleteId || null;
    this.name = input.name || null;
    this.birthDate = input.birthDate || null;
    this.document = input.document || null;
    this.shirtNumber = normalizeShirtNumber(input.shirtNumber);
    this.position = input.position || null;
    this.captain = Boolean(input.captain);
    this.active = typeof input.active === "boolean" ? input.active : true;
    this.createdAt = input.createdAt || null;
    this.updatedAt = input.updatedAt || null;
    this.createdBy = input.createdBy || null;
    this.updatedBy = input.updatedBy || null;
  }

  static fromPersistence(row = {}) {
    return new ChampionshipRegistrationPlayer({
      active: typeof row.active === "boolean" ? row.active : Number(row.active ?? 1) === 1,
      athleteId: row.athlete_id || row.athleteId || null,
      birthDate: row.birth_date || row.birthDate || null,
      captain: typeof row.captain === "boolean" ? row.captain : Number(row.captain || 0) === 1,
      createdAt: row.created_at || row.createdAt || null,
      createdBy: row.created_by || row.createdBy || null,
      document: row.document || null,
      id: row.id || null,
      name: row.name || null,
      position: row.position || null,
      registrationId: row.registration_id || row.registrationId || null,
      shirtNumber: row.shirt_number || row.shirtNumber || null,
      updatedAt: row.updated_at || row.updatedAt || null,
      updatedBy: row.updated_by || row.updatedBy || null,
    });
  }

  toJSON() {
    return {
      active: this.active,
      athleteId: this.athleteId,
      birthDate: this.birthDate,
      captain: this.captain,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      document: this.document,
      id: this.id,
      name: this.name,
      position: this.position,
      registrationId: this.registrationId,
      shirtNumber: this.shirtNumber,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }
}

function normalizeShirtNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

module.exports = {
  ChampionshipRegistrationPlayer,
};
