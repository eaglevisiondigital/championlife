import assert from "node:assert/strict";
import { nmiPreviewConfiguration } from "../site-build/build.mjs";
import { readFileSync } from "node:fs";
const backend = { url: "https://bkbmjisprwmkptywtmih.supabase.co" },
  env = {
    NMI_SANDBOX_COMPONENT_ENABLED: "true",
    NMI_SANDBOX_ORGANIZATION_ID: "74000000-0000-4000-8000-000000000001",
    NMI_SANDBOX_GATEWAY_ID: "74000000-0000-4000-8000-000000000031",
    NMI_SANDBOX_PUBLIC_TOKENIZATION_KEY: "xxxxxx-xxxxxx-xxxxxx-xxxxxx",
    NMI_SANDBOX_MERCHANT_REFERENCE: "mock-merchant",
  };
assert.equal(nmiPreviewConfiguration(env, false, backend), null);
assert.equal(nmiPreviewConfiguration(env, true, null), null);
assert.equal(nmiPreviewConfiguration({}, true, backend), null);
assert.throws(() =>
  nmiPreviewConfiguration(
    {
      ...env,
      NMI_SANDBOX_PUBLIC_TOKENIZATION_KEY: "private_security_key_do_not_expose",
    },
    true,
    backend,
  ),
);
assert.equal(
  nmiPreviewConfiguration(env, true, backend).environment,
  "sandbox",
);
const source = readFileSync(
  new URL("../site-build/build.mjs", import.meta.url),
  "utf8",
);
assert(source.includes("if(nmi)await writeFile"));
assert(source.includes("/checkout.html\\n  Content-Security-Policy:"));
assert(!source.includes("https://*.nmi.com"));
const lock = JSON.parse(
  readFileSync(
    new URL("../nmi-component/package-lock.json", import.meta.url),
    "utf8",
  ),
);
assert.equal(
  lock.packages["node_modules/@nmipayments/nmi-pay"].version,
  "1.1.1",
);
assert(lock.packages["node_modules/@nmipayments/nmi-pay"].integrity);
const html = readFileSync(
  new URL("../../checkout.html", import.meta.url),
  "utf8",
);
assert(html.includes("nmi-config.js") && html.includes("nmi-checkout.js"));
assert(!/name="(?:card_number|cvv|account_number)"/.test(html));
console.log("12 GIV-3B isolated build/public configuration checks passed");
