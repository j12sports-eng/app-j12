/**
 * Future Person entity for the App J12 architecture.
 *
 * The entity is intentionally a lightweight data holder. It has no persistence,
 * no SQL, no validation rules and no integration with existing modules.
 */
class Person {
  /**
   * @param {import("./person.types.js").PersonData} [data]
   */
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.name = data.name ?? null;
    this.documents = Array.isArray(data.documents) ? data.documents : [];
    this.contact = data.contact ?? null;
    this.address = data.address ?? null;
    this.profiles = Array.isArray(data.profiles) ? data.profiles : [];
    this.birthDate = data.birthDate ?? null;
    this.birthCity = data.birthCity ?? null;
    this.birthState = data.birthState ?? null;
    this.nationality = data.nationality ?? null;
    this.bloodType = data.bloodType ?? null;
    this.status = data.status ?? null;
    this.createdAt = data.createdAt ?? null;
    this.updatedAt = data.updatedAt ?? null;
  }

  /**
   * Returns a plain object representation for future mappers/adapters.
   *
   * @returns {import("./person.types.js").PersonData}
   */
  toJSON() {
    return {
      address: this.address,
      birthCity: this.birthCity,
      birthDate: this.birthDate,
      birthState: this.birthState,
      bloodType: this.bloodType,
      contact: this.contact,
      createdAt: this.createdAt,
      documents: this.documents,
      id: this.id,
      name: this.name,
      nationality: this.nationality,
      profiles: this.profiles,
      status: this.status,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = {
  Person,
};
