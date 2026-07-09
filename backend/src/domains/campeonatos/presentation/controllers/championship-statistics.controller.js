const STATISTICS_SERVICE_REQUIRED_CODE = "CHAMPIONSHIP_STATISTICS_SERVICE_REQUIRED";

class ChampionshipStatisticsController {
  constructor(options = {}) {
    this.statisticsService =
      options.statisticsService || options.championshipStatisticsService || null;

    this.findStatistics = this.findStatistics.bind(this);
    this.findRankings = this.findRankings.bind(this);
    this.findTopScorers = this.findTopScorers.bind(this);
    this.recalculate = this.recalculate.bind(this);
  }

  async findStatistics(req, res, next) {
    try {
      const data = await this.getStatisticsService().findStatistics(
        req.params.championshipId,
        req.query,
      );

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  async findRankings(req, res, next) {
    try {
      const data = await this.getStatisticsService().findRankings(
        req.params.championshipId,
        req.query,
      );

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  async findTopScorers(req, res, next) {
    try {
      const data = await this.getStatisticsService().findTopScorers(
        req.params.championshipId,
        req.query,
      );

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  async recalculate(req, res, next) {
    try {
      const data = await this.getStatisticsService().recalculate(
        req.params.championshipId,
        req.body,
        readRequestContext(req),
      );

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }

  getStatisticsService() {
    if (!this.statisticsService) {
      const error = new Error("Servico de estatisticas de campeonato nao configurado.");
      error.code = STATISTICS_SERVICE_REQUIRED_CODE;
      error.errorCode = STATISTICS_SERVICE_REQUIRED_CODE;
      error.statusCode = 500;
      throw error;
    }

    return this.statisticsService;
  }
}

function readRequestContext(req) {
  return {
    auth: req.auth || null,
    ip: req.ip || req.headers?.["x-forwarded-for"] || null,
    user: req.user || null,
  };
}

module.exports = {
  ChampionshipStatisticsController,
};
