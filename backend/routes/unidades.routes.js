const express = require("express");
const { listarUnidades } = require("../src/controllers/unidades.controller.js");

const router = express.Router();

router.get("/", listarUnidades);

module.exports = router;
