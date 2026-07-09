class ChampionshipRegistrationRepository {
  async create() {
    throw new Error("ChampionshipRegistrationRepository.create must be implemented.");
  }

  async update() {
    throw new Error("ChampionshipRegistrationRepository.update must be implemented.");
  }

  async findById() {
    throw new Error("ChampionshipRegistrationRepository.findById must be implemented.");
  }

  async findByChampionshipAndTeam() {
    throw new Error(
      "ChampionshipRegistrationRepository.findByChampionshipAndTeam must be implemented.",
    );
  }

  async findAll() {
    throw new Error("ChampionshipRegistrationRepository.findAll must be implemented.");
  }

  async countActiveByChampionship() {
    throw new Error(
      "ChampionshipRegistrationRepository.countActiveByChampionship must be implemented.",
    );
  }

  async findAvailableTeams() {
    throw new Error("ChampionshipRegistrationRepository.findAvailableTeams must be implemented.");
  }

  async findTeamById() {
    throw new Error("ChampionshipRegistrationRepository.findTeamById must be implemented.");
  }
}

module.exports = {
  ChampionshipRegistrationRepository,
};
