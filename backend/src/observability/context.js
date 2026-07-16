const { AsyncLocalStorage } = require("node:async_hooks");

const storage = new AsyncLocalStorage();

function getObservabilityContext() {
  return storage.getStore() || {};
}

function runWithObservabilityContext(context, callback) {
  return storage.run(Object.freeze({ ...(context || {}) }), callback);
}

module.exports = { getObservabilityContext, runWithObservabilityContext };
