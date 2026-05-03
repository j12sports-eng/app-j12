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
    const payload = req.body?.data;

    if (typeof payload === "undefined") {
      return res.status(400).json({ message: "Envie o campo data para persistir a colecao." });
    }

    const snapshot = await upsertCollectionSnapshot(collection, payload);
    return res.json({
      data: snapshot.data,
      updatedAt: snapshot.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
