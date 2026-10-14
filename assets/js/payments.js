/* GIV-3A current-authority UI. No payment input, provider widget, secrets or transport. */
(() => {
  "use strict";
  const root = document.getElementById("payments-app");
  if (!root) return;
  const A = window.ChampionLifeAuth,
    E = window.OutreachUI.el,
    U = window.GivingUtils,
    Q = new URLSearchParams(location.search),
    view = root.dataset.view;
  let org = Q.get("organization"),
    scope,
    userId,
    epoch = 0,
    sequence = 0,
    busy = false,
    context,
    donor = false;
  const labels = {
    configuration: "Native Merchant Configuration",
    routing: "Routing Matrix",
    checkout: "Checkout",
    methods: "Payment Methods",
    transaction: "Transaction Detail",
  };
  const can = (k) => scope?.permissions?.includes(k),
    money = (v, c = "USD") => U.money(String(v), c),
    button = (text, fn) => {
      const b = E("button", text, { type: "button", class: "giving-button" });
      b.onclick = fn;
      return b;
    };
  function status(text, isError = false) {
    const p = E("p", text, {
      role: isError ? "alert" : "status",
      tabindex: "-1",
      class: isError ? "giving-error" : "giving-note",
    });
    root.querySelector(".payment-feedback")?.remove();
    p.classList.add("payment-feedback");
    root.append(p);
    if (isError) p.focus();
  }
  function deny() {
    epoch++;
    root.replaceChildren(
      E("p", "Payment processing is not yet enabled.", {
        role: "status",
        class: "giving-note",
      }),
      E(
        "section",
        "Your payment workspace access is no longer available. Contact an administrator if needed.",
        { class: "staff-state", role: "status" },
      ),
      E("a", "Return to Staff Dashboard", {
        href: "staff-home.html",
        class: "giving-button",
      }),
    );
  }
  async function call(action, payload = {}, useDonor = donor) {
    const token = epoch;
    const r = await A.client.rpc(
      useDonor ? "payments_donor" : "payments_workspace",
      { p_action: action, p_org: org, p_payload: payload },
    );
    if (token !== epoch || (await A.getUser())?.id !== userId)
      throw Error("Access changed.");
    if (r.error) {
      if (
        ["42501", "PGRST301", "PGRST302"].includes(r.error.code) ||
        [401, 403].includes(r.status)
      ) {
        deny();
        window.StaffWorkspace?.refresh();
        throw Error("Payment access unavailable.");
      }
      throw Error(
        r.error.code === "PT409"
          ? "The record changed. Reload before saving."
          : "The payment request could not be prepared. Check the selected account, route and exact amount.",
      );
    }
    return r.data;
  }
  function panel(title) {
    const p = E("section", null, { class: "giving-panel" });
    p.append(E("h2", title));
    root.append(p);
    return p;
  }
  function table(parent, columns, rows) {
    const wrap = E("div", null, {
        class: "payments-table-wrap",
        tabindex: "0",
        "aria-label": "Scrollable " + columns[0][0] + " table",
      }),
      t = E("table"),
      head = E("tr"),
      body = E("tbody");
    columns.forEach(([label]) => head.append(E("th", label, { scope: "col" })));
    const th = E("thead");
    th.append(head);
    for (const r of rows) {
      const tr = E("tr");
      for (const [, get] of columns) {
        const v = get(r),
          td = E("td");
        td.append(
          v instanceof Node
            ? v
            : document.createTextNode(String(v ?? "Not configured")),
        );
        tr.append(td);
      }
      body.append(tr);
    }
    if (!rows.length) {
      const tr = E("tr");
      tr.append(
        E("td", "No configured records.", { colspan: String(columns.length) }),
      );
      body.append(tr);
    }
    t.append(th, body);
    wrap.append(t);
    parent.append(wrap);
  }
  function field(
    form,
    label,
    name,
    { choices, value = "", type = "text", required = true } = {},
  ) {
    const id = "payment-" + name + "-" + Math.random().toString(36).slice(2, 7),
      w = E("label", label, { for: id }),
      c = E(choices ? "select" : "input", null, {
        id,
        name,
        ...(!choices ? { type } : {}),
        ...(required ? { required: "" } : {}),
      });
    if (choices)
      choices.forEach(([v, t]) => c.append(E("option", t, { value: v })));
    c.value = value;
    form.append(w, c);
    return c;
  }
  function form(parent, title, fn) {
    const f = E("form", null, { class: "giving-form", "aria-label": title });
    parent.append(E("h3", title), f);
    const b = E("button", "Save " + title, {
      type: "submit",
      class: "giving-button giving-primary",
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      b.disabled = true;
      try {
        await fn(f);
        status("Configuration saved. Processing remains disabled.");
        await render();
      } catch (e) {
        status(e.message, true);
      } finally {
        busy = false;
        b.disabled = false;
      }
    };
    return { f, finish: () => f.append(b) };
  }
  function header() {
    root.replaceChildren();
    root.append(
      E("p", "GIVING / FINANCE", { class: "staff-eyebrow" }),
      E(
        view === "configuration" && root.dataset.extension ? "h2" : "h1",
        labels[view],
      ),
      E("p", "Payment processing is not yet enabled.", {
        class: "giving-note",
        role: "status",
      }),
    );
    if (scope) root.append(E("p", scope.name));
  }
  async function configuration(data) {
    const accounts = panel("Provider accounts and processor routes");
    for (const g of data.gateways) {
      const card = E("article", null, { class: "giving-gateway-card" });
      card.append(
        E("h3", g.label),
        E(
          "p",
          g.provider === "authorize_net"
            ? "Authorize.Net · separate account token scope"
            : g.provider === "nmi"
              ? "NMI · multiple explicit processor routes"
              : "Provider-neutral account",
        ),
        E(
          "p",
          g.environment + " · Disabled · Credentials: " + g.credential_status,
        ),
        E("p", "Last verified: " + (g.last_verified || "Not verified")),
      );
      table(
        card,
        [
          ["MID-safe route", (r) => r.label],
          ["Currency", (r) => r.currency],
          ["Country", (r) => r.country],
          ["State", () => "Disabled"],
          [
            "Capabilities",
            (r) => (r.capabilities || []).join(", ") || "Not configured",
          ],
        ],
        data.routes.filter((r) => r.gateway_id === g.id),
      );
      if (can("payments.provider.activate"))
        card.append(
          button("Review activation gate", async () => {
            try {
              const r = await call("activation_request", { id: g.id });
              status(r.message);
            } catch (e) {
              status(e.message, true);
            }
          }),
        );
      accounts.append(card);
    }
    if (!data.gateways.length)
      accounts.append(E("p", "No native provider accounts configured."));
    if (can("payments.configure")) {
      const p = panel("Add gateway account");
      const x = form(p, "gateway account", (f) =>
        call("gateway_create", {
          label: f.elements.label.value,
          provider: f.elements.provider.value,
          environment: f.elements.environment.value,
          capabilities: [],
        }),
      );
      field(x.f, "Display name", "label");
      field(x.f, "Provider", "provider", {
        choices: [
          ["nmi", "NMI"],
          ["authorize_net", "Authorize.Net"],
          ["manual", "Manual"],
          ["future", "Future gateway"],
        ],
      });
      field(x.f, "Environment", "environment", {
        choices: [
          ["sandbox", "Sandbox"],
          ["live", "Live — held; separate release required"],
        ],
      });
      x.finish();
    }
    if (can("payments.route")) {
      const p = panel("Add processor route");
      const x = form(p, "processor route", (f) =>
        call("route_create", {
          gateway_id: f.elements.gateway.value,
          label: f.elements.label.value,
          provider_route_key: f.elements.routekey.value,
          external_processor_id: f.elements.external.value || null,
          currency: f.elements.currency.value.toUpperCase(),
          country: f.elements.country.value.toUpperCase(),
          capabilities: [],
        }),
      );
      field(x.f, "Gateway account", "gateway", {
        choices: data.gateways.map((g) => [g.id, g.label]),
      });
      field(x.f, "MID-safe display name", "label");
      field(x.f, "Provider route key", "routekey");
      field(x.f, "Opaque processor reference (not a secret)", "external", {
        required: false,
      });
      field(x.f, "Currency", "currency", { value: "USD" });
      field(x.f, "Country", "country", { value: "US" });
      x.finish();
    }
  }
  async function routing(data) {
    const p = panel("Deterministic financial ownership");
    const rows = data.funds.map((f) => ({
      fund: f.name,
      destination: data.destinations.find((d) => d.id === f.destination_id),
    }));
    for (const d of data.destinations.filter(
      (d) => !data.funds.some((f) => f.destination_id === d.id),
    ))
      rows.push({
        fund: "Payment purpose / unassigned designation",
        destination: d,
      });
    table(
      p,
      [
        ["Purpose / fund", (r) => r.fund],
        ["Merchant destination", (r) => r.destination?.label],
        [
          "Gateway",
          (r) =>
            data.gateways.find((g) => g.id === r.destination?.gateway_id)
              ?.label,
        ],
        [
          "MID route",
          (r) =>
            data.routes.find((x) => x.id === r.destination?.route_id)?.label,
        ],
        ["Currency", (r) => r.destination?.currency],
        ["State", () => "Disabled"],
      ],
      rows,
    );
    if (can("payments.route")) {
      const x = form(p, "route binding", (f) => {
        const d = data.destinations.find(
            (d) => d.id === f.elements.destination.value,
          ),
          r = data.routes.find((r) => r.id === f.elements.route.value);
        return call("route_bind", {
          id: d.id,
          revision: d.revision,
          gateway_id: r.gateway_id,
          route_id: r.id,
        });
      });
      const dest = field(x.f, "Merchant destination", "destination", {
          choices: data.destinations.map((d) => [d.id, d.label]),
        }),
        route = field(x.f, "Processor route", "route", {
          choices: data.routes.map((r) => [r.id, r.label]),
        });
      dest.onchange = () => {
        const d = data.destinations.find((d) => d.id === dest.value);
        route.replaceChildren(
          ...data.routes
            .filter((r) => r.currency === d?.currency)
            .map((r) => E("option", r.label, { value: r.id })),
        );
      };
      dest.onchange();
      x.finish();
    }
    p.append(
      E(
        "p",
        "Each line keeps its original routing snapshot. Later configuration changes do not reroute an existing checkout.",
      ),
    );
  }
  async function session(data) {
    const s = data.session,
      p = panel("Payment summary");
    table(
      p,
      [
        ["Fund / designation", (l) => l.fund || "Payment purpose"],
        ["Purpose", (l) => l.purpose.replaceAll("_", " ")],
        ["Amount", (l) => money(l.amount_minor, s.currency)],
        ["Merchant", (l) => l.merchant],
        [
          "Charitable",
          (l) =>
            l.tax_eligible ? "Eligible contribution" : "Non-charitable payment",
        ],
      ],
      data.lines,
    );
    p.append(
      E("p", "Total: " + money(s.total_minor, s.currency), {
        class: "payments-total",
      }),
    );
    const settings = E("fieldset");
    settings.append(E("legend", "Checkout choices"));
    field(settings, "Recurring choice", "recurring", {
      choices: [
        ["once", "One time"],
        ["weekly", "Weekly"],
        ["biweekly", "Every two weeks"],
        ["monthly", "Monthly"],
        ["annual", "Annual"],
      ],
      value: data.checkout?.recurring_choice || "once",
    });
    const anon = field(
      settings,
      "Anonymous giving where applicable",
      "anonymous",
      { type: "checkbox", required: false },
    );
    anon.checked = s.anonymous;
    anon.disabled = !data.lines.some(
      (l) => l.purpose === "charitable_contribution",
    );
    field(settings, "Receipt email", "receipt_email", {
      type: "email",
      value: data.checkout?.receipt_email || "",
      required: false,
    });
    p.append(
      settings,
      E(
        "p",
        "These choices are a held checkout preview; no payment is submitted.",
      ),
      E(
        "div",
        "Payment processing is not yet enabled. No card or bank information is collected.",
        { class: "payments-placeholder", role: "note" },
      ),
      E("button", "Payment disabled", {
        type: "button",
        disabled: "",
        class: "giving-button giving-primary",
      }),
    );
    const legs = panel("Transaction legs");
    table(
      legs,
      [
        ["Gateway", (l) => l.gateway_label],
        ["MID-safe route", (l) => l.route_label || "Original route"],
        ["Amount", (l) => money(l.amount_minor, s.currency)],
        ["State", (l) => l.status.replaceAll("_", " ")],
        ["Execution", () => "Held"],
      ],
      data.legs,
    );
    const receipt = panel("Receipt preview — not issued");
    receipt.append(
      E(
        "p",
        "Date: " +
          (data.receipt.date
            ? new Date(data.receipt.date).toLocaleDateString()
            : "Not issued"),
      ),
      E("p", "Session reference: " + (data.receipt.reference || s.id)),
      E(
        "p",
        "Payment method: " +
          (data.receipt.payment_method_summary ||
            "Not selected — processing held"),
      ),
      E(
        "p",
        "Contributions: " + money(data.receipt.charitable_minor, s.currency),
      ),
      E(
        "p",
        "Non-charitable payments: " +
          money(data.receipt.non_charitable_minor, s.currency),
      ),
      E(
        "p",
        "One session may contain multiple processor transactions. An authorization is not settled giving. No receipt has been sent.",
      ),
    );
    if (view === "transaction" && !donor) {
      for (const l of data.legs) {
        for (const [action, key, label] of [
          ["refund_request", "payments.refund", "Prepare held refund"],
          ["void_request", "payments.void", "Prepare held void"],
        ])
          if (can(key)) {
            const requestKey = crypto.randomUUID();
            const x = form(legs, label, (f) =>
              call(action, {
                request_key: requestKey,
                leg_id: l.id,
                amount_minor: U.minor(f.elements.amount.value),
                reason: f.elements.reason.value,
              }),
            );
            field(
              x.f,
              "Amount for " + (l.route_label || "transaction"),
              "amount",
            );
            field(x.f, "Review reason", "reason");
            x.finish();
          }
      }
    }
  }
  async function render() {
    const token = epoch;
    header();
    if (view === "methods") {
      const data = await call("methods");
      if (token !== epoch) return;
      const p = panel("Saved method references");
      table(
        p,
        [
          ["Method", (m) => m.brand + " ending " + m.last4],
          ["Status", (m) => m.status],
          ["Gateway scopes", (m) => m.gateway_count],
          [
            "Manage",
            (m) =>
              donor || can("payments.configure")
                ? button(
                    "Remove " + m.brand + " ending " + m.last4,
                    async () => {
                      try {
                        await call("method_remove", { id: m.id });
                        await render();
                      } catch (e) {
                        status(e.message, true);
                      }
                    },
                  )
                : "View only",
          ],
        ],
        data.methods,
      );
      p.append(
        E(
          "p",
          "One logical method may require separate provider tokens. Tokens are never displayed here.",
        ),
        E("button", "Payment method registration disabled", {
          type: "button",
          disabled: "",
        }),
      );
      return;
    }
    const id = Q.get("session") || Q.get("id");
    if (["checkout", "transaction"].includes(view) && id) {
      const data = await call("session", { id });
      if (token !== epoch) return;
      await session(data);
      return;
    }
    const data = await call("configuration", {}, false);
    if (token !== epoch) return;
    if (view === "configuration") await configuration(data);
    else if (view === "routing") await routing(data);
    else {
      const p = panel("Prepared sessions");
      table(
        p,
        [
          [
            "Session",
            (s) =>
              E("a", "Open " + s.id, {
                href:
                  location.pathname +
                  "?organization=" +
                  encodeURIComponent(org) +
                  "&session=" +
                  encodeURIComponent(s.id),
              }),
          ],
          ["Total", (s) => money(s.total_minor, s.currency)],
          ["State", (s) => s.status],
        ],
        data.sessions,
      );
      p.append(
        E(
          "p",
          "Checkout sessions are prepared through the canonical Forms/Giving boundary.",
        ),
      );
    }
  }
  async function start(preserve = false) {
    const request = ++sequence;
    try {
      const user = await A.getUser();
      if (request !== sequence) return;
      if (!user || user.is_anonymous) {
        userId = null;
        deny();
        return;
      }
      const r = await A.client.rpc("payments_workspace", {
        p_action: "context",
        p_org: null,
        p_payload: {},
      });
      if (request !== sequence || (await A.getUser())?.id !== user.id) return;
      const old = scope,
        oldUser = userId;
      userId = user.id;
      context = r.data;
      scope =
        context?.organizations?.find(
          (o) => o.id === org && o.permissions.includes("payments.view"),
        ) ||
        (!org
          ? context?.organizations?.find((o) =>
              o.permissions.includes("payments.view"),
            )
          : null);
      donor = false;
      if (!scope) {
        if (["methods", "checkout"].includes(view) && org) {
          donor = true;
          scope = { id: org, name: "Your payment workspace", permissions: [] };
        } else {
          deny();
          return;
        }
      }
      scope = { ...scope, permissions: [...scope.permissions] };
      org = scope.id;
      if (donor) {
        const check = await A.client.rpc("payments_donor", {
          p_action: "methods",
          p_org: org,
          p_payload: {},
        });
        if (request !== sequence) return;
        if (check.error) {
          deny();
          return;
        }
      }
      if (
        preserve &&
        oldUser === userId &&
        old?.id === org &&
        JSON.stringify(old.permissions) === JSON.stringify(scope.permissions)
      )
        return;
      epoch++;
      await render();
    } catch (e) {
      if (request !== sequence) return;
      if (!userId) deny();
      else status(e.message, true);
    }
  }
  window.addEventListener("staff-workspace-context", () => start(true));
  window.addEventListener("focus", () => start(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") start(true);
  });
  A.client.auth.onAuthStateChange(() => {
    epoch++;
    scope = null;
    root.replaceChildren();
    setTimeout(() => start(), 0);
  });
  setInterval(() => {
    if (document.visibilityState === "visible") start(true);
  }, 20000);
  start();
})();
