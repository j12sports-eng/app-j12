const assert = require("node:assert/strict");
const test = require("node:test");

const {
  BancoInterClient,
  INTER_CLIENT_CREDENTIALS_MISSING_CODE,
  buildPixChargePayload,
} = require("./banco-inter.client.js");

test("BancoInterClient authenticates with OAuth and reuses cached token", async () => {
  const calls = [];
  const client = new BancoInterClient({
    baseUrl: "https://inter.test",
    clientId: "client-id",
    clientSecret: "client-secret",
    httpClient: {
      async post(url, body, config) {
        calls.push({ body, config, url });
        return {
          data: {
            access_token: "token-1",
            expires_in: 3600,
            scope: "pix.read pix.write",
            token_type: "Bearer",
          },
        };
      },
    },
    httpsAgentFactory() {
      return { agent: true };
    },
    now: () => 1000,
    pixKey: "pix-key",
  });

  const first = await client.getAccessToken();
  const second = await client.getAccessToken();

  assert.equal(first.accessToken, "token-1");
  assert.equal(second.accessToken, "token-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://inter.test/oauth/v2/token");
  assert.match(calls[0].body, /grant_type=client_credentials/);
  assert.equal(calls[0].config.httpsAgent.agent, true);
});

test("BancoInterClient refreshes token and retries one unauthorized request", async () => {
  let tokenRequests = 0;
  let requestAttempts = 0;
  const client = new BancoInterClient({
    baseUrl: "https://inter.test",
    clientId: "client-id",
    clientSecret: "client-secret",
    httpClient: {
      async post() {
        tokenRequests += 1;
        return {
          data: {
            access_token: `token-${tokenRequests}`,
            expires_in: 3600,
          },
        };
      },
      async request(config) {
        requestAttempts += 1;

        if (requestAttempts === 1) {
          const error = new Error("unauthorized");
          error.response = { status: 401 };
          throw error;
        }

        return {
          data: {
            authorization: config.headers.Authorization,
            ok: true,
          },
        };
      },
    },
    httpsAgentFactory() {
      return {};
    },
    pixKey: "pix-key",
  });

  const response = await client.request({
    method: "GET",
    url: "/pix/v2/cob/TXID",
  });

  assert.equal(response.data.ok, true);
  assert.equal(response.data.authorization, "Bearer token-2");
  assert.equal(tokenRequests, 2);
  assert.equal(requestAttempts, 2);
});

test("BancoInterClient creates Pix charge payload with debtor and payment link fields", async () => {
  const requests = [];
  const client = new BancoInterClient({
    baseUrl: "https://inter.test",
    clientId: "client-id",
    clientSecret: "client-secret",
    httpClient: {
      async post() {
        return {
          data: {
            access_token: "token",
            expires_in: 3600,
          },
        };
      },
      async request(config) {
        requests.push(config);

        if (config.url.endsWith("/qrcode")) {
          return {
            data: {
              pixCopiaECola: "pix-copy",
              qrCode: "base64",
            },
          };
        }

        return {
          data: {
            loc: {
              location: "https://inter.test/pagar/123",
            },
          },
        };
      },
    },
    httpsAgentFactory() {
      return {};
    },
    pixKey: "pix-key",
  });

  const payload = buildPixChargePayload({
    amount: 120,
    pixKey: "pix-key",
    responsibleCpf: "123.456.789-09",
    responsibleName: "Responsavel",
    studentName: "Aluno",
  });
  const issued = await client.createPixCharge({
    amount: 120,
    responsibleCpf: "123.456.789-09",
    responsibleName: "Responsavel",
    studentName: "Aluno",
    txid: "TXIDEXPLICITVALID12345678901",
  });

  assert.equal(payload.devedor.cpf, "12345678909");
  assert.equal(payload.valor.original, "120.00");
  assert.equal(issued.paymentLink, "https://inter.test/pagar/123");
  assert.equal(issued.pixCopyPaste, "pix-copy");
  assert.equal(issued.qrCode, "data:image/png;base64,base64");
  assert.equal(requests[0].method, "PUT");
  assert.equal(requests[0].url, "/pix/v2/cob/TXIDEXPLICITVALID12345678901");
});

test("BancoInterClient rejects missing credentials before external request", async () => {
  const client = new BancoInterClient({
    baseUrl: "https://inter.test",
    httpClient: {},
    httpsAgentFactory() {
      return {};
    },
    pixKey: "pix-key",
  });

  await assert.rejects(() => client.getAccessToken(), {
    code: INTER_CLIENT_CREDENTIALS_MISSING_CODE,
  });
});

test("BancoInterClient envia payload minimo no cancelamento Pix", async () => {
  const requests = [];
  const client = new BancoInterClient({
    clientId: "fixture-client-id",
    clientSecret: "fixture-client-secret",
    httpClient: {
      async post() {
        return { data: { access_token: "fixture-token", expires_in: 3600 } };
      },
      async request(config) {
        requests.push(config);
        return { data: { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" } };
      },
    },
    httpsAgentFactory() {
      return {};
    },
    pixKey: "fixture-pix-key",
  });
  await client.cancelPixCharge("TXID-HISTORICO", "motivo local");
  assert.deepEqual(requests[0].data, { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" });
  assert.deepEqual(Object.keys(requests[0].data), ["status"]);
});
