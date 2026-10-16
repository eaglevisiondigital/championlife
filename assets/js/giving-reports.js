/* GIV-2B reports and held statements. All datasets and capabilities are server-scoped. */
(() => {
  "use strict";
  const root = document.getElementById("giving-reports-app");
  if (!root) return;
  const E = window.OutreachUI.el,
    U = window.GivingUtils,
    M = window.GivingManagementUtils,
    auth = window.ChampionLifeAuth;
  const params = new URLSearchParams(location.search),
    view = root.dataset.view,
    kind = params.get("report") || root.dataset.report || "summary";
  const catalog = [
    ["summary", "Giving Summary"],
    ["fund", "Giving by Fund"],
    ["parent", "Parent Fund Rollup"],
    ["fund_detail", "Fund Detail"],
    ["donor", "Donor Giving", "donor"],
    ["household", "Household Giving", "donor"],
    ["first_donor", "First Recorded Donors", "donor"],
    ["recurring", "Recurring Giving", "donor"],
    ["recurring_mix", "One-Time vs Recurring"],
    ["pledge", "Pledge Report", "donor"],
    ["manual", "Manual Giving"],
    ["online", "Online Giving"],
    ["payment", "Payment Type"],
    ["destination", "Merchant Destination", "merchant"],
    ["gateway", "Gateway", "merchant"],
    ["mid", "Processor / MID", "merchant"],
    ["settlement", "Settlement", "merchant"],
    ["batch", "Batch / Reconciliation", "merchant"],
    ["reconciliation", "Reconciliation", "merchant"],
    ["refund", "Refunds", "donor"],
    ["failed", "Failed Transactions", "donor"],
    ["campaign", "Campaign / Appeal"],
    ["event", "Event / Fundraiser"],
    ["text", "Text-to-Give Foundation"],
  ];
  let org = params.get("organization"),
    scope,
    user,
    epoch = 0,
    sequence = 0,
    loadedSignature = "",
    currency = "USD",
    scale = 2,
    filters = {};
  const allowedFields = [
    "period",
    "starts_on",
    "ends_on",
    "as_of",
    "as_on",
    "fund_id",
    "parent_id",
    "person_id",
    "household_id",
    "source",
    "payment_method",
    "destination_id",
    "gateway_id",
    "processor_route_id",
    "campaign",
    "event",
    "min_minor",
    "max_minor",
    "recurring",
    "status",
    "batch_type",
  ];
  for (const key of allowedFields)
    if (params.get(key)) filters[key] = params.get(key);
  filters.period ??= "today";
  const can = (k) => scope?.permissions.includes(k),
    may = (k) =>
      can("finance.reports.read") &&
      (!k?.[2] ||
        can(
          k[2] === "donor" ? "finance.gifts.read" : "finance.reports.merchant",
        ));
  const money = (v) =>
    v == null ? "Not available" : U.money(v, currency, scale);
  const date = (v) =>
    v
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? "UTC" : scope?.timezone || "UTC",
          dateStyle: "medium",
        }).format(new Date(v))
      : "Not recorded";
  const reportLink = (report, extra = {}) =>
    "staff-giving-report.html?" +
    new URLSearchParams({ organization: org, report, ...filters, ...extra });
  function panel(title, parent = root) {
    const p = E("section", null, { class: "giving-panel" });
    if (title) p.append(E("h2", title));
    parent.append(p);
    return p;
  }
  function note(parent, text) {
    parent.append(E("p", text, { class: "giving-footnote" }));
  }
  function button(label, fn) {
    const b = E("button", label, { type: "button" });
    b.onclick = async () => {
      if (b.disabled) return;
      b.disabled = true;
      try {
        await fn();
      } catch (e) {
        if (!root.querySelector(".staff-state")) {
          const error = E("p", e.message, {
            role: "alert",
            class: "giving-error",
          });
          root.append(error);
        }
      } finally {
        b.disabled = false;
      }
    };
    return b;
  }
  function field(parent, label, name, value = "", choices) {
    const wrap = E("label", label),
      input = E(choices ? "select" : "input", null, {
        name,
        type: ["starts_on", "ends_on", "anchor"].includes(name)
          ? "date"
          : "text",
      });
    if (choices)
      for (const [v, t] of choices) input.append(E("option", t, { value: v }));
    input.value = value || (choices?.[0]?.[0] ?? "");
    wrap.append(input);
    parent.append(wrap);
    return input;
  }
  async function call(action, payload = {}) {
    const version = epoch,
      who = user,
      res = await auth.client.rpc("giving_reports", {
        p_action: action,
        p_org: org,
        p_payload: payload,
      });
    if (version !== epoch || (await auth.getUser())?.id !== who)
      throw Error("Report scope changed. Refresh to continue.");
    if (res.error) {
      if (res.error.code === "42501" || [401, 403].includes(res.status)) {
        epoch++;
        root.replaceChildren();
        window.StaffWorkspace.denied(
          root,
          "Your access to this finance report is no longer available.",
        );
        window.StaffWorkspace.refresh();
      }
      throw Error(res.error.message || "Report unavailable");
    }
    return res.data;
  }
  function table(parent, rows, headers) {
    if (!rows?.length) {
      parent.append(
        E("p", "No records in the selected period.", { class: "giving-empty" }),
      );
      return;
    }
    const wrap = E("div", null, {
        class: "giving-table-wrap",
        tabindex: "0",
        "aria-label": "Scrollable report table",
      }),
      t = E("table"),
      head = E("thead"),
      tr = E("tr");
    for (const h of headers)
      tr.append(
        E(
          "th",
          h
            .replaceAll("_", " ")
            .replace("minor", "")
            .trim()
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          { scope: "col" },
        ),
      );
    head.append(tr);
    t.append(head);
    const body = E("tbody");
    for (const r of rows) {
      const row = E("tr");
      for (const h of headers) {
        let value = r[h];
        if (h.endsWith("_minor")) value = money(value);
        else if (["last_gift", "next_run_at", "batch_date", "date"].includes(h) && value) value = date(value);
        else if (Array.isArray(value))
          value = value
            .map((v) =>
              typeof v === "object"
                ? Object.entries(v)
                    .map(([k, x]) =>
                      k.endsWith("_minor") ? money(x) : String(x ?? ""),
                    )
                    .join(" · ")
                : String(v),
            )
            .join("; ");
        row.append(E("td", value == null ? "Not available" : String(value)));
      }
      body.append(row);
    }
    t.append(body);
    wrap.append(t);
    parent.append(wrap);
  }
  function metrics(parent, items) {
    const grid = E("div", null, { class: "giving-metrics" });
    for (const [label, value, description, report, linkFilters] of items) {
      const card = E("article", null, { class: "giving-metric" });
      card.append(E("span", label), E("strong", value));
      if (description) card.append(E("small", description));
      if (report)
        card.append(
          E("a", "View report", {
            href: reportLink(report, linkFilters || {}),
          }),
        );
      grid.append(card);
    }
    parent.append(grid);
  }
  function fundView(parent, funds) {
    const section = panel(
      filters.period === "today" ? "Today by Fund" : "Selected Period by Fund",
      parent,
    );
    for (const f of M.fundTree(funds)) {
      const row = E("div", null, { class: "giving-fund" }),
        label = f.children.length
          ? button(f.name, () => {
              child.hidden = !child.hidden;
              label.setAttribute("aria-expanded", String(!child.hidden));
            })
          : E("a", f.name, {
              href: reportLink("fund_detail", { fund_id: f.id }),
            });
      if (f.children.length) {
        label.setAttribute("aria-expanded", "false");
        label.setAttribute("aria-controls", "report-fund-" + f.id);
      }
      row.append(label, E("strong", money(f.total_minor)));
      const child = E("div", null, {
        class: "giving-fund-children",
        id: "report-fund-" + f.id,
        hidden: "",
      });
      for (const c of f.children) {
        const line = E("div", null, { class: "giving-fund-child" });
        line.append(
          E("a", c.name, {
            href: reportLink("fund_detail", { fund_id: c.id }),
          }),
          E("span", money(c.direct_minor)),
        );
        child.append(line);
      }
      row.append(child);
      section.append(row);
    }
    const total = E("div", null, { class: "giving-fund giving-fund-total" });
    total.append(
      E("strong", "TOTAL"),
      E("strong", money(M.sum(funds, "direct_minor"))),
    );
    section.append(total);
    note(
      section,
      "Parents include their direct giving plus children; children are not counted a second time.",
    );
    section.append(
      E("a", "View All Funds", {
        href: reportLink("fund"),
        class: "giving-button",
      }),
    );
  }
  function chart(parent, title, rows, report = "summary") {
    const p = panel(title, parent);
    if (!rows?.length) {
      p.append(
        E("p", "No chart data in this period.", { class: "giving-empty" }),
      );
      return;
    }
    const values = rows.map((r) => BigInt(r.amount_minor ?? r.net_minor ?? 0)),
      max = values.reduce((m, v) => {
        v = v < 0n ? -v : v;
        return v > m ? v : m;
      }, 1n),
      bars = E("div", null, { class: "giving-chart", "aria-label": title });
    rows.forEach((r, i) => {
      const value = values[i],
        line = E("a", null, {
          class: "giving-chart-row",
          href: reportLink(report),
          title: r.label + ": " + money(value.toString()),
          "aria-label": r.label + ": " + money(value.toString()),
        });
      const bar = E("span", null, {
        class: "giving-chart-bar" + (value < 0n ? " is-negative" : ""),
      });
      bar.style.width =
        String(((value < 0n ? -value : value) * 10000n) / max / 100n) + "%";
      line.append(
        E("span", r.label, { class: "giving-chart-label" }),
        bar,
        E("span", money(value.toString()), { class: "giving-chart-value" }),
      );
      bars.append(line);
    });
    p.append(bars);
    const detail = E("details");
    detail.append(E("summary", "Accessible chart data"));
    table(
      detail,
      rows.map((r) => ({
        label: r.label,
        amount_minor: String(r.amount_minor ?? r.net_minor ?? 0),
      })),
      ["label", "amount_minor"],
    );
    p.append(detail);
  }
  function periods() {
    const p = panel("Reporting period"),
      controls = E("div", null, { class: "giving-periods giving-period-selector", role: "group", "aria-label": "Reporting period" });
    for (const [value, label] of [
      ["past_24_hours", "24 Hours"],
      ["today", "Today"],
      ["week", "Week"],
      ["month", "Month"],
      ["quarter", "Quarter"],
      ["six_months", "6 Months"],
      ["ytd", "YTD"],
      ["custom", "Custom"],
    ]) {
      const b = button(label, async () => {
        filters.period = value;
        sync();
        await render();
      });
      b.setAttribute("aria-pressed", String(filters.period === value));
      controls.append(b);
    }
    p.append(controls);
    const form = E("form", null, { class: "giving-filters" });
    const from = field(form, "From", "starts_on", filters.starts_on || ""),
      to = field(form, "To", "ends_on", filters.ends_on || ""),
      anchor = field(
        form,
        "Compare as of (Sunday/month/year)",
        "anchor",
        filters.as_on || (filters.as_of || "").slice(0, 10),
      );
    form.append(E("button", "Apply range / history", { type: "submit" }));
    form.onsubmit = async (e) => {
      e.preventDefault();
      filters.period = from.value && to.value ? "custom" : filters.period;
      if (from.value) filters.starts_on = from.value;
      if (to.value) filters.ends_on = to.value;
      if (anchor.value) {
        filters.as_on = anchor.value;
        delete filters.as_of;
      } else {
        delete filters.as_of;
        delete filters.as_on;
      }
      sync();
      try {
        await render();
      } catch (error) {
        root.append(E("p", error.message, { role: "alert" }));
      }
    };
    p.append(form);
    const annual = E("div", null, { class: "giving-filters" }),
      year = field(
        annual,
        "Annual reporting year",
        "annual_year",
        String(new Date().getFullYear()),
      );
    annual.append(
      button("View Annual", async () => {
        if (!/^\d{4}$/.test(year.value))
          throw Error("Enter a four-digit reporting year.");
        filters = {
          ...filters,
          period: "annual",
          as_on: year.value + "-12-31",
        };
        delete filters.as_of;
        sync();
        await render();
      }),
    );
    p.append(annual);
    note(
      p,
      "Calendar-local periods use organization timezone. 6 Months is rolling; YTD compares the matching prior-year range.",
    );
  }
  function sync() {
    const q = new URLSearchParams({
      organization: org,
      ...filters,
      ...(view === "report" ? { report: kind } : {}),
    });
    history.replaceState(null, "", location.pathname + "?" + q);
  }
  async function reportFilters() {
    const choices = await call("choices"),
      p = panel("Report filters"),
      form = E("form", null, { class: "giving-form" });
    const inputs = {};
    let definitions = [
      ["fund_id", "Fund"],
      ["parent_id", "Parent fund"],
      ["source", "Canonical source"],
      ["payment_method", "Payment type"],
      ["campaign", "Campaign / appeal"],
      ["event", "Event / fundraiser"],
      ["min_minor", "Minimum (minor units)"],
      ["max_minor", "Maximum (minor units)"],
    ];
    if (can("finance.gifts.read"))
      definitions.push(["person_id", "Donor"], ["household_id", "Household"]);
    if (can("finance.reports.merchant"))
      definitions.push(
        ["destination_id", "Merchant destination"],
        ["gateway_id", "Gateway"],
        ["processor_route_id", "Processor / MID"],
      );
    if (
      [
        "recurring",
        "pledge",
        "batch",
        "settlement",
        "reconciliation",
        "refund",
      ].includes(kind)
    )
      definitions.push(["status", "Status"]);
    if (["batch", "settlement", "reconciliation"].includes(kind))
      definitions.push(["batch_type", "Batch type"]);
    const named = {
      fund_id: choices.funds,
      parent_id: choices.funds.filter((f) => !f.parent_id),
      person_id: choices.people,
      household_id: choices.households,
    };
    if (["pledge", "recurring"].includes(kind))
      definitions = definitions.filter(([k]) =>
        [
          "fund_id",
          "parent_id",
          "person_id",
          "household_id",
          "status",
        ].includes(k),
      );
    if (["batch", "settlement", "reconciliation"].includes(kind))
      definitions = definitions.filter(([k]) =>
        ["status", "batch_type"].includes(k),
      );
    for (const [key, id, label] of [
      ["destination_id", "destination_id", "destination"],
      ["gateway_id", "gateway_id", "gateway"],
      ["processor_route_id", "processor_route_id", "mid"],
    ])
      named[key] = [
        ...new Map(
          choices.routes.map((r) => [r[id], { id: r[id], name: r[label] }]),
        ).values(),
      ];
    for (const [name, label] of definitions)
      inputs[name] = field(
        form,
        label,
        name,
        filters[name] || "",
        named[name]
          ? [["", "All"], ...named[name].map((r) => [r.id, r.name])]
          : name === "payment_method"
            ? [
                ["", "All"],
                ["cash", "Cash"],
                ["check", "Check"],
                ["ach", "ACH"],
                ["card", "Card"],
                ["external", "External Card / Reference"],
                ["other", "Other"],
              ]
            : name === "source"
              ? [
                  ["", "All"],
                  ["staff_manual", "Manual"],
                  ["import", "Imported"],
                  ["web", "Online"],
                  ["recurring", "Recurring"],
                  ["text", "Text-to-Give"],
                ]
              : undefined,
      );
    form.append(E("button", "Apply report filters", { type: "submit" }));
    form.onsubmit = async (e) => {
      e.preventDefault();
      for (const [name, input] of Object.entries(inputs))
        if (input.value.trim()) filters[name] = input.value.trim();
        else delete filters[name];
      sync();
      try {
        await render();
      } catch (error) {
        root.append(E("p", error.message, { role: "alert" }));
      }
    };
    const details = E("details");
    details.append(E("summary", "Refine this report"), form);
    p.append(details);
  }
  function reportTable(parent, data) {
    const preferred = [
      "label",
      "parent",
      "household",
      "fund",
      "gift_count",
      "gross_minor",
      "net_minor",
      "average_minor",
      "percent_of_total",
      "donors",
      "ytd_minor",
      "last_gift",
      "recurring_status",
      "pledge_status",
      "recurring_minor",
      "one_time_minor",
      "pledged_minor",
      "received_minor",
      "remaining_minor",
      "percent_complete",
      "frequency",
      "next_run_at",
      "funds",
      "merchant",
      "gateway",
      "mid",
      "fees_minor",
      "net_settlement_minor",
      "settlement_state",
      "individuals",
      "settlement_minor",
      "deposit_minor",
      "ledger_minor",
      "difference_minor",
      "batch_date",
      "kind",
      "status",
      "date",
      "amount_minor",
      "extent",
      "original_gifts",
      "reason",
      "category",
    ];
    const keys = preferred.filter((k) =>
      data.rows.some((r) => k in r && r[k] != null),
    );
    const rows = data.rows.map((r) => ({
      ...r,
      ...(r.pledged_minor
        ? { percent_complete: M.percent(r.received_minor, r.pledged_minor) }
        : {}),
    }));
    if (rows.some((r) => r.percent_complete)) keys.push("percent_complete");
    table(parent, rows, keys.length ? keys : ["label", "net_minor"]);
  }
  async function exportReport() {
    const data = await call("export", { report: kind, ...filters }),
      keys = [...new Set(data.rows.flatMap(Object.keys))].filter(
        (k) => !["id", "bucket"].includes(k),
      );
    const label = (k) =>
      k
        .replace(/_minor$/, " (minor units)")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    const headers = [
      "Report",
      "Currency",
      "Period From",
      "Period To (excluded)",
      "Timezone",
      ...keys.map(label),
    ];
    const rows = data.rows.map((r) =>
      Object.fromEntries(
        headers.map((h, i) => [
          h,
          i === 0
            ? kind
            : i === 1
              ? data.currency
              : i === 2
                ? data.period.starts_at
                : i === 3
                  ? data.period.ends_at
                  : i === 4
                    ? data.period.timezone
                    : Array.isArray(r[keys[i - 5]])
                      ? JSON.stringify(r[keys[i - 5]])
                      : r[keys[i - 5]],
        ]),
      ),
    );
    const blob = new Blob([U.csv(rows, headers)], {
        type: "text/csv;charset=utf-8",
      }),
      url = URL.createObjectURL(blob),
      a = E("a", null, { href: url, download: "giving-" + kind + ".csv" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function statements() {
    const p = panel("Generate New Statement"),
      options = await call("statement_options"),
      form = E("form", null, { class: "giving-form" });
    const mode = field(form, "Recipient type", "mode", "individual", [
        ["individual", "Individual"],
        ["household", "Household"],
      ]),
      person = field(
        form,
        "Donor",
        "person_id",
        "",
        options.people.map((r) => [r.id, r.name]),
      ),
      house = field(
        form,
        "Household",
        "household_id",
        "",
        options.households.map((r) => [r.id, r.name]),
      ),
      year = field(form, "Tax year", "year", String(new Date().getFullYear())),
      from = field(form, "Custom From (optional)", "starts_on", ""),
      to = field(form, "Custom To (optional)", "ends_on", ""),
      fundSummary = field(form, "Fund summary", "fund_summary", "true", [
        ["true", "Include"],
        ["false", "Omit"],
      ]);
    form.append(E("button", "Preview Statement", { type: "submit" }));
    let previewPayload, previewKey;
    form.onsubmit = async (e) => {
      e.preventDefault();
      previewPayload = {
        period: from.value && to.value ? "custom" : "annual",
        as_on: year.value + "-12-31",
        ...(mode.value === "individual"
          ? { person_id: person.value }
          : { household_id: house.value }),
        fund_summary: fundSummary.value === "true",
      };
      if (from.value && to.value)
        Object.assign(previewPayload, {
          starts_on: from.value,
          ends_on: to.value,
        });
      try {
        previewKey = crypto.randomUUID();
        const data = await call("statement_preview", previewPayload);
        root.querySelector(".giving-statement-preview")?.remove();
        const preview = panel("Current Statement Preview");
        preview.classList.add("giving-statement-preview");
        statementContent(preview, data);
        preview.append(
          button("Generate held statement", async () => {
            const result = await call("statement_generate", {
              ...previewPayload,
              request_key: previewKey,
            });
            location.href =
              "staff-giving-statement.html?" +
              new URLSearchParams({ organization: org, id: result.id });
          }),
        );
      } catch (error) {
        root.append(E("p", error.message, { role: "alert" }));
      }
    };
    p.append(form);
    note(
      p,
      "Generation snapshots eligible posted contributions and creates a new immutable version. Nothing is sent.",
    );
    const dry = panel("Annual batch foundation");
    dry.append(
      button("Dry-run recipient count", async () => {
        const r = await call("statement_bulk_preview", {
          period: "annual",
          as_on: year.value + "-12-31",
        });
        note(
          dry,
          r.individuals +
            " individuals; " +
            r.households +
            " households. Count only; delivery HELD.",
        );
      }),
    );
    const h = panel("Statement History"),
      historyData = await call("statement_history");
    for (const row of historyData.statements) {
      const card = E("article", null, { class: "giving-statement-history" });
      card.append(
        E("h3", row.name || "Historical statement"),
        E(
          "p",
          date(row.starts_at) +
            " – " +
            date(row.ends_at) +
            " · Version " +
            row.version +
            " · Generated " +
            date(row.generated_at),
        ),
        E("p", "Delivery: " + row.delivery_status),
        E("a", "Preview / Print", {
          class: "giving-button",
          href:
            "staff-giving-statement.html?" +
            new URLSearchParams({ organization: org, id: row.id }),
        }),
      );
      h.append(card);
    }
    if (!historyData.statements.length)
      h.append(E("p", "No statement history.", { class: "giving-empty" }));
  }
  function statementContent(parent, s, historical = false) {
    currency = s.currency || currency;
    scale = s.minor_unit_scale ?? scale;
    parent.append(
      E("p", "CHAMPION LIFE · CONTRIBUTION STATEMENT", {
        class: "staff-eyebrow",
      }),
      E("h2", s.organization || "Champion Life"),
      ...(s.recipient ? [E("h3", s.recipient)] : []),
      E("p", "Date range: " + date(s.period?.starts_at) + " – " + date(s.period?.ends_at)),
      E("p", s.address || s.address_note || ""),
    );
    const itemized = Array.isArray(s.contributions);
    if (historical && !itemized) {
      parent.append(E("h3", "Historical Statement Snapshot"));
      note(parent, "This historical statement was generated before itemized line-detail snapshots were available. Its stored total is preserved.");
    } else {
      table(parent, (s.contributions || []).map((c) => ({ ...c, date: date(c.date) })),
        ["date", "donor", "designation", "amount_minor", "kind"]);
    }
    note(parent, historical
      ? "This immutable generated statement reflects the records at generation. A current preview may include later activity and show a different total."
      : "Current records as of this preview. This is not a previously generated statement and may differ from historical versions.");
    parent.append(
      E("strong", "Eligible contributions: " + money(s.total_minor ?? "0")),
    );
    if (s.fund_summary && itemized) {
      const detail = panel("Fund Summary", parent);
      table(detail, M.group(s.contributions || [], "designation"), [
        "label",
        "amount_minor",
      ]);
    }
    note(
      parent,
      s.tax_language ||
        "Configured tax language is not yet supplied. Confirm approved wording before delivery.",
    );
    note(
      parent,
      "Payment credentials and internal routing are omitted. Delivery is held.",
    );
  }
  async function render() {
    const version = ++epoch;
    root.replaceChildren();
    const head = E("div", null, { class: "giving-header" }),
      title =
        view === "pastor"
          ? "Leadership Finance"
          : view === "reports"
            ? "Reports Center"
            : view === "statements"
              ? "Donor Statements"
              : view === "statement"
                ? "Historical Generated Statement"
                : catalog.find((r) => r[0] === kind)?.[1] || "Giving Report";
    const titleBlock = E("div");
    titleBlock.append(
      E("p", "GIVING / FINANCE", { class: "staff-eyebrow" }),
      E("h1", title),
    );
    head.append(titleBlock);
    const orgSelect = field(
      head,
      "Authorized organization",
      "organization",
      org,
      (scope ? contextOrgs : [])
        .filter((r) =>
          r.permissions.includes(
            view.startsWith("statement")
              ? "finance.statements.generate"
              : "finance.reports.read",
          ),
        )
        .map((r) => [r.id, r.name]),
    );
    orgSelect.onchange = () => {
      org = orgSelect.value;
      filters = { period: "today" };
      loadedSignature = "";
      start();
    };
    root.append(head);
    const tools = E("div", null, { class: "giving-actions" });
    tools.append(button("Print / Save PDF", () => window.print()));
    if (
      ["report", "pastor"].includes(view) &&
      (can("finance.export") ||
        (can("finance.reports.export") &&
          !catalog.find((r) => r[0] === kind)?.[2]))
    )
      tools.append(
        button(
          view === "pastor" ? "Export summary CSV" : "Export CSV",
          exportReport,
        ),
      );
    root.append(tools);
    root.append(
      E(
        "p",
        "Canonical Giving records only. GiveHub remains live; processors and statement delivery are not connected.",
        { class: "giving-note" },
      ),
    );
    if (view === "statements") {
      await statements();
      return;
    }
    if (view === "statement") {
      const data = await call("statement_detail", { id: params.get("id") });
      if (version !== epoch) return;
      const p = panel("Historical Generated Statement · Version " + data.version);
      statementContent(p, data.snapshot, true);
      note(
        p,
        "Generated " +
          date(data.generated_at) +
          " · immutable version " +
          data.version,
      );
      return;
    }
    periods();
    if (view === "reports") {
      const grid = E("div", null, { class: "giving-report-catalog" });
      for (const report of catalog.filter(may)) {
        const card = E("a", null, {
          href: reportLink(report[0]),
          class: "giving-report-link",
        });
        card.append(
          E("h2", report[1]),
          E("p", "View canonical " + report[1].toLowerCase() + " →"),
        );
        grid.append(card);
      }
      root.append(grid);
      return;
    }
    if (view === "report") await reportFilters();
    const data = await call(view === "pastor" ? "dashboard" : "report", {
      report: view === "pastor" ? "summary" : kind,
      ...filters,
    });
    if (version !== epoch) return;
    currency = data.currency;
    scale = data.minor_unit_scale;
    const summary = data.summary;
    if (view === "pastor") {
      const items = [
        [
          "Today",
          money(
            data.comparisons.today?.current_minor ??
              (filters.period === "today" ? summary.net_minor : null),
          ),
          "Organization local day",
          "summary",
          { period: "today" },
        ],
        [
          "This Sunday",
          money(data.comparisons.sunday.current_minor),
          "Configured service boundary",
          "summary",
          { period: "sunday" },
        ],
        [
          "This Month",
          money(data.comparisons.month.current_minor),
          "Calendar month",
          "summary",
          { period: "month" },
        ],
        [
          "YTD",
          money(data.comparisons.ytd.current_minor),
          "Matching prior-year comparison",
          "summary",
          { period: "ytd" },
        ],
        [
          "Recurring",
          money(summary.recurring_minor),
          "Selected period",
          "recurring_mix",
        ],
        [
          "Pledged",
          money(data.leadership.pledged_minor),
          "Current commitments",
        ],
        [
          "Outstanding",
          money(data.leadership.outstanding_minor),
          "Current commitments",
        ],
        [
          "Unreconciled",
          String(data.leadership.unreconciled_batches),
          "Current batch states",
        ],
      ];
      metrics(root, items);
      fundView(root, data.funds);
      const settlement = panel("Settlement / MID summary");
      table(settlement, data.leadership.settlements, [
        "merchant",
        "mid",
        "net_minor",
      ]);
    } else
      metrics(root, [
        [
          "Gross contributions",
          money(summary.gross_minor),
          "Posted original gifts",
        ],
        [
          "Refunds",
          money(summary.refund_minor),
          "Recorded refund ledger entries",
        ],
        [
          "Adjustments",
          money(summary.adjustment_minor),
          "Reversals / correction / reclassification",
        ],
        [
          "Net Giving",
          money(summary.net_minor),
          "Gross − refunds + adjustments",
        ],
        [
          "Gift sessions",
          String(summary.gift_count),
          "Distinct sessions; manual gifts count individually",
        ],
        ["Average", money(summary.average_minor), "Net per gift session"],
        ["Recurring", money(summary.recurring_minor), "Selected period"],
        ["One-Time", money(summary.one_time_minor), "Selected period"],
      ]);
    if (kind === "parent" && data.funds?.length) fundView(root, data.funds);
    if (kind === "fund_detail") {
      const routes = panel("Recorded Merchant / Gateway / MID");
      table(routes, data.selected_routes || [], [
        "merchant",
        "gateway",
        "mid",
        "net_minor",
      ]);
    }
    const comparisons = E("div", null, { class: "giving-report-grid" });
    for (const [key, label] of [
      ["sunday", "Sunday-to-Sunday"],
      ["week", "Week-to-Week"],
      ["month", "Month-to-Month"],
      ["quarter", "Quarter-to-Quarter"],
      ["ytd", "YTD vs Prior Year"],
    ]) {
      const c = data.comparisons[key],
        p = panel(label, comparisons);
      p.append(
        E("strong", money(c.current_minor)),
        E("p", "Previous " + money(c.prior_minor)),
        E(
          "p",
          "Difference " +
            money(c.difference_minor) +
            " · " +
            (c.percent_change == null
              ? "No prior baseline"
              : c.percent_change + "%"),
        ),
      );
      note(p, date(c.period.starts_at) + " – " + date(c.period.ends_at));
    }
    root.append(comparisons);
    const charts = E("div", null, { class: "giving-report-grid" });
    chart(
      charts,
      filters.fund_id ? "Selected Fund Weekly Trend" : "Weekly Giving Trend",
      data.charts.weekly,
    );
    chart(charts, "Monthly Giving", data.charts.monthly);
    chart(charts, "Prior-Year Monthly Comparison", data.charts.prior_monthly);
    chart(charts, "Manual vs Online", data.source_breakdown, "payment");
    chart(
      charts,
      "One-Time vs Recurring",
      [
        { label: "One-Time", amount_minor: summary.one_time_minor },
        { label: "Recurring", amount_minor: summary.recurring_minor },
      ],
      "recurring_mix",
    );
    root.append(charts);
    if (kind === "pledge") {
      metrics(root, [
        [
          "Total Pledged",
          money(M.sum(data.rows, "pledged_minor")),
          "Overlapping commitments",
        ],
        [
          "Received",
          money(M.sum(data.rows, "received_minor")),
          "Recorded allocations",
        ],
        [
          "Outstanding",
          money(M.sum(data.rows, "remaining_minor")),
          "Remaining commitments",
        ],
      ]);
    }
    if (kind === "recurring") {
      const statuses = ["active", "paused", "failed", "cancelled"];
      metrics(
        root,
        statuses.map((status) => [
          status[0].toUpperCase() + status.slice(1),
          String(data.rows.filter((r) => r.status === status).length),
          "Current matching instructions",
        ]),
      );
    }
    const p = panel("Report data");
    reportTable(p, data);
    note(p, data.limitations);
    note(
      p,
      "Range " +
        date(data.period.starts_at) +
        " – " +
        date(data.period.ends_at) +
        " (end excluded) · " +
        data.period.timezone +
        ". Net ledger values include recorded refunds and transparent corrections.",
    );
  }
  let contextOrgs = [];
  async function start(force = false) {
    const request = ++sequence;
    try {
      const identity = await auth.getUser();
      if (!identity || identity.is_anonymous) {
        epoch++;
        root.replaceChildren();
        window.StaffWorkspace.denied(
          root,
          "Sign in with authorized finance access.",
        );
        return;
      }
      const res = await auth.client.rpc("giving_reports", {
        p_action: "context",
        p_org: null,
        p_payload: {},
      });
      if (request !== sequence) return;
      if (res.error) throw Error("Reporting access check failed");
      contextOrgs = res.data.organizations || [];
      const required = view.startsWith("statement")
        ? "finance.statements.generate"
        : "finance.reports.read";
      scope =
        contextOrgs.find(
          (o) => o.id === org && o.permissions.includes(required),
        ) ||
        (!org
          ? contextOrgs.find((o) => o.permissions.includes(required))
          : null);
      if (!scope) {
        epoch++;
        root.replaceChildren();
        window.StaffWorkspace.denied(
          root,
          "Your current permissions do not include this reporting section.",
        );
        window.StaffWorkspace.refresh();
        return;
      }
      org = scope.id;
      user = identity.id;
      currency = scope.currency;
      scale = scope.minor_unit_scale;
      const signature = user + org + scope.permissions.slice().sort().join("|");
      if (force && signature === loadedSignature) return;
      loadedSignature = signature;
      await render();
    } catch (e) {
      if (request !== sequence) return;
      loadedSignature = "";
      if (!root.querySelector(".staff-state")) {
        epoch++;
        root.replaceChildren();
        window.StaffWorkspace.denied(
          root,
          "Reporting unavailable. Refresh to check access again.",
        );
      }
    }
  }
  auth.client.auth.onAuthStateChange((event, session) => {
    if (session?.user?.id !== user) {
      epoch++;
      sequence++;
      root.replaceChildren();
      window.StaffWorkspace.denied(root, "Reporting access changed.");
      loadedSignature = "";
    }
    if (session?.user) setTimeout(() => start(true), 0);
  });
  window.addEventListener("focus", () => start(true));
  setInterval(() => start(true), 20000);
  start();
})();
