// Loopback-only disconnected build QA. No database client/configuration or hosted deployment.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("../../", import.meta.url))),
  allowed = new Set(
    JSON.parse(
      readFileSync(root + "/tools/site-build/public-files.json", "utf8"),
    ),
  );
allowed.add("tools/backend-tests/fixtures/payments-browser-fixture.js");
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1"),
    name = decodeURIComponent(url.pathname.slice(1));
  if (!allowed.has(name)) {
    res.writeHead(404);
    res.end();
    return;
  }
  let b = readFileSync(resolve(root, name));
  if (extname(name) === ".html") {
    let s = b.toString();
    s = s.replace(
      /<script src="(?:https:[^"]+|assets\/js\/(?:supabase-config|champion-life-auth)\.js)"><\/script>/g,
      "",
    );
    s = s.replace(
      '<script src="assets/js/outreach-staff-common.js">',
      '<script src="tools/backend-tests/fixtures/payments-browser-fixture.js"></script><script src="assets/js/outreach-staff-common.js">',
    );
    b = Buffer.from(s);
  }
  res.writeHead(200, {
    "Content-Type":
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
      }[extname(name)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(b);
});
server.listen(8763, "127.0.0.1", () =>
  console.log(
    "Disconnected GIV-3A QA: http://127.0.0.1:8763/staff-payment-providers.html",
  ),
);
process.on("SIGTERM", () => server.close());
