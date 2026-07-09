const { ChampionshipPublicService } = require("../../application/services/index.js");

class ChampionshipPublicController {
  constructor(options = {}) {
    this.publicService =
      options.publicService ||
      options.championshipPublicService ||
      options.service ||
      new ChampionshipPublicService(options);

    this.findAll = this.findAll.bind(this);
    this.findById = this.findById.bind(this);
    this.findGroups = this.findGroups.bind(this);
    this.findTeams = this.findTeams.bind(this);
    this.findMatches = this.findMatches.bind(this);
    this.findStandings = this.findStandings.bind(this);
    this.findBracket = this.findBracket.bind(this);
    this.findStatistics = this.findStatistics.bind(this);
    this.findTopScorers = this.findTopScorers.bind(this);
  }

  async findAll(req, res, next) {
    return handleChampionshipPublicRequest(res, next, () =>
      this.publicService.findAll(req.query || {}),
    );
  }

  async findById(req, res, next) {
    return handleChampionshipPublicRequest(res, next, () =>
      this.publicService.findById(req.params.championshipId),
    );
  }

  async findGroups(req, res, next) {
    return handleChampionshipPublicRequest(res, next, () =>
      this.publicService.findGroups(req.params.championshipId, req.query || {}),
    );
  }

  async findTeams(req, res, next) {
    return handleChampionshipPublicRequest(res, next, () =>
      this.publicService.findTeams(req.params.championshipId, req.query || {}),
    );
  }

  async findMatches(req, res, next) {
    return handleChampionshipPublicRequest(res, next, () =>
      this.publicService.findMatches(req.params.championshipId, req.query || {}),
    );
  }

  async findStandings(req, res, next) {
    return handleChampionshipPublicRequest(res, next, () =>
      this.publicService.findStandings(req.params.championshipId, req.query || {}),
    );
  }

  async findBracket(req, res, next) {
    return handleChampionshipPublicRequest(res, next, () =>
      this.publicService.findBracket(req.params.championshipId),
    );
  }

  async findStatistics(req, res, next) {
    return handleChampionshipPublicRequest(res, next, () =>
      this.publicService.findStatistics(req.params.championshipId, req.query || {}),
    );
  }

  async findTopScorers(req, res, next) {
    return handleChampionshipPublicRequest(res, next, () =>
      this.publicService.findTopScorers(req.params.championshipId, req.query || {}),
    );
  }
}

async function handleChampionshipPublicRequest(res, next, action) {
  try {
    const data = await action();
    return res.json({
      data,
      success: true,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  ChampionshipPublicController,
  handleChampionshipPublicRequest,
};
