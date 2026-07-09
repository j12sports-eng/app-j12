class ChampionshipMatchReportRepository {
  async createReport() {
    throw new Error("ChampionshipMatchReportRepository.createReport must be implemented.");
  }

  async updateReport() {
    throw new Error("ChampionshipMatchReportRepository.updateReport must be implemented.");
  }

  async updateReportScore() {
    throw new Error("ChampionshipMatchReportRepository.updateReportScore must be implemented.");
  }

  async updateReportStatus() {
    throw new Error("ChampionshipMatchReportRepository.updateReportStatus must be implemented.");
  }

  async findReportByMatchId() {
    throw new Error("ChampionshipMatchReportRepository.findReportByMatchId must be implemented.");
  }

  async findMatchById() {
    throw new Error("ChampionshipMatchReportRepository.findMatchById must be implemented.");
  }

  async createEvent() {
    throw new Error("ChampionshipMatchReportRepository.createEvent must be implemented.");
  }

  async updateEvent() {
    throw new Error("ChampionshipMatchReportRepository.updateEvent must be implemented.");
  }

  async deleteEvent() {
    throw new Error("ChampionshipMatchReportRepository.deleteEvent must be implemented.");
  }

  async findEventById() {
    throw new Error("ChampionshipMatchReportRepository.findEventById must be implemented.");
  }

  async findEventsByReportId() {
    throw new Error("ChampionshipMatchReportRepository.findEventsByReportId must be implemented.");
  }
}

module.exports = {
  ChampionshipMatchReportRepository,
};
