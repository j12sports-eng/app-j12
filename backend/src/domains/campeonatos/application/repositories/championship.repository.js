class ChampionshipRepository {
  async create() {
    throw new Error("ChampionshipRepository.create must be implemented.");
  }

  async update() {
    throw new Error("ChampionshipRepository.update must be implemented.");
  }

  async remove() {
    throw new Error("ChampionshipRepository.remove must be implemented.");
  }

  async findById() {
    throw new Error("ChampionshipRepository.findById must be implemented.");
  }

  async findAll() {
    throw new Error("ChampionshipRepository.findAll must be implemented.");
  }

  async publish() {
    throw new Error("ChampionshipRepository.publish must be implemented.");
  }

  async archive() {
    throw new Error("ChampionshipRepository.archive must be implemented.");
  }
}

module.exports = {
  ChampionshipRepository,
};
