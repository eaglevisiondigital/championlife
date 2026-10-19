import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
let n = 0;
const ok = (v, m) => {
    assert.ok(v, m);
    n++;
    console.log("PASS " + m);
  },
  read = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8"),
  tick = () => new Promise((r) => setTimeout(r, 20));
async function page({
  ready = true,
  testMode = true,
  enabled = true,
  canPrepare = true,
  outcomeStatus = "captured",
} = {}) {
  const errors = [],
    dom = new JSDOM(
      '<head></head><body><main id="payments-app"><section class="giving-panel"></section></main></body>',
      {
        url: "https://isolated--championlifechurch.netlify.app/checkout.html",
        runScripts: "outside-only",
        pretendToBeVisual: true,
        virtualConsole: new VirtualConsole().on("jsdomError", (e) =>
          errors.push(e),
        ),
      },
    );
  const w = dom.window;
  w.eval(read("assets/js/outreach-staff-common.js"));
  w.eval(read("assets/js/giving-utils.js"));
  const data = {
    session: { id: "session", currency: "USD", total_minor: "2350" },
    sandbox_ready: ready,
    can_prepare: canPrepare,
    methods: [],
    attempts: [],
    legs: [
      { id: "leg-1", route_label: "Main", amount_minor: "2000" },
      { id: "leg-2", route_label: "Merch", amount_minor: "350" },
    ],
    lines: [
      { fund: "Tithe", amount_minor: "2000", tax_eligible: true },
      { fund: "Book", amount_minor: "350", tax_eligible: false },
    ],
  };
  let handlers,
    calls = [],
    destroyed = 0,
    tokenRequests = 0,
    authListener;
  w.CHAMPION_NMI_SANDBOX = enabled
    ? {
        project: "https://bkbmjisprwmkptywtmih.supabase.co",
        environment: "sandbox",
        organization_id: "org",
        enabled: true,
        public_key: "mock-public",
        merchant_reference: "mock-merchant",
      }
    : null;
  w.NmiSandboxComponent = {
    createNmiToken: async () => {
      tokenRequests++;
      return { testMode, merchantId: "mock-merchant", currencies: ["USD"] };
    },
    mountNmiPayments: (_c, props) => {
      handlers = props;
      props.onFieldsAvailable();
      return {
        destroy() {
          destroyed++;
        },
        resetFields() {},
      };
    },
  };
  w.ChampionLifeAuth = {
    client: {
      rpc: async () => ({ data }),
      auth: {
        onAuthStateChange: (fn) => {
          authListener = fn;
        },
      },
      functions: {
        invoke: async (name, params) => {
          calls.push(params.body);
          return {
            data: {
              id: "canonical-attempt",
              status: outcomeStatus,
              sandbox_only: true,
            },
          };
        },
      },
    },
  };
  w.eval(read("assets/js/nmi-checkout.js"));
  w.dispatchEvent(
    new w.CustomEvent("payments-session-rendered", {
      detail: { organization_id: "org", session_id: "session" },
    }),
  );
  await tick();
  return {
    w,
    dom,
    data,
    calls,
    errors,
    get handlers() {
      return handlers;
    },
    get tokenRequests() {
      return tokenRequests;
    },
    get destroyed() {
      return destroyed;
    },
    revoke: () => authListener("SIGNED_OUT"),
    refresh: () => authListener("TOKEN_REFRESHED"),
    close: () => w.close(),
  };
}
for (const options of [
  { enabled: false },
  { canPrepare: false },
  { ready: false },
  { testMode: false },
]) {
  const h = await page(options);
  ok(!h.handlers, "held/unverified configuration never mounts provider fields");
  ok(h.calls.length === 0, "held configuration no processing call");
  if (options.ready === false)
    ok(
      h.tokenRequests === 0,
      "unverified DB route never contacts NMI component API",
    );
  h.close();
}
const h = await page();
const d = h.w.document,
  b = d.querySelector("button");
ok(b.disabled, "submit disabled before tokenization");
ok(
  d.body.textContent.includes("SANDBOX / TEST ONLY"),
  "permanent sandbox notice",
);
ok(
  !d.querySelector("input:not([type=checkbox])"),
  "no host PAN/CVV or bank input",
);
ok(
  !d.querySelector("#nmi-save-sandbox").checked,
  "vault saving requires explicit sandbox choice",
);
ok(
  d.querySelectorAll("label").length === 3 &&
    d.querySelectorAll("select").length === 2,
  "selectors labelled and bounded",
);
h.handlers.onChange({
  complete: true,
  token: "fake_transient_token",
  lookupData: {
    card: { number: "DO_NOT_READ" },
    check: { account: "DO_NOT_READ" },
  },
});
ok(!b.disabled, "successful tokenization enables submit");
b.click();
b.click();
await tick();
ok(h.calls.length === 1, "double click invokes one stable request");
ok(
  Object.keys(h.calls[0]).sort().join(",") ===
    "leg_id,operation,organization_id,payment_token,request_key,save_method,session_id",
  "app sends only canonical intent plus token; no lookup/card/bank data",
);
ok(
  !JSON.stringify(h.calls).includes("DO_NOT_READ"),
  "SDK lookupData never copied to app request",
);
ok(
  d.body.textContent.includes("settlement pending"),
  "captured UI does not claim settlement",
);
ok(b.disabled, "captured attempt cannot blindly resubmit");
ok(
  d
    .querySelector('[aria-label="Sandbox receipt"]')
    .textContent.includes("Non-charitable payment"),
  "sandbox receipt separates book and gift",
);
await h.refresh();
await tick();
ok(
  d.querySelector(".nmi-sandbox-panel"),
  "ordinary session refresh preserves current permitted checkout",
);
const selector = d.querySelector("#nmi-sandbox-leg");
selector.value = "leg-2";
selector.dispatchEvent(new h.w.Event("change"));
ok(
  !d.querySelector(".nmi-hosted-fields").hidden && b.disabled,
  "next leg restores secure fields and still requires a fresh token",
);
ok(d.body.textContent.includes("Sandbox transaction reference: canonical-attempt"),"receipt shows canonical transaction reference without MID or vault internals");
h.revoke();
await tick();
ok(
  !d.querySelector(".nmi-sandbox-panel") && h.destroyed === 1,
  "current-session auth change clears panel/token and destroys component",
);
ok(h.errors.length === 0, "no host console application errors");
h.close();
const r = await page();
r.dom.window.document.querySelector("#payments-app").replaceChildren();
await tick();
ok(
  r.destroyed === 1 &&
    !r.dom.window.document.querySelector(".nmi-sandbox-panel"),
  "existing permission-denial rerender clears hosted component",
);
r.close();
const declined = await page({ outcomeStatus: "failed" });
const declinedButton = declined.w.document.querySelector("button");
for (let attempt = 0; attempt < 2; attempt++) {
  declined.handlers.onChange({ complete: true, token: "mock_declined_token" });
  declinedButton.click();
  await tick();
}
ok(
  declined.calls.length === 2 &&
    declined.calls[0].request_key !== declined.calls[1].request_key,
  "normalized known decline permits deliberate fresh attempt without replaying failed key",
);
declined.close();
console.log(
  n + " GIV-3B checkout DOM/security checks passed; mocked callbacks only",
);
