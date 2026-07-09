class ChampionshipGroupRepository {
  async create() {
    throw new Error("ChampionshipGroupRepository.create must be implemented.");
  }

  async update() {
    throw new Error("ChampionshipGroupRepository.update must be implemented.");
  }

  async delete() {
    throw new Error("ChampionshipGroupRepository.delete must be implemented.");
  }

  async findAllByChampionship() {
    throw new Error("ChampionshipGroupRepository.findAllByChampionship must be implemented.");
  }

  async findById() {
    throw new Error("ChampionshipGroupRepository.findById must be implemented.");
  }

  async findByName() {
    throw new Error("ChampionshipGroupRepository.findByName must be implemented.");
  }

  async countRegistrations() {
    throw new Error("ChampionshipGroupRepository.countRegistrations must be implemented.");
  }

  async addRegistration() {
    throw new Error("ChampionshipGroupRepository.addRegistration must be implemented.");
  }

  async removeRegistration() {
    throw new Error("ChampionshipGroupRepository.removeRegistration must be implemented.");
  }

  async moveRegistration() {
    throw new Error("ChampionshipGroupRepository.moveRegistration must be implemented.");
  }

  async findAssignmentByRegistration() {
    throw new Error(
      "ChampionshipGroupRepository.findAssignmentByRegistration must be implemented.",
    );
  }

  async listAssignmentsByChampionship() {
    throw new Error(
      "ChampionshipGroupRepository.listAssignmentsByChampionship must be implemented.",
    );
  }

  async clearAssignments() {
    throw new Error("ChampionshipGroupRepository.clearAssignments must be implemented.");
  }

  async replaceAssignments() {
    throw new Error("ChampionshipGroupRepository.replaceAssignments must be implemented.");
  }
}

module.exports = {
  ChampionshipGroupRepository,
};
