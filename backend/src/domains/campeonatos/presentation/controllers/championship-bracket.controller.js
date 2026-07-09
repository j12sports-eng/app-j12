const { ChampionshipBracketService } = require("../../application/services/index.js");
const { handleChampionshipRequest } = require("./championship-admin.controller.js");

class ChampionshipBracketController {
  constructor(options = {}) {
    this.bracketService =
      options.bracketService || options.service || new ChampionshipBracketService(options);

    this.advanceMatch = this.advanceMatch.bind(this);
    this.deleteByChampionship = this.deleteByChampionship.bind(this);
    this.findByChampionship = this.findByChampionship.bind(this);
    this.findByPhase = this.findByPhase.bind(this);
    this.generate = this.generate.bind(this);
    this.updateMatch = this.updateMatch.bind(this);
  }

  async findByChampionship(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.bracketService.findByChampionship(req.params.championshipId),
    );
  }

  async findByPhase(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.bracketService.findByPhase(req.params.championshipId, req.params.phase),
    );
  }

  async generate(req, res, next) {
    return handleChampionshipRequest(
      res,
      next,
      () =>
        this.bracketService.generate(
          req.params.championshipId,
          req.body || {},
          readRequestContext(req),
        ),
      201,
    );
  }

  async updateMatch(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.bracketService.updateMatch(req.params.matchId, req.body || {}, readRequestContext(req)),
    );
  }

  async advanceMatch(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.bracketService.advanceMatch(req.params.matchId, req.body || {}, readRequestContext(req)),
    );
  }

  async deleteByChampionship(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.bracketService.deleteByChampionship(req.params.championshipId),
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
  ChampionshipBracketController,
};
