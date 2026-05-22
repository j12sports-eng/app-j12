const express = require("express");
const { requireAuth } = require("../../auth");
const { getCollectionSnapshot, upsertCollectionSnapshot } = require("../config/db");

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
    
    // Log detalhado
    console.log(`[API] PUT /api/state/${collection}`);
    console.log(`[API] req.body:`, JSON.stringify(req.body, null, 2));
    
    // Aceitar tanto req.body.data quanto req.body direto
    let payload = req.body?.data;
    
    if (typeof payload === "undefined" && typeof req.body === "object") {
      if (!req.body.method && Object.keys(req.body).length > 0) {
        payload = req.body;
        console.log(`[API] Usando fallback: req.body como payload`);
      }
    }

    if (typeof payload === "undefined" || payload === null) {
      console.error(`[API] Erro 400: Campo 'data' ausente`);
      return res.status(400).json({ 
        message: "Envie o campo data para persistir a colecao.",
        received: req.body,
        expected: { data: "..." }
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
    
    // Log detalhado do body recebido
    console.log(`[API] POST /api/state/${collection}`);
    console.log(`[API] req.body:`, JSON.stringify(req.body, null, 2));
    console.log(`[API] req.body.data:`, req.body?.data);
    
    // Aceitar tanto req.body.data quanto req.body direto (fallback)
    let payload = req.body?.data;
    
    if (typeof payload === "undefined" && typeof req.body === "object") {
      // Se não tiver 'data', usar req.body direto como fallback
      // Mas excluir campos obrigatórios como 'method'
      if (!req.body.method && Object.keys(req.body).length > 0) {
        payload = req.body;
        console.log(`[API] Usando fallback: req.body como payload`);
      }
    }

    if (typeof payload === "undefined" || payload === null) {
      console.error(`[API] Erro 400: Campo 'data' ausente`);
      return res.status(400).json({ 
        message: "Envie o campo data para persistir a colecao.",
        received: req.body,
        expected: { data: "..." }
      });
    }

    console.log(`[API] Persistindo ${collection} com payload:`, JSON.stringify(payload, null, 2));
    
    const snapshot = await upsertCollectionSnapshot(collection, payload);
    
    console.log(`[API] ✓ ${collection} persistido com sucesso`);
    
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
