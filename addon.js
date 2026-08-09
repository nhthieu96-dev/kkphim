// Entry point để chạy addon như 1 server bình thường (local dev, Render,
// Docker...). Trên Vercel dùng file api/index.js thay thế.

const { serveHTTP } = require("stremio-addon-sdk");
const builder = require("./lib/addon-builder");

const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`Hiếu Gà Phim Stremio add-on đang chạy tại http://127.0.0.1:${PORT}/manifest.json`);
