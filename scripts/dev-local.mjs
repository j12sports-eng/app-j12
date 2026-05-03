import { spawn } from "node:child_process";
import net from "node:net";

const rawArgs = process.argv.slice(2);
const skipBackend = rawArgs.includes("--skip-backend") || process.env.J12_SKIP_BACKEND === "1";
const skipFrontend = rawArgs.includes("--skip-frontend") || process.env.J12_SKIP_FRONTEND === "1";

const viteArgs = rawArgs.filter((arg) => arg !== "--skip-backend" && arg !== "--skip-frontend");

const BACKEND_HOST = process.env.HOST || "127.0.0.1";
const BACKEND_PORT = Number(process.env.PORT || "3001");
const FALLBACK_BACKEND_PORT = Number(process.env.J12_FALLBACK_PORT || "4001");
const DEFAULT_FRONTEND_HOST = "127.0.0.1";
const DEFAULT_FRONTEND_PORT = "3000";

const managedChildren = new Set();
let shuttingDown = false;

function withDefaultFlag(args, flag, value, aliases = []) {
  const matchesFlag = args.some(
    (arg, index) =>
      arg === flag ||
      aliases.includes(arg) ||
      arg.startsWith(`${flag}=`) ||
      aliases.some((alias) => arg.startsWith(`${alias}=`)) ||
      (aliases.includes(arg) && index < args.length - 1),
  );

  if (matchesFlag) return args;
  return [...args, flag, value];
}

function waitForPort(host, port, timeoutMs = 5000) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    function attempt() {
      const socket = new net.Socket();

      socket.setTimeout(500);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => socket.destroy());
      socket.once("error", () => socket.destroy());
      socket.once("close", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(attempt, 150);
      });

      socket.connect(port, host);
    }

    attempt();
  });
}

function spawnManaged(label, args, options = {}) {
  const { env = process.env, exitIsFatal = true } = options;
  const handle = {
    label,
    exitIsFatal,
    child: null,
  };

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  handle.child = child;
  managedChildren.add(handle);

  child.once("exit", (code, signal) => {
    managedChildren.delete(handle);

    if (shuttingDown) return;
    if (!handle.exitIsFatal) return;

    const reason = signal
      ? `${label} encerrado por sinal ${signal}.`
      : `${label} encerrou com codigo ${code}.`;
    console.error(reason);
    shutdown(code ?? 1);
  });

  child.once("error", (error) => {
    managedChildren.delete(handle);

    if (shuttingDown) return;
    if (!handle.exitIsFatal) return;

    console.error(`Falha ao iniciar ${label}: ${error.message}`);
    shutdown(1);
  });

  return handle;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const handle of managedChildren) {
    if (handle.child && !handle.child.killed) {
      handle.child.kill();
    }
  }

  setTimeout(() => process.exit(exitCode), 100);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function buildBackendUrl(host, port) {
  return `http://${host}:${port}`;
}

async function ensureBackend() {
  const mysqlBackendUrl = buildBackendUrl(BACKEND_HOST, BACKEND_PORT);
  const fallbackBackendUrl = buildBackendUrl(BACKEND_HOST, FALLBACK_BACKEND_PORT);

  if (await waitForPort(BACKEND_HOST, BACKEND_PORT, 300)) {
    console.log(`Backend MySQL ja esta ativo em ${mysqlBackendUrl}/health`);
    return {
      label: "mysql",
      port: BACKEND_PORT,
      url: mysqlBackendUrl,
    };
  }

  console.log(`Iniciando backend MySQL local em ${mysqlBackendUrl}...`);
  const mysqlHandle = spawnManaged("backend-mysql", ["backend/server.js"], {
    exitIsFatal: false,
  });

  const mysqlReady = await waitForPort(BACKEND_HOST, BACKEND_PORT, 5000);
  if (mysqlReady) {
    mysqlHandle.exitIsFatal = true;
    return {
      label: "mysql",
      port: BACKEND_PORT,
      url: mysqlBackendUrl,
    };
  }

  if (!mysqlHandle.child.killed) {
    mysqlHandle.child.kill();
  }

  console.warn(
    `Backend MySQL nao respondeu na porta ${BACKEND_PORT}. Tentando backend persistente em ${fallbackBackendUrl}...`,
  );

  if (await waitForPort(BACKEND_HOST, FALLBACK_BACKEND_PORT, 300)) {
    console.log(`Backend persistente ja esta ativo em ${fallbackBackendUrl}/health`);
    return {
      label: "persistent",
      port: FALLBACK_BACKEND_PORT,
      url: fallbackBackendUrl,
    };
  }

  const fallbackHandle = spawnManaged("backend-persistente", ["server/index.mjs"], {
    exitIsFatal: false,
  });
  const fallbackReady = await waitForPort(BACKEND_HOST, FALLBACK_BACKEND_PORT, 5000);

  if (!fallbackReady) {
    if (!fallbackHandle.child.killed) {
      fallbackHandle.child.kill();
    }

    throw new Error(
      `Nenhum backend local respondeu nas portas ${BACKEND_PORT} ou ${FALLBACK_BACKEND_PORT}.`,
    );
  }

  fallbackHandle.exitIsFatal = true;
  return {
    label: "persistent",
    port: FALLBACK_BACKEND_PORT,
    url: fallbackBackendUrl,
  };
}

async function main() {
  const normalizedViteArgs = withDefaultFlag(
    withDefaultFlag(viteArgs, "--host", DEFAULT_FRONTEND_HOST),
    "--port",
    DEFAULT_FRONTEND_PORT,
    ["-p"],
  );
  let activeBackend = null;

  if (!skipBackend) {
    try {
      activeBackend = await ensureBackend();
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Falha ao iniciar backend local.");
      shutdown(1);
      return;
    }
  }

  if (!skipFrontend) {
    console.log("Iniciando frontend Vite...");
    const frontendEnv = { ...process.env };

    if (activeBackend?.url) {
      frontendEnv.VITE_API_URL = activeBackend.url;
      frontendEnv.VITE_MYSQL_API_URL = activeBackend.url;
    }

    spawnManaged("frontend", ["node_modules/vite/bin/vite.js", ...normalizedViteArgs], {
      env: frontendEnv,
    });
  } else if (managedChildren.size === 0) {
    console.log("Nada para iniciar.");
    process.exit(0);
    return;
  }

  console.log("");
  console.log("Aplicacao pronta:");
  if (!skipFrontend) {
    const frontendHost = normalizedViteArgs.includes("--host")
      ? normalizedViteArgs[normalizedViteArgs.indexOf("--host") + 1]
      : DEFAULT_FRONTEND_HOST;
    const portIndex = normalizedViteArgs.findIndex((arg) => arg === "--port" || arg === "-p");
    const frontendPort = portIndex >= 0 ? normalizedViteArgs[portIndex + 1] : DEFAULT_FRONTEND_PORT;
    console.log(`Frontend: http://${frontendHost}:${frontendPort}`);
  }
  if (activeBackend) {
    const backendLabel = activeBackend.label === "mysql" ? "MySQL" : "Persistente";
    console.log(`Backend:  ${activeBackend.url}/health (${backendLabel})`);
  }
  console.log("");
}

await main();
