const { ChampionshipApplicationService } = require("../../application/services/index.js");

class ChampionshipAdminController {
  constructor(options = {}) {
    this.championshipService =
      options.championshipService || options.service || new ChampionshipApplicationService(options);

    this.create = this.create.bind(this);
    this.archive = this.archive.bind(this);
    this.findAll = this.findAll.bind(this);
    this.findById = this.findById.bind(this);
    this.publish = this.publish.bind(this);
    this.remove = this.remove.bind(this);
    this.update = this.update.bind(this);
  }

  async findAll(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.championshipService.findAll(req.query || {}),
    );
  }

  async findById(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.championshipService.findById(req.params.id),
    );
  }

  async create(req, res, next) {
    return handleChampionshipRequest(
      res,
      next,
      () => this.championshipService.create(req.body || {}, readRequestContext(req)),
      201,
    );
  }

  async publish(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.championshipService.publish(req.params.id, readRequestContext(req)),
    );
  }

  async archive(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.championshipService.archive(req.params.id, readRequestContext(req)),
    );
  }

  async update(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.championshipService.update(req.params.id, req.body || {}, readRequestContext(req)),
    );
  }

  async remove(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.championshipService.remove(req.params.id, readRequestContext(req)),
    );
  }
}

function readRequestContext(req) {
  return {
    auth: req?.auth || null,
    user: req?.user || null,
  };
}

async function handleChampionshipRequest(res, next, action, statusCode = 200) {
  try {
    const data = await action();
    return res.status(statusCode).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  ChampionshipAdminController,
  handleChampionshipRequest,
};
