const express = require("express");

const { canManageSystem, requireAuth } = require("../../auth.js");
const {
  configurePixWebhook,
  createPixCharge,
  findInterCertificates,
  findPaymentByTxid,
  gerarToken,
  handleInterWebhook,
  userCanAccessStudent,
} = require("../services/inter.service.js");

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function requireManager(req, res, next) {
  if (!canManageSystem(req.auth || req.user)) {
    res.status(403).json({
      success: false,
      error: "Acesso restrito a administradores.",
    });
    return;
  }

  next();
}

function mapInterError(error) {
  if (error?.statusCode || error?.status) {
    return {
      status: Number(error.statusCode || error.status),
      message: error.message,
    };
  }

  if (
    ["INTER_CERTIFICATES_NOT_FOUND", "INTER_CREDENTIALS_MISSING", "INTER_PIX_KEY_MISSING"].includes(
      error?.code,
    )
  ) {
    return {
      status: 503,
      message: error.message,
    };
  }

  if (error?.response) {
    return {
      status: 502,
      message:
        error.response.data?.detail ||
        error.response.data?.title ||
        error.response.data?.message ||
        error.response.statusText ||
        "Erro na comunicacao com Banco Inter.",
      details: error.response.data,
    };
  }

  return {
    status: 500,
    message: error?.message || "Erro interno na integracao Banco Inter.",
  };
}

router.get(
  ["/inter/token", "/api/inter/token"],
  requireAuth,
  requireManager,
  asyncHandler(async (_req, res) => {
    const data = await gerarToken();
    res.json({
      success: true,
      data,
    });
  }),
);

router.get(
  ["/inter/certificates/status", "/api/inter/certificates/status"],
  requireAuth,
  requireManager,
  asyncHandler(async (_req, res) => {
    const certificates = findInterCertificates();
    res.json({
      success: true,
      data: {
        certPath: certificates.certPath,
        keyPath: certificates.keyPath,
      },
    });
  }),
);

router.post(
  ["/pix/create", "/api/pix/create"],
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = await createPixCharge({
      id: req.body?.id,
      mensalidadeId: req.body?.mensalidadeId ?? req.body?.mensalidade_id,
      chargeId: req.body?.chargeId ?? req.body?.cobrancaId ?? req.body?.cobranca_id,
      user: req.auth || req.user,
    });

    res.status(201).json({
      success: true,
      data,
    });
  }),
);

router.get(
  ["/pix/:txid/status", "/api/pix/:txid/status"],
  requireAuth,
  asyncHandler(async (req, res) => {
    const payment = await findPaymentByTxid(req.params.txid);
    if (!payment) {
      res.status(404).json({
        success: false,
        error: "Pagamento PIX nao encontrado.",
      });
      return;
    }

    if (!canManageSystem(req.auth || req.user) && !(await userCanAccessStudent(req.auth || req.user, payment.studentId))) {
      res.status(403).json({
        success: false,
        error: "Sem permissao para consultar este PIX.",
      });
      return;
    }

    res.json({
      success: true,
      data: {
        txid: payment.txid,
        status: payment.status,
        paidAt: payment.paidAt,
        e2eid: payment.e2eid,
        qrCode: payment.qrCode,
        pixCopiaCola: payment.pixCopyPaste,
      },
    });
  }),
);

router.post(
  ["/webhooks/inter", "/api/webhooks/inter"],
  asyncHandler(async (req, res) => {
    const data = await handleInterWebhook(req);
    res.json({
      success: true,
      data,
    });
  }),
);

router.post(
  ["/inter/webhook/configure", "/api/inter/webhook/configure"],
  requireAuth,
  requireManager,
  asyncHandler(async (req, res) => {
    const data = await configurePixWebhook(req.body?.webhookUrl || process.env.INTER_WEBHOOK_URL);
    res.json({
      success: true,
      data,
    });
  }),
);

router.use((error, _req, res, _next) => {
  const mapped = mapInterError(error);
  console.error("[inter][route]", mapped.message, mapped.details || error);
  res.status(mapped.status).json({
    success: false,
    error: mapped.message,
    details: mapped.details,
  });
});

module.exports = router;
