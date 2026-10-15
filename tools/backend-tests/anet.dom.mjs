import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
let n = 0;
const ok = (v, m) => {
    assert.ok(v, m);
    n++;
    console.log("PASS " + m);
  },
  tick = () => new Promise((r) => setTimeout(r, 20)),
  script = readFileSync(
    new URL("../../assets/js/authorize-net-hosted.js", import.meta.url),
    "utf8",
  );
function setup(options = {}) {
  const dom = new JSDOM('<main id="payments-app"></main>', {
    url: "https://isolated--championlifechurch.netlify.app/checkout.html",
    runScripts: "outside-only",
  });
  dom.window.eval(script);
  let sessionCalls = 0,
    handoffs = 0,
    allowed = true;
  const session = {
    status: "tokenized",
    form_url: "https://test.authorize.net/payment/payment",
    form_token: "mock_ephemeral_form_token_value",
    environment: "sandbox",
    gateway_id: "Main",
    expires_in_seconds: 900,
  };
  const controller = dom.window.AuthorizeNetHosted.mount(
    dom.window.document.querySelector("main"),
    {
      enabled: true,
      gateway_id: "Main",
      checkAccess: async () => allowed,
      createSession: async () => {
        sessionCalls++;
        return { ...session, ...options.result };
      },
      handoff: async (form) => {
        handoffs++;
        assert.equal(form.querySelector("input").name, "token");
      },
      ...options,
    },
  );
  return {
    dom,
    controller,
    setAllowed: (v) => (allowed = v),
    get calls() {
      return sessionCalls;
    },
    get handoffs() {
      return handoffs;
    },
    button: dom.window.document.querySelector("button"),
  };
}
let h = setup({ enabled: false });
ok(h.button.disabled, "default disabled approval gate");
ok(h.calls === 0, "no token/provider request on mount");
h.dom.window.close();
h = setup();
h.button.click();
h.button.click();
await tick();
ok(h.calls === 1 && h.handoffs === 1, "double submit one canonical handoff");
ok(h.button.disabled, "no second provider form submission");
ok(
  !h.dom.window.document.querySelector("input"),
  "transient hosted token removed after handoff",
);
ok(
  h.dom.window.document.body.textContent.includes("verified status"),
  "navigation not false success",
);
ok(
  !/apiLoginId|transactionKey|signatureKey/.test(
    h.dom.window.document.body.innerHTML,
  ),
  "host has no credential fields or values",
);
h.dom.window.close();
for (const result of [
  { gateway_id: "Youth" },
  { environment: "live" },
  { form_url: "https://evil.test" },
  { expires_in_seconds: 901 },
  { form_token: "bad" },
]) {
  h = setup({ result });
  h.button.click();
  await tick();
  ok(
    h.handoffs === 0,
    "invalid account/environment/url/token/expiry fails closed",
  );
  h.dom.window.close();
}
h = setup();
h.setAllowed(false);
await h.controller.recheck();
ok(
  !h.dom.window.document.querySelector("section"),
  "same-session denial clears hosted UI",
);
h.dom.window.close();
h = setup();
h.dom.window.document.querySelector("main").replaceChildren();
await tick();
ok(
  !h.dom.window.document.querySelector("section"),
  "parent protected rerender disposes component",
);
h.dom.window.close();
h = setup({
  createSession: async () => {
    throw Error("PRIVATE_PROVIDER_DETAIL");
  },
});
h.button.click();
await tick();
ok(
  h.dom.window.document.body.textContent.includes("requires review") &&
    !h.dom.window.document.body.textContent.includes("PRIVATE_PROVIDER_DETAIL"),
  "safe accessible unknown status no raw error",
);
ok(
  !h.dom.window.document.querySelector("input:not([type=hidden])"),
  "no application-owned PAN/CVV/bank input",
);
ok(
  h.dom.window.document.querySelector("[role=status][aria-live=polite]"),
  "live status accessible",
);
h.dom.window.close();
console.log(
  n + " GIV-3C hosted-controller DOM checks passed; no provider requests",
);
