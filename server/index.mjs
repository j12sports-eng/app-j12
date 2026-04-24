import { createServer } from "node:http";
import {
  ALLOWED_COLLECTIONS,
  authenticateUser,
  createPublicEnrollment,
  createPasswordResetToken,
  createSession,
  deleteSession,
  findUserBySessionToken,
  getNextEnrollmentNumberPreview,
  purgeExpiredPasswordResetTokens,
  resetUserPassword,
  validatePasswordResetToken,
  getCollection,
  getDatabasePath,
  putCollection,
} from "./database.mjs";
import { sendPasswordResetEmail } from "./email.mjs";

const NODE_ENV = process.env.NODE_ENV || "development";
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || "4001");
const SHOW_HEALTH_DETAILS = process.env.HEALTH_SHOW_DETAILS === "true";
const DEFAULT_PRODUCTION_ORIGINS = ["https://app.j12sports.com.br"];
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
const APP_BASE_URL = process.env.APP_BASE_URL?.trim() || "";

function parseAllowedOrigins(rawValue) {
  if (rawValue?.trim()) {
    return rawValue
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return NODE_ENV === "production" ? DEFAULT_PRODUCTION_ORIGINS : ["*"];
}

function getAllowedOrigin(req) {
  const requestOrigin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (!requestOrigin) return null;
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : null;
}

function isOriginAllowed(req) {
  if (ALLOWED_ORIGINS.includes("*")) return true;
  if (!req.headers.origin) return true;
  return ALLOWED_ORIGINS.includes(req.headers.origin);
}

function setCorsHeaders(req, res) {
  const allowedOrigin = getAllowedOrigin(req);

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }

  if (allowedOrigin && allowedOrigin !== "*") {
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
}

function sendJson(req, res, status, payload) {
  setCorsHeaders(req, res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendHtml(req, res, status, html) {
  setCorsHeaders(req, res);
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024 * 4) {
        reject(new Error("Payload excede o limite de 4MB"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON invalido"));
      }
    });

    req.on("error", reject);
  });
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length);
}

function getAuthenticatedUser(req) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return findUserBySessionToken(token);
}

function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isPrivilegedUser(user) {
  return user?.role === "admin" || user?.role === "coordenador";
}

function getTurmasCollection() {
  const record = getCollection("turmas");
  return Array.isArray(record?.data) ? record.data : [];
}

function getSettingsCollection() {
  const record = getCollection("settings");
  return record?.data ?? null;
}

function getProfessorAccessContext(user) {
  const turmas = getTurmasCollection();
  const settings = getSettingsCollection();
  const users = Array.isArray(settings?.users) ? settings.users : [];
  const configuredUser = users.find((item) => String(item?.id ?? "") === String(user?.id ?? ""));

  let classIds = Array.isArray(configuredUser?.classIds)
    ? configuredUser.classIds.filter((item) => typeof item === "string" && item.trim())
    : [];

  if (classIds.length === 0) {
    classIds = turmas
      .filter((turma) => {
        if (!turma) return false;
        if (user?.teacherId && turma.professorId && turma.professorId === user.teacherId) {
          return true;
        }

        return normalizeComparable(turma.professor) === normalizeComparable(user?.nome);
      })
      .map((turma) => turma.id)
      .filter((item) => typeof item === "string" && item.trim());
  }

  const allowedClassIds = new Set(classIds);
  const allowedTurmas = turmas.filter((turma) => allowedClassIds.has(turma?.id));
  const allowedStudentIds = new Set(
    allowedTurmas.flatMap((turma) =>
      Array.isArray(turma?.alunoIds)
        ? turma.alunoIds.filter((item) => typeof item === "string" && item.trim())
        : [],
    ),
  );

  return {
    settings,
    configuredUser,
    allowedClassIds,
    allowedTurmas,
    allowedStudentIds,
  };
}

function buildScopedSettings(data, user, context) {
  if (!data || typeof data !== "object") return data;
  if (isPrivilegedUser(user)) return data;

  const base = {
    ...data,
    general: data.general ?? {},
    appearance: data.appearance ?? {},
    notifications: data.notifications ?? {},
    permissions: Array.isArray(data.permissions)
      ? data.permissions.filter((item) => item?.role === user?.role)
      : [],
    integrations:
      user?.role === "professor"
        ? {
            ...data.integrations,
            automationToken: "",
          }
        : {
            whatsappEnabled: false,
            emailEnabled: false,
            paymentGateway: "",
            automationToken: "",
          },
  };

  if (user?.role === "professor") {
    return {
      ...base,
      users: Array.isArray(data.users)
        ? data.users.filter((item) => String(item?.id ?? "") === String(user.id))
        : [],
      teacherAssets: Array.isArray(data.teacherAssets)
        ? data.teacherAssets.filter((item) => item?.teacherId === user.teacherId)
        : [],
      units: Array.isArray(data.units) ? data.units : [],
      modalities: Array.isArray(data.modalities) ? data.modalities : [],
      contracts: [],
    };
  }

  return {
    ...base,
    users: Array.isArray(data.users)
      ? data.users.filter((item) => String(item?.studentId ?? "") === String(user?.studentId ?? ""))
      : [],
    teacherAssets: [],
    units: [],
    modalities: [],
    contracts: [],
  };
}

