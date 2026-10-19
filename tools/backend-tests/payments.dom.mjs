import {sharedShellFixture,hasAccessibleLabel,hasSharedRecovery} from './nmi-shared-shell-fixture.mjs';
import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
const read = (p) =>
    readFileSync(new URL("../../" + p, import.meta.url), "utf8"),
  tick = () => new Promise((r) => setTimeout(r, 35));
let n = 0;
const ok = (v, m) => {
  assert.ok(v, m);
  n++;
  console.log("PASS " + m);
};
async function page(view = "configuration", search = "") {
  const errors = [],
    dom = new JSDOM(
      '<body data-staff-workspace><main><div id="payments-app" data-view="' +
        view +
        '"></div></main></body>',
      {
        url: "https://local.example/staff-payment-providers.html" + search,
        runScripts: "outside-only",
        pretendToBeVisual: true,
        virtualConsole: new VirtualConsole().on("jsdomError", (e) =>
          errors.push(e),
        ),
      },
    ),
    w = dom.window;
  w.__PAYMENTS_DOM_TEST__ = true;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.eval(read("assets/js/outreach-staff-common.js"));
  w.eval(read("assets/js/giving-utils.js"));
  w.eval(read("tools/backend-tests/fixtures/payments-browser-fixture.js"));
  w.eval(sharedShellFixture());
  w.eval(read("assets/js/payments.js"));
  await tick();
  await tick();
  return {
    w,
    d: w.document,
    state: w.paymentsFixture,
    errors,
    close: () => w.close(),
  };
}
const click = (h, t) => {
  const b = [...h.d.querySelectorAll("button")].find(
    (x) => x.textContent === t,
  );
  assert(b, t + " exists");
  b.click();
};
for (const view of [
  "configuration",
  "routing",
  "methods",
  "transaction",
  "checkout",
]) {
  const h = await page(
    view,
    ["transaction", "checkout"].includes(view)
      ? "?organization=74000000-0000-4000-8000-000000000001&session=91000000-0000-4000-8000-000000000090"
      : "",
  );
  ok(
    h.d.querySelector("h1") &&
      h.d.body.textContent.includes("Payment processing is not yet enabled."),
    view + " clear held shell",
  );
  ok(
    !h.d.querySelector(
      "input[name=pan],input[name=cvv],input[name=card_number],input[type=password]",
    ),
    view + " no raw financial or credential fields",
  );
  ok(
    h.d.querySelector("[data-capability=paymentsview]"),
    view + " permission-filtered native navigation",
  );
  ok(!h.errors.length, view + " no unexpected console error");
  for (const el of h.d.querySelectorAll(
    "input,select",
  ))
    ok(
      hasAccessibleLabel(el),
      view + " controls labelled",
    );
  h.close();
}
{
  const h = await page();
  ok(
    h.d.body.textContent.includes("NMI Gateway") &&
      h.d.querySelectorAll(".giving-gateway-card").length === 6,
    "one NMI and five separate Authorize.Net accounts displayed",
  );
  ok(
    [...h.d.querySelectorAll(".giving-gateway-card")][0].textContent.includes(
      "Outreach",
    ) &&
      [...h.d.querySelectorAll(".giving-gateway-card")][0].textContent.includes(
        "Merch",
      ),
    "NMI five route display",
  );
  ok(
    !h.d.body.textContent.includes("credential_reference"),
    "secret references absent",
  );
  click(h, "Review activation gate");
  await tick();
  ok(
    h.d.body.textContent.includes("separately authorized release"),
    "activation stays held",
  );
  h.state.per.splice(h.state.per.indexOf("payments.configure"), 1);
  h.state.per.splice(h.state.per.indexOf("payments.route"), 1);
  h.w.dispatchEvent(new h.w.Event("focus"));
  await tick();
  ok(
    !h.d.querySelector("form"),
    "view-only no configuration mutation controls",
  );
  h.close();
}
{
  const h = await page(
    "checkout",
    "?session=91000000-0000-4000-8000-000000000090",
  );
  ok(
    h.d.body.textContent.includes("USD 385.00"),
    "exact checkout total displayed",
  );
  ok(
    h.d.body.textContent.includes("USD 350.00") &&
      h.d.body.textContent.includes("USD 35.00"),
    "mixed receipt categories visible",
  );
  ok(h.d.querySelector("button[disabled]"), "payment action disabled");
  ok(
    h.d.querySelector("[name=recurring] option[value=annual]"),
    "annual recurring preview",
  );
  ok(
    h.d.querySelector("[name=receipt_email]") &&
      !h.d.querySelector("[name=payment_reference]"),
    "receipt email without provider reference entry",
  );
  h.close();
}
{
  const h = await page("methods");
  ok(
    h.d.body.textContent.includes("Visa ending 4242") &&
      h.d.body.textContent.includes("2"),
    "logical masked method multiple gateway scopes",
  );
  click(h, "Remove Visa ending 4242");
  await tick();
  ok(
    !h.d.body.textContent.includes("Visa ending 4242"),
    "removed method clears summary",
  );
  h.close();
}
{
  const h = await page(
    "transaction",
    "?session=91000000-0000-4000-8000-000000000090",
  );
  h.state.deny = true;
  h.w.dispatchEvent(new h.w.Event("focus"));
  await tick();
  await tick();
  ok(
    hasSharedRecovery(h.d),
    "same-session revocation renders accessible shared recovery",
  );
  ok(
    !h.d.body.textContent.includes("USD 385.00") &&
      !h.d.querySelector("#payments-app input"),
    "revocation clears amounts/form input",
  );
  ok(
    !h.d.querySelector("[data-capability=paymentsview]"),
    "revocation removes payment navigation",
  );
  h.close();
}
{
  const h = await page();
  h.state.delayAction = "configuration";
  h.state.per.push("synthetic-context-change");
  h.w.dispatchEvent(new h.w.Event("focus"));
  await tick();
  h.state.deny = true;
  h.w.dispatchEvent(new h.w.Event("focus"));
  await tick();
  h.state.release?.();
  await tick();
  ok(
    !h.d.body.textContent.includes("NMI Gateway") &&
      hasSharedRecovery(h.d),
    "pending data cannot replace shared recovery or repopulate revoked UI",
  );
  h.close();
}
{
  const h = await page();
  h.state.signOut();
  await tick();
  ok(
    !h.d.body.textContent.includes("NMI Gateway"),
    "sign-out clears account metadata",
  );
  h.close();
}
console.log(n + " GIV-3A DOM/accessibility checks passed");
