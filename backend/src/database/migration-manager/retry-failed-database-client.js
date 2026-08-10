"use strict";

const { createApplyOneWriteClient } = require("./apply-one-database-client");

async function createRetryFailedWriteClient(config, dependencies) {
  return createApplyOneWriteClient(config, dependencies);
}

module.exports = { createRetryFailedWriteClient };
