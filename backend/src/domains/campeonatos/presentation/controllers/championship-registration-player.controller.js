const { ChampionshipRegistrationPlayerService } = require("../../application/services/index.js");
const { handleChampionshipRequest } = require("./championship-admin.controller.js");

class ChampionshipRegistrationPlayerController {
  constructor(options = {}) {
    this.playerService =
      options.playerService ||
      options.registrationPlayerService ||
      options.service ||
      new ChampionshipRegistrationPlayerService(options);

    this.create = this.create.bind(this);
    this.delete = this.delete.bind(this);
    this.findAll = this.findAll.bind(this);
    this.findById = this.findById.bind(this);
    this.setCaptain = this.setCaptain.bind(this);
    this.update = this.update.bind(this);
  }

  async create(req, res, next) {
    return handleChampionshipRequest(
      res,
      next,
      () =>
        this.playerService.create(
          req.params.registrationId,
          req.body || {},
          readRequestContext(req),
        ),
      201,
    );
  }

  async update(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.playerService.update(
        req.params.registrationId,
        req.params.playerId,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }

  async delete(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.playerService.delete(
        req.params.registrationId,
        req.params.playerId,
        readRequestContext(req),
      ),
    );
  }

  async findById(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.playerService.findById(req.params.registrationId, req.params.playerId),
    );
  }

  async findAll(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.playerService.findAll(req.params.registrationId, req.query || {}),
    );
  }

  async setCaptain(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.playerService.setCaptain(
        req.params.registrationId,
        req.params.playerId,
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
  ChampionshipRegistrationPlayerController,
};
