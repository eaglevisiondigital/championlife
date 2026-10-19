/* Disconnected, synthetic reports data; excluded from public build. */
(() => {
  const g = window.givingFixture;
  g.permissions.push("finance.reports.export", "finance.reports.merchant");
  const base = g.data.dashboard,
    period = { ...base.report.period, period: "today" },
    comparison = {
      period,
      current_minor: "87500",
      prior_minor: "65000",
      difference_minor: "22500",
      percent_change: "34.62",
    },
    rows = [
      {
        label: "Missions",
        parent: null,
        household: null,
        gift_count: 4,
        net_minor: "57500",
        average_minor: "14375",
        percent_of_total: "65.71",
        recurring_minor: "25000",
        one_time_minor: "32500",
      },
      {
        label: "Youth",
        gift_count: 2,
        net_minor: "30000",
        average_minor: "15000",
        percent_of_total: "34.29",
        recurring_minor: "0",
        one_time_minor: "30000",
      },
    ];
  const data = {
    report: "summary",
    currency: "USD",
    minor_unit_scale: 2,
    period,
    summary: {
      gross_minor: "88500",
      refund_minor: "1000",
      adjustment_minor: "0",
      net_minor: "87500",
      gift_count: 6,
      average_minor: "14583",
      recurring_minor: "25000",
      one_time_minor: "62500",
    },
    rows,
    charts: {
      weekly: [
        { label: "2026-10-05", amount_minor: "57500" },
        { label: "2026-10-12", amount_minor: "30000" },
      ],
      monthly: [{ label: "2026-10-01", amount_minor: "87500" }],
      prior_monthly: [{ label: "2025-10-01", amount_minor: "65000" }],
    },
    comparisons: Object.fromEntries(
      ["today", "sunday", "week", "month", "quarter", "ytd"].map((k) => [
        k,
        { ...comparison, period: { ...period, period: k } },
      ]),
    ),
    funds: base.funds,
    leadership: {
      pledged_minor: "200000",
      received_minor: "50000",
      outstanding_minor: "150000",
      unreconciled_batches: 1,
      settlements: [
        { merchant: "Main Merchant", mid: "Main MID", net_minor: null },
      ],
    },
    source_breakdown: [{ label: "Manual Cash", amount_minor: "87500" }],
    limitations:
      "Synthetic canonical-shaped fixture. First recorded donor history may be incomplete.",
  };
  const snapshot = {
    organization: "Champion Life · Synthetic",
    recipient: "Ada Synthetic",
    currency: "USD",
    minor_unit_scale: 2,
    period,
    total_minor: "12500",
    tax_language: "SYNTHETIC approved tax wording",
    fund_summary: true,
    contributions: [
      {
        date: "2026-10-09T15:00:00Z",
        donor: "Ada Synthetic",
        designation: "Missions",
        amount_minor: "12500",
        kind: "gift",
      },
    ],
  };
  const old = g.rpc || window.ChampionLifeAuth.client.rpc;
  window.ChampionLifeAuth.client.rpc = async (name, args = {}) => {
    if (name !== "giving_reports") return old(name, args);
    g.calls.push({ name, args });
    if (g.delay) await g.delay;
    if (g.deny)
      return {
        error: { code: "42501", message: "Report access denied" },
        status: 403,
      };
    const a = args.p_action;
    if (a === "context")
      return {
        data: {
          organizations: [
            {
              id: g.org,
              name: "Synthetic Church",
              currency: "USD",
              minor_unit_scale: 2,
              timezone: "America/Chicago",
              permissions: g.permissions,
            },
          ],
        },
      };
    if (a === "choices")
      return {
        data: {
          funds: g.data.funds.funds,
          people: [{ id: "person", name: "Ada Synthetic" }],
          households: [{ id: "household", name: "Synthetic Household" }],
          routes: g.data.fund_management.routing,
        },
      };
    if (a === "statement_options")
      return {
        data: {
          people: [{ id: "person", name: "Ada Synthetic" }],
          households: [{ id: "household", name: "Synthetic Household" }],
        },
      };
    if (a === "statement_history")
      return {
        data: {
          statements: g.statements || [
            {
              id: "statement",
              name: "Ada Synthetic",
              starts_at: period.starts_at,
              ends_at: period.ends_at,
              generated_at: "2026-10-11T17:00:00Z",
              version: 1,
              delivery_status: "held",
            },
          ],
        },
      };
    if (a === "statement_detail")
      return {
        data: {
          id: "statement",
          version: 1,
          generated_at: "2026-10-11T17:00:00Z",
          snapshot,
        },
      };
    if (a === "statement_preview") return { data: snapshot };
    if (a === "statement_generate")
      return { data: { id: "statement", version: 2, delivery: "HELD" } };
    if (a === "statement_bulk_preview")
      return {
        data: {
          dry_run: true,
          individuals: 1,
          households: 1,
          delivery: "HELD",
        },
      };
    const result = JSON.parse(JSON.stringify(data));
    if (args.p_payload?.period === "week") {
      result.summary.net_minor = "175000";
      result.period.period = "week";
      result.funds.forEach(
        (f) => (f.direct_minor = (BigInt(f.direct_minor) * 2n).toString()),
      );
    }
    const kind = args.p_payload?.report;
    result.report = kind || "summary";
    if (kind === "pledge")
      result.rows = [
        {
          label: "Ada Synthetic",
          fund: "Missions",
          pledged_minor: "200000",
          received_minor: "50000",
          remaining_minor: "150000",
          frequency: "monthly",
          status: "active",
        },
      ];
    if (kind === "mid")
      result.rows = [
        {
          label: "Main MID",
          merchant: "Main Merchant",
          funds: ["Missions", "Youth"],
          gift_count: 2,
          gross_minor: "87500",
          net_minor: "87500",
          fees_minor: null,
          net_settlement_minor: null,
          settlement_state: "captured",
        },
      ];
    if (["batch", "settlement", "reconciliation"].includes(kind))
      result.rows = [
        {
          label: "Synthetic Deposit",
          batch_date: "2026-10-11",
          kind: "service",
          ledger_minor: "87500",
          settlement_minor: null,
          deposit_minor: null,
          difference_minor: null,
          status: "open",
        },
      ];
    if (kind === "donor")
      result.rows = [
        {
          label: "Ada Synthetic",
          household: "Synthetic Household",
          gift_count: 6,
          net_minor: "87500",
          ytd_minor: "250000",
          last_gift: "2026-10-11T15:00:00Z",
          recurring_status: "draft",
          pledge_status: "active",
        },
      ];
    if (g.empty) {
      result.rows = [];
      result.summary = {
        gross_minor: "0",
        refund_minor: "0",
        adjustment_minor: "0",
        net_minor: "0",
        gift_count: 0,
        average_minor: null,
        recurring_minor: "0",
        one_time_minor: "0",
      };
      result.charts = { weekly: [], monthly: [], prior_monthly: [] };
      result.source_breakdown = [];
    }
    return { data: result };
  };
  g.reportData = data;
})();
