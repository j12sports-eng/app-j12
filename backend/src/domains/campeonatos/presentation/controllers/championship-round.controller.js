const { ChampionshipRoundService } = require("../../application/services/index.js");
const { handleChampionshipRequest } = require("./championship-admin.controller.js");

class ChampionshipRoundController {
  constructor(options = {}) {
    this.roundService =
      options.roundService || options.service || new ChampionshipRoundService(options);

    this.createMatch = this.createMatch.bind(this);
    this.createRound = this.createRound.bind(this);
    this.deleteMatch = this.deleteMatch.bind(this);
    this.deleteRound = this.deleteRound.bind(this);
    this.findMatches = this.findMatches.bind(this);
    this.findRoundById = this.findRoundById.bind(this);
    this.findRoundsByChampionship = this.findRoundsByChampionship.bind(this);
    this.generateMatches = this.generateMatches.bind(this);
    this.moveMatch = this.moveMatch.bind(this);
    this.updateMatch = this.updateMatch.bind(this);
    this.updateRound = this.updateRound.bind(this);
  }

  async createRound(req, res, next) {
    return handleChampionshipRequest(
      res,
      next,
      () =>
        this.roundService.createRound(
          req.params.championshipId,
          req.body || {},
          readRequestContext(req),
        ),
      201,
    );
  }

  async updateRound(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.roundService.updateRound(
        req.params.championshipId,
        req.params.roundId,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }

  async deleteRound(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.roundService.deleteRound(req.params.championshipId, req.params.roundId),
    );
  }

  async findRoundsByChampionship(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.roundService.findRoundsByChampionship(req.params.championshipId, req.query || {}),
    );
  }

  async findRoundById(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.roundService.findRoundById(req.params.championshipId, req.params.roundId),
    );
  }

  async createMatch(req, res, next) {
    return handleChampionshipRequest(
      res,
      next,
      () =>
        this.roundService.createMatch(
          req.params.championshipId,
          req.params.roundId,
          req.body || {},
          readRequestContext(req),
        ),
      201,
    );
  }

  async updateMatch(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.roundService.updateMatch(
        req.params.championshipId,
        req.params.matchId,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }

  async deleteMatch(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.roundService.deleteMatch(
        req.params.championshipId,
        req.params.matchId,
        readRequestContext(req),
      ),
    );
  }

  async moveMatch(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.roundService.moveMatch(
        req.params.championshipId,
        req.params.matchId,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }

  async findMatches(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.roundService.findMatches(req.params.championshipId, req.query || {}),
    );
  }

  async generateMatches(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.roundService.generateMatches(
        req.params.championshipId,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }
}

function readRequestContext(req) {
  return {
    auth: req?.auth || null,
    user: req?.user || null,
  };
}

module.exports = {
  ChampionshipRoundController,
};
