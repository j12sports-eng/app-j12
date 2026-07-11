const express = require("express");
const { canManageSystem, requireAuth } = require("../../auth.js");
const { getCollectionSnapshot, upsertCollectionSnapshot } = require("../config/db.js");

const router = express.Router();

const ALLOWED_COLLECTIONS = new Set([
  "professores",
  "turmas",
  "planos",
  "contratos",
  "trial-classes",
  "settings",
]);

function assertAllowedCollection(collectionName) {
  const normalized = String(collectionName || "")
    .trim()
    .toLowerCase();

  if (!ALLOWED_COLLECTIONS.has(normalized)) {
    const error = new Error("Colecao nao suportada pela API.");
    error.statusCode = 404;
    throw error;
  }

  return normalized;
}

router.use(requireAuth);
router.use((req, res, next) => {
  if (canManageSystem(req.auth)) return next();

  return res.status(403).json({ message: "Acesso restrito a perfis de gestao." });
});

router.get("/:collection", async (req, res, next) => {
  try {
    const collection = assertAllowedCollection(req.params.collection);
    const snapshot = await getCollectionSnapshot(collection);

    if (!snapshot) {
      return res.status(404).json({ message: "Colecao ainda nao inicializada." });
    }

    return res.json({
      data: snapshot.data,
      updatedAt: snapshot.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:collection", async (req, res, next) => {
  try {
    const collection = assertAllowedCollection(req.params.collection);
    // Aceitar tanto req.body.data quanto req.body direto
    let payload = req.body?.data;

    if (typeof payload === "undefined" && typeof req.body === "object") {
      if (!req.body.method && Object.keys(req.body).length > 0) {
        payload = req.body;
      }
    }

    if (typeof payload === "undefined" || payload === null) {
      console.error(`[API] Erro 400: Campo 'data' ausente`);
      return res.status(400).json({
        message: "Envie o campo data para persistir a colecao.",
        expected: { data: "..." },
      });
    }

    const snapshot = await upsertCollectionSnapshot(collection, payload);

    return res.json({
      success: true,
      data: snapshot.data,
      updatedAt: snapshot.updatedAt,
    });
  } catch (error) {
    console.error(`[API] Erro ao atualizar ${req.params.collection}:`, error);
    next(error);
  }
});

router.post("/:collection", async (req, res, next) => {
  try {
    const collection = assertAllowedCollection(req.params.collection);
    // Aceitar tanto req.body.data quanto req.body direto (fallback)
    let payload = req.body?.data;

    if (typeof payload === "undefined" && typeof req.body === "object") {
      // Se não tiver 'data', usar req.body direto como fallback
      // Mas excluir campos obrigatórios como 'method'
      if (!req.body.method && Object.keys(req.body).length > 0) {
        payload = req.body;
      }
    }

    if (typeof payload === "undefined" || payload === null) {
      console.error(`[API] Erro 400: Campo 'data' ausente`);
      return res.status(400).json({
        message: "Envie o campo data para persistir a colecao.",
        expected: { data: "..." },
      });
    }

    const snapshot = await upsertCollectionSnapshot(collection, payload);
    return res.json({
      success: true,
      data: snapshot.data,
      updatedAt: snapshot.updatedAt,
    });
  } catch (error) {
    console.error(`[API] Erro ao persistir ${req.params.collection}:`, error);
    next(error);
  }
});

module.exports = router;
