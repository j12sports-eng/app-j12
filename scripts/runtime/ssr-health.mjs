export function createSsrHealth(options = {}) {
  const exists = options.existsSync;
  const clientDir = options.clientDir;
  const serverEntry = options.serverEntry;
  const now = typeof options.now === "function" ? options.now : () => new Date();
  const state = options.state || {};

  function liveness() {
    return { statusCode: 200, body: { status: "alive", timestamp: now().toISOString() } };
  }

  function readiness() {
    const clientAssets = exists(clientDir);
    const serverBundle = exists(serverEntry);
    const ready = clientAssets && serverBundle && state.shuttingDown !== true;
    return {
      statusCode: ready ? 200 : 503,
      body: {
        status: ready ? "ready" : "not_ready",
        dependencies: { clientAssets, serverBundle },
        shuttingDown: state.shuttingDown === true,
        timestamp: now().toISOString(),
      },
    };
  }

  return { liveness, readiness };
}
