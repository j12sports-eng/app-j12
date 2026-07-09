class ChampionshipBracketRepository {
  async replaceByChampionship() {
    throw new Error("ChampionshipBracketRepository.replaceByChampionship must be implemented.");
  }

  async findByChampionship() {
    throw new Error("ChampionshipBracketRepository.findByChampionship must be implemented.");
  }

  async findByPhase() {
    throw new Error("ChampionshipBracketRepository.findByPhase must be implemented.");
  }

  async findMatchById() {
    throw new Error("ChampionshipBracketRepository.findMatchById must be implemented.");
  }

  async updateMatch() {
    throw new Error("ChampionshipBracketRepository.updateMatch must be implemented.");
  }

  async updateBracket() {
    throw new Error("ChampionshipBracketRepository.updateBracket must be implemented.");
  }

  async deleteByChampionship() {
    throw new Error("ChampionshipBracketRepository.deleteByChampionship must be implemented.");
  }

  async hasStarted() {
    throw new Error("ChampionshipBracketRepository.hasStarted must be implemented.");
  }
}

module.exports = {
  ChampionshipBracketRepository,
};
