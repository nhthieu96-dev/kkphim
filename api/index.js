// Entry point cho Vercel (serverless function). Xem lib/addon-builder.js cho
// toàn bộ logic addon.

const { getRouter } = require("stremio-addon-sdk");
const builder = require("../lib/addon-builder");

const router = getRouter(builder.getInterface());

module.exports = (req, res) => {
  router(req, res, () => {
    res.statusCode = 404;
    res.end("Not found");
  });
};
