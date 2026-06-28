const express = require("express");
const { ensureAuthSchema } = require("../db.js");
const {
  PASSWORD_RULE_MESSAGE,
  authenticateUserDetailed,
  changePassword,
  completeStudentFirstAccess,
  createPasswordResetToken,
  createSession,
  deleteSession,
  getValidPasswordResetToken,
  requireAuth,
  resetPassword,
} = require("../auth.js");

const router = express.Router();

function hasEnv(name) {
  return String(process.env[name] || "").trim().length > 0;
}

function hasAnyEnv(names) {
  return names.some(hasEnv);
}

function getMissingLoginConfig() {
  const missing = [];
  const hasDatabaseConfig =
    hasEnv("DATABASE_URL") || (hasEnv("DB_HOST") && hasEnv("DB_USER") && hasEnv("DB_NAME"));

  if (!hasDatabaseConfig) {
    missing.push("DATABASE_URL ou DB_HOST/DB_USER/DB_NAME");
  }

  if (!hasAnyEnv(["JWT_SECRET", "AUTH_JWT_SECRET", "APP_JWT_SECRET", "SESSION_SECRET"])) {
    missing.push("JWT_SECRET");
  }

  if (!hasAnyEnv(["JWT_EXPIRES", "JWT_EXPIRES_IN", "JWT_EXPIRES_IN_SECONDS"])) {
    missing.push("JWT_EXPIRES");
  }

  if (!hasEnv("NODE_ENV")) {
    missing.push("NODE_ENV");
  }

  return missing;
}

function assertLoginRuntimeConfig() {
  const missing = getMissingLoginConfig();
  if (missing.length === 0) return;

  const error = new Error(`Variaveis de ambiente ausentes: ${missing.join(", ")}.`);
  error.statusCode = 500;
  error.code = "CONFIG_ERROR";
  error.expose = true;
  throw error;
}

function logLogin(level, message, req, meta = {}) {
  const entry = {
    requestId: req.id || req.headers["x-request-id"] || null,
    endpoint: req.originalUrl || req.url || "/auth/login",
    usuarioInformado: meta.usuarioInformado || null,
    timestamp: new Date().toISOString(),
    ambiente: process.env.NODE_ENV || "development",
    ...meta,
  };

  delete entry.password;
  delete entry.senha;

  const line = `[LOGIN] ${message}`;
  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(line, serialized);
    return;
  }

  if (level === "warn") {
    console.warn(line, serialized);
    return;
  }

  console.log(line, serialized);
}

router.get("/login", (_req, res) => {
  res.status(405).json({
    message: "Use POST /auth/login para autenticar com e-mail e senha.",
  });
});

function getBaseUrl(req) {
  const origin = String(req.headers.origin || "").trim();
  if (origin) return origin.replace(/\/+$/, "");
  return `http://${req.get("host") || "localhost:3000"}`;
}

