const express = require("express");
const {
  PASSWORD_RULE_MESSAGE,
  authenticateUser,
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
  try {
    const identifier = String(req.body.login || req.body.email || req.body.identifier || "").trim();
    const password = String(req.body.senha || req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({ message: "Informe login/e-mail e senha." });
    }

    const user = await authenticateUser(identifier, password);
    if (!user) {
      return res.status(401).json({ message: "Login ou senha invalidos." });
    }

    const token = await createSession(user);
    res.json({ token, user });
  } catch (error) {
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
