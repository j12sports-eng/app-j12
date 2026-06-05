import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request as createHttpProxyRequest } from "node:http";
import { request as createHttpsProxyRequest } from "node:https";
import net from "node:net";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const DEFAULT_API_TARGET = "http://127.0.0.1:3001";

function getArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);

  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }

  return process.env[name.replaceAll("-", "_").toUpperCase()] || fallback;
}

function getFirstEnv(...names) {
  for (const name of names) {
    const value = process.env[name];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function normalizeApiTarget(value) {
  const configured = String(value || "")
    .trim()
    .replace(/\/+$/, "");

  if (!/^https?:\/\//i.test(configured)) {
    return DEFAULT_API_TARGET;
  }

  return configured
    .replace(/\/api\/auth\/login$/i, "/api")
    .replace(/\/auth\/login$/i, "")
    .replace(/\/api\/auth$/i, "/api")
    .replace(/\/auth$/i, "");
}

function resolveApiTarget() {
  return normalizeApiTarget(
    getArg(
      "api-target",
      getFirstEnv("API_TARGET", "SSR_API_URL", "API_BASE_URL", "AUTH_URL", "VITE_API_URL"),
    ),
  );
}

const HOST = getArg("host", "127.0.0.1");
const PORT = Number(getArg("port", "4173"));
const CLIENT_DIR = path.resolve(rootDir, getArg("client-dist", "dist/client"));
const SERVER_ENTRY = path.resolve(rootDir, getArg("server-entry", "dist/server/server.mjs"));
const API_TARGET = new URL(resolveApiTarget());
const SSR_TIMEOUT_MS = Number(getArg("ssr-timeout-ms", "30000"));

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

let serverEntryPromise;

function isApiRequest(url) {
  return (
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/auth" ||
    url.pathname.startsWith("/auth/")
  );
}

function isSocketRequest(url) {
  return url.pathname === "/socket.io" || url.pathname.startsWith("/socket.io/");
}

function setError(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

function logSsr(message, details) {
  if (details) {
    console.log(message, details);
    return;
  }

  console.log(message);
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} excedeu ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function logFailedFetchResponse(fetchResponse, req, startedAt) {
  if (fetchResponse.status < 500) {
    return;
  }

  let body = "";

  try {
    body = await fetchResponse.clone().text();
  } catch (error) {
    console.error("[SSR] falha ao ler corpo de resposta 500:", error);
  }

  console.error("[SSR] fetchHandler retornou erro HTTP:", {
    method: req.method,
    url: req.url,
    status: fetchResponse.status,
    statusText: fetchResponse.statusText,
    elapsedMs: Date.now() - startedAt,
    body: body.slice(0, 4000),
  });
}

function resolveStaticFile(url) {
  let pathname = "/";

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  const requestedPath = path.resolve(CLIENT_DIR, `.${pathname}`);
  const relativePath = path.relative(CLIENT_DIR, requestedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    return requestedPath;
  }

  return null;
}

function serveStatic(req, res, url) {
  const filePath = resolveStaticFile(url);

  if (!filePath) {
    return false;
  }

  const extension = path.extname(filePath).toLowerCase();
  const headers = {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
  };

  if (url.pathname.startsWith("/assets/")) {
    headers["Cache-Control"] = "public, max-age=2592000, immutable";
  }

  res.writeHead(200, headers);

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  createReadStream(filePath).pipe(res);
  return true;
}

function getApiProxyPath(url) {
  if (url.pathname === "/api") {
    return `/${url.search}`;
  }

  if (url.pathname.startsWith("/api/")) {
    return `${url.pathname.slice(4)}${url.search}`;
  }

  return `${url.pathname}${url.search}`;
}

function proxyHttp(req, res, proxyPath = req.url) {
  try {
    logSsr("[SSR] proxy API iniciou", {
      method: req.method,
      url: req.url,
      proxyPath,
      target: API_TARGET.origin,
    });

    const headers = {
      ...req.headers,
      host: API_TARGET.host,
      "x-forwarded-host": req.headers.host || "",
      "x-forwarded-proto": req.headers["x-forwarded-proto"] || "http",
    };

    const proxyRequest =
      API_TARGET.protocol === "https:" ? createHttpsProxyRequest : createHttpProxyRequest;
    const proxyReq = proxyRequest(
      {
        hostname: API_TARGET.hostname,
        port: API_TARGET.port || (API_TARGET.protocol === "https:" ? 443 : 80),
        protocol: API_TARGET.protocol,
        method: req.method,
        path: proxyPath,
        headers,
      },
      (proxyRes) => {
        proxyRes.on("error", (error) => {
          console.error("[SSR] proxy response stream error:", error);
          res.destroy(error);
        });

        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on("error", (error) => {
      console.error("[SSR] proxy API falhou:", error);

      if (!res.headersSent) {
        setError(res, 502, `Falha ao conectar na API: ${error.message}`);
        return;
      }

      res.destroy(error);
    });

    req.on("error", (error) => {
      console.error("[SSR] request stream error no proxy:", error);
      proxyReq.destroy(error);
    });

    req.pipe(proxyReq);
  } catch (error) {
    console.error("[SSR] proxy API erro inesperado:", error);

    if (!res.headersSent) {
      setError(
        res,
        502,
        error instanceof Error ? error.message : "Falha inesperada no proxy da API.",
      );
      return;
    }

    res.destroy(error);
  }
}

function proxyWebSocket(req, socket, head) {
  try {
    const targetPort = Number(API_TARGET.port || (API_TARGET.protocol === "https:" ? 443 : 80));
    const backendSocket = net.connect(targetPort, API_TARGET.hostname, () => {
      backendSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);

      for (const [key, value] of Object.entries(req.headers)) {
        if (key.toLowerCase() === "host") {
          continue;
        }

        const headerValue = Array.isArray(value) ? value.join(", ") : value;
        backendSocket.write(`${key}: ${headerValue || ""}\r\n`);
      }

      backendSocket.write(`host: ${API_TARGET.host}\r\n`);
      backendSocket.write("\r\n");

      if (head.length > 0) {
        backendSocket.write(head);
      }

      backendSocket.pipe(socket);
      socket.pipe(backendSocket);
    });

    backendSocket.on("error", (error) => {
      console.error("[SSR] websocket proxy error:", error);
      socket.destroy();
    });
  } catch (error) {
    console.error("[SSR] websocket proxy erro inesperado:", error);
    socket.destroy();
  }
}

async function getServerFetch() {
  logSsr("[SSR] carregando server entry", { serverEntry: SERVER_ENTRY });

  if (!existsSync(SERVER_ENTRY)) {
    throw new Error(
      `Build SSR nao encontrado em ${SERVER_ENTRY}. Execute npm run build antes de iniciar o frontend.`,
    );
  }

  let serverEntry;

  try {
    serverEntryPromise ??= import(pathToFileURL(SERVER_ENTRY).href);
    serverEntry = await serverEntryPromise;
  } catch (error) {
    console.error("[SSR] falha ao importar server entry:", error);
    throw error;
  }

  const fetchHandler = serverEntry.default?.fetch;

  if (typeof fetchHandler !== "function") {
    throw new Error(`${SERVER_ENTRY} nao exporta default.fetch.`);
  }

  return fetchHandler;
}

function createFetchRequest(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || `${HOST}:${PORT}`;
  const url = new URL(req.url || "/", `${protocol}://${Array.isArray(host) ? host[0] : host}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }

    if (value != null) {
      headers.set(key, value);
    }
  }

  const init = {
    method: req.method,
    headers,
  };

  if (!["GET", "HEAD"].includes(req.method || "GET")) {
    init.body = Readable.toWeb(req);
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function sendFetchResponse(fetchResponse, res) {
  res.statusCode = fetchResponse.status;

  fetchResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!fetchResponse.body) {
    res.end();
    return;
  }

  await new Promise((resolve, reject) => {
    const stream = Readable.fromWeb(fetchResponse.body);

    stream.on("error", reject);
    res.on("error", reject);
    res.on("finish", resolve);
    stream.pipe(res);
  });
}

async function renderSsr(req, res) {
  const startedAt = Date.now();
  logSsr("[SSR] iniciou render", {
    method: req.method,
    url: req.url,
  });

  try {
    const fetchHandler = await getServerFetch();
    const executionContext = {
      passThroughOnException() {},
      waitUntil(promise) {
        Promise.resolve(promise).catch((error) => {
          console.error("SSR waitUntil error:", error);
        });
      },
    };
    const fetchRequest = createFetchRequest(req);
    const fetchResponse = await withTimeout(
      fetchHandler(fetchRequest, {}, executionContext),
      SSR_TIMEOUT_MS,
      `SSR ${req.method} ${req.url}`,
    );

    logSsr("[SSR] terminou fetchHandler", {
      method: req.method,
      url: req.url,
      status: fetchResponse.status,
      elapsedMs: Date.now() - startedAt,
    });

    await logFailedFetchResponse(fetchResponse, req, startedAt);

    await sendFetchResponse(fetchResponse, res);

    logSsr("[SSR] enviou resposta", {
      method: req.method,
      url: req.url,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("SSR render error:", error);
    setError(
      res,
      500,
      error instanceof Error ? error.message : "Falha ao renderizar frontend SSR.",
    );
  }
}

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    logSsr("[SSR] recebeu request", {
      method: req.method,
      pathname: url.pathname,
    });

    if (isApiRequest(url)) {
      proxyHttp(req, res, getApiProxyPath(url));
      return;
    }

    if (isSocketRequest(url)) {
      proxyHttp(req, res);
      return;
    }

    if (serveStatic(req, res, url)) {
      logSsr("[SSR] serviu asset estatico", {
        method: req.method,
        pathname: url.pathname,
      });
      return;
    }

    if (url.pathname.startsWith("/assets/")) {
      setError(res, 404, "Asset nao encontrado.");
      return;
    }

    void renderSsr(req, res);
  } catch (error) {
    console.error("[SSR] pipeline HTTP falhou:", error);

    if (!res.headersSent) {
      setError(
        res,
        500,
        error instanceof Error ? error.message : "Falha inesperada no frontend SSR.",
      );
      return;
    }

    res.destroy(error);
  }
});

const server = createServer(app);

server.on("error", (error) => {
  console.error("[SSR] servidor HTTP falhou:", error);
});

server.on("upgrade", (req, socket, head) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (isSocketRequest(url)) {
      proxyWebSocket(req, socket, head);
      return;
    }

    socket.destroy();
  } catch (error) {
    console.error("[SSR] upgrade falhou:", error);
    socket.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Frontend SSR Express server listening on http://${HOST}:${PORT}`);
  console.log(`Serving client assets from ${CLIENT_DIR}`);
  console.log(`Rendering SSR with ${SERVER_ENTRY}`);
  console.log(`Proxying API to ${API_TARGET.origin}`);
});