router.post("/login", async (req, res, next) => {
  let identifier = "";

  try {
    logLogin("info", "Iniciando login", req);
    logLogin("info", "Lendo body", req);

    identifier = String(req.body.login || req.body.email || req.body.identifier || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.senha || req.body.password || "");
    const loginMeta = { usuarioInformado: identifier || null };

    logLogin("info", "Validando entrada", req, {
      ...loginMeta,
      hasIdentifier: Boolean(identifier),
      hasPassword: Boolean(password),
    });
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Dados invalidos. Informe email/login e senha.",
        code: "VALIDATION_ERROR",
        requestId: req.id || null,
        timestamp: new Date().toISOString(),
      });
    }

    logLogin("info", "Validando ambiente", req, loginMeta);
    assertLoginRuntimeConfig();

    logLogin("info", "Validando schema de autenticacao", req, loginMeta);
    await ensureAuthSchema();

    const authResult = await authenticateUserDetailed(identifier, password, {
      onStep(step, meta) {
        logLogin("info", step, req, {
          ...loginMeta,
          ...meta,
        });
      },
    });
    const user = authResult.user;
    if (!user) {
      logLogin("warn", "Credenciais invalidas", req, {
        ...loginMeta,
        found: authResult.found,
        reason: authResult.reason,
      });

      return res.status(401).json({
        success: false,
        message: "Usuario ou senha invalidos.",
        code: "AUTH_ERROR",
        requestId: req.id || null,
        timestamp: new Date().toISOString(),
      });
    }

    logLogin("info", "Gerando JWT", req, {
      ...loginMeta,
      userId: user.id,
      role: user.role,
      source: user.source || null,
    });

    const token = await createSession(user);

    logLogin("info", "Login concluido", req, {
      ...loginMeta,
      userId: user.id,
      role: user.role,
    });

    res.json({
      success: true,
      message: "Login realizado com sucesso.",
      token,
      user,
      requestId: req.id || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logLogin("error", "Erro no login", req, {
      usuarioInformado: identifier || null,
      errorMessage: error?.message || "Erro desconhecido.",
      errorCode: error?.code || error?.errorCode || null,
      statusCode: Number(error?.statusCode || error?.status || 500),
    });
    console.error(error);
    console.error(error?.stack);
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json(req.user || req.auth);
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await deleteSession(req.authToken);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const identifier = String(req.body.email || req.body.login || req.body.identifier || "").trim();
    const channel = String(req.body.channel || "email")
      .trim()
      .toLowerCase();

    if (!identifier) {
      return res.status(400).json({ message: "Informe um e-mail ou login valido." });
    }

    const reset = await createPasswordResetToken(identifier, channel);
    if (!reset) {
      return res
        .status(404)
        .json({ message: "Nao encontramos um usuario com esse identificador." });
    }

    res.json({
      ok: true,
      message:
        channel === "whatsapp"
          ? "Recuperacao preparada para envio por WhatsApp."
          : "Recuperacao preparada para envio por e-mail.",
      previewUrl: `${getBaseUrl(req)}/reset-password/${reset.token}`,
      expiresAt: reset.expiresAt,
      channel,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/reset-password/:token", async (req, res, next) => {
  try {
    const tokenData = await getValidPasswordResetToken(req.params.token);
    if (!tokenData) {
      return res.status(400).json({ valid: false, message: "Token invalido ou expirado." });
    }

    res.json({
      valid: true,
      email: tokenData.email,
      login: tokenData.login,
      expiresAt: tokenData.expires_at,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const token = String(req.body.token || "").trim();
    const password = String(req.body.senha || req.body.password || "");
    const confirmPassword = String(req.body.confirmarSenha || req.body.confirmPassword || "");

    if (!token) {
      return res.status(400).json({ message: "Token de recuperacao obrigatorio." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "A confirmacao da senha nao confere." });
    }

    await resetPassword(token, password);

    res.json({
      ok: true,
      message: "Senha redefinida com sucesso.",
      passwordRule: PASSWORD_RULE_MESSAGE,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.senhaAtual || req.body.currentPassword || "");
    const nextPassword = String(req.body.novaSenha || req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmarSenha || req.body.confirmPassword || "");

    if (!currentPassword || !nextPassword) {
      return res.status(400).json({ message: "Preencha a senha atual e a nova senha." });
    }

    if (nextPassword !== confirmPassword) {
      return res.status(400).json({ message: "A confirmacao da nova senha nao confere." });
    }

    await changePassword((req.user || req.auth).id, currentPassword, nextPassword);
    res.json({ ok: true, message: "Senha alterada com sucesso." });
  } catch (error) {
    next(error);
  }
});

router.post("/first-access", async (req, res, next) => {
  try {
    const user = await completeStudentFirstAccess(req.body || {});
    res.status(201).json({
      ok: true,
      user,
      message: "Primeiro acesso configurado. Agora voce ja pode entrar com seu login e senha.",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
