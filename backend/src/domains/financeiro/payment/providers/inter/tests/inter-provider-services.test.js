const assert = require("node:assert/strict");
const test = require("node:test");

const { InterClient } = require("../services/inter-client.js");
const { MTLSService } = require("../services/mtls.service.js");
const { OAuthService } = require("../services/oauth.service.js");
const { PixService } = require("../services/pix.service.js");

test("OAuthService caches token and renews only near expiration", async () => {
  let now = 1_000;
  const calls = [];
  const oauth = new OAuthService({
    baseUrl: "https://inter.test",
    clientId: "client-id",
    clientSecret: "client-secret",
    httpClient: {
      async post(url, body, config) {
        calls.push({ body, config, url });
        return {
          data: {
            access_token: `token-${calls.length}`,
            expires_in: 120,
            token_type: "Bearer",
          },
        };
      },
    },
    mtlsService: {
      createHttpsAgent() {
        return "agent";
      },
    },
    now: () => now,
  });

  const first = await oauth.getAccessToken();
  const cached = await oauth.getAccessToken();
  now += 100_000;
  const renewed = await oauth.getAccessToken();

  assert.equal(first.accessToken, "token-1");
  assert.equal(cached.accessToken, "token-1");
  assert.equal(renewed.accessToken, "token-2");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://inter.test/oauth/v2/token");
  assert.equal(calls[0].body.includes("client_secret=client-secret"), true);
});

test("InterClient refreshes OAuth token and retries one auth failure", async () => {
  const oauthCalls = [];
  const requests = [];
  const client = new InterClient({
    baseUrl: "https://inter.test",
    httpClient: {
      async request(config) {
        requests.push(config);
        if (requests.length === 1) {
          const error = new Error("unauthorized");
          error.response = { status: 401 };
          throw error;
        }

        return { data: { ok: true }, status: 200 };
      },
    },
    mtlsService: {
      createHttpsAgent() {
        return "agent";
      },
    },
    oauthService: {
      clearTokenCache() {
        oauthCalls.push(["clear"]);
      },
      async getAccessToken(input) {
        oauthCalls.push(["token", input]);
        return {
          accessToken: input.forceRefresh ? "new-token" : "old-token",
        };
      },
    },
  });

  const response = await client.request({ method: "GET", url: "/pix/v2/cob/TXID" });

  assert.deepEqual(response.data, { ok: true });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers.Authorization, "Bearer old-token");
  assert.equal(requests[1].headers.Authorization, "Bearer new-token");
  assert.deepEqual(oauthCalls, [
    ["token", { forceRefresh: false }],
    ["clear"],
    ["token", { forceRefresh: true }],
  ]);
});

test("MTLSService loads client certificate, private key and certificate chain from env paths", () => {
  const reads = [];
  const fakeFs = {
    existsSync(filePath) {
      return ["cert.pem", "key.pem", "ca.pem"].some((name) => filePath.endsWith(name));
    },
    readFileSync(filePath) {
      reads.push(filePath);
      if (filePath.endsWith("cert.pem"))
        return Buffer.from("-----BEGIN CERTIFICATE-----\nfixture-only\n-----END CERTIFICATE-----");
      if (filePath.endsWith("key.pem"))
        return Buffer.from("-----BEGIN PRIVATE KEY-----\nfixture-only\n-----END PRIVATE KEY-----");
      return Buffer.from("fixture-ca-chain");
    },
    statSync() {
      return { isFile: () => true };
    },
  };
  const mtls = new MTLSService({
    agentFactory(config) {
      return config;
    },
    env: {
      INTER_CA_PATH: "ca.pem",
      INTER_CERT_PATH: "cert.pem",
      INTER_KEY_PATH: "key.pem",
    },
    fs: fakeFs,
  });

  const agentConfig = mtls.createHttpsAgent();

  assert.equal(Buffer.isBuffer(agentConfig.cert), true);
  assert.equal(Buffer.isBuffer(agentConfig.key), true);
  assert.equal(Array.isArray(agentConfig.ca), true);
  assert.equal(agentConfig.rejectUnauthorized, true);
  assert.equal(reads.length, 3);
});

