class ChampionshipRoundRepository {
  async createRound() {
    throw new Error("ChampionshipRoundRepository.createRound must be implemented.");
  }

  async updateRound() {
    throw new Error("ChampionshipRoundRepository.updateRound must be implemented.");
  }

  async deleteRound() {
    throw new Error("ChampionshipRoundRepository.deleteRound must be implemented.");
  }

  async findRoundsByChampionship() {
    throw new Error("ChampionshipRoundRepository.findRoundsByChampionship must be implemented.");
  }

  async findRoundById() {
    throw new Error("ChampionshipRoundRepository.findRoundById must be implemented.");
  }

  async findRoundByNumber() {
    throw new Error("ChampionshipRoundRepository.findRoundByNumber must be implemented.");
  }

  async getNextRoundNumber() {
    throw new Error("ChampionshipRoundRepository.getNextRoundNumber must be implemented.");
  }

  async countMatchesByRound() {
    throw new Error("ChampionshipRoundRepository.countMatchesByRound must be implemented.");
  }

  async createMatch() {
    throw new Error("ChampionshipRoundRepository.createMatch must be implemented.");
  }

  async updateMatch() {
    throw new Error("ChampionshipRoundRepository.updateMatch must be implemented.");
  }

  async deleteMatch() {
    throw new Error("ChampionshipRoundRepository.deleteMatch must be implemented.");
  }

  async moveMatch() {
    throw new Error("ChampionshipRoundRepository.moveMatch must be implemented.");
  }

  async findMatchById() {
    throw new Error("ChampionshipRoundRepository.findMatchById must be implemented.");
  }

  async findMatches() {
    throw new Error("ChampionshipRoundRepository.findMatches must be implemented.");
  }

  async findDuplicateMatch() {
    throw new Error("ChampionshipRoundRepository.findDuplicateMatch must be implemented.");
  }

  async findCourtConflict() {
    throw new Error("ChampionshipRoundRepository.findCourtConflict must be implemented.");
  }

  async countMatchesByPhase() {
    throw new Error("ChampionshipRoundRepository.countMatchesByPhase must be implemented.");
  }

  async deleteMatchesByPhase() {
    throw new Error("ChampionshipRoundRepository.deleteMatchesByPhase must be implemented.");
  }
}

module.exports = {
  ChampionshipRoundRepository,
};
