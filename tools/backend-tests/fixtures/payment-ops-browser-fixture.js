// Disconnected synthetic BUILD QA only. Excluded from public artifacts. No real database/provider.
(() => {
  const org = "74000000-0000-4000-8000-000000000001",
    person = "74000000-0000-4000-8000-000000000020",
    user = "74000000-0000-4000-8000-000000000010",
    issueId = "97000000-0000-4000-8000-000000000001",
    sessionId = "97000000-0000-4000-8000-000000000002",
    refundId = "97000000-0000-4000-8000-000000000003",
    methodId = "97000000-0000-4000-8000-000000000004";
  const permissions = [
    "payments.view",
    "payments.manage",
    "payments.refund.request",
    "payments.refund.approve",
    "payments.refund.execute",
    "payments.void.request",
    "payments.void.approve",
    "payments.void.execute",
    "payments.recurring.manage",
    "payments.method.manage",
    "payments.reconcile",
    "payments.issue.assign",
    "finance.export",
  ];
  const types = [
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
  const issues = types.map((issue_type, i) => ({
    id: i ? issueId.slice(0, -3) + String(i + 1).padStart(3, "0") : issueId,
    issue_type,
    status: "open",
    priority: issue_type === "payment_unknown" ? "high" : "normal",
    assigned_to: null,
    revision: 1,
    date: "2026-10-15T10:00:00Z",
    next_action:
      issue_type === "payment_unknown"
        ? "Check Provider Status — do not retry"
        : "Review payment issue",
    last_action: "Issue opened",
    session_id: sessionId,
    leg_id: "synthetic-leg",
    gateway_id: "synthetic-gateway",
    donor: "SYNTHETIC Donor",
    person_id: person,
    amount_minor: "5000",
    currency: "USD",
    provider: i % 2 ? "authorize_net" : "nmi",
    gateway: i % 2 ? "Authorize.Net Youth" : "NMI Main",
    merchant_destination: "Youth Giving",
    mid_route: "Youth",
  }));
  const session = {
    id: sessionId,
    date: "2026-10-15T10:00:00Z",
    currency: "USD",
    intended_minor: "35000",
    processed_minor: "30000",
    not_processed_minor: "5000",
    unconfirmed_minor: "0",
    status: "partial_success",
    message:
      "Part of your payment was completed. Review the amounts charged and not charged below.",
    lines: [
      {
        purpose: "charitable_contribution",
        fund: "Tithe",
        amount_minor: "20000",
        status: "captured",
      },
      {
        purpose: "charitable_contribution",
        fund: "Youth",
        amount_minor: "5000",
        status: "failed",
      },
      {
        purpose: "charitable_contribution",
        fund: "Outreach",
        amount_minor: "10000",
        status: "captured",
      },
    ],
    legs: [
      {
        id: "synthetic-main",
        provider: "nmi",
        route: "Main",
        amount_minor: "20000",
        status: "captured",
      },
      {
        id: "synthetic-youth",
        provider: "authorize_net",
        route: "Youth",
        amount_minor: "5000",
        status: "failed",
      },
      {
        id: "synthetic-outreach",
        provider: "future",
        route: "Outreach",
        amount_minor: "10000",
        status: "captured",
      },
    ],
    receipts: [
      {
        number: "SYNTHETIC-RECEIPT",
        generated_at: "2026-10-15T10:00:00Z",
        total_minor: "30000",
      },
    ],
    refunds: [
      {
        id: refundId,
        kind: "refund",
        amount_minor: "1000",
        status: "requested",
      },
    ],
  };
  const methods = [
      {
        id: methodId,
        person_id: person,
        brand: "Visa",
        last4: "1111",
        expiry_month: 12,
        expiry_year: 2026,
        status: "held",
        default: false,
        expiry_state: "Expires Soon",
      },
    ],
    detail = {
      issue: issues[0],
      session,
      attempts: [
        {
          attempt: 1,
          date: "2026-10-15T10:00:00Z",
          provider: "future",
          operation: "sale",
          result: "review",
          failure: "unknown",
          next_action: "Reconcile before retry",
        },
      ],
      observations: [
        {
          result: "settlement_mismatch",
          exception_type: "amount_mismatch",
          gross_minor: "29999",
          difference_minor: "1",
          fee_minor: null,
          net_minor: null,
          due_on: null,
        },
      ],
      settlements: [],
      refunds: [
        {
          id: refundId,
          kind: "refund",
          amount_minor: "1000",
          status: "requested",
          reason: "Synthetic review only",
          requested_by: "Synthetic requester",
          requested_at: "2026-10-15T09:30:00Z",
        },
      ],
      notes: [
        {
          body: "Internal synthetic finance note",
          actor: "Synthetic operator",
          date: "2026-10-15",
        },
      ],
      audit: [
        {
          action: "payment_ops.refund_request",
          actor: "Synthetic operator",
          date: "2026-10-15",
        },
      ],
    };
  let allowed = true,
    per = [...permissions],
    calls = [];
  const old = window.ChampionLifeAuth.client.rpc;
  window.ChampionLifeAuth.client.rpc = async (name, args = {}) => {
    if (!name.startsWith("payment_operations")) return old(name, args);
    calls.push({ name, ...args });
    const a = args.p_action;
    if (a === "context")
      return {
        data: {
          organizations: allowed
            ? [{ id: org, name: "Champion Life · SYNTHETIC", permissions: per }]
            : [],
        },
      };
    if (!allowed) return { error: { code: "42501" } };
    if (a === "options")
      return {
        data: {
          staff: [{ id: user, name: "Synthetic Finance" }],
          funds: [{ id: "synthetic-fund", name: "Youth" }],
          gateways: [{ id: "synthetic-gateway", name: "NMI Main" }],
          methods,
        },
      };
    if (a === "summary")
      return { data: Object.fromEntries(types.map((k) => [k, 1])) };
    if (["dashboard", "queue", "my_work", "export", "report"].includes(a)) {
      const p = args.p_payload || {};
      return {
        data: {
          counts: Object.fromEntries(types.map((k) => [k, 1])),
          issues: issues.filter(
            (x) => !p.issue_type || x.issue_type === p.issue_type,
          ),
          policy: {
            currency: "USD",
            retry_days: [],
            max_attempts: 3,
            expiry_horizon_days: 60,
          },
        },
      };
    }
    if (a === "methods") return { data: { methods } };
    if (a === "history")
      return { data: { sessions: [{ ...session, legs: [] }], methods } };
    if (a === "recurring_list")
      return {
        data: {
          recurring: [
            {
              id: "synthetic-recurring",
              person_id: person,
              donor: "SYNTHETIC Donor",
              currency: "USD",
              amount_minor: "5000",
              frequency: "monthly",
              next_due: "2026-11-01T10:00:00Z",
              status: "past_due",
              failure_count: 1,
              last_payment: null,
              next_action: "Update method; review safe retry",
              revision: 1,
              method: "Visa ending 1111",
              lines: [{ fund: "Youth", amount_minor: "5000", route: "Youth" }],
              changes: [],
            },
          ],
        },
      };
    if (a === "session") return { data: session };
    if (["transaction", "reconciliation", "refund_detail", "issue"].includes(a))
      return { data: detail };
    return {
      data: {
        id: args.p_payload?.id || issueId,
        status: "requested",
        execution: "held",
        message: "SYNTHETIC action recorded. No provider connected.",
      },
    };
  };
  window.__OPS_QA = {
    org,
    issueId,
    sessionId,
    refundId,
    calls,
    permissions,
    deny() {
      allowed = false;
      window.dispatchEvent(new Event("focus"));
    },
    revoke(permission) {
      per = per.filter((x) => x !== permission);
      window.dispatchEvent(new Event("focus"));
    },
  };
  document.addEventListener("DOMContentLoaded", () => {
    const p = document.createElement("p");
    p.textContent =
      "DISCONNECTED GIV-3D BUILD QA · synthetic records only · no network or financial execution";
    p.setAttribute("role", "note");
    document.querySelector("main")?.prepend(p);
  });
})();

document.addEventListener("DOMContentLoaded", () => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = "Revoke synthetic operations access";
  b.className = "giving-button";
  b.onclick = () => window.__OPS_QA.deny();
  document.querySelector("main")?.append(b);
});
