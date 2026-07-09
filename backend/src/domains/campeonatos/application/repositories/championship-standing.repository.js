class ChampionshipStandingRepository {
  async replaceByChampionship() {
    throw new Error("ChampionshipStandingRepository.replaceByChampionship must be implemented.");
  }

  async findByChampionship() {
    throw new Error("ChampionshipStandingRepository.findByChampionship must be implemented.");
  }

  async findByGroup() {
    throw new Error("ChampionshipStandingRepository.findByGroup must be implemented.");
  }

  async deleteByChampionship() {
    throw new Error("ChampionshipStandingRepository.deleteByChampionship must be implemented.");
  }
}

module.exports = {
  ChampionshipStandingRepository,
};
