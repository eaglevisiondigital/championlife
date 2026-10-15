/* GIV-3D provider-neutral operations. No provider transport, raw payment fields or credentials. */
(() => {
  "use strict";
  const root = document.getElementById("payments-app");
  if (!root?.dataset.opsView) return;
  const A = window.ChampionLifeAuth,
    E = window.OutreachUI.el,
    U = window.GivingUtils,
    Q = new URLSearchParams(location.search),
    view = root.dataset.opsView,
    donor = view === "donor";
  const titles = {
    dashboard: "Payment Operations",
    queue: "Payment Issue Queue",
    work: "My Payment Work",
    transaction: "Transaction Detail",
    session: "Session Detail",
    recurring: "Recurring Management",
    refund: "Refund Detail",
    reconciliation: "Reconciliation Detail",
    methods: "Payment Methods",
    donor: "Your Payments & Saved Methods",
  };
  const kinds = [
    "payment_failed",
    "payment_unknown",
    "partial_checkout",
    "recurring_failed",
    "payment_method_expiring",
    "refund_pending",
    "void_pending",
    "settlement_mismatch",
    "unreconciled",
    "duplicate_review",
    "provider_configuration",
    "chargeback",
    "manual_review",
  ];
  let org = Q.get("organization"),
    scope,
    userId,
    epoch = 0,
    sequence = 0,
    busy = false,
    lastData,
    options = {},
    filters = {};
  const can = (k) => scope?.permissions?.includes(k),
    money = (v, c = "USD") => (v == null ? "Unknown" : U.money(String(v), c)),
    label = (s) => String(s || "").replaceAll("_", " "),
    link = (text, file, id) =>
      E("a", text, {
        class: "giving-button",
        href:
          file +
          "?organization=" +
          encodeURIComponent(org) +
          (id ? "&id=" + encodeURIComponent(id) : ""),
      });
  const button = (text, fn) => {
    const b = E("button", text, { type: "button", class: "giving-button" });
    b.onclick = fn;
    return b;
  };
  function panel(title, parent = root) {
    const s = E("section", null, { class: "giving-panel" });
    if (title) s.append(E("h2", title));
    parent.append(s);
    return s;
  }
  function feedback(text, error = false) {
    root.querySelector(".ops-feedback")?.remove();
    const p = E("p", text, {
      class: "ops-feedback " + (error ? "giving-error" : "giving-note"),
      role: error ? "alert" : "status",
      tabindex: "-1",
    });
    root.append(p);
    if (error) p.focus();
  }
  function deny() {
    epoch++;
    scope = null;
    lastData = null;
    document.querySelectorAll(".payment-ops-dialog").forEach((d) => d.remove());
    root.replaceChildren(
      E("h1", "Payment access unavailable"),
      E(
        "p",
        "Your payment workspace access is no longer available. Contact an administrator if needed.",
        { role: "status" },
      ),
      link("Return to Staff Home", "staff-home.html"),
    );
  }
  async function call(action, payload = {}) {
    const stamp = epoch;
    const r = await A.client.rpc(
      donor ? "payment_operations_donor" : "payment_operations",
      { p_action: action, p_org: org, p_payload: payload },
    );
    if (stamp !== epoch || (await A.getUser())?.id !== userId)
      throw Error("Access changed.");
    if (r.error) {
      if (
        ["42501", "PGRST301", "PGRST302"].includes(r.error.code) ||
        [401, 403].includes(r.status)
      ) {
        deny();
        throw Error("Payment access unavailable.");
      }
      throw Error(
        r.error.code === "PT409"
          ? "This record changed. Reload before acting."
          : "This action is held or cannot be completed. Check the current state, permissions, exact amount and approval requirements.",
      );
    }
    return r.data;
  }
  function field(
    form,
    text,
    name,
    { type = "text", value = "", choices, required = true } = {},
  ) {
    const id = "ops-" + name + "-" + Math.random().toString(36).slice(2),
      wrap = E("label", text, { for: id });
    let input;
    if (choices) {
      input = E("select", null, { id, name });
      for (const [v, l] of choices) input.append(E("option", l, { value: v }));
    } else
      input = E(type === "textarea" ? "textarea" : "input", null, {
        id,
        name,
        ...(type === "textarea" ? {} : { type }),
      });
    input.required = required;
    input.value = value;
    input.setAttribute("aria-describedby", "ops-action-help");
    wrap.append(input);
    form.append(wrap);
    return input;
  }
  function form(parent, title, fields, submit) {
    const f = E("form", null, { class: "ops-form" });
    f.append(E("h3", title));
    const inputs = {};
    for (const [text, name, options] of fields)
      inputs[name] = field(f, text, name, options);
    const b = E("button", title, {
      type: "submit",
      class: "giving-button giving-primary",
    });
    f.append(b);
    f.onsubmit = (e) => {
      e.preventDefault();
      if (!f.reportValidity()) return;
      const values = Object.fromEntries(
        Object.entries(inputs).map(([k, v]) => [k, v.value]),
      );
      try {
        submit(values);
      } catch (error) {
        feedback(error.message, true);
      }
    };
    parent.append(f);
    return f;
  }
  function confirmAction(title, action, payload) {
    if (busy) return;
    const stamp = epoch,
      d = E("dialog", null, {
        class: "payment-ops-dialog",
        "aria-label": title,
      }),
      heading = E("h2", title),
      msg = E(
        "p",
        "This records a finance workflow action. Payment execution and donor messages remain held. Verify the selected record before continuing.",
      ),
      cancel = button("Cancel", () => {
        d.close?.();
        d.remove();
      }),
      go = button("Confirm " + title, async () => {
        if (busy || stamp !== epoch) return;
        busy = true;
        go.disabled = true;
        cancel.disabled = true;
        try {
          const data = await call(action, {
            request_key: crypto.randomUUID(),
            ...payload,
          });
          d.close?.();
          d.remove();
          await render();
          feedback(
            data.message ||
              data.next_action ||
              "Action recorded. Provider execution remains held.",
          );
        } catch (e) {
          d.remove();
          feedback(e.message, true);
        } finally {
          busy = false;
        }
      });
    d.append(heading, msg, cancel, go);
    document.body.append(d);
    if (d.showModal) d.showModal();
    else d.setAttribute("open", "");
    cancel.focus();
    d.addEventListener("close", () => d.remove());
  }
  function table(parent, columns, rows) {
    const w = E("div", null, {
        class: "payments-table-wrap",
        tabindex: "0",
        "aria-label": "Scrollable " + columns[0][0] + " table",
      }),
      t = E("table"),
      thead = E("thead"),
      head = E("tr"),
      body = E("tbody");
    columns.forEach(([text]) => head.append(E("th", text, { scope: "col" })));
    thead.append(head);
    for (const row of rows) {
      const tr = E("tr");
      columns.forEach(([, get]) => {
        const td = E("td"),
          v = get(row);
        td.append(
          v instanceof Node
            ? v
            : document.createTextNode(String(v ?? "Unknown")),
        );
        tr.append(td);
      });
      body.append(tr);
    }
    if (!rows.length) {
      const tr = E("tr");
      tr.append(
        E("td", "No matching records.", { colspan: String(columns.length) }),
      );
      body.append(tr);
    }
    t.append(thead, body);
    w.append(t);
    parent.append(w);
  }
  function queue(parent, issues) {
    parent.append(
      E(
        "p",
        "Shows up to 500 newest matching issues. Refine filters before exporting; CSV includes the same bounded selection.",
      ),
    );
    table(
      parent,
      [
        [
          "Issue",
          (r) =>
            link(
              label(r.issue_type),
              "staff-payment-transaction-detail.html",
              r.id,
            ),
        ],
        ["Status", (r) => label(r.status)],
        ["Donor", (r) => r.donor || "No linked donor"],
        ["Amount", (r) => money(r.amount_minor, r.currency)],
        ["Date", (r) => new Date(r.date).toLocaleDateString()],
        [
          "Provider / Gateway",
          (r) => [r.provider, r.gateway].filter(Boolean).join(" · "),
        ],
        [
          "Destination / MID Route",
          (r) =>
            [r.merchant_destination, r.mid_route].filter(Boolean).join(" · "),
        ],
        ["Last action", (r) => r.last_action],
        ["Assigned to", (r) => r.assigned_to || "Unassigned"],
        ["Next action", (r) => r.next_action],
        ["Priority", (r) => r.priority],
      ],
      issues,
    );
  }
  function filterForm(parent) {
    form(
      parent,
      "Apply filters",
      [
        [
          "Issue type",
          "issue_type",
          {
            required: false,
            choices: [
              ["", "All issue types"],
              ...kinds.map((k) => [k, label(k)]),
            ],
          },
        ],
        [
          "Provider",
          "provider",
          {
            required: false,
            choices: [
              ["", "All providers"],
              ["nmi", "NMI"],
              ["authorize_net", "Authorize.Net"],
              ["future", "Future"],
              ["manual", "Manual"],
            ],
          },
        ],
        ["Merchant destination", "destination", { required: false }],
        ["MID route label", "mid", { required: false }],
        ["From", "starts_at", { type: "date", required: false }],
        ["To (exclusive)", "ends_at", { type: "date", required: false }],
        ["Minimum amount (minor units)", "min_minor", { required: false }],
        ["Maximum amount (minor units)", "max_minor", { required: false }],
        [
          "Assigned staff",
          "assigned_to",
          {
            required: false,
            choices: [
              ["", "All staff"],
              ...(options.staff || []).map((s) => [s.id, s.name]),
            ],
          },
        ],
        [
          "Status",
          "status",
          {
            required: false,
            choices: [
              ["", "All statuses"],
              ...["open", "assigned", "review", "resolved", "closed"].map(
                (s) => [s, label(s)],
              ),
            ],
          },
        ],
        [
          "Search donor, email, session, receipt, reference, last 4 or amount",
          "search",
          { required: false },
        ],
      ],
      (v) => {
        filters = Object.fromEntries(Object.entries(v).filter(([, v]) => v));
        render().catch((e) => feedback(e.message, true));
      },
    );
  }
  function counts(parent, data) {
    const grid = E("div", null, { class: "ops-metrics" });
    for (const k of kinds) {
      const card = E("a", null, {
        class: "ops-metric",
        href:
          "staff-payment-issues.html?organization=" +
          encodeURIComponent(org) +
          "&issue_type=" +
          k,
      });
      card.append(E("strong", String(data[k] || 0)), E("span", label(k)));
      grid.append(card);
    }
    parent.append(grid);
  }
  function session(parent, s) {
    parent.append(E("p", s.message, { class: "giving-note", role: "status" }));
    const grid = E("dl", null, { class: "ops-summary" });
    for (const [title, value] of [
      ["Session total", s.intended_minor],
      ["Processed", s.processed_minor],
      ["Not processed", s.not_processed_minor],
      ["Still unconfirmed", s.unconfirmed_minor],
    ])
      grid.append(E("dt", title), E("dd", money(value, s.currency)));
    parent.append(grid);
    table(
      parent,
      [
        [
          "Purpose / Fund",
          (r) => [label(r.purpose), r.fund].filter(Boolean).join(" · "),
        ],
        ["Amount", (r) => money(r.amount_minor, s.currency)],
        [
          "Status",
          (r) => label(r.status) + (r.unresolved ? " — unresolved" : ""),
        ],
      ],
      s.lines || [],
    );
    if (!donor)
      table(
        parent,
        [
          ["Provider leg", (r) => r.id],
          ["Provider", (r) => r.provider],
          ["Original route", (r) => r.route],
          ["Amount", (r) => money(r.amount_minor, s.currency)],
          ["State", (r) => label(r.status)],
        ],
        s.legs || [],
      );
    const receipts = panel("Historical receipts", parent);
    for (const r of s.receipts || []) {
      const b = button("View receipt " + r.number, () => {
        const out = E("div");
        out.append(
          E("p", "Receipt " + r.number),
          E("p", "Generated " + new Date(r.generated_at).toLocaleDateString()),
          E("p", "Recorded activity: " + money(r.total_minor, s.currency)),
        );
        receipts.append(out);
      });
      receipts.append(b);
    }
    if (!s.receipts?.length)
      receipts.append(
        E(
          "p",
          "No receipt has been issued. Only completed financial activity can appear on an issued receipt.",
        ),
      );
    if (s.refunds?.length)
      table(
        parent,
        [
          ["Adjustment", (r) => r.kind],
          ["Amount", (r) => money(r.amount_minor, s.currency)],
          ["State", (r) => label(r.status)],
        ],
        s.refunds,
      );
  }
  function methods(parent, data) {
    parent.append(
      E(
        "p",
        "Secure provider-hosted entry is not yet enabled. No card or bank details are collected.",
        { class: "giving-note" },
      ),
    );
    if (donor || can("payments.method.manage"))
      parent.append(
        button("Add New", () =>
          confirmAction("Add payment method", "method_add", {}),
        ),
      );
    for (const m of data) {
      const card = panel(m.brand + " ending " + m.last4, parent);
      card.append(
        E(
          "p",
          "Expiration: " +
            (m.expiry_month
              ? m.expiry_month + "/" + m.expiry_year
              : "Unknown") +
            " · " +
            m.expiry_state +
            " · " +
            m.status +
            (m.default ? " · Default" : ""),
        ),
      );
      if (donor || can("payments.method.manage")) {
        card.append(
          button("Replace", () =>
            confirmAction("Replace method", "method_replace", { id: m.id }),
          ),
          button("Set Default", () =>
            confirmAction("Set default method", "method_default", { id: m.id }),
          ),
          button("Remove", () =>
            confirmAction("Remove method", "method_remove", { id: m.id }),
          ),
        );
      }
    }
  }
  function issueActions(parent, data) {
    const i = data.issue;
    if (!i) return;
    const p = panel("Finance actions", parent);
    p.append(
      E(
        "p",
        "Unknown, fraud and duplicate outcomes require reconciliation before retry. No real payment operation occurs here.",
        { id: "ops-action-help" },
      ),
    );
    if (can("payments.issue.assign")) {
      p.append(
        button("Claim issue", () =>
          confirmAction("Claim issue", "claim", {
            id: i.id,
            revision: i.revision,
          }),
        ),
      );
      form(
        p,
        "Assign issue",
        [
          [
            "Authorized finance staff",
            "assigned_to",
            { choices: (options.staff || []).map((s) => [s.id, s.name]) },
          ],
          [
            "Priority",
            "priority",
            { choices: ["low", "normal", "high", "urgent"].map((x) => [x, x]) },
          ],
        ],
        (v) =>
          confirmAction("Assign issue", "assign", {
            id: i.id,
            revision: i.revision,
            ...v,
          }),
      );
    }
    if (can("payments.manage")) {
      p.append(
        button("Check Provider Status", () =>
          confirmAction("Check Provider Status", "lookup", { id: i.id }),
        ),
        button("Request safe retry", () =>
          confirmAction("Request safe retry", "retry", { id: i.id }),
        ),
        button("Create staff task hook", () =>
          confirmAction("Create staff task hook", "task_hook", { id: i.id }),
        ),
      );
      form(
        p,
        "Add internal note",
        [
          [
            "Internal note (never sent to donor)",
            "reason",
            { type: "textarea" },
          ],
        ],
        (v) => confirmAction("Add internal note", "note", { id: i.id, ...v }),
      );
    }
    if (can("payments.manage") || can("payments.reconcile"))
      form(
        p,
        "Record resolution",
        [
          [
            "Resolution type",
            "resolution_type",
            {
              choices: [
                "review",
                "lookup_required",
                "matched",
                "unmatched",
                "difference",
                "resolved",
                "closed",
                "leave_partial",
                "contact_donor",
              ].map((x) => [x, label(x)]),
            },
          ],
          ["Reason", "reason", { type: "textarea" }],
        ],
        (v) =>
          confirmAction(
            "Record resolution",
            i.issue_type === "settlement_mismatch" ||
              i.issue_type === "unreconciled"
              ? "reconcile"
              : "resolve",
            { id: i.id, revision: i.revision, ...v },
          ),
      );
    for (const kind of ["refund", "void"])
      if (i.leg_id && can("payments." + kind + ".request"))
        form(
          p,
          "Request " + kind,
          [
            ["Exact amount (for example 25.00)", "amount", {}],
            ["Reason", "reason", { type: "textarea" }],
          ],
          (v) =>
            confirmAction("Request " + kind, kind + "_request", {
              leg_id: i.leg_id,
              amount_minor: U.amountToMinor(v.amount),
              reason: v.reason,
            }),
        );
    for (const r of data.refunds || []) {
      const card = panel(
        label(r.kind) + " request · " + money(r.amount_minor),
        p,
      );
      card.append(E("p", label(r.status)));
      if (r.status === "requested" && can("payments." + r.kind + ".approve"))
        form(
          card,
          "Review " + r.kind,
          [
            [
              "Decision",
              "decision",
              {
                choices: [
                  ["approve", "Approve"],
                  ["reject", "Reject"],
                ],
              },
            ],
            ["Review reason", "reason", { type: "textarea" }],
          ],
          (v) =>
            confirmAction("Review " + r.kind, r.kind + "_" + v.decision, {
              id: r.id,
              reason: v.reason,
            }),
        );
      if (
        ["requested", "approved"].includes(r.status) &&
        can("payments." + r.kind + ".execute")
      )
        form(
          card,
          "Queue held " + r.kind,
          [["Reason", "reason", { type: "textarea" }]],
          (v) =>
            confirmAction("Queue held " + r.kind, r.kind + "_execute", {
              id: r.id,
              ...v,
            }),
        );
    }
  }
  function recurring(parent, items) {
    for (const r of items) {
      const p = panel(
        r.donor + " · " + money(r.amount_minor, r.currency),
        parent,
      );
      p.append(
        E(
          "p",
          label(r.status) +
            " · " +
            label(r.frequency) +
            " · Next due " +
            new Date(r.next_due).toLocaleDateString(),
        ),
        E(
          "p",
          "Method: " +
            (r.method || "Method required") +
            " · Failures: " +
            r.failure_count +
            " · Last payment: " +
            (r.last_payment || "None"),
        ),
        E("p", r.next_action),
      );
      table(
        p,
        [
          ["Fund", (x) => x.fund],
          ["Amount", (x) => money(x.amount_minor, r.currency)],
          ["Original route", (x) => x.route],
        ],
        r.lines || [],
      );
      if (can("payments.recurring.manage")) {
        for (const [action, title] of [
          ["pause", "Pause"],
          ["resume", "Resume"],
          ["retry", "Request safe recurring retry"],
        ])
          p.append(
            button(title, () =>
              confirmAction(title, "recurring_" + action, {
                id: r.id,
                revision: r.revision,
              }),
            ),
          );
        form(
          p,
          "Cancel instruction",
          [
            [
              "Agreed end date (leave blank for immediate cancellation)",
              "effective_on",
              { type: "date", required: false },
            ],
          ],
          (v) =>
            confirmAction("Cancel instruction", "recurring_cancel", {
              id: r.id,
              revision: r.revision,
              ...(v.effective_on ? { effective_on: v.effective_on } : {}),
            }),
        );
        form(
          p,
          "Change payment method",
          [
            [
              "Saved payment method",
              "method_id",
              {
                choices: (options.methods || [])
                  .filter((m) => m.person_id === r.person_id)
                  .map((m) => [m.id, m.brand + " ending " + m.last4]),
              },
            ],
          ],
          (v) =>
            confirmAction("Change payment method", "recurring_method", {
              id: r.id,
              revision: r.revision,
              ...v,
            }),
        );
        form(
          p,
          "Request future amount / designation change",
          [
            ["Effective date", "effective_on", { type: "date" }],
            [
              "Reviewed donor authorization reference",
              "authorization_reference",
              {},
            ],
            [
              "Fund / designation",
              "fund_id",
              { choices: (options.funds || []).map((f) => [f.id, f.name]) },
            ],
            ["New amount (for example 25.00)", "amount", {}],
          ],
          (v) =>
            confirmAction("Request future change", "recurring_change", {
              id: r.id,
              revision: r.revision,
              effective_on: v.effective_on,
              authorization_reference: v.authorization_reference,
              lines: [
                { fund_id: v.fund_id, amount_minor: U.amountToMinor(v.amount) },
              ],
            }),
        );
      }
      for (const change of r.changes || [])
        p.append(
          E(
            "p",
            "Requested future change effective " +
              change.effective_on +
              " — " +
              change.execution,
          ),
        );
    }
  }
  function policy(parent, current) {
    if (!can("payments.manage")) return;
    const details = E("details");
    details.append(E("summary", "Configure approved operations policy"));
    parent.append(details);
    const p = panel("Controlled operations policy", details);
    p.append(
      E(
        "p",
        "Defaults: approval required, separate reviewer, no automatic retry. Configure only an approved organization policy. Provider execution stays held.",
      ),
    );
    form(
      p,
      "Save policy",
      [
        ["Currency", "currency", { value: current.currency || "USD" }],
        [
          "Refund approval required",
          "refund_approval_required",
          {
            choices: [
              ["true", "Required"],
              ["false", "Threshold / permission policy"],
            ],
          },
        ],
        [
          "Void approval required",
          "void_approval_required",
          {
            choices: [
              ["true", "Required"],
              ["false", "Permission policy"],
            ],
          },
        ],
        [
          "Refund approval threshold (minor units, blank = all)",
          "refund_threshold_minor",
          { required: false, value: current.refund_threshold_minor || "" },
        ],
        [
          "Requester may self approve",
          "self_approval",
          {
            choices: [
              ["false", "No — separate reviewer"],
              ["true", "Yes — explicitly approved policy"],
            ],
          },
        ],
        [
          "Retry days (blank = none; for example 1,3)",
          "retry_days",
          { required: false, value: (current.retry_days || []).join(",") },
        ],
        [
          "Maximum attempts",
          "max_attempts",
          { type: "number", value: current.max_attempts || 3 },
        ],
        [
          "Expiry horizon in days",
          "expiry_horizon_days",
          { type: "number", value: current.expiry_horizon_days || 60 },
        ],
      ],
      (v) =>
        confirmAction("Save controlled policy", "policy", {
          ...v,
          refund_threshold_minor: v.refund_threshold_minor || null,
          refund_approval_required: v.refund_approval_required === "true",
          void_approval_required: v.void_approval_required === "true",
          self_approval: v.self_approval === "true",
          retry_days: v.retry_days
            ? v.retry_days.split(",").map((x) => Number(x.trim()))
            : [],
          max_attempts: Number(v.max_attempts),
          expiry_horizon_days: Number(v.expiry_horizon_days),
        }),
    );
    form(
      p,
      "Record provider incident",
      [
        [
          "Gateway account",
          "id",
          { choices: (options.gateways || []).map((g) => [g.id, g.name]) },
        ],
        [
          "Provider status",
          "status",
          {
            choices: [
              "healthy",
              "degraded",
              "unavailable",
              "maintenance",
              "unknown",
            ].map((x) => [x, label(x)]),
          },
        ],
        ["Safe reason", "reason", { type: "textarea" }],
      ],
      (v) => confirmAction("Record provider incident", "incident", v),
    );
  }
  async function render() {
    const stamp = epoch;
    root.replaceChildren(
      E("p", "Loading payment operations…", { role: "status" }),
    );
    const action = donor
      ? "history"
      : {
          dashboard: "dashboard",
          queue: "queue",
          work: "my_work",
          transaction: "transaction",
          session: "session",
          recurring: "recurring_list",
          refund: "refund_detail",
          reconciliation: "reconciliation",
          methods: "methods",
        }[view] || "dashboard";
    const id = Q.get("id"),
      detail = ["transaction", "session", "refund", "reconciliation"].includes(
        view,
      );
    if (!donor) options = await call("options");
    const data = await call(
      detail && !id ? "queue" : action,
      detail && id
        ? { id }
        : ["dashboard", "queue", "work"].includes(view)
          ? filters
          : {},
    );
    if (stamp !== epoch) return;
    lastData = data;
    root.replaceChildren(
      E(
        "p",
        donor ? "CHAMPION LIFE · YOUR PAYMENTS" : "CHAMPION LIFE · FINANCE",
        { class: "giving-eyebrow" },
      ),
      E("h1", titles[view]),
      E(
        "p",
        "Provider execution is held. No payment or donor message is sent from this workspace.",
        { class: "giving-note", role: "status" },
      ),
    );
    const nav = E("nav", null, {
      "aria-label": "Payment operations views",
      class: "ops-nav",
    });
    if (!donor)
      for (const [text, file] of [
        ["Operations", "staff-payment-operations.html"],
        ["Issue Queue", "staff-payment-issues.html"],
        ["My Work", "staff-payment-work.html"],
        ["Recurring", "staff-payment-recurring.html"],
        ["Payment Methods", "staff-payment-method-management.html"],
      ])
        nav.append(link(text, file));
    root.append(nav);
    if (donor) {
      for (const s of data.sessions || [])
        session(panel("Payment · " + new Date(s.date).toLocaleDateString()), s);
      methods(panel("Saved Payment Methods"), data.methods || []);
      return;
    }
    if (view === "methods") {
      methods(panel("Saved Payment Methods"), data.methods || []);
      return;
    }
    if (view === "recurring") {
      recurring(root, data.recurring || []);
      return;
    }
    if (view === "session" && id) {
      session(panel("One donor session · " + data.id), data);
      return;
    }
    if (detail && id) {
      if (data.session)
        session(panel("Session and provider legs"), data.session);
      const p = panel(
        data.issue ? label(data.issue.issue_type) : "Payment review",
      );
      p.append(E("p", data.issue?.next_action || "Review current state"));
      table(
        panel("Safe attempt history"),
        [
          ["Attempt", (r) => r.attempt],
          ["Date", (r) => r.date],
          ["Operation", (r) => r.operation],
          ["Result", (r) => r.result],
          ["Failure", (r) => r.failure || "None"],
          ["Next action", (r) => r.next_action],
        ],
        data.attempts || [],
      );
      table(
        panel("Reconciliation observations"),
        [
          ["Result", (r) => r.result],
          ["Exception", (r) => r.exception_type],
          ["Gross", (r) => money(r.gross_minor)],
          ["Fees", (r) => money(r.fee_minor)],
          ["Net", (r) => money(r.net_minor)],
          ["Due", (r) => r.due_on],
        ],
        data.observations || [],
      );
      table(
        panel("Settlement batches"),
        [
          ["Batch", (r) => r.batch],
          ["Gross", (r) => money(r.gross_minor)],
          ["Fees", (r) => money(r.fee_minor)],
          ["Net", (r) => money(r.net_minor)],
        ],
        data.settlements || [],
      );
      issueActions(root, data);
      table(
        panel("Internal notes"),
        [
          ["Note", (r) => r.body],
          ["Operator", (r) => r.actor],
          ["Date", (r) => r.date],
        ],
        data.notes || [],
      );
      table(
        panel("Operator audit"),
        [
          ["Action", (r) => r.action],
          ["Operator", (r) => r.actor],
          ["Reason", (r) => r.detail?.reason || ""],
          ["Date", (r) => r.date],
        ],
        data.audit || [],
      );
      if (data.session)
        root.append(
          link(
            "Open session detail",
            "staff-payment-session.html",
            data.session.id,
          ),
        );
      return;
    }
    if (view === "dashboard") {
      counts(panel("Canonical work needing attention"), data.counts || {});
      policy(root, data.policy || {});
    }
    filterForm(panel("Find payment work"));
    queue(
      panel(view === "work" ? "Your assigned payment work" : "Payment issues"),
      data.issues || [],
    );
    if (can("finance.export"))
      root.append(
        button("Export operational CSV", async () => {
          try {
            const x = await call(
              "export",
              view === "work" ? { ...filters, assigned_to: userId } : filters,
            );
            const safe = (x.issues || []).map((r) => ({
              Status: r.status,
              Issue: r.issue_type,
              Donor: r.donor,
              Amount: r.amount_minor,
              Currency: r.currency,
              Date: r.date,
              Priority: r.priority,
            }));
            const blob = new Blob(
                [
                  U.csv(safe, [
                    "Status",
                    "Issue",
                    "Donor",
                    "Amount",
                    "Currency",
                    "Date",
                    "Priority",
                  ]),
                ],
                { type: "text/csv" },
              ),
              url = URL.createObjectURL(blob),
              a = E("a", "Download operational CSV", {
                href: url,
                download: "payment-operations.csv",
              });
            root.append(a);
            a.click();
            setTimeout(() => {
              a.remove();
              URL.revokeObjectURL(url);
            }, 1000);
          } catch (e) {
            feedback(e.message, true);
          }
        }),
      );
  }
  async function start(preserve = false) {
    const turn = ++sequence;
    try {
      const user = await A.getUser();
      if (turn !== sequence) return;
      if (!user || user.is_anonymous) {
        deny();
        return;
      }
      const oldUser = userId,
        oldScope = scope;
      userId = user.id;
      if (donor) {
        scope = { id: org, permissions: [] };
        if (!org) {
          deny();
          return;
        }
        await call("history");
      } else {
        const r = await A.client.rpc("payment_operations", {
          p_action: "context",
          p_org: null,
          p_payload: {},
        });
        if (turn !== sequence || (await A.getUser())?.id !== user.id) return;
        scope =
          r.data?.organizations?.find(
            (o) => o.id === org && o.permissions.includes("payments.view"),
          ) ||
          (!org
            ? r.data?.organizations?.find((o) =>
                o.permissions.includes("payments.view"),
              )
            : null);
        if (!scope) {
          deny();
          return;
        }
        scope = { ...scope, permissions: [...scope.permissions] };
        org = scope.id;
      }
      if (turn !== sequence) return;
      if (
        preserve &&
        oldUser === userId &&
        oldScope?.id === scope?.id &&
        JSON.stringify(oldScope?.permissions) ===
          JSON.stringify(scope?.permissions)
      )
        return;
      document
        .querySelectorAll(".payment-ops-dialog")
        .forEach((d) => d.remove());
      epoch++;
      filters = filters.issue_type
        ? filters
        : Q.get("issue_type")
          ? { issue_type: Q.get("issue_type") }
          : filters;
      await render();
    } catch (e) {
      if (turn !== sequence) return;
      deny();
    }
  }
  window.addEventListener("staff-workspace-context", () => start(true));
  window.addEventListener("focus", () => start(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") start(true);
  });
  A.client.auth.onAuthStateChange(() => {
    deny();
    setTimeout(() => start(), 0);
  });
  setInterval(() => {
    if (document.visibilityState === "visible") start(true);
  }, 15000);
  start();
})();
