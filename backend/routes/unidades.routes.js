const express = require("express");
const { listarUnidades } = require("../controllers/unidades.controller");

const router = express.Router();

router.get("/", listarUnidades);

module.exports = router;
