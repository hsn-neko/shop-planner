// Tiny static server for local preview and tests: serves the repo root.
const http = require("http");
const handler = require("serve-handler");
const path = require("path");

const port = Number(process.env.PORT || 4173);
http
  .createServer((req, res) => handler(req, res, { public: path.join(__dirname, "..") }))
  .listen(port, () => console.log(`Planner at http://localhost:${port}`));