function filterCollectionForUser(collection, data, user) {
  if (!user) return data;
  if (isPrivilegedUser(user)) return data;

  if (collection === "settings") {
    const context = user.role === "professor" ? getProfessorAccessContext(user) : null;
    return buildScopedSettings(data, user, context);
  }

  if (user.role === "professor") {
    if (!Array.isArray(data)) return [];

    const context = getProfessorAccessContext(user);

    switch (collection) {
      case "turmas":
        return data.filter((item) => context.allowedClassIds.has(item?.id));
      case "alunos":
        return data.filter((item) => context.allowedStudentIds.has(item?.id));
      case "professores":
        return data.filter(
          (item) =>
            item?.id === user.teacherId ||
            normalizeComparable(item?.nome) === normalizeComparable(user.nome),
        );
      case "planos":
        return [];
      case "financeiro":
      case "financeiro-recorrencias":
      case "contratos":
      case "trial-classes":
        return [];
      default:
        return [];
    }
  }

  const studentId = String(user.studentId ?? "").trim();
  if (!studentId) return Array.isArray(data) ? [] : data;
  if (!Array.isArray(data)) return data;

  switch (collection) {
    case "alunos":
      return data.filter((item) => item?.id === studentId);
    case "contratos":
      return data.filter((item) => item?.alunoId === studentId);
    case "financeiro":
      return data.filter((item) => item?.alunoId === studentId);
    case "turmas":
      return data.filter(
        (item) => Array.isArray(item?.alunoIds) && item.alunoIds.includes(studentId),
      );
    case "professores": {
      const ownTurmas = getTurmasCollection().filter(
        (item) => Array.isArray(item?.alunoIds) && item.alunoIds.includes(studentId),
      );
      const teacherIds = new Set(ownTurmas.map((item) => item?.professorId).filter(Boolean));
      return data.filter((item) => teacherIds.has(item?.id));
    }
    default:
      return [];
  }
}

