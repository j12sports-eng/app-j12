const { ChampionshipStandingService } = require("../../application/services/index.js");
const { handleChampionshipRequest } = require("./championship-admin.controller.js");

class ChampionshipStandingController {
  constructor(options = {}) {
    this.standingService =
      options.standingService || options.service || new ChampionshipStandingService(options);

    this.findAll = this.findAll.bind(this);
    this.findByGroup = this.findByGroup.bind(this);
    this.recalculate = this.recalculate.bind(this);
  }

  async findAll(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.standingService.findAll(req.params.championshipId, req.query || {}),
    );
  }

  async findByGroup(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.standingService.findByGroup(
        req.params.championshipId,
        req.params.groupId,
        req.query || {},
      ),
    );
  }

  async recalculate(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.standingService.recalculate(req.params.championshipId, req.body || {}),
    );
  }
}

module.exports = {
  ChampionshipStandingController,
};
