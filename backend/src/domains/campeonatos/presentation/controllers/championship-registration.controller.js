const { ChampionshipRegistrationService } = require("../../application/services/index.js");
const { handleChampionshipRequest } = require("./championship-admin.controller.js");

class ChampionshipRegistrationController {
  constructor(options = {}) {
    this.registrationService =
      options.registrationService ||
      options.service ||
      new ChampionshipRegistrationService(options);

    this.cancel = this.cancel.bind(this);
    this.findAll = this.findAll.bind(this);
    this.findAvailableTeams = this.findAvailableTeams.bind(this);
    this.findById = this.findById.bind(this);
    this.register = this.register.bind(this);
    this.update = this.update.bind(this);
    this.updateStatus = this.updateStatus.bind(this);
  }

  async register(req, res, next) {
    return handleChampionshipRequest(
      res,
      next,
      () => this.registrationService.register(req.body || {}, readRequestContext(req)),
      201,
    );
  }

  async cancel(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.registrationService.cancel(
        req.params.registrationId || req.params.id,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }

  async update(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.registrationService.update(
        req.params.registrationId || req.params.id,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }

  async updateStatus(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.registrationService.updateStatus(
        req.params.registrationId || req.params.id,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }

  async findById(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.registrationService.findById(req.params.registrationId || req.params.id),
    );
  }

  async findAll(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.registrationService.findAll({
        ...(req.query || {}),
        championshipId: req.params.championshipId || req.query?.championshipId,
      }),
    );
  }

  async findAvailableTeams(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.registrationService.findAvailableTeams(req.query || {}),
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
  ChampionshipRegistrationController,
};
