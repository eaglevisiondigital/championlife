import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
await build({
  entryPoints: [fileURLToPath(new URL("source.mjs", import.meta.url))],
  bundle: true,
  format: "iife",
  globalName: "NmiSandboxComponent",
  target: "es2022",
  supported: { "template-literal": false }, // Preserve literal whitespace as escapes in the generated artifact.
  outfile: root + "assets/js/nmi-component.js",
  minify: true,
  legalComments: "eof",
});
