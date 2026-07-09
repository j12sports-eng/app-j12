class ChampionshipRegistrationPlayerRepository {
  async create() {
    throw new Error("ChampionshipRegistrationPlayerRepository.create not implemented");
  }

  async update() {
    throw new Error("ChampionshipRegistrationPlayerRepository.update not implemented");
  }

  async deactivate() {
    throw new Error("ChampionshipRegistrationPlayerRepository.deactivate not implemented");
  }

  async findByRegistrationAndId() {
    throw new Error(
      "ChampionshipRegistrationPlayerRepository.findByRegistrationAndId not implemented",
    );
  }

  async findByRegistrationAndShirtNumber() {
    throw new Error(
      "ChampionshipRegistrationPlayerRepository.findByRegistrationAndShirtNumber not implemented",
    );
  }

  async findCaptainByRegistration() {
    throw new Error(
      "ChampionshipRegistrationPlayerRepository.findCaptainByRegistration not implemented",
    );
  }

  async findAllByRegistration() {
    throw new Error(
      "ChampionshipRegistrationPlayerRepository.findAllByRegistration not implemented",
    );
  }

  async setCaptain() {
    throw new Error("ChampionshipRegistrationPlayerRepository.setCaptain not implemented");
  }
}

module.exports = {
  ChampionshipRegistrationPlayerRepository,
};
