import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
const read = (p) =>
    readFileSync(new URL("../../" + p, import.meta.url), "utf8"),
  tick = () => new Promise((r) => setTimeout(r, 40));
let n = 0;
const ok = (v, m) => {
  assert.ok(v, m);
  n++;
  console.log("PASS " + m);
};
const pages = [
  "pastor",
  "reports",
  "summary",
  "fund-report",
  "donor-report",
  "pledge-report",
  "mid-report",
  "reconciliation-report",
  "statements",
  "statement",
  "report",
];
async function page(name, permissions, prepare) {
  const errors = [],
    vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    if (!e.message.includes("navigation")) errors.push(e.message);
  });
  const h = new JSDOM(read("staff-giving-" + name + ".html"), {
      url:
        "https://preview.example/staff-giving-" + name + ".html?id=statement",
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole: vc,
    }),
    w = h.window;
  w.matchMedia = () => ({ matches: false });
  w.setInterval = () => 1;
  w.print = () => (w.printed = true);
  w.URL.createObjectURL = () => {
    w.blobCreated = true;
    return "blob:synthetic";
  };
  w.URL.revokeObjectURL = () => {};
  for (const file of [
    "tools/backend-tests/fixtures/giving-browser-fixture.js",
    "tools/backend-tests/fixtures/giving-reports-browser-fixture.js",
    "assets/js/outreach-staff-common.js",
    "assets/js/staff-workspace.js",
    "assets/js/giving-utils.js",
    "assets/js/giving-management-utils.js",
  ])
    w.eval(read(file));
  if (permissions) w.givingFixture.permissions = permissions;
  if (prepare) prepare(w.givingFixture, w);
  w.eval(read("assets/js/giving-reports.js"));
  await tick();
  return {
    w,
    d: w.document,
    g: w.givingFixture,
    errors,
    close: () => w.close(),
  };
}
const click = (h, label) => {
  const b = [...h.d.querySelectorAll("button")].find(
    (b) => b.textContent === label,
  );
  assert(b, label);
  b.click();
};
for (const name of ["donor-report", "reconciliation-report"]) {
  const h = await page(name);
  const cells = [...h.d.querySelectorAll("#giving-reports-app tbody")].map(t => t.textContent).join(" ");
  ok(cells.includes("Oct 11, 2026"), name + " formats dates without shifting calendar-only values");
  ok(!cells.includes("2026-10-11"), name + " does not expose raw ISO timestamps");
  h.close();
}
for (const name of pages) {
  const h = await page(name);
  ok(h.d.querySelector("#giving-reports-app h1"), name + " loaded headline");
  ok(
    h.d.querySelectorAll(".staff-sidebar").length === 1,
    name + " shared shell",
  );
  ok(
    h.d.querySelector(".staff-sidebar-foot img").alt ===
      "Kingdom Propel by EagleVision",
    name + " attribution",
  );
  ok(h.errors.length === 0, name + " zero console failures");
  for (const input of h.d.querySelectorAll("input,select"))
    ok(input.closest("label"), name + " label " + input.name);
  for (const t of h.d.querySelectorAll("table"))
    ok(t.querySelector("th[scope=col]"), name + " table headings");
  if (!name.startsWith("statement")) {
    click(h, "Week");
    await tick();
    if (name !== "reports")
      ok(
        h.d
          .querySelector("#giving-reports-app")
          .textContent.includes("175,000") ||
          h.d
            .querySelector("#giving-reports-app")
            .textContent.includes("1,750.00"),
        name + " period updates canonical metric",
      );
    else
      ok(
        h.d.querySelector(".giving-report-link").href.includes("period=week"),
        "catalog links preserve period",
      );
  }
  click(h, "Print / Save PDF");
  ok(h.w.printed, name + " native print/PDF hook");
  h.close();
}
let h = await page("reports", [
  "finance.reports.read",
  "finance.reports.export",
]);
ok(
  h.d.querySelectorAll(".giving-report-link").length === 11,
  "leadership catalog excludes all donor and restricted merchant reports",
);
ok(
  !h.d.querySelector(".giving-report-link[href*=report\\=donor]"),
  "leadership no donor link",
);
h.close();
h = await page("pastor", ["finance.reports.read", "finance.reports.export"]);
ok(
  !h.d.querySelector("a[href*=manual]") &&
    !h.d.querySelector("a[href*=merchants]"),
  "Pastor shell has no operator links",
);
const toggle = [...h.d.querySelectorAll("button")].find(
  (b) => b.textContent === "Missions",
);
toggle.click();
await tick();
ok(
  toggle.getAttribute("aria-expanded") === "true",
  "leadership fund expansion",
);
toggle.click();
await tick();
ok(toggle.getAttribute("aria-expanded") === "false", "fund collapse");
ok(
  h.d.querySelectorAll(".giving-chart-row[title]").length > 0 &&
    h.d.querySelector("details summary"),
  "charts tooltip and accessible table alternative",
);
h.g.deny = true;
h.w.dispatchEvent(new h.w.Event("focus"));
await tick();
ok(
  h.d.querySelector(".staff-state") &&
    !h.d.querySelector("#giving-reports-app table"),
  "same-session report revocation clears content",
);
h.close();
h = await page("statements", ["finance.statements.generate"]);
const f = h.d.querySelector(".giving-form");
f.querySelector("[name=mode]").value = "household";
f.dispatchEvent(new h.w.Event("submit", { bubbles: true, cancelable: true }));
await tick();
ok(
  h.d
    .querySelector(".giving-statement-preview")
    ?.textContent.includes("Eligible contributions"),
  "statement preview before generation",
);
ok(
  h.g.calls.find((x) => x.args.p_action === "statement_preview").args.p_payload
    .household_id === "household",
  "household statement selected",
);
ok(
  !h.g.calls.some((x) => x.args.p_action === "statement_generate"),
  "preview does not save",
);
click(h, "Dry-run recipient count");
await tick();
ok(
  h.d.querySelector("#giving-reports-app").textContent.includes("Count only"),
  "bulk dry-run count presented",
);
h.close();
h = await page("summary");
click(h, "Export CSV");
await tick();
ok(
  h.g.calls.some((x) => x.args.p_action === "export") && h.w.blobCreated,
  "server authorized CSV projection and real download construction",
);
ok(
  h.w.GivingUtils.csvCell(" =CMD()").startsWith("\"'"),
  "formula neutralization",
);
h.close();
h = await page("report", []);
ok(
  h.d.querySelector(".staff-state") &&
    !h.d.querySelector("#giving-reports-app table"),
  "ordinary staff direct report denied",
);
h.close();
{
  let release;
  const h = await page("summary", undefined, (g, w) => {
    const rpc = w.ChampionLifeAuth.client.rpc;
    w.ChampionLifeAuth.client.rpc = async (name, args) => {
      if (name === "giving_reports" && args.p_action === "report")
        await new Promise((r) => (release = r));
      return rpc(name, args);
    };
  });
  ok(typeof release === "function", "report read intentionally in flight");
  h.w.dispatchEvent(new h.w.Event("focus"));
  await tick();
  release();
  await tick();
  ok(
    h.d.querySelector("#giving-reports-app table") &&
      !h.d.querySelector(".staff-state"),
    "unchanged refresh preserves pending report",
  );
  h.close();
}
{
  const h = await page("summary");
  h.g.empty = true;
  click(h, "Week");
  await tick();
  ok(
    h.d
      .querySelector("#giving-reports-app")
      .textContent.includes("No records in the selected period"),
    "clean empty report",
  );
  h.close();
  const a = await page("statements", undefined, (g) => (g.statements = []));
  ok(
    a.d
      .querySelector("#giving-reports-app")
      .textContent.includes("No statement history"),
    "clean empty statement history",
  );
  a.close();
}
{
  let release;
  let pending = true;
  const h = await page('summary', undefined, (g, w) => {
    const rpc = w.ChampionLifeAuth.client.rpc;
    w.ChampionLifeAuth.client.rpc = async (name, args) => {
      if (name === 'giving_reports' && args.p_action === 'report' && pending) {
        pending = false;
        await new Promise((r) => (release = r));
      }
      return rpc(name, args);
    };
  });
  ok(typeof release === 'function', 'old identity report held in flight');
  h.g.user = { ...h.g.user, id: 'replacement-synthetic-account' };
  h.g.callbacks.forEach((fn) => fn('SIGNED_IN', { user: h.g.user }));
  await tick();
  await tick();
  ok(h.d.querySelector('#giving-reports-app table'), 'new identity report loaded');
  release();
  await tick();
  ok(
    h.d.querySelector('#giving-reports-app table') && !h.d.querySelector('.staff-state'),
    'obsolete report rejection cannot erase current authorized render',
  );
  h.close();
}

