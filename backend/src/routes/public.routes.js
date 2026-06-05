const express = require("express");
const {
  createPublicEnrollment,
  getNextEnrollmentNumber,
  lookupAddress,
} = require("../controllers/public-enrollments.controller.js");
const {
  getPublicModalidades,
  getPublicUnidades,
  getPublicTurmas,
  getPublicHorarios,
} = require("../controllers/public-catalog.controller.js");

const router = express.Router();

// ============================================
// MATRÍCULA (Existentes)
// ============================================
router.get("/enrollments/next-number", getNextEnrollmentNumber);
router.post("/enrollments", createPublicEnrollment);
router.get("/address/lookup", lookupAddress);

// ============================================
// CATÁLOGO (Novos - sem autenticação)
// ============================================
router.get("/modalidades", getPublicModalidades);
router.get("/unidades", getPublicUnidades);
router.get("/turmas", getPublicTurmas);
router.get("/horarios", getPublicHorarios);

module.exports = router;
