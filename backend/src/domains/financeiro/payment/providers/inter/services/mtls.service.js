const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const INTER_MTLS_CERTIFICATE_MISSING_CODE = "INTER_MTLS_CERTIFICATE_MISSING";
const INTER_MTLS_INVALID_CODE = "INTER_MTLS_INVALID";

class MTLSService {
  constructor(options = {}) {
    this.agentFactory = options.agentFactory || ((config) => new https.Agent(config));
    this.env = options.env || process.env;
    this.fs = options.fs || fs;
    this.path = options.path || path;
    if (options.rejectUnauthorized === false) {
      throw controlledError(
        "Banco Inter requer validacao TLS do servidor.",
        INTER_MTLS_INVALID_CODE,
      );
    }
    this.rejectUnauthorized = true;
  }

  createHttpsAgent() {
    const config = this.resolveCertificateConfig();

    return this.agentFactory({
      ca: config.ca,
      cert: config.cert,
      key: config.key,
      keepAlive: true,
      rejectUnauthorized: this.rejectUnauthorized,
    });
  }

  resolveCertificateConfig() {
    const cert = this.readRequiredFile(
      this.env.INTER_CERT_PATH || this.env.INTER_CERT || this.env.BANCO_INTER_CERT_PATH,
      "certificado cliente",
    );
    const key = this.readRequiredFile(
      this.env.INTER_KEY_PATH || this.env.INTER_KEY || this.env.BANCO_INTER_KEY_PATH,
      "chave privada",
    );
    const ca = this.readOptionalChain(
      this.env.INTER_CA_PATH || this.env.INTER_CERT_CHAIN_PATH || this.env.BANCO_INTER_CA_PATH,
    );

    return {
      ca,
      cert,
      key,
    };
  }

  readRequiredFile(filePath, label) {
    const resolved = this.resolvePath(filePath);

    if (!resolved || !this.fileExists(resolved)) {
      throw controlledError(
        `Banco Inter requer ${label} mTLS configurado por variavel de ambiente.`,
        INTER_MTLS_CERTIFICATE_MISSING_CODE,
        INTER_MTLS_INVALID_CODE,
        { label },
      );
    }

    const content = this.fs.readFileSync(resolved);
    if (!content || Number(content.length || 0) === 0) {
      throw controlledError(
        `Arquivo de ${label} mTLS do Banco Inter esta vazio.`,
        INTER_MTLS_CERTIFICATE_MISSING_CODE,
        INTER_MTLS_INVALID_CODE,
        { label },
      );
    }

    const normalized = content.toString("utf8");
    const isCertificate = label === "certificado cliente";
    const hasValidEnvelope = isCertificate
      ? /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(normalized)
      : /-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/.test(
          normalized,
        );
    if (!hasValidEnvelope) {
      throw controlledError(
        "Arquivo mTLS do Banco Inter possui formato invalido.",
        INTER_MTLS_INVALID_CODE,
        { label },
      );
    }
    return content;
  }

  readOptionalChain(value) {
    const paths = String(value || "")
      .split(",")
      .map((item) => this.resolvePath(item))
      .filter(Boolean);
    const chain = [];

    for (const filePath of paths) {
      if (this.fileExists(filePath)) {
        chain.push(this.fs.readFileSync(filePath));
      }
    }

    return chain.length > 0 ? chain : undefined;
  }

  resolvePath(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return null;
    if (this.path.isAbsolute(normalized)) return normalized;
    return this.path.resolve(process.cwd(), normalized);
  }

  fileExists(filePath) {
    try {
      return Boolean(
        filePath && this.fs.existsSync(filePath) && this.fs.statSync(filePath).isFile(),
      );
    } catch {
      return false;
    }
  }
}

function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;

  for (const [key, value] of Object.entries(details)) {
    error[key] = value;
  }

  return error;
}

module.exports = {
  INTER_MTLS_CERTIFICATE_MISSING_CODE,
  INTER_MTLS_INVALID_CODE,
  MTLSService,
};