{
  let fail = true;
  const h = await page('summary', undefined, (g, w) => {
    const rpc = w.ChampionLifeAuth.client.rpc;
    w.ChampionLifeAuth.client.rpc = async (name, args) => {
      if (name === 'giving_reports' && args.p_action === 'report' && fail) {
        fail = false;
        throw new Error('Synthetic temporary read failure');
      }
      return rpc(name, args);
    };
  });
  ok(h.d.querySelector('.staff-state'), 'temporary report failure clears content');
  h.w.dispatchEvent(new h.w.Event('focus'));
  await tick();
  await tick();
  ok(
    h.d.querySelector('#giving-reports-app table') && !h.d.querySelector('.staff-state'),
    'unchanged authority can retry a failed render',
  );
  h.close();
}

// Legacy immutable snapshots have aggregate rows, not contribution line details.
{
  const snapshot = { organization: "Synthetic Church", currency: "USD", total_minor: "1318800", period: { starts_at: "2026-01-01T00:00:00Z", ends_at: "2027-01-01T00:00:00Z" }, rows: [{ label: "Missions", amount_minor: "1318800" }] };
  const original = JSON.stringify(snapshot);
  const a = await page("statement", undefined, (g, w) => {
    const rpc = w.ChampionLifeAuth.client.rpc;
    w.ChampionLifeAuth.client.rpc = async (name, args) => args.p_action === "statement_detail" ? { data: { snapshot, version: 2, generated_at: "2026-10-15T14:00:00Z" } } : rpc(name, args);
  });
  const text = a.d.getElementById("giving-reports-app").textContent;
  ok(text.includes("Historical Generated Statement") && text.includes("Version 2") && text.includes("Generated") && text.includes("Date range:"), "historical statement identifies version, generation and range");
  ok(text.includes("Historical Statement Snapshot") && text.includes("USD 13,188.00") && text.includes("before itemized"), "legacy statement displays stored total with honest missing-detail explanation");
  ok(!a.d.querySelector("#giving-reports-app table") && !text.includes("14,588"), "legacy statement omits empty table and never substitutes current total");
  ok(JSON.stringify(snapshot) === original, "historical snapshot remains unchanged");
  a.close();
}
// A long statement must flow onto paper without a mostly empty cover page.
// Print-only controls must be hidden while contribution rows remain together.
{
  const h = new JSDOM('<style>' + read('assets/css/giving-reports.css') + '</style>');
  const print = [...h.window.document.styleSheets[0].cssRules].find(
    (rule) => rule.conditionText === 'print',
  );
  const rules = [...print.cssRules];
  const controls = rules.find((rule) => rule.selectorText?.includes('button'));
  ok(
    controls.selectorText.includes('#giving-reports-app .giving-header > label') &&
      controls.style.getPropertyValue('display') === 'none',
    'printed organization selector hidden with operator controls',
  );
  ok(
    rules.find((rule) => rule.selectorText === '.giving-panel').style
      .getPropertyValue('break-inside') === 'auto',
    'long printed statement flows across pages',
  );
  ok(
    rules.find((rule) => rule.selectorText === 'tr').style
      .getPropertyValue('break-inside') === 'avoid',
    'printed contribution rows stay together',
  );
  h.window.close();
}
console.log(n + " GIV-2B DOM/accessibility checks passed");
