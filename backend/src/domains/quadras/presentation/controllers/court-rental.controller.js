const { CourtRentalService } = require("../../application/services/court-rental.service.js");

class CourtRentalController {
  constructor(options = {}) {
    this.service = options.service || new CourtRentalService(options);

    this.addToWaitlist = this.addToWaitlist.bind(this);
    this.calculateQuote = this.calculateQuote.bind(this);
    this.cancelReservation = this.cancelReservation.bind(this);
    this.createBlock = this.createBlock.bind(this);
    this.createCourt = this.createCourt.bind(this);
    this.createRenter = this.createRenter.bind(this);
    this.createReservation = this.createReservation.bind(this);
    this.cancelBlock = this.cancelBlock.bind(this);
    this.confirmReservationPayment = this.confirmReservationPayment.bind(this);
    this.duplicateReservation = this.duplicateReservation.bind(this);
    this.exportReports = this.exportReports.bind(this);
    this.getAvailability = this.getAvailability.bind(this);
    this.getCourt = this.getCourt.bind(this);
    this.getReports = this.getReports.bind(this);
    this.listAudit = this.listAudit.bind(this);
    this.listBlocks = this.listBlocks.bind(this);
    this.listCourts = this.listCourts.bind(this);
    this.listPriceRules = this.listPriceRules.bind(this);
    this.listRenters = this.listRenters.bind(this);
    this.listReservations = this.listReservations.bind(this);
    this.listWaitlist = this.listWaitlist.bind(this);
    this.promoteWaitlistEntry = this.promoteWaitlistEntry.bind(this);
    this.rescheduleReservation = this.rescheduleReservation.bind(this);
    this.updateBlock = this.updateBlock.bind(this);
    this.updateCourt = this.updateCourt.bind(this);
    this.updateReservation = this.updateReservation.bind(this);
    this.upsertPriceRule = this.upsertPriceRule.bind(this);
    this.validateAvailability = this.validateAvailability.bind(this);
  }

  async listCourts(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.listCourts(req.query));
  }

  async getCourt(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.getCourtById(req.params.courtId));
  }

  async createCourt(req, res, next) {
    return handleCourtRentalRequest(
      res,
      next,
      () => this.service.createCourt(req.body, readAuth(req)),
      201,
    );
  }

  async updateCourt(req, res, next) {
    return handleCourtRentalRequest(res, next, () =>
      this.service.updateCourt(req.params.courtId, req.body, readAuth(req)),
    );
  }

  async listPriceRules(req, res, next) {
    return handleCourtRentalRequest(res, next, () =>
      this.service.listPriceRules(req.params.courtId),
    );
  }

  async upsertPriceRule(req, res, next) {
    return handleCourtRentalRequest(
      res,
      next,
      () => this.service.upsertPriceRule(req.params.courtId, req.body, readAuth(req)),
      201,
    );
  }

  async listRenters(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.listRenters(req.query));
  }

  async createRenter(req, res, next) {
    return handleCourtRentalRequest(
      res,
      next,
      () => this.service.createRenter(req.body, readAuth(req)),
      201,
    );
  }

  async listReservations(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.listReservations(req.query));
  }

  async createReservation(req, res, next) {
    return handleCourtRentalRequest(
      res,
      next,
      () => this.service.createReservation(req.body, readAuth(req)),
      201,
    );
  }

  async updateReservation(req, res, next) {
    return handleCourtRentalRequest(res, next, () =>
      this.service.updateReservation(req.params.reservationId, req.body, readAuth(req)),
    );
  }

  async confirmReservationPayment(req, res, next) {
    return handleCourtRentalRequest(res, next, () =>
      this.service.confirmReservationPayment(req.params.reservationId, req.body, readAuth(req)),
    );
  }

  async duplicateReservation(req, res, next) {
    return handleCourtRentalRequest(
      res,
      next,
      () => this.service.duplicateReservation(req.params.reservationId, req.body, readAuth(req)),
      201,
    );
  }

  async cancelReservation(req, res, next) {
    return handleCourtRentalRequest(res, next, () =>
      this.service.cancelReservation(
        req.params.reservationId,
        { ...req.query, ...req.body },
        readAuth(req),
      ),
    );
  }

  async rescheduleReservation(req, res, next) {
    return handleCourtRentalRequest(res, next, () =>
      this.service.rescheduleReservation(req.params.reservationId, req.body, readAuth(req)),
    );
  }

  async getAvailability(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.getAvailability(req.query));
  }

  async validateAvailability(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.validateAvailability(req.body));
  }

  async calculateQuote(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.calculateQuote(req.body));
  }

  async listBlocks(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.listBlocks(req.query));
  }

  async createBlock(req, res, next) {
    return handleCourtRentalRequest(
      res,
      next,
      () => this.service.createBlock(req.body, readAuth(req)),
      201,
    );
  }

  async updateBlock(req, res, next) {
    return handleCourtRentalRequest(res, next, () =>
      this.service.updateBlock(req.params.blockId, req.body, readAuth(req)),
    );
  }

  async cancelBlock(req, res, next) {
    return handleCourtRentalRequest(res, next, () =>
      this.service.cancelBlock(req.params.blockId, { ...req.query, ...req.body }, readAuth(req)),
    );
  }

  async listWaitlist(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.listWaitlist(req.query));
  }

  async addToWaitlist(req, res, next) {
    return handleCourtRentalRequest(
      res,
      next,
      () => this.service.addToWaitlist(req.body, readAuth(req)),
      201,
    );
  }

  async promoteWaitlistEntry(req, res, next) {
    return handleCourtRentalRequest(res, next, () =>
      this.service.promoteWaitlistEntry(req.params.waitlistId, req.body, readAuth(req)),
    );
  }

  async getReports(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.getReports(req.query));
  }

  async exportReports(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.exportReports(req.query));
  }

  async listAudit(req, res, next) {
    return handleCourtRentalRequest(res, next, () => this.service.listAudit(req.query));
  }
}

function readAuth(req) {
  return req?.auth || req?.user || null;
}

async function handleCourtRentalRequest(res, next, action, statusCode = 200) {
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
  CourtRentalController,
  handleCourtRentalRequest,
};
