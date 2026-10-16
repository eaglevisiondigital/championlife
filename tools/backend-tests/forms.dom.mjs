import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import {
  f,
  definition,
  createPayload,
  paymentDefinition,
} from "./forms-fixture.mjs";
let n = 0;
const ok = (v, m) => {
    assert.ok(v, m);
    n++;
    console.log("PASS " + m);
  },
  script = (name) =>
    readFileSync(new URL("../../assets/js/" + name, import.meta.url), "utf8"),
  tick = async () => {
    for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
  };
function dom(html = '<div id="root"></div>', url = "https://example.test/") {
  const d = new JSDOM(html, {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  d.window.eval(script("forms-model.js"));
  d.window.eval(script("forms-renderer.js"));
  return d;
}
const a = dom(),
  w = a.window,
  M = w.FormsModel,
  R = w.FormsRenderer,
  root = w.document.getElementById("root");
try {
  ok(
    M.minor("25.37") === "2537" && M.major("2537") === "25.37",
    "integer amount parsing/display exact",
  );
  assert.throws(() => M.minor("1.001"));
  ok(true, "fractional cents rejected");
  ok(
    M.key("Mobile Phone", ["mobile_phone"]) === "mobile_phone_1",
    "stable unique key fallback",
  );
  R.render(
    root,
    {
      sections: [
        {
          key: "main",
          title: "Test",
          fields: [
            { key: "constructor", type: "short_text", label: "Custom key" },
          ],
        },
      ],
      conditions: [],
      settings: {},
      payment: {},
    },
    { preview: true },
  );
  ok(
    root.querySelector("input").value === "",
    "valid custom keys do not inherit JavaScript object values",
  );
  let d = definition();
  ok(
    M.state(d, { children: false }).child_count.hidden,
    "section condition hides child",
  );
  ok(
    !M.state(d, { children: true }).child_count.hidden &&
      M.state(d, { children: true }).child_count.required,
    "section condition reveals required field",
  );
  d.conditions.push({
    source: "child_count",
    operator: "is_not_empty",
    action: "show",
    target: "children",
  });
  ok(
    M.validate(d).includes("Conditional cycle detected."),
    "cycle includes section descendants",
  );
  for (const op of M.operators)
    ok(
      typeof M.match(
        op,
        op.includes("than") ? 3 : "abc",
        op.includes("than") ? 2 : "a",
      ) === "boolean",
      "safe operator " + op,
    );
  let submits = 0;
  d = definition();
  const rendered = R.render(root, d, {
    preview: true,
    onSubmit: () => submits++,
  });
  rendered.form.dispatchEvent(
    new w.Event("submit", { bubbles: true, cancelable: true }),
  );
  ok(
    submits === 0 && root.textContent.includes("Preview only"),
    "live preview never invokes submit",
  );
  for (const [type, label] of Object.entries(M.types)) {
    if (type === "section") continue;
    const field = M.field(type);
    if (type === "payment" || type === "submit") {
    }
    const form = {
      sections: [{ key: "main", title: "Test", columns: 3, fields: [field] }],
      conditions: [],
      settings: {},
      payment: {},
    };
    R.render(root, form, {
      preview: true,
      funds: [
        { id: f.mainFund, name: "MISSIONS", parent_id: null },
        { id: f.youthFund, name: "Local", parent_id: f.mainFund },
      ],
    });
    ok(
      !!root.querySelector('[data-field="' + field.key + '"]'),
      "renderer " + label,
    );
  }
  d = definition();
  R.render(root, d, { onSubmit: () => submits++ });
  root
    .querySelector("form")
    .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await tick();
  ok(
    submits === 0 &&
      root.querySelector("[role=alert]").textContent.includes("Your name"),
    "validation announces error with field name",
  );
  ok(w.document.activeElement?.id === "form-name", "focus first invalid input");
  for (const node of root.querySelectorAll("input,select,textarea"))
    ok(
      !!root.querySelector('label[for="' + node.id + '"]') ||
        !!node.closest("fieldset")?.querySelector("legend"),
      "public field accessible name",
    );
  const yes = root.querySelector("#form-children-true");
  yes.checked = true;
  yes.dispatchEvent(new w.Event("change"));
  ok(
    !root.querySelector("[data-section=children_section]").hidden,
    "public Yes reveals section",
  );
  const source = readFileSync(
    new URL("../../assets/css/forms.css", import.meta.url),
    "utf8",
  );
  ok(
    source.includes("@media (max-width: 850px)") &&
      source.includes("@media (max-width: 600px)"),
    "tablet/mobile pane and stacked field rules",
  );
} finally {
  a.window.close();
}
async function admin(view = "builder", readOnly = false) {
  const d = dom(
      '<div id="forms-app" class="forms-app" data-view="' + view + '"></div>',
      "https://example.test/staff-form-builder.html?organization=" +
        f.org +
        "&form=87000000-0000-4000-8000-000000000001" + (readOnly ? "&preview=true" : ""),
    ),
    w = d.window;
  const per = readOnly ? ["forms.read"] : [
    "forms.read",
    "forms.create",
    "forms.edit",
    "forms.publish",
    "forms.archive",
    "forms.submissions.read",
    "forms.submissions.export",
    "forms.payment.configure",
  ];
  let current = {
    form: {
      id: "87000000-0000-4000-8000-000000000001",
      name: "Synthetic form",
      type: "registration",
      status: "draft",
      slug: "synthetic-form",
      description: "",
    },
    version: {
      id: "87000000-0000-4000-8000-000000000002",
      version: 1,
      revision: 1,
      definition: definition(),
    },
    permissions: per,
  };
  const calls = [];
  let failSave = false,
    deferred = null;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.URL.createObjectURL = () => "blob:synthetic";
  w.URL.revokeObjectURL = () => {};
  w.ChampionLifeAuth = {
    client: {
      rpc: async (name, args) => {
        calls.push([name, args]);
        if (deferred && args.p_action === "draft") return await deferred;
        const a = args.p_action;
        if (a === "list") return { data: { forms: [{ ...current.form, permissions: per, updated_at: "2026-10-15T14:00:00+00:00", last_published: "2026-01-15T14:00:00Z", published_version: 1, submission_count: 0 }] } };
        if (a === "funds")
          return { data: { funds: [{ id: f.mainFund, name: "MISSIONS" }] } };
        if (a === "save") {
          if (failSave) return { error: { code: "PT409" } };
          current = {
            ...current,
            version: {
              ...current.version,
              revision: current.version.revision + 1,
              definition: args.p_payload.definition,
            },
          };
        }
        if (a === "publish") current.version.state = "published";
        if (a === "submissions" || a === "export")
          return { data: { submissions: [], metrics: { count: 0 } } };
        return { data: structuredClone(current) };
      },
    },
  };
  const context = {
    user: { id: f.admin },
    giving: { organizations: [{ id: f.org, timezone: "America/Chicago" }] },
    forms: {
      organizations: [
        {
          id: f.org,
          name: "Synthetic Org",
          permissions: per,
          scoped_forms: [],
        },
      ],
    },
  };
  w.eval(script("forms-admin.js"));
  w.dispatchEvent(
    new w.CustomEvent("staff-workspace-context", { detail: context }),
  );
  await tick();
  return {
    d,
    w,
    calls,
    current,
    context,
    set fail(v) {
      failSave = v;
    },
    set pending(v) {
      deferred = v;
    },
  };
}
const b = await admin();
try {
  const { w, calls } = b;
  const app = w.document.getElementById("forms-app"),
    api = w.FormsAdmin;
  ok(app.querySelectorAll(".forms-pane").length === 3, "builder three panes");
  ok(
    app.querySelectorAll(".forms-library button").length === 29,
    "full library + explicit consent",
  );
  const first = api.draft.sections[0].fields[0].key;
  api.move(first, 1);
  ok(
    api.draft.sections[0].fields[1].key === first,
    "keyboard reorder fallback changes canonical order",
  );
  api.duplicate(first);
  ok(
    api.draft.sections[0].fields[2].key !== first && MISSING(api.draft),
    "duplicate gets new stable key",
  );
  const transfer = { setData() {} };
  function dragEvent(type) {
    const e = new w.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, "dataTransfer", { value: transfer });
    return e;
  }
  app
    .querySelector(".forms-library [data-type=short_text]")
    .dispatchEvent(dragEvent("dragstart"));
  app.querySelector(".forms-canvas-field").dispatchEvent(dragEvent("drop"));
  ok(
    api.draft.sections[0].fields[0].type === "short_text",
    "drag from library inserts at canvas position",
  );
  const movedKey = api.draft.sections[0].fields[0].key;
  app
    .querySelector('[data-key="' + movedKey + '"] .forms-drag-handle')
    .dispatchEvent(dragEvent("dragstart"));
  app
    .querySelectorAll(".forms-canvas-section")[1]
    .dispatchEvent(dragEvent("drop"));
  ok(
    api.draft.sections[1].fields.at(-1).key === movedKey,
    "existing drag crosses sections without duplicate key",
  );
  const pointerSource = app.querySelector(
    '[data-key="' + movedKey + '"] .forms-drag-handle',
  );
  w.document.elementFromPoint = () => app.querySelector('[data-key="email"]');
  pointerSource.onpointerdown(
    new w.MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 1,
      clientY: 1,
    }),
  );
  pointerSource.onpointermove(
    new w.MouseEvent("pointermove", {
      bubbles: true,
      cancelable: true,
      clientX: 80,
      clientY: 80,
    }),
  );
  ok(
    !!w.document.querySelector(".forms-drag-preview"),
    "pointer drag has a visible move affordance",
  );
  pointerSource.onpointerup(
    new w.MouseEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      clientX: 80,
      clientY: 80,
    }),
  );
  ok(
    api.draft.sections[0].fields[0].key === movedKey && MISSING(api.draft),
    "pointer drop moves exact field without duplication",
  );
  ok(
    !w.document.querySelector(".forms-drag-preview"),
    "pointer drop clears temporary drag state",
  );
  api.add("short_text");
  ok(
    api.draft.sections.at(-1).fields.at(-1).type === "short_text",
    "library add to canvas",
  );
  const before = api.draft.sections.at(-1).fields.length;
  api.remove(api.draft.sections.at(-1).fields.at(-1).key);
  ok(
    api.draft.sections.at(-1).fields.length === before - 1,
    "draft deletion retains prior fixture",
  );
  app.querySelectorAll("button");
  [...app.querySelectorAll("button")]
    .find((b) => b.textContent === "Undo")
    .click();
  ok(
    api.draft.sections.at(-1).fields.length === before,
    "undo restores removed draft field",
  );
  [...app.querySelectorAll("button")]
    .find((b) => b.textContent === "Redo")
    .click();
  ok(
    api.draft.sections.at(-1).fields.length === before - 1,
    "redo reapplies local removal",
  );
  await api.save();
  ok(
    calls.some(([, a]) => a.p_action === "save" && a.p_payload.revision === 1),
    "autosave includes expected revision",
  );
  const find = (text) =>
    [...app.querySelectorAll("button")].find((b) => b.textContent === text);
  find("Mobile").click();
  ok(!!app.querySelector(".forms-mode-mobile"), "mobile canvas toggle");
  find("Live preview").click();
  ok(
    !!app.querySelector(".forms-preview-mobile") &&
      !!app.querySelector(".kp-form"),
    "shared live mobile renderer",
  );
  app
    .querySelector(".kp-form")
    .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  ok(
    !calls.some(([name]) => name === "forms_gateway"),
    "admin preview no public submit",
  );
  find("Return to editor").click();
  b.fail = true;
  api.add("email");
  await api.save();
  ok(
    app.textContent.includes("Reload before saving"),
    "two-editor conflict visible",
  );
  ok(
    app.querySelectorAll("[draggable=true]").length === 0 ||
      app.textContent.includes("Conflict"),
    "conflict retains local draft safely",
  );
  const csv = api.csv({
    submissions: [
      {
        reference: "F-synthetic",
        version: 1,
        answers: [
          {
            field_key: "name",
            label_snapshot: "Your name",
            submitted_value: "=SUM(1,2)",
          },
        ],
      },
    ],
  });
  ok(csv.includes("'=SUM(1,2)"), "export formula neutralization");
  w.dispatchEvent(
    new w.CustomEvent("staff-workspace-context", {
      detail: { user: { id: f.admin }, forms: { organizations: [] } },
    }),
  );
  await tick();
  ok(
    !app.querySelector("input") &&
      !api.draft &&
      app.textContent.includes("no longer available"),
    "same-session content + draft clearing",
  );
} finally {
  b.d.window.close();
}
for (const view of ["builder", "list"]) {
  const a = await admin(view, true), app = a.w.document.getElementById("forms-app");
  const controls = [...app.querySelectorAll("button,a")].map(n => n.textContent);
  ok(!controls.some(x => /editor|settings|conditions|save|publish|edit|duplicate|archive/i.test(x) && x !== "Show archived"), "leadership " + view + " offers no editing language or actions");
  if (view === "builder") {
    ok(app.textContent.includes("Read-only form preview") && app.querySelector(".forms-preview"), "leadership opens preview without editor panels");
    ok(!app.querySelector(".forms-builder"), "read-only view omits builder library and settings");
    const required = app.querySelector("input[required]");
    ok(required?.closest(".form-field").querySelector(".form-required:not([hidden])"), "required label marker follows field requirement");
  } else {
    const dates = [...app.querySelectorAll("time")];
    ok(dates[0].textContent.includes("Oct 15, 2026") && dates[0].textContent.includes("9:00 AM CDT"), "form date uses organization daylight timezone");
    ok(dates[1].textContent.includes("8:00 AM CST"), "form date respects winter timezone");
    ok(dates[0].getAttribute("datetime") === "2026-10-15T14:00:00+00:00", "exact form timestamp retained in semantic time element");
    ok(controls.includes("View form"), "leadership list uses view wording");
  }
  a.d.window.close();
}
function MISSING(d) {
  return (
    new Set(d.sections.flatMap((s) => s.fields.map((f) => f.key))).size ===
    d.sections.flatMap((s) => s.fields).length
  );
}
const c = await admin();
try {
  let resolve;
  const pending = new Promise((r) => (resolve = r));
  c.pending = pending;
  c.w.dispatchEvent(
    new c.w.CustomEvent("staff-workspace-context", {
      detail: {
        user: { id: f.admin },
        forms: {
          organizations: [
            {
              id: f.org,
              name: "Synthetic Org",
              permissions: ["forms.read", "forms.edit"],
            },
          ],
        },
      },
    }),
  );
  await tick();
  c.w.dispatchEvent(
    new c.w.CustomEvent("staff-workspace-context", {
      detail: { user: { id: f.admin }, forms: { organizations: [] } },
    }),
  );
  resolve({ data: c.current });
  await tick();
  ok(
    !c.w.document.querySelector(".forms-canvas-field"),
    "late authorized response cannot restore revoked builder",
  );
} finally {
  c.d.window.close();
}
// Hosted Netlify internal rewrites preserve the visible clean URL.
for (const url of [
  `https://example.test/forms/${f.org}/synthetic-form`,
  `https://example.test/form.html?organization=${f.org}&slug=synthetic-form`,
]) {
  const routeDom = dom('<div id="public-form-app"></div>', url);
  try {
    const calls = [];
    routeDom.window.ChampionLifeAuth = { client: { rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { available: false } };
    } } };
    routeDom.window.eval(script("forms-public.js"));
    await tick();
    ok(calls.length === 1 && calls[0].name === "forms_public" &&
      calls[0].args.p_org === f.org && calls[0].args.p_slug === "synthetic-form",
      "public renderer resolves exact organization/slug from " + (url.includes("?organization") ? "query" : "clean path"));
  } finally { routeDom.window.close(); }
}

console.log(n + " Forms DOM/model/accessibility checks passed");
