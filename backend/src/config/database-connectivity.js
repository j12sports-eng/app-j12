const NON_RECOVERABLE_CODES = new Set([
  "ER_HOST_IS_BLOCKED",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
]);
const NON_RECOVERABLE_ERRNOS = new Set([1129, 1045, 1049]);
const TRANSIENT_CODES = new Set([
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_ERROR",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
]);

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function classifyDatabaseError(error) {
  const code = String(error?.code || "");
  const errno = Number(error?.errno);
  if (NON_RECOVERABLE_CODES.has(code) || NON_RECOVERABLE_ERRNOS.has(errno))
    return "non-recoverable";
  if (TRANSIENT_CODES.has(code)) return "transient";
  return "unknown";
}

function sanitizedError(error, category, extra = {}) {
  return {
    code: error?.code || null,
    errno: error?.errno ?? null,
    category,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function createDatabaseConnectivity({
  pool,
  maxAttempts = 3,
  sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  logger = console,
  setIntervalFn = setInterval,
} = {}) {
  const attemptsLimit = clampInteger(maxAttempts, 3, 1, 5);
  let testConnectionInFlight = null;
  let keepaliveInFlight = false;

  async function runConnectionTest() {
    for (let attempt = 1; attempt <= attemptsLimit; attempt += 1) {
      let connection = null;
      try {
        connection = await pool.getConnection();
        await connection.ping();
        return true;
      } catch (error) {
        const category = classifyDatabaseError(error);
        logger.error(
          "[mysql] connection test failed",
          sanitizedError(error, category, { attempt, attemptsLimit }),
        );
        if (category !== "transient" || attempt >= attemptsLimit) throw error;
        await sleep(Math.min(1000 * 2 ** (attempt - 1), 30000));
      } finally {
        connection?.release();
      }
    }
    return false;
  }

  function testConnection() {
    if (testConnectionInFlight) return testConnectionInFlight;
    // Important: one shared promise prevents concurrent retry chains.
    testConnectionInFlight = runConnectionTest().finally(() => {
      testConnectionInFlight = null;
    });
    return testConnectionInFlight;
  }

  function startKeepalive({ enabled = false, intervalMs = 300000 } = {}) {
    if (!enabled) return null;
    const safeIntervalMs = clampInteger(intervalMs, 300000, 60000, 86400000);
    const timer = setIntervalFn(async () => {
      if (keepaliveInFlight) return;
      keepaliveInFlight = true;
      try {
        await pool.query("SELECT 1");
      } catch (error) {
        logger.error(
          "[mysql] keepalive failed",
          sanitizedError(error, classifyDatabaseError(error)),
        );
      } finally {
        keepaliveInFlight = false;
      }
    }, safeIntervalMs);
    timer?.unref?.();
    return timer;
  }

  return { testConnection, startKeepalive };
}

module.exports = { clampInteger, classifyDatabaseError, createDatabaseConnectivity };
