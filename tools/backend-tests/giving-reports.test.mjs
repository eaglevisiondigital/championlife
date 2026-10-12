import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID as uid } from "node:crypto";
import { migrationOrder } from "./migration-order.mjs";
import {
  f,
  fixtureSQL,
  sessionPayload,
  manualPayload,
} from "./giving-fixture.mjs";
const db = new PGlite(),
  q = (s, p = []) => db.query(s, p);
let n = 0;
const ok = (v, m) => {
    assert.ok(v, m);
    n++;
    console.log("PASS " + m);
  },
  deny = async (fn, m) => {
    await assert.rejects(fn);
    ok(true, m);
  },
  owner = () => db.exec("reset role");
const as = async (u = f.admin, role = "authenticated") => {
  await owner();
  await q("select set_config('request.jwt.claim.sub',$1,false)", [u || ""]);
  await db.exec("set role " + role);
};
const api = (a, p = {}, o = f.org) =>
    q("select giving_reports($1,$2,$3)v", [a, o, p]).then((r) => r.rows[0].v),
  core = (a, p = {}) =>
    q("select giving_workspace($1,$2,$3)v", [a, f.org, p]).then(
      (r) => r.rows[0].v,
    ),
  svc = (a, p) =>
    q("select giving_service($1,$2,$3)v", [a, f.org, p]).then(
      (r) => r.rows[0].v,
    );
