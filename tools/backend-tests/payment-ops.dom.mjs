import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
const read = (p) =>
    readFileSync(new URL("../../" + p, import.meta.url), "utf8"),
  tick = () => new Promise((r) => setTimeout(r, 40));
let n = 0;
const ok = (x, m) => {
  assert.ok(x, m);
  n++;
  console.log("PASS " + m);
};
async function page(view = "dashboard", id = "") {
  const errors = [],
    dom = new JSDOM(
      '<body><main><div id="payments-app" data-ops-view="' +
        view +
        '"></div></main></body>',
      {
        url:
          "https://local.example/staff-payment-operations.html?organization=74000000-0000-4000-8000-000000000001" +
          (id ? "&id=" + id : ""),
        runScripts: "outside-only",
        pretendToBeVisual: true,
        virtualConsole: new VirtualConsole().on("jsdomError", (e) =>
          errors.push(e),
        ),
      },
    ),
    w = dom.window;
  w.eval(read("assets/js/outreach-staff-common.js"));
  w.eval(read("assets/js/giving-utils.js"));
  w.eval(read("tools/backend-tests/fixtures/payments-browser-fixture.js"));
  w.eval(read("tools/backend-tests/fixtures/payment-ops-browser-fixture.js"));
  w.eval(read("assets/js/payment-operations.js"));
  await tick();
  return { dom, w, errors, root: w.document.getElementById("payments-app") };
}
for (const view of [
  "dashboard",
  "queue",
  "work",
  "transaction",
  "session",
  "recurring",
  "refund",
  "reconciliation",
  "methods",
  "donor",
]) {
  const { dom, w, root, errors } = await page(
    view,
    "97000000-0000-4000-8000-000000000001",
  );
  ok(root.querySelector("h1"), "page renders " + view);
  ok(!root.textContent.includes("Loading"), "loading cleared " + view);
  ok(
    !root.querySelector(
      "input[name=card_number],input[name=cvv],input[name=account_number],input[name=routing_number]",
    ),
    "no application raw payment fields " + view,
  );
  ok(errors.length === 0, "no console errors " + view);
  ok(root.querySelector("[role=status]"), "status not color only " + view);
  w.__OPS_QA.deny();
  await tick();
  ok(
    root.textContent.includes("access is no longer available") &&
      !root.textContent.includes("SYNTHETIC Donor"),
    "same-session protected data cleared " + view,
  );
  dom.window.close();
}
{
  const { dom, w, root } = await page(
    "transaction",
    "97000000-0000-4000-8000-000000000001",
  );
  const b = [...root.querySelectorAll("button")].find(
    (b) => b.textContent === "Check Provider Status",
  );
  b.click();
  ok(
    w.document.querySelector("dialog[open]"),
    "accessible action confirmation",
  );
  ok(w.document.activeElement.textContent === "Cancel", "safe initial focus");
  const confirm = [...w.document.querySelectorAll("dialog button")].find((x) =>
    x.textContent.startsWith("Confirm"),
  );
  confirm.click();
  await tick();
  ok(
    w.__OPS_QA.calls.some(
      (c) => c.p_action === "lookup" && c.p_payload.request_key,
    ),
    "lookup action calls guarded canonical RPC with idempotency",
  );
  ok(
    root.textContent.includes("No provider connected"),
    "action never claims financial success",
  );
  dom.window.close();
}
{
  const { dom, w, root } = await page(
    "transaction",
    "97000000-0000-4000-8000-000000000001",
  );
  root.querySelectorAll("button").forEach((b) => {
    if (b.textContent === "Check Provider Status") b.click();
  });
  w.__OPS_QA.revoke("payments.manage");
  await tick();
  ok(
    !w.document.querySelector("dialog") &&
      !root.textContent.includes("Check Provider Status"),
    "individual permission revocation clears controls and dialogs",
  );
  dom.window.close();
}
{
  const { dom, w, root } = await page("donor");
  ok(
    root.textContent.includes("Processed") &&
      root.textContent.includes("Not processed"),
    "donor partial message exact split",
  );
  ok(
    root.textContent.includes("SYNTHETIC-RECEIPT"),
    "historical receipt reference accessible",
  );
  ok(
    !root.textContent.includes("NMI") &&
      !root.textContent.includes("Authorize.Net") &&
      !root.textContent.includes("Internal synthetic"),
    "donor no provider/MID/internal notes",
  );
  ok(
    root.textContent.includes("Saved Payment Methods") &&
      root.textContent.includes("ending 1111"),
    "one logical masked method",
  );
  dom.window.close();
}
{
  const { dom, w, root } = await page("queue");
  ok(
    [...root.querySelectorAll("label")].every((l) =>
      w.document.getElementById(l.htmlFor),
    ),
    "filter labels associated",
  );
  ok(
    root.textContent.includes("Last action") &&
      root.textContent.includes("Assigned to") &&
      root.textContent.includes("MID Route"),
    "required actionable queue columns",
  );
  ok(
    w.GivingUtils.csv([{ Note: "=1+1" }], ["Note"]).includes("'=1+1"),
    "CSV formula neutralization",
  );
  dom.window.close();
}
// My Work export must preserve its implicit current-user scope, even when a
// conflicting assignee filter is supplied. Other queues retain their filters.
for (const view of ["work", "queue"]) {
  const { dom, w, root } = await page(view);
  w.URL.createObjectURL = () => "blob:synthetic-export";
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = () => {};
  const assignee = root.querySelector("select[name=assigned_to]");
  if (assignee) {
    const option = w.document.createElement("option");
    option.value = "74000000-0000-4000-8000-000000000099";
    option.textContent = "Another synthetic operator";
    assignee.append(option);
    assignee.value = option.value;
    assignee.closest("form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await tick();
  }
  [...root.querySelectorAll("button")].find(b => b.textContent === "Export operational CSV").click();
  await tick();
  const request = w.__OPS_QA.calls.filter(c => c.p_action === "export").at(-1);
  ok(request && (view === "work"
    ? request.p_payload.assigned_to === (await w.ChampionLifeAuth.getUser()).id
    : request.p_payload.assigned_to === (assignee ? "74000000-0000-4000-8000-000000000099" : undefined)),
    "export preserves visible assignee scope: " + view);
  dom.window.close();
}
{
  const { dom, w, root } = await page("queue");
  const provider = root.querySelector('select[name="provider"]');
  provider.value = "external_connector";
  provider.closest("form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await tick();
  ok(w.__OPS_QA.calls.some(c => c.p_payload?.provider === "external_connector"), "Future provider uses canonical external connector value");
  dom.window.close();
}
{
  const { dom, root } = await page("transaction", "97000000-0000-4000-8000-000000000001");
  ok(root.textContent.includes("Difference") && root.textContent.includes("USD 0.01"), "reconciliation renders exact difference");
  ok(root.textContent.includes("Synthetic review only") && root.textContent.includes("Synthetic requester") && root.textContent.includes("2026-10-15T09:30:00Z"), "refund request renders reason requester and timestamp");
  dom.window.close();
}
{
 const {dom,root}=await page();
 ok(!root.querySelector('.ops-nav'),'operational destinations use shared sidebar rather than duplicate top navigation');
 dom.window.close();
}
console.log(
  n + " GIV-3D operations DOM/accessibility/revocation checks passed",
);
