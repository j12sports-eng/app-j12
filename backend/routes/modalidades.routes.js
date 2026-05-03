const express = require("express");
const { listarModalidades } = require("../controllers/modalidades.controller");

const router = express.Router();

router.get("/", listarModalidades);

module.exports = router;