test("PixService creates, consults and cancels Pix charge through InterClient", async () => {
  const requests = [];
  const pix = new PixService({
    client: {
      async request(config) {
        requests.push(config);
        if (config.method === "PUT") {
          return {
            data: {
              loc: {
                id: "LOC-1",
                location: "https://inter.test/pagar/TXID-1",
              },
            },
          };
        }

        if (config.url.endsWith("/qrcode")) {
          return {
            data: {
              imagemQrcode: "base64-image",
              pixCopiaECola: "pix-copy",
            },
          };
        }

        return {
          data: {
            pix: [{ endToEndId: "E2E-1" }],
            status: "CONCLUIDA",
          },
        };
      },
    },
    pixKey: "pix-key",
  });

  const created = await pix.createPixCharge({
    amount: 250,
    chargeId: "cob-1",
    description: "Mensalidade",
    responsibleCpf: "12345678909",
    responsibleName: "Responsavel",
    studentName: "Aluno",
    txid: "TXIDEXPLICITVALID12345678901",
  });
  const consulted = await pix.getPixCharge("TXID-1");
  const cancelled = await pix.cancelPixCharge("TXID-1", "cancelamento");

  assert.equal(created.txid, "TXIDEXPLICITVALID12345678901");
  assert.equal(created.pixCopyPaste, "pix-copy");
  assert.equal(created.paymentLink, "https://inter.test/pagar/TXID-1");
  assert.equal(created.qrCode, "data:image/png;base64,base64-image");
  assert.deepEqual(consulted.pix, [{ endToEndId: "E2E-1" }]);
  assert.deepEqual(cancelled.pix, [{ endToEndId: "E2E-1" }]);
  assert.deepEqual(
    requests.map((item) => [item.method, item.url]),
    [
      ["PUT", "/pix/v2/cob/TXIDEXPLICITVALID12345678901"],
      ["GET", "/pix/v2/cob/TXIDEXPLICITVALID12345678901/qrcode"],
      ["GET", "/pix/v2/cob/TXID-1"],
      ["PATCH", "/pix/v2/cob/TXID-1"],
    ],
  );
});

test("PixService gera txids Pix validos em todos os cenarios novos", async () => {
  const urls = [];
  const pix = new PixService({
    client: {
      async request(config) {
        urls.push(config.url);
        return config.url.endsWith("/qrcode")
          ? { data: { pixCopiaECola: "fixture-pix-copy" } }
          : { data: { status: "ATIVA" } };
      },
    },
    pixKey: "fixture-pix-key",
  });
  const cases = [
    { chargeId: "cobranca-com espacos/acentos-á_uuid-123" },
    { mensalidadeId: "mensalidade/ç_123-456" },
    {},
    {},
  ];
  const results = [];
  for (const input of cases) results.push(await pix.createPixCharge({ amount: 1, ...input }));
  for (const result of results) {
    assert.match(result.txid, /^[A-Za-z0-9]{26,35}$/);
    assert.equal(result.txid.length, 35);
    assert.equal(urls.includes(`/pix/v2/cob/${result.txid}`), true);
  }
  assert.equal(results[0].txid, (await pix.createPixCharge({ amount: 1, ...cases[0] })).txid);
  assert.equal(results[1].txid, (await pix.createPixCharge({ amount: 1, ...cases[1] })).txid);
  assert.notEqual(results[2].txid, results[3].txid);
});

test("PixService valida txid explicito sem truncamento silencioso", async () => {
  const explicit = "TXIDEXPLICITVALID12345678901";
  const requests = [];
  const pix = new PixService({
    client: {
      async request(config) {
        requests.push(config);
        return config.url.endsWith("/qrcode")
          ? { data: { pixCopiaECola: "fixture-pix-copy" } }
          : { data: { status: "ATIVA" } };
      },
    },
    pixKey: "fixture-pix-key",
  });
  const issued = await pix.createPixCharge({ amount: 1, txid: explicit });
  assert.equal(issued.txid, explicit);
  assert.equal(requests[0].url, `/pix/v2/cob/${explicit}`);
  await assert.rejects(
    pix.createPixCharge({ amount: 1, txid: `${explicit}TOO-LONG-AND-INVALID` }),
    { code: "INTER_TXID_INVALID" },
  );
});

test("PixService envia somente status no cancelamento Pix", async () => {
  const requests = [];
  const pix = new PixService({
    client: {
      async request(config) {
        requests.push(config);
        return { data: { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" } };
      },
    },
    pixKey: "fixture-pix-key",
  });
  await pix.cancelPixCharge("TXID-HISTORICO", "motivo mantido na camada de auditoria");
  assert.deepEqual(requests[0].data, { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" });
  assert.deepEqual(Object.keys(requests[0].data), ["status"]);
});
