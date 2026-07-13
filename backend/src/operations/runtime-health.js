function createRuntimeHealth(options = {}) {
  const state = options.state || {};
  const probeDatabase = options.probeDatabase;
  const now = typeof options.now === "function" ? options.now : () => new Date();

  function liveness() {
    return {
      statusCode: 200,
      body: {
        status: "alive",
        timestamp: now().toISOString(),
      },
    };
  }

  async function readiness() {
    let databaseReady = state.database === "ready";
    if (databaseReady && typeof probeDatabase === "function") {
      try {
        databaseReady = (await probeDatabase()) !== false;
      } catch {
        databaseReady = false;
      }
    }
    const schemaReady = state.schemaReady === true;
    const shuttingDown = state.shuttingDown === true;
    const ready = databaseReady && schemaReady && !shuttingDown;
    return {
      statusCode: ready ? 200 : 503,
      body: {
        status: ready ? "ready" : "not_ready",
        dependencies: { database: databaseReady, schema: schemaReady },
        shuttingDown,
        timestamp: now().toISOString(),
      },
    };
  }

  async function internalHealth() {
    const ready = await readiness();
    return {
      statusCode: ready.statusCode,
      body: {
        ...ready.body,
        startedAt: state.startedAt || null,
        readyAt: state.readyAt || null,
        uptimeSeconds: Math.round(process.uptime()),
      },
    };
  }

  return { internalHealth, liveness, readiness };
}

module.exports = { createRuntimeHealth };
