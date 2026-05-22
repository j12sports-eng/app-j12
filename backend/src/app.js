const express = require("express");

const cors = require("cors");

const interRoutes = require("./routes/inter.routes");

const app = express();

/**
 * =====================================
 * MIDDLEWARES
 * =====================================
 */

app.use(cors());

app.use(express.json());

/**
 * =====================================
 * HEALTH CHECK
 * =====================================
 */

app.get("/", (req, res) => {
  res.json({
    ok: true,

    message: "API J12 funcionando 🚀",
  });
});

/**
 * =====================================
 * ROTAS BANCO INTER
 * =====================================
 */

app.use(interRoutes);

/**
 * =====================================
 * EXPORT
 * =====================================
 */

module.exports = app;
