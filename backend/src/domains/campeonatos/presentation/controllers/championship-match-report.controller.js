const { ChampionshipMatchReportService } = require("../../application/services/index.js");
const { handleChampionshipRequest } = require("./championship-admin.controller.js");

class ChampionshipMatchReportController {
  constructor(options = {}) {
    this.matchReportService =
      options.matchReportService || options.service || new ChampionshipMatchReportService(options);

    this.create = this.create.bind(this);
    this.createEvent = this.createEvent.bind(this);
    this.deleteEvent = this.deleteEvent.bind(this);
    this.finalize = this.finalize.bind(this);
    this.findByMatch = this.findByMatch.bind(this);
    this.open = this.open.bind(this);
    this.reopen = this.reopen.bind(this);
    this.update = this.update.bind(this);
    this.updateEvent = this.updateEvent.bind(this);
  }

  async create(req, res, next) {
    return handleChampionshipRequest(
      res,
      next,
      () =>
        this.matchReportService.create(req.params.matchId, req.body || {}, readRequestContext(req)),
      201,
    );
  }

  async findByMatch(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.matchReportService.findByMatch(req.params.matchId),
    );
  }

  async update(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.matchReportService.update(req.params.matchId, req.body || {}, readRequestContext(req)),
    );
  }

  async open(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.matchReportService.open(req.params.matchId, readRequestContext(req)),
    );
  }

  async createEvent(req, res, next) {
    return handleChampionshipRequest(
      res,
      next,
      () =>
        this.matchReportService.createEvent(
          req.params.matchId,
          req.body || {},
          readRequestContext(req),
        ),
      201,
    );
  }

  async updateEvent(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.matchReportService.updateEvent(
        req.params.matchId,
        req.params.eventId,
        req.body || {},
        readRequestContext(req),
      ),
    );
  }

  async deleteEvent(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.matchReportService.deleteEvent(
        req.params.matchId,
        req.params.eventId,
        readRequestContext(req),
      ),
    );
  }

  async finalize(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.matchReportService.finalize(req.params.matchId, req.body || {}, readRequestContext(req)),
    );
  }

  async reopen(req, res, next) {
    return handleChampionshipRequest(res, next, () =>
      this.matchReportService.reopen(req.params.matchId, readRequestContext(req)),
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
  ChampionshipMatchReportController,
};
