const { createBiFoundationDto } = require("../dtos/bi-foundation.dto.js");
const { normalizeBiQuery } = require("../filters/bi-query.js");

class BiFoundationService {
  constructor(options = {}) {
    this.now = options.now;
    this.timezone = options.timezone;
  }

  describe(input = {}) {
    const query = normalizeBiQuery(input, { now: this.now, timezone: this.timezone });
    return createBiFoundationDto(query);
  }
}

module.exports = { BiFoundationService };
