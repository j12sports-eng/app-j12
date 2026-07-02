class BaseService {
  constructor({ logger = null, repository = null } = {}) {
    this.logger = logger;
    this.repository = repository;
  }

  async execute() {
    throw new Error("BaseService.execute must be implemented.");
  }
}

module.exports = {
  BaseService,
};
