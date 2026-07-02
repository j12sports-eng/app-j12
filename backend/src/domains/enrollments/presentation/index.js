module.exports = Object.freeze({
  layer: "presentation",
  ...require("./controllers/index.js"),
  ...require("./routes/index.js"),
});