function canWriteCollection(user, collection, payload) {
  if (!user) return false;
  if (isPrivilegedUser(user)) return true;

  if (user.role === "professor") {
    if (collection !== "turmas" || !Array.isArray(payload)) return false;

    const currentRecord = getCollection("turmas");
    const currentData = Array.isArray(currentRecord?.data) ? currentRecord.data : [];
    const currentById = new Map(currentData.map((item) => [item.id, item]));
    const nextById = new Map(payload.map((item) => [item?.id, item]));
    const { allowedClassIds } = getProfessorAccessContext(user);

    if (payload.length !== currentData.length) return false;

    for (const currentItem of currentData) {
      const nextItem = nextById.get(currentItem.id);
      if (!nextItem) return false;

      if (!allowedClassIds.has(currentItem.id)) {
        if (JSON.stringify(nextItem) !== JSON.stringify(currentItem)) {
          return false;
        }
        continue;
      }

      const currentBase = { ...currentItem, presencas: undefined };
      const nextBase = { ...nextItem, presencas: undefined };
      if (JSON.stringify(currentBase) !== JSON.stringify(nextBase)) {
        return false;
      }
    }

    return [...nextById.keys()].every((id) => currentById.has(id));
  }

  if ((user.role === "aluno" || user.role === "responsavel") && collection === "alunos" && Array.isArray(payload)) {
    return payload.every((item) => item?.id === user.studentId);
  }

  return false;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

function normalizeCep(value) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

async function lookupAddressByCep(cep) {
  const normalizedCep = normalizeCep(cep);

  if (normalizedCep.length !== 8) {
    throw new Error("Informe um CEP valido com 8 numeros.");
  }

  let response;

  try {
    response = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("Nao foi possivel consultar o CEP no momento.");
  }

  if (!response.ok) {
    throw new Error("Nao foi possivel consultar o CEP no momento.");
  }

  const data = await response.json();

  if (data?.erro) {
    throw new Error("CEP nao encontrado. Confira os numeros e tente novamente.");
  }

  return {
    cep: normalizedCep,
    rua: String(data?.logradouro ?? "").trim(),
    bairro: String(data?.bairro ?? "").trim(),
    cidade: String(data?.localidade ?? "").trim(),
    estado: String(data?.uf ?? "").trim().toUpperCase(),
  };
}

function getAppBaseUrl(req) {
  if (APP_BASE_URL) {
    return APP_BASE_URL.replace(/\/+$/, "");
  }

  if (req.headers.origin) {
    return req.headers.origin.replace(/\/+$/, "");
  }

  return `http://${req.headers.host ?? `${HOST}:${PORT}`}`;
}

const server = createServer(async (req, res) => {
  // ROTA PRINCIPAL
if (req.url === "/" && req.method === "GET") {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "J12 API ONLINE 🚀" }));
  return;
}
  setCorsHeaders(req, res);
  purgeExpiredPasswordResetTokens();

  if (!req.url || !req.method) {
    sendJson(req, res, 400, { message: "Requisicao invalida" });
    return;
  }

  if (!isOriginAllowed(req)) {
    sendJson(req, res, 403, { message: "Origem nao permitida" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
  const pathname = url.pathname;

  if (pathname === "/" && req.method === "GET") {
    sendHtml(
      req,
      res,
      200,
      `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>J12 App</title>
          <style>
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              background: #111;
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .box {
              text-align: center;
              padding: 32px;
              border-radius: 16px;
              background: #1a1a1a;
              box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
              max-width: 560px;
              width: calc(100% - 32px);
            }
            h1 {
              color: #ff6b00;
              margin: 0 0 12px;
            }
            p {
              margin: 0;
              color: #ddd;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>🔥 J12 App Online com sucesso!</h1>
            <p>Seu backend está funcionando corretamente.</p>
          </div>
        </body>
      </html>
      `,
    );
    return;
  }

  if (pathname === "/health" && req.method === "GET") {
    const payload = {
      ok: true,
      service: "j12-persistent-api",
      timestamp: new Date().toISOString(),
    };

    if (SHOW_HEALTH_DETAILS) {
      payload.runtime = {
        host: HOST,
        port: PORT,
        databasePath: getDatabasePath(),
        collections: [...ALLOWED_COLLECTIONS],
        allowedOrigins: ALLOWED_ORIGINS,
      };
    }

    sendJson(req, res, 200, payload);
    return;
  }

  if (pathname === "/auth/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email ?? "").trim().toLowerCase();
      const senha = String(body.senha ?? "");

      const user = authenticateUser(email, senha);

      if (!user) {
        sendJson(req, res, 401, { message: "E-mail ou senha invalidos" });
        return;
      }

      const token = createSession(user.id);
      sendJson(req, res, 200, { token, user });
    } catch (error) {
      sendJson(req, res, 400, {
        message: error instanceof Error ? error.message : "Falha ao processar login",
      });
    }
    return;
  }

  if (pathname === "/auth/me" && req.method === "GET") {
    const user = getAuthenticatedUser(req);

    if (!user) {
      sendJson(req, res, 401, { message: "Sessao invalida ou expirada" });
      return;
    }

    sendJson(req, res, 200, user);
    return;
  }

  if (pathname === "/auth/logout" && req.method === "POST") {
    const token = getTokenFromRequest(req);
    if (token) deleteSession(token);
    sendJson(req, res, 200, { ok: true });
    return;
  }

  if (pathname === "/auth/forgot-password" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email ?? "").trim().toLowerCase();

      if (!isValidEmail(email)) {
        sendJson(req, res, 400, { message: "Informe um e-mail valido" });
        return;
      }

      const reset = createPasswordResetToken(email);

      if (!reset) {
        sendJson(req, res, 404, { message: "Nao encontramos um usuario com este e-mail" });
        return;
      }

      const resetUrl = `${getAppBaseUrl(req)}/reset-password/${reset.token}`;
      const delivery = await sendPasswordResetEmail({
        to: reset.user.email,
        resetUrl,
        expiresAt: reset.expiresAt,
      });

      sendJson(req, res, 200, {
        ok: true,
        message: "Enviamos o link de redefinicao para o e-mail informado.",
        expiresAt: reset.expiresAt,
        previewUrl: delivery.previewUrl ?? null,
        deliveryProvider: delivery.provider,
      });
    } catch (error) {
      sendJson(req, res, 400, {
        message:
          error instanceof Error
            ? error.message
            : "Falha ao iniciar recuperacao de senha",
      });
    }
    return;
  }

  if (pathname.startsWith("/auth/reset-password/") && req.method === "GET") {
    const token = pathname.slice("/auth/reset-password/".length);
    const validation = validatePasswordResetToken(token);

    if (!validation.ok) {
      sendJson(req, res, 400, { message: validation.reason, valid: false });
      return;
    }

    sendJson(req, res, 200, {
      valid: true,
      email: validation.data.email,
      expiresAt: validation.data.expiresAt,
    });
    return;
  }

  if (pathname === "/auth/reset-password" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const token = String(body.token ?? "").trim();
      const senha = String(body.senha ?? "");
      const confirmarSenha = String(body.confirmarSenha ?? "");

      if (!token) {
        sendJson(req, res, 400, { message: "Token de redefinicao obrigatorio" });
        return;
      }

      if (!isStrongPassword(senha)) {
        sendJson(req, res, 400, {
          message:
            "A senha deve ter no minimo 8 caracteres, incluindo letra maiuscula, minuscula e numero",
        });
        return;
      }

      if (senha !== confirmarSenha) {
        sendJson(req, res, 400, { message: "A confirmacao da senha nao confere" });
        return;
      }

      resetUserPassword(token, senha);

      sendJson(req, res, 200, {
        ok: true,
        message: "Senha alterada com sucesso.",
      });
    } catch (error) {
      sendJson(req, res, 400, {
        message: error instanceof Error ? error.message : "Falha ao redefinir senha",
      });
    }
    return;
  }

  if (pathname === "/public/enrollments" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);

      const requiredChecks = [
        body?.dadosAluno?.nomeCompleto,
        body?.dadosAluno?.dataNascimento,
        body?.dadosAluno?.cpf,
        body?.dadosAluno?.rg,
        body?.dadosAluno?.sexo,
        body?.responsavel?.nomeCompleto,
        body?.responsavel?.cpf,
        body?.responsavel?.rg,
        body?.responsavel?.whatsapp,
        body?.responsavel?.email,
        body?.responsavel?.parentesco,
        body?.endereco?.cep,
        body?.endereco?.rua,
        body?.endereco?.numero,
        body?.endereco?.bairro,
        body?.endereco?.cidade,
        body?.endereco?.estado,
      ];

      if (requiredChecks.some((value) => !String(value ?? "").trim())) {
        sendJson(req, res, 400, { message: "Preencha os dados obrigatorios da matricula" });
        return;
      }

      const result = createPublicEnrollment(body);

      sendJson(req, res, 201, {
        ok: true,
        protocol: result.protocol,
        status: result.status,
        createdAt: result.createdAt,
        numeroMatricula: result.numeroMatricula,
      });
    } catch (error) {
      sendJson(req, res, 400, {
        message: error instanceof Error ? error.message : "Falha ao registrar matricula",
      });
    }
    return;
  }

  if (pathname === "/public/enrollments/next-number" && req.method === "GET") {
    try {
      const result = getNextEnrollmentNumberPreview();
      sendJson(req, res, 200, { ok: true, ...result });
    } catch (error) {
      sendJson(req, res, 409, {
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel gerar a proxima matricula.",
      });
    }
    return;
  }

  if (pathname === "/public/address/lookup" && req.method === "GET") {
    try {
      const cep = url.searchParams.get("cep");
      const address = await lookupAddressByCep(cep);
      sendJson(req, res, 200, { ok: true, ...address });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel localizar o endereco.";
      const status = message.includes("nao encontrado") ? 404 : 400;
      sendJson(req, res, status, { message });
    }
    return;
  }

  if (pathname.startsWith("/api/state/")) {
    const user = getAuthenticatedUser(req);

    if (!user) {
      sendJson(req, res, 401, { message: "Sessao invalida ou expirada" });
      return;
    }

    const collection = pathname.slice("/api/state/".length);

    if (!ALLOWED_COLLECTIONS.has(collection)) {
      sendJson(req, res, 404, { message: "Colecao nao encontrada" });
      return;
    }

    if (req.method === "GET") {
      const record = getCollection(collection);

      if (!record) {
        sendJson(req, res, 404, { message: "Colecao ainda nao inicializada" });
        return;
      }

      sendJson(req, res, 200, {
        data: filterCollectionForUser(collection, record.data, user),
        updatedAt: record.updatedAt,
      });
      return;
    }

    if (req.method === "PUT") {
      try {
        const body = await readJsonBody(req);

        if (!("data" in body)) {
          sendJson(req, res, 400, { message: "Campo data obrigatorio" });
          return;
        }

        if (!canWriteCollection(user, collection, body.data)) {
          sendJson(req, res, 403, {
            message: "Voce nao tem permissao para alterar esta colecao",
          });
          return;
        }

        const updatedAt = putCollection(collection, body.data);
        sendJson(req, res, 200, { ok: true, updatedAt });
      } catch (error) {
        sendJson(req, res, 400, {
          message: error instanceof Error ? error.message : "Falha ao salvar colecao",
        });
      }
      return;
    }

    sendJson(req, res, 405, { message: "Metodo nao permitido" });
    return;
  }

  sendJson(req, res, 404, { message: "Rota nao encontrada" });
});

server.listen(PORT, HOST, () => {
  console.log(`J12 API persistente pronta em http://${HOST}:${PORT}`);
});