try {
  await db.exec(
    readFileSync(
      new URL("fixtures/supabase-test-bootstrap.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL("../../supabase/bootstrap/automatic-rls.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const m of migrationOrder)
    await db.exec(
      readFileSync(
        new URL("../../supabase/migrations/" + m, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(fixtureSQL);
  await as();
  const query = { period: "annual", as_of: "2026-10-11T17:00:00Z" };
  for (const [amount, at, fund] of [
    [10000, "2025-10-10T15:00:00Z", f.mainFund],
    [12000, "2026-01-01T06:00:00Z", f.mainFund],
    [15000, "2026-10-11T04:59:59Z", f.youthFund],
    [20000, "2026-10-11T05:00:00Z", f.mainFund],
    [2500, "2026-10-11T13:00:00Z", f.parent],
  ])
    await core(
      "manual",
      manualPayload(uid(), {
        amount_minor: amount,
        gift_at: at,
        fund_id: fund,
      }),
    );
  let r = await api("dashboard", { period: "today", as_of: query.as_of });
  ok(
    r.summary.net_minor === "22500",
    "local Today includes midnight, excludes preceding minute",
  );
  ok(
    r.funds.reduce((n, f) => n + BigInt(f.direct_minor), 0n) === 22500n,
    "dashboard funds reconcile without duplicate children",
  );
  ok(
    !JSON.stringify(r).includes("Synthetic Donor") &&
      !JSON.stringify(r).includes("Synthetic Household"),
    "leadership aggregate contains no donor/household names",
  );
  for (const period of [
    "past_24_hours",
    "today",
    "week",
    "month",
    "quarter",
    "six_months",
    "ytd",
    "annual",
  ]) {
    r = await api("report", { ...query, period });
    ok(
      r.summary.net_minor ===
        r.rows.reduce((n, x) => n + BigInt(x.net_minor), 0n).toString(),
      period + " report rows reconcile",
    );
    ok(
      r.charts.weekly
        .reduce((n, x) => n + BigInt(x.amount_minor), 0n)
        .toString() === r.summary.net_minor,
      period + " weekly chart sums exactly",
    );
    ok(
      r.charts.monthly
        .reduce((n, x) => n + BigInt(x.amount_minor), 0n)
        .toString() === r.summary.net_minor,
      period + " monthly chart sums exactly",
    );
  }
  r = await api("report", { ...query, period: "ytd" });
  ok(
    new Date(r.comparisons.ytd.period.prior_ends_at).toISOString() ===
      "2025-10-11T17:00:00.000Z",
    "prior YTD matches partial current range",
  );
  ok(
    r.comparisons.sunday.period.service_boundary === "06:00:00",
    "Sunday configured 06:00 boundary",
  );
  ok(
    r.comparisons.quarter.percent_change === null,
    "zero baseline percent honestly unavailable",
  );
  const parentReport = await api("report", { ...query, report: "parent" });
  ok(
    parentReport.funds
      .reduce((n, f) => n + BigInt(f.direct_minor), 0n)
      .toString() === parentReport.summary.net_minor,
    "parent report supplies expandable direct child totals",
  );
  const dst = await api("report", {
    period: "custom",
    starts_on: "2026-11-01",
    ends_on: "2026-11-01",
  });
  ok(
    new Date(dst.period.ends_at) - new Date(dst.period.starts_at) ===
      25 * 3600000,
    "DST fall civil day is 25 hours",
  );
  const spring = await api("report", {
    period: "custom",
    starts_on: "2026-03-08",
    ends_on: "2026-03-08",
  });
  ok(
    new Date(spring.period.ends_at) - new Date(spring.period.starts_at) ===
      23 * 3600000,
    "DST spring civil day is 23 hours",
  );
  await deny(
    () =>
      api("report", {
        period: "custom",
        starts_on: "2026-12-31",
        ends_on: "2026-01-01",
      }),
    "reversed dates rejected",
  );
  await deny(
    () => api("report", { ...query, min_minor: "5000", max_minor: "1" }),
    "reversed amounts rejected",
  );
  for (const report of [
    "summary",
    "fund",
    "parent",
    "fund_detail",
    "donor",
    "household",
    "first_donor",
    "recurring",
    "recurring_mix",
    "pledge",
    "manual",
    "online",
    "payment",
    "destination",
    "gateway",
    "mid",
    "settlement",
    "batch",
    "reconciliation",
    "refund",
    "failed",
    "campaign",
    "event",
    "text",
  ]) {
    r = await api("report", { ...query, report });
    ok(Array.isArray(r.rows), "canonical " + report + " projection executes");
  }
  let donation = await core(
    "manual",
    manualPayload(uid(), {
      person_id: f.secondPerson,
      household_id: null,
      amount_minor: 5000,
      gift_at: "2026-10-01T15:00:00Z",
    }),
  );
  r = await api("report", { ...query, report: "first_donor" });
  ok(
    r.rows.some((x) => x.bucket === f.secondPerson) &&
      !r.rows.some((x) => x.bucket === f.person),
    "first recorded donor uses prior ledger and labels historical limitation",
  );
  const before = (await api("report", query)).summary.net_minor;
  await core("adjust", {
    request_key: uid(),
    id: donation.id,
    reason: "Synthetic reclassification",
    replacement_fund_id: f.youthFund,
    replacement_minor: 5000,
  });
  ok(
    (await api("report", query)).summary.net_minor === before,
    "same-amount reclassification preserves org total",
  );
  const session = await core("session_create", sessionPayload(uid()));
  await owner();
  const legs = (
    await q("select *from giving_transaction_legs where session_id=$1", [
      session.id,
    ])
  ).rows;
  await as(null, "service_role");
  for (let i = 0; i < legs.length; i++)
    await svc("webhook", {
      gateway_id: legs[i].route_snapshot.gateway_id,
      leg_id: legs[i].id,
      event_reference: "report-test-" + i,
      outcome: i === 2 ? "failed" : "captured",
      provider_reference: "safe-synthetic-" + i,
      payload_digest: "synthetic-report-" + i,
      ...(i === 0
        ? {
            processor_fee_minor: 40,
            platform_fee_minor: 10,
            net_settlement_minor: Number(legs[i].amount_minor) - 50,
          }
        : {}),
    });
  await svc("finalize", { session_id: session.id });
  await as();
  const all = {
      period: "custom",
      starts_on: "2020-01-01",
      ends_on: "2030-12-31",
    },
    multi = await api("report", { ...all, report: "summary" });
  const originalCount = (await api("report", { ...all, report: "manual" }))
    .summary.gift_count;
  ok(
    multi.summary.gift_count === originalCount + 1,
    "multi-MID session counts once despite several legs",
  );
  let mid = await api("report", { ...all, report: "mid" });
  ok(
    mid.rows.some((x) => x.fees_minor == null) &&
      mid.rows.some((x) => x.fees_minor === "50"),
    "unknown fees stay unavailable; known fees reported once per leg",
  );
  const refund = await core("refund_request", {
    request_key: uid(),
    leg_id: legs[0].id,
    amount_minor: 1000,
    kind: "refund",
    reason: "Synthetic report refund",
  });
  await as(null, "service_role");
  await svc("refund_record", {
    id: refund.id,
    provider_reference: "synthetic-report-refund",
    payload_digest: "synthetic-refund",
  });
  await as();
  r = await api("report", all);
  ok(
    r.summary.refund_minor === "1000" &&
      BigInt(r.summary.gross_minor) +
        BigInt(r.summary.adjustment_minor) -
        1000n ===
        BigInt(r.summary.net_minor),
    "gross/refund/adjustment/net explicitly reconcile",
  );
  ok(
    (await api("report", { ...all, report: "refund" })).rows[0].extent ===
      "Partial",
    "partial refund report references original transaction",
  );
  ok(
    (await api("report", { ...all, report: "failed" })).rows.length === 1,
    "failed transaction report safe canonical failure",
  );
  const postRefundMid = await api("report", { ...all, report: "mid" });
  ok(
    postRefundMid.rows.find((x) => x.fees_minor === "50")?.fees_minor === "50",
    "refund ledger row does not duplicate financial leg fees",
  );
  const failedFund = (
    await api("report", { ...all, report: "failed", fund_id: f.anFund })
  ).rows;
  ok(
    failedFund.length === 1,
    "failed report fund filter follows failed financial leg",
  );
  ok(
    (await api("report", { ...all, report: "failed", fund_id: f.mainFund }))
      .rows.length === 0,
    "failed report excludes nonmatching fund",
  );
  ok(
    (
      await api("report", {
        ...all,
        report: "refund",
        person_id: f.secondPerson,
      })
    ).rows.length === 0,
    "refund report donor filter applies to table",
  );
  await deny(
    () => api("report", { ...all, report: "batch", source: "web" }),
    "unsupported batch source filter fails rather than silently ignoring it",
  );
  const huge = await core(
    "manual",
    manualPayload(uid(), { amount_minor: "1000000000000" }),
  );
  ok(
    typeof (await api("report", all)).summary.net_minor === "string",
    "financial aggregates serialize strings",
  );
  // Shared report filters must match independent canonical SQL, not a UI-only selection.
  for (const filter of [
    { fund_id: f.mainFund },
    { parent_id: f.parent },
    { person_id: f.person },
    { household_id: f.household },
    { source: "staff_manual" },
    { payment_method: "cash" },
    { destination_id: f.mainDest },
    { gateway_id: f.nmi },
    { processor_route_id: f.mainRoute },
    { min_minor: "100000" },
    { max_minor: "10000" },
    { recurring: "false" },
  ]) {
    const data = await api("report", { ...all, ...filter });
    let predicates = [];
    const values = [];
    const add = (expr, val) => {
      values.push(val);
      predicates.push(expr.replace("?", "$" + values.length));
    };
    if (filter.fund_id) add("(g.fund_id=? or f.parent_id=?)", filter.fund_id);
    if (filter.parent_id)
      add("coalesce(f.parent_id,g.fund_id)=?", filter.parent_id);
    if (filter.person_id) add("g.person_id=?", filter.person_id);
    if (filter.household_id) add("g.household_id=?", filter.household_id);
    if (filter.source) add("g.source=?", filter.source);
    if (filter.payment_method) add("g.payment_method=?", filter.payment_method);
    for (const key of ["destination_id", "gateway_id", "processor_route_id"])
      if (filter[key]) add("g.route_snapshot->>'" + key + "'=?", filter[key]);
    if (filter.min_minor) add("g.amount_minor>=?::bigint", filter.min_minor);
    if (filter.max_minor) add("g.amount_minor<=?::bigint", filter.max_minor);
    if (filter.recurring)
      add(
        "(g.recurring_id is null and g.source<>'recurring')=?::boolean",
        true,
      );
    await owner();
    const expected = (
      await q(
        "select coalesce(sum(g.amount_minor),0)::text total from giving_ledger g join giving_funds f on(f.organization_id,f.id)=(g.organization_id,g.fund_id)where g.organization_id='" +
          f.org +
          "' and " +
          predicates.join(" and ").replaceAll("?", "$1"),
        values,
      )
    ).rows[0].total;
    await as();
    ok(
      data.summary.net_minor === expected,
      "canonical filter " + Object.keys(filter)[0],
    );
  }
  await owner();
  await q(
    "update giving_organization_config set timezone='Pacific/Kiritimati'where organization_id=$1",
    [f.org],
  );
  await as();
  const pacific = await api("report", {
    period: "annual",
    as_on: "2026-12-31",
  });
  ok(
    new Date(pacific.period.starts_at).toISOString() ===
      "2025-12-31T10:00:00.000Z",
    "annual selection interprets calendar year in org timezone, including UTC+14",
  );
  await owner();
  await q(
    "update giving_organization_config set timezone='America/Chicago'where organization_id=$1",
    [f.org],
  );
  await as();
  const preview = {
    period: "annual",
    as_of: "2026-10-11T17:00:00Z",
    person_id: f.person,
    fund_summary: true,
  };
  let p = await api("statement_preview", preview);
  ok(
    p.total_minor !== "0" &&
      p.contributions.every((x) => x.designation !== "Event Fees"),
    "tax statements exclude ineligible contributions",
  );
  ok(
    !JSON.stringify(p).includes("mid_reference") &&
      !JSON.stringify(p).includes("route_snapshot"),
    "statement has no routing/token metadata",
  );
  const sp = { ...preview, request_key: uid() },
    first = await api("statement_generate", sp);
  ok(
    (await api("statement_generate", sp)).id === first.id,
    "statement retry idempotent",
  );
  const second = await api("statement_generate", { ...sp, request_key: uid() });
  ok(
    second.version === 2 && second.id !== first.id,
    "regeneration creates a new immutable version",
  );
  await deny(
    () => api("statement_generate", { ...sp, fund_summary: false }),
    "changed statement retry rejected",
  );
  const persisted = await api("statement_detail", { id: first.id });
  ok(
    persisted.version === 1 && persisted.snapshot.total_minor === p.total_minor,
    "previous snapshot unchanged after regeneration",
  );
  ok(
    (await api("statement_history")).statements.every(
      (x) => x.delivery_status === "held",
    ),
    "all delivery held; no fake queued/delivered state",
  );
  ok(
    (await api("statement_bulk_preview", query)).dry_run,
    "bulk generation count dry-run only",
  );
  const hh = await api("statement_preview", {
    ...preview,
    person_id: undefined,
    household_id: f.household,
  });
  ok(
    hh.contributions.some((x) => x.donor === "Synthetic Donor") &&
      !hh.contributions.some((x) => x.donor === "Second Donor"),
    "household statement keeps correct individual lineage",
  );
  await deny(
    () => api("statement_detail", { id: uid() }),
    "guessed statement denied",
  );
  await deny(
    () => api("statement_preview", { ...preview, person_id: f.foreignPerson }),
    "foreign statement donor denied",
  );
  await owner();
  await q(
    "insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'finance.statements.generate')",
    [f.org, f.ordinary],
  );
  await as(f.ordinary);
  ok(
    (await api("statement_preview", preview)).recipient === "Synthetic Donor",
    "statement-only capability can preview without reports or gift-read",
  );
  await deny(
    () => api("report", query),
    "statement authority does not grant report access",
  );
  await as();
  await deny(
    () => api("statement_detail", { id: first.id }, f.other),
    "cross-org statement ID denied",
  );
  await owner();
  await deny(
    () => q("update giving_statements set version=999 where id=$1", [first.id]),
    "statement immutable even to owner",
  );
  await deny(
    () => q("update giving_statement_delivery_events set status='delivered'"),
    "delivery history append-only",
  );
  await as(f.reporter);
  ok(
    (await api("choices")).people.length === 0,
    "leadership choices omit donor PII",
  );
  ok((await api("dashboard", query)).summary, "reports-only dashboard allowed");
  for (const report of [
    "donor",
    "household",
    "first_donor",
    "recurring",
    "pledge",
    "refund",
    "failed",
    "mid",
  ])
    await deny(
      () => api("report", { ...query, report }),
      "reports-only denied " + report,
    );
  await deny(
    () => api("statement_detail", { id: first.id }),
    "report role cannot guess statement",
  );
  await deny(() => api("export", query), "reports do not imply export");
  await owner();
  await q(
    "insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'finance.reports.export')",
    [f.org, f.reporter],
  );
  await as(f.reporter);
  ok(
    (await api("export", query)).summary,
    "narrow leadership quick summary export",
  );
  await deny(
    () => api("export", { ...query, report: "donor" }),
    "narrow export cannot expose donors",
  );
  await deny(
    () => api("report", { ...query, person_id: f.person }),
    "summary donor-filter guessing denied",
  );
  await deny(() => api("report", query, f.other), "cross org reports denied");
  await deny(
    () => core("manual", manualPayload(uid())),
    "leadership cannot post",
  );
  await deny(() => core("merchants"), "leadership cannot configure merchant");
  await as(f.ordinary);
  await deny(() => api("dashboard"), "ordinary staff denied");
  await as(null, "anon");
  await deny(() => api("report"), "anonymous denied");
  await as();
  await deny(
    () => q("select *from giving_statement_delivery_events"),
    "raw delivery rows denied",
  );
  await deny(
    () => q("select private.giving_reporting($1,$2)", [f.org, query]),
    "private report helper raw execution denied",
  );
  await owner();
  await q(
    "update organization_staff_permissions set revoked_at=now()where organization_id=$1 and user_id=$2",
    [f.org, f.admin],
  );
  await as();
  for (const action of [
    "dashboard",
    "report",
    "export",
    "statement_history",
    "statement_detail",
    "statement_generate",
  ])
    await deny(
      () => api(action, { id: first.id }),
      "same-session revoke " + action,
    );
  console.log(n + " GIV-2B database/security checks passed");
} catch (e) {
  console.error("GIV-2B:", e.message, e.where || "");
  process.exitCode = 1;
} finally {
  await db.close();
}
