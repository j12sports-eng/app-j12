const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
const BACKEND_ROOT = path.resolve(__dirname, "../../../");
const SERVICE_CERT_DIR = path.resolve(__dirname, "certificates");

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function nullableText(value, max = 191) {
  const normalized = text(value, max);
  return normalized || null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

function resolvePathCandidate(value) {
  const normalized = text(value, 1000);
  if (!normalized) return [];

  if (path.isAbsolute(normalized)) {
    return [normalized];
  }

  return [
    path.resolve(process.cwd(), normalized),
    path.resolve(PROJECT_ROOT, normalized),
    path.resolve(BACKEND_ROOT, normalized),
  ];
}

function uniquePaths(paths) {
  return Array.from(new Set(paths.map((item) => path.normalize(item))));
}

function buildNamedCandidates(searchDirs, names, extensions) {
  const candidates = [];

  for (const dir of searchDirs) {
    for (const name of names) {
      candidates.push(path.join(dir, name));
      for (const ext of extensions) {
        candidates.push(path.join(dir, `${name}${ext}`));
      }
    }
  }

  return candidates;
}

function firstExisting(paths) {
  for (const candidate of uniquePaths(paths)) {
    try {
      if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Ignora paths inacessiveis e continua procurando em locais conhecidos.
    }
  }

  return null;
}

function findInterCertificates() {
  const searchDirs = uniquePaths([
    SERVICE_CERT_DIR,
    path.resolve(PROJECT_ROOT, "certs"),
    path.resolve(BACKEND_ROOT, "certs"),
    path.resolve(PROJECT_ROOT, "src/services/bancoInter/certificates"),
    path.resolve(PROJECT_ROOT, "backend/src/services/bancoInter/certificates"),
    PROJECT_ROOT,
    BACKEND_ROOT,
  ]);

  const certEnvCandidates = [
    ...resolvePathCandidate(process.env.INTER_CERT_PATH),
    ...resolvePathCandidate(process.env.INTER_CERT),
  ];
  const keyEnvCandidates = [
    ...resolvePathCandidate(process.env.INTER_KEY_PATH),
    ...resolvePathCandidate(process.env.INTER_KEY),
  ];

  const certCandidates = [
    ...certEnvCandidates,
    ...buildNamedCandidates(
      searchDirs,
      ["Inter API_Certificado", "Inter API Certificado", "inter", "inter-api", "banco-inter"],
      ["", ".crt", ".pem", ".cer", ".key"],
    ),
  ];

  const keyCandidates = [
    ...keyEnvCandidates,
    ...buildNamedCandidates(
      searchDirs,
      ["Inter API_Chave", "Inter API Chave", "inter", "inter-api", "banco-inter"],
      ["", ".key", ".pem", ".crt", ".cer"],
    ),
  ];

  const certPath = firstExisting(certCandidates);
  const keyPath = firstExisting(keyCandidates.filter((candidate) => candidate !== certPath));

  if (!certPath || !keyPath) {
    const error = new Error(
      "Certificado/chave do Banco Inter nao encontrados. Configure INTER_CERT_PATH e INTER_KEY_PATH ou coloque os arquivos Inter API_Certificado e Inter API_Chave em backend/src/services/bancoInter/certificates ou certs/.",
    );
    error.code = "INTER_CERTIFICATES_NOT_FOUND";
    error.details = {
      certFound: Boolean(certPath),
      keyFound: Boolean(keyPath),
      searchedDirs: searchDirs,
    };
    throw error;
  }

  return {
    certPath,
    keyPath,
  };
}

function createInterHttpsAgent() {
  const { certPath, keyPath } = findInterCertificates();

  return new https.Agent({
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    keepAlive: true,
    rejectUnauthorized: true,
  });
}

function resolveInterBaseUrl() {
  const configured = text(process.env.INTER_BASE_URL, 500).replace(/\/+$/, "");
  if (configured) return configured;

  const environment = text(
    process.env.INTER_ENVIRONMENT || process.env.INTER_ENV,
    50,
  ).toLowerCase();
  if (["homologacao", "homologation", "sandbox", "hml"].includes(environment)) {
    return "https://cdpj-sandbox.partners.uatinter.co";
  }

  return "https://cdpj.partners.bancointer.com.br";
}

function resolvePixKey() {
  return (
    text(process.env.INTER_PIX_KEY, 191) ||
    text(process.env.PIX_KEY, 191) ||
    text(process.env.J12_PIX_KEY, 191)
  );
}

function buildTxid(seed) {
  const normalizedSeed = String(seed ?? "").trim();
  const entropy = normalizedSeed
    ? crypto.createHash("sha256").update(normalizedSeed).digest("hex").slice(0, 32)
    : crypto.randomBytes(16).toString("hex");

  return `J12${entropy}`.toUpperCase();
}

function resolvePixTxid(explicitTxid, seed) {
  const explicit = String(explicitTxid ?? "").trim();
  if (!explicit) return buildTxid(seed);

  if (!/^[A-Za-z0-9]{26,35}$/.test(explicit)) {
    const error = new Error("Txid Pix deve conter de 26 a 35 caracteres alfanumericos.");
    error.code = "INTER_TXID_INVALID";
    throw error;
  }

  return explicit;
}

function money(value) {
  const parsed = Number(value ?? 0);
  return (Number.isFinite(parsed) ? parsed : 0).toFixed(2);
}

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const normalized = text(value, 32);
  return normalized ? normalized.slice(0, 10) : null;
}

function nowMysql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify({ error: "payload_nao_serializavel" });
  }
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function logInter(scope, message, meta = null) {
  const suffix = meta ? ` ${safeJsonStringify(meta)}` : "";
  console.info(`[inter][${scope}] ${message}${suffix}`);
}

module.exports = {
  BACKEND_ROOT,
  PROJECT_ROOT,
  SERVICE_CERT_DIR,
  buildTxid,
  createInterHttpsAgent,
  dateOnly,
  findInterCertificates,
  logInter,
  money,
  nowMysql,
  nullableText,
  parseJson,
  resolveInterBaseUrl,
  resolvePixTxid,
  resolvePixKey,
  safeJsonStringify,
  text,
  toArray,
};
