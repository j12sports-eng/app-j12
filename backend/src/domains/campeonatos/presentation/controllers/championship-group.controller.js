const { ChampionshipGroupService } = require("../../application/services/index.js");
const { handleChampionshipRequest } = require("./championship-admin.controller.js");

class ChampionshipGroupController {
  constructor(options = {}) {
    this.groupService =
      options.groupService || options.service || new ChampionshipGroupService(options);

    this.assignRegistration = this.assignRegistration.bind(this);
    this.create = this.create.bind(this);
    this.draw = this.draw.bind(this);
    this.findAll = this.findAll.bind(this);
    this.findById = this.findById.bind(this);
    this.moveRegistration = this.moveRegistration.bind(this);
    this.redistribute = this.redistribute.bind(this);
    this.remove = this.remove.bind(this);
    this.removeRegistration = this.removeRegistration.bind(this);
    this.update = this.update.bind(this);
  }

  async create(req, res, next) {
    return handleChampionshipRequest(
      res,
      next,
      () =>
        this.groupService.create(
          req.params.championshipId,
          req.body || {},
          readRequestContext(req),
        ),
      201,
    );
  }

  async update(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.groupService.update(
        req.params.championshipId,
        req.params.groupId,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }

  async remove(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.groupService.remove(req.params.championshipId, req.params.groupId),
    );
  }

  async findAll(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.groupService.findAll(req.params.championshipId, req.query || {}),
    );
  }

  async findById(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.groupService.findById(req.params.championshipId, req.params.groupId),
    );
  }

  async assignRegistration(req, res, next) {
    return handleChampionshipRequest(
      res,
      next,
      () =>
        this.groupService.assignRegistration(
          req.params.championshipId,
          req.params.groupId,
          req.body || {},
          readRequestContext(req),
        ),
      201,
    );
  }

  async removeRegistration(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.groupService.removeRegistration(
        req.params.championshipId,
        req.params.groupId,
        req.params.registrationId,
      ),
    );
  }

  async moveRegistration(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.groupService.moveRegistration(
        req.params.championshipId,
        req.params.groupId,
        req.params.registrationId,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }

  async draw(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.groupService.drawGroups(
        req.params.championshipId,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }

  async redistribute(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.groupService.redistributeGroups(
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
  ChampionshipGroupController,
};
