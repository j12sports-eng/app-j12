function createGracefulShutdown(options = {}) {
  const server = options.server;
  const timeoutMs = positiveInteger(options.timeoutMs, 15000);
  const logger = options.logger || console;
  const state = options.state || {};
  let shutdownPromise = null;

  return function shutdown(signal = "UNKNOWN") {
    if (shutdownPromise) return shutdownPromise;
    state.shuttingDown = true;
    shutdownPromise = performShutdown({ ...options, logger, server, signal, state, timeoutMs });
    return shutdownPromise;
  };
}

async function performShutdown(options) {
  const { logger, server, signal, timeoutMs } = options;
  logger.info?.("[shutdown] begin", { signal, timeoutMs });
  let timedOut = false;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      server?.closeAllConnections?.();
      resolve();
    }, timeoutMs);
    timeoutId.unref?.();
  });
  const cleanup = (async () => {
    await Promise.all([
      closeHttpServer(server),
      closeResource(options.io, "close"),
      ...Array.from(options.jobs || [], (job) => closeResource(job, "stop")),
    ]);
    await closeResource(options.pool, "end");
  })();
  await Promise.race([cleanup, timeout]);
  clearTimeout(timeoutId);
  if (timedOut) {
    logger.error?.("[shutdown] timeout", { signal, timeoutMs });
    return { completed: false, timedOut: true };
  }
  logger.info?.("[shutdown] complete", { signal });
  return { completed: true, timedOut: false };
}

function closeHttpServer(server) {
  if (!server || typeof server.close !== "function" || server.listening === false)
    return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections?.();
  });
}

async function closeResource(resource, method) {
  if (!resource || typeof resource[method] !== "function") return;
  if (resource[method].length > 0) {
    await new Promise((resolve, reject) =>
      resource[method]((error) => (error ? reject(error) : resolve())),
    );
    return;
  }
  await resource[method]();
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = { closeHttpServer, createGracefulShutdown, performShutdown };
