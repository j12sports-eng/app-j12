module.exports = {
  ...require("./inter-client.js"),
  ...require("./mtls.service.js"),
  ...require("./oauth.service.js"),
  ...require("./pix.service.js"),
  ...require("./webhook.service.js"),
};
