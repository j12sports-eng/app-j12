class ChampionshipPublicRepository {
  async findPublishedAll() {
    throw new Error("ChampionshipPublicRepository.findPublishedAll must be implemented.");
  }

  async findPublishedById() {
    throw new Error("ChampionshipPublicRepository.findPublishedById must be implemented.");
  }

  async findTeamsByChampionship() {
    throw new Error("ChampionshipPublicRepository.findTeamsByChampionship must be implemented.");
  }
}

module.exports = {
  ChampionshipPublicRepository,
};
