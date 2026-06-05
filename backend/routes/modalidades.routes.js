const express = require("express");
const { listarModalidades } = require("../src/controllers/modalidades.controller.js");

const router = express.Router();

router.get("/", listarModalidades);

module.exports = router;
