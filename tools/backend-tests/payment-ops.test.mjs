import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID as uid } from "node:crypto";
import { migrationOrder } from "./migration-order.mjs";
import { f, paymentsFixtureSQL, checkout } from "./payments-fixture.mjs";
const db = new PGlite(),
  q = (s, p = []) => db.query(s, p);
let n = 0;
const ok = (v, m) => {
    assert.ok(v, m);
    console.log("PASS " + m);
    n++;
  },
  deny = async (fn, m) => {
    await assert.rejects(fn);
    ok(true, m);
  },
  owner = () => db.exec("reset role"),
  as = async (u = f.admin, role = "authenticated") => {
    await owner();
    await q("select set_config('request.jwt.claim.sub',$1,false)", [u || ""]);
    await db.exec("set role " + role);
  },
  rpc = (a, p = {}, o = f.org) =>
    q("select payment_operations($1,$2,$3)v", [a, o, p]).then(
      (r) => r.rows[0].v,
    ),
  svc = (a, p = {}, o = f.org) =>
    q("select payment_operations_service($1,$2,$3)v", [a, o, p]).then(
      (r) => r.rows[0].v,
    ),
  donor = (a, p = {}, o = f.org) =>
    q("select payment_operations_donor($1,$2,$3)v", [a, o, p]).then(
      (r) => r.rows[0].v,
    ),
  rows = async () => (await rpc("queue")).issues;
try {
  for (const file of [
    "fixtures/supabase-test-bootstrap.sql",
    "../../supabase/bootstrap/automatic-rls.sql",
    ...migrationOrder.map((m) => "../../supabase/migrations/" + m),
  ])
    await db.exec(readFileSync(new URL(file, import.meta.url), "utf8"));
  await db.exec(
    paymentsFixtureSQL +
      `insert into organization_staff_permissions(organization_id,user_id,permission)select '${f.org}','${f.admin}',k from unnest(private.payment_ops_permissions())k on conflict do nothing;insert into organization_staff_permissions(organization_id,user_id,permission)values('${f.org}','${f.reader}','payments.refund.approve'),('${f.org}','${f.reader}','payments.void.approve'),('${f.org}','${f.reader}','payments.issue.assign');`,
  );
  await as(null, "anon");
  await deny(() => rpc("context"), "anonymous operations denied");
  await deny(
    () => svc("observe", { request_key: uid() }),
    "anonymous service denied",
  );
  await as(f.admin);
  await deny(
    () => svc("observe", { request_key: uid() }),
    "staff cannot inject normalized observations",
  );
  await as(f.reporter);
  ok(typeof (await rpc("summary")) === "object", "Pastor safe summary");
  await deny(() => rpc("queue"), "Pastor cannot read donor operations");
  await deny(
    () => rpc("refund_request", { request_key: uid() }),
    "Pastor cannot request refund",
  );
  await as();
  ok(
    (await rpc("context")).organizations.some((x) => x.id === f.org),
    "current finance context",
  );
  await deny(() => rpc("queue", {}, f.other), "cross-org queue denied");
  const session = (
    await q("select payments_workspace($1,$2,$3)v", [
      "checkout_prepare",
      f.org,
      checkout(uid()),
    ])
  ).rows[0].v;
  const sessionId = session.id || session.session?.id;
  assert.ok(sessionId, JSON.stringify(session));
  await owner();
  const legs = (
    await q(
      "select id,amount_minor::text from giving_transaction_legs where session_id=$1 order by amount_minor::bigint desc",
      [sessionId],
    )
  ).rows;
  const leg = legs[0].id,
    voidLeg = legs[1].id;
  await q(
    "update giving_transaction_legs set status=case when id=$1 then 'authorized'else 'captured'end where session_id=$2",
    [voidLeg, sessionId],
  );
  await as(null, "service_role");
  const observe = async (result, failure_category, extra = {}) =>
    svc("observe", {
      request_key: uid(),
      source_key: "synthetic:" + uid(),
      leg_id: leg,
      result,
      ...(failure_category ? { failure_category } : {}),
      ...extra,
    });
  await observe("unknown", "unknown");
  await as();
  let issue = (await rows()).find((x) => x.issue_type === "payment_unknown");
  ok(issue, "canonical unknown creates issue");
  await deny(
    () => rpc("retry", { request_key: uid(), id: issue.id }),
    "unknown charge cannot retry",
  );
  const lookup = await rpc("lookup", { request_key: uid(), id: issue.id });
  ok(
    lookup.execution === "held",
    "Check Provider Status holds without network",
  );
  await deny(
    () =>
      rpc("resolve", {
        request_key: uid(),
        id: issue.id,
        revision: issue.revision,
        resolution_type: "resolved",
        reason: "Unverified conclusion",
      }),
    "unknown closure requires provider proof",
  );
  await as(null, "service_role");
  await observe("not_found");
  await as();
  const retryPayload = { request_key: uid(), id: issue.id };
  const retry = await rpc("retry", retryPayload);
  ok(
    retry.execution === "held",
    "reconciled not found permits only held explicit retry",
  );
  ok(
    (await rpc("retry", retryPayload)).id === retry.id,
    "retry exact replay idempotent",
  );
  await deny(
    () => rpc("retry", { ...retryPayload, reason: "Changed content" }),
    "retry changed replay denied",
  );
  await as(null, "service_role");
  await observe("failed", "fraud_review");
  await as();
  issue = (await rows()).find((x) => x.issue_type === "manual_review");
  ok(issue, "fraud creates manual review");
  await deny(
    () => rpc("retry", { request_key: uid(), id: issue.id }),
    "fraud no retry",
  );
  await as(null, "service_role");
  await observe("failed", "duplicate");
  await as();
  ok(
    (await rows()).some((x) => x.issue_type === "duplicate_review"),
    "duplicate review queue",
  );
  const refundPayload = {
    request_key: uid(),
    leg_id: leg,
    amount_minor: "100",
    reason: "Synthetic duplicate donation",
  };
  let refund = await rpc("refund_request", refundPayload);
  ok(refund.execution === "held", "refund canonical request held");
  ok(
    (await rpc("refund_request", refundPayload)).id === refund.id,
    "refund request retry unique",
  );
  await deny(
    () => rpc("refund_request", { ...refundPayload, amount_minor: "101" }),
    "changed refund replay denied",
  );
  await deny(
    () =>
      rpc("refund_request", {
        ...refundPayload,
        request_key: uid(),
        amount_minor: "999999",
      }),
    "refund remaining principal bounds",
  );
  await deny(
    () =>
      rpc("refund_request", {
        ...refundPayload,
        request_key: uid(),
        amount_minor: 100,
      }),
    "refund rejects JSON numeric money",
  );
  await deny(
    () =>
      rpc("refund_approve", {
        request_key: uid(),
        id: refund.id,
        reason: "Self approval denied",
      }),
    "default self approval denied",
  );
  await deny(
    () =>
      rpc("refund_execute", {
        request_key: uid(),
        id: refund.id,
        reason: "No approval yet",
      }),
    "execution requires approval",
  );
  await as(f.reader);
  let approve = {
    request_key: uid(),
    id: refund.id,
    reason: "Independent finance review",
  };
  ok(
    (await rpc("refund_approve", approve)).status === "approved",
    "maker checker approval",
  );
  ok(
    (await rpc("refund_approve", approve)).status === "approved",
    "approval exact replay unique",
  );
  await deny(
    () => rpc("refund_approve", { ...approve, request_key: uid() }),
    "second approval transition denied",
  );
  await deny(
    () =>
      rpc("refund_execute", {
        request_key: uid(),
        id: refund.id,
        reason: "Reader has no execution",
      }),
    "approver cannot execute without separate key",
  );
  await as();
  ok(
    (
      await rpc("refund_execute", {
        request_key: uid(),
        id: refund.id,
        reason: "Queue held execution request",
      })
    ).status === "execution_pending",
    "approved execution pending no provider",
  );
  let voidRequest = await rpc("void_request", {
    request_key: uid(),
    leg_id: voidLeg,
    amount_minor: legs[1].amount_minor,
    reason: "Unsettled authorization cancellation",
  });
  await as(f.reader);
  ok(
    (
      await rpc("void_approve", {
        request_key: uid(),
        id: voidRequest.id,
        reason: "Independent authorization review",
      })
    ).status === "approved",
    "void separate approval",
  );
  await as();
  await deny(
    () =>
      rpc("void_request", {
        request_key: uid(),
        leg_id: leg,
        amount_minor: legs[0].amount_minor,
        reason: "Captured cannot void",
      }),
    "captured void prohibited",
  );
  ok(
    (
      await rpc("void_execute", {
        request_key: uid(),
        id: voidRequest.id,
        reason: "Queue held void request",
      })
    ).execution === "held",
    "void request cannot execute payment",
  );
  await owner();
  const snap = (
    await q(
      "select route_snapshot from private.payment_ops_approvals where refund_id=$1",
      [refund.id],
    )
  ).rows[0].route_snapshot;
  await q(
    "update giving_destinations set merchant_label='Changed current route' where id=$1",
    [f.mainDest],
  );
  ok(
    snap.gateway_id === f.nmi && snap.processor_route_id === f.mainRoute,
    "adjustments retain historical routing",
  );
  await as();
  issue = (await rows()).find((x) => x.issue_type === "provider_configuration");
  let claim = { request_key: uid(), id: issue.id, revision: issue.revision };
  ok((await rpc("claim", claim)).claimed, "issue assignment first transition");
  await as(f.reader);
  ok(
    !(
      await rpc("claim", {
        request_key: uid(),
        id: issue.id,
        revision: issue.revision,
      })
    ).claimed,
    "second staff cannot claim same issue",
  );
  await as();
  await deny(
    () =>
      rpc("assign", {
        request_key: uid(),
        id: issue.id,
        revision: issue.revision,
        assigned_to: f.admin,
      }),
    "stale issue revision denied",
  );
  await rpc("note", {
    request_key: uid(),
    id: issue.id,
    reason: "Internal finance review only",
  });
  await deny(
    () =>
      rpc("note", {
        request_key: uid(),
        id: issue.id,
        reason: "password=do-not-store",
      }),
    "notes reject secret labels",
  );
  await deny(
    () =>
      rpc("note", {
        request_key: uid(),
        id: issue.id,
        reason: "4111111111111111",
      }),
    "notes reject PAN shape",
  );
  ok(
    (await rpc("task_hook", { request_key: uid(), id: issue.id })).task_hook ===
      "held",
    "canonical work integration intent held no unsolicited tasks",
  );
  await as(null, "service_role");
  await observe("settlement_mismatch", null, {
    exception_type: "amount_mismatch",
    gross_minor: "20001",
  });
  await as();
  issue = (await rows()).find((x) => x.issue_type === "settlement_mismatch");
  const detail = await rpc("reconciliation", { id: issue.id });
  ok(
    detail.observations.some(
      (x) => x.fee_minor === null && x.net_minor === null,
    ),
    "unknown fees/net stay null",
  );
  let resolution = {
    request_key: uid(),
    id: issue.id,
    revision: issue.revision,
    resolution_type: "difference",
    reason: "Bank amount differs from canonical amount",
  };
  await rpc("reconcile", resolution);
  ok(
    (await rpc("reconcile", resolution)).resolution === "difference",
    "reconciliation retry idempotent",
  );
  await deny(
    () => rpc("reconcile", { ...resolution, request_key: uid() }),
    "second reconciliation transition blocked",
  );
  await as(null, "service_role");
  await observe("chargeback", null, { due_on: "2026-12-01" });
  await as();
  ok(
    (await rows()).some((x) => x.issue_type === "chargeback"),
    "chargeback queue foundation",
  );
  ok(
    (await rpc("queue", { provider: "nmi" })).issues.every(
      (x) => x.provider === "nmi",
    ),
    "queue provider filter",
  );
  ok(
    (await rpc("queue", { min_minor: "30000" })).issues.every(
      (x) => BigInt(x.amount_minor || "0") >= 30000n,
    ),
    "queue exact amount filter",
  );
  ok(
    (await rpc("queue", { search: "Synthetic" })).issues.length > 0,
    "safe donor search",
  );
  await as(null, "service_role");
  await observe("paid");
  await as();
  const s = await rpc("session", { id: sessionId });
  ok(s.intended_minor === "38500", "session retains canonical total");
  await owner();
  ok(
    (await q("select status from giving_transaction_legs where id=$1", [leg]))
      .rows[0].status === "captured",
    "lookup cannot promote financial truth",
  );
  await as(f.donor);
  const dh = await donor("history");
  ok(
    !JSON.stringify(dh).includes("gateway_id") &&
      !JSON.stringify(dh).includes("mid_route") &&
      !JSON.stringify(dh).includes("Internal finance"),
    "donor projection excludes internal metadata",
  );
  await as(f.otherDonor);
  await deny(() => donor("history"), "unreviewed donor mapping denied");
  await as(f.donor);
  await deny(
    () => donor("session", { id: uid() }),
    "guessed donor session denied",
  );
  await owner();
  ok(
    (await q("select private.payment_ops_expiry(2,2028)::text d")).rows[0].d ===
      "2028-02-29",
    "expiry leap year end of month",
  );
  ok(
    (await q("select private.payment_ops_expiry(10,2026)::text d")).rows[0]
      .d === "2026-10-31",
    "expiry includes entire expiry month",
  );
  await as();
  const recurring = (
    await q("select giving_workspace('recurring_create',$1,$2)v", [
      f.org,
      {
        request_key: uid(),
        person_id: f.person,
        currency: "USD",
        frequency: "monthly",
        starts_on: "2026-10-01",
        next_run_at: "2026-11-01T10:00:00Z",
        lines: [{ fund_id: f.mainFund, amount_minor: 1000 }],
      },
    ])
  ).rows[0].v;
  const rid = recurring.id;
  await rpc("recurring_list");
  let rec = (await rpc("recurring_list")).recurring.find((x) => x.id === rid);
  ok(rec, "recurring operational view canonical parent");
  await rpc("recurring_pause", {
    request_key: uid(),
    id: rid,
    revision: rec.revision,
  });
  await deny(
    () =>
      rpc("recurring_resume", {
        request_key: uid(),
        id: rid,
        revision: rec.revision + 1,
      }),
    "resume requires valid current method",
  );
  let change = {
    request_key: uid(),
    id: rid,
    revision: rec.revision + 1,
    effective_on: "2027-01-01",
    authorization_reference: "Synthetic reviewed donor authorization",
    lines: [{ fund_id: f.youthFund, amount_minor: "1500" }],
  };
  ok(
    (await rpc("recurring_change", change)).execution === "held",
    "future amount/fund changes hold with authorization",
  );
  await owner();
  ok(
    (
      await q(
        "select amount_minor::text from giving_recurring_lines where instruction_id=$1",
        [rid],
      )
    ).rows[0].amount_minor === "1000",
    "future change preserves original designation/principal",
  );
  await as(null, "service_role");
  await svc("recurring_failure", {
    request_key: uid(),
    id: rid,
    failure_category: "unknown",
  });
  await as();
  await deny(
    async () =>
      rpc("recurring_retry", {
        request_key: uid(),
        id: rid,
        revision: (await rpc("recurring_list")).recurring.find(
          (x) => x.id === rid,
        ).revision,
      }),
    "unknown recurring failure never retries",
  );
  await rpc("policy", {
    request_key: uid(),
    refund_approval_required: true,
    void_approval_required: true,
    refund_threshold_minor: "20000",
    currency: "USD",
    self_approval: false,
    retry_days: [1, 3],
    max_attempts: 3,
    expiry_horizon_days: 60,
  });
  await as(null, "service_role");
  await svc("recurring_failure", {
    request_key: uid(),
    id: rid,
    failure_category: "declined",
  });
  await owner();
  ok(
    (
      await q(
        "select count(*)::int n from private.payment_ops_jobs where instruction_id=$1 and kind='recurring_retry'",
        [rid],
      )
    ).rows[0].n === 1,
    "configured recurring retry creates held schedule",
  );
  await as(null, "service_role");
  await svc("recurring_failure", {
    request_key: uid(),
    id: rid,
    failure_category: "declined",
  });
  await as();
  ok(
    (await rpc("recurring_list")).recurring.find((x) => x.id === rid).status ===
      "review",
    "retry limit moves recurring to manual review",
  );
  // Service lease claims have no provider side effect; stale ambiguous retry cannot be recharged.
  await as(null, "service_role");
  const leaseKey = { request_key: uid(), id: lookup.id };
  let claimed = await svc("claim", leaseKey);
  ok(claimed.claimed, "lookup work lease claim");
  ok(
    !(await svc("claim", { request_key: uid(), id: lookup.id })).claimed,
    "one held work lease",
  );
  await owner();
  await q(
    "update private.payment_ops_jobs set lease_until=now()-interval '1 second'where id=$1",
    [lookup.id],
  );
  await as(null, "service_role");
  ok(
    !(await svc("claim", leaseKey)).claimed,
    "expired claim replay does not return a usable stale token",
  );
  ok(
    (await svc("recover", { request_key: uid(), id: lookup.id })).execution ===
      "held",
    "expired lookup lease safely recoverable",
  );
  await deny(
    () => svc("claim", { request_key: uid(), id: retry.id }),
    "queued retry rechecks latest ambiguity before lease",
  );
  const original = (
    await q("select payments_service('operation_prepare',$1,$2)v", [
      f.org,
      {
        request_key: uid(),
        leg_id: leg,
        operation: "sale",
        amount_minor: legs[0].amount_minor,
      },
    ])
  ).rows[0].v;
  const originalLease = (
    await q("select payments_service('operation_claim',$1,$2)v", [
      f.org,
      { id: original.id },
    ])
  ).rows[0].v;
  await owner();
  await q(
    "update private.payments_operations set lease_created_at=now()-interval '6 minutes'where id=$1",
    [original.id],
  );
  await as(null, "service_role");
  await svc("recover_provider", { request_key: uid(), id: original.id });
  ok(
    !(
      await q("select payments_service('operation_claim',$1,$2)v", [
        f.org,
        { id: original.id },
      ])
    ).rows[0].v.claimed,
    "stale provider operation cannot be reclaimed by legacy charge worker",
  );
  await owner();
  const retained = (
    await q(
      "select lease_token::text,status from private.payments_operations where id=$1",
      [original.id],
    )
  ).rows[0];
  ok(
    retained.lease_token === originalLease.lease_token &&
      retained.status === "review",
    "provider recovery retains original lease and history",
  );
  await as(null, "service_role");
  await deny(
    () => svc("refund_completed", { request_key: uid(), id: uid() }),
    "refund notice requires existing verified canonical financial outcome",
  );
  await as();
  for (const permission of [
    "payments.manage",
    "payments.refund.request",
    "payments.refund.approve",
    "payments.refund.execute",
    "payments.void.request",
    "payments.void.approve",
    "payments.void.execute",
    "payments.method.manage",
    "payments.recurring.manage",
    "payments.reconcile",
    "payments.issue.assign",
  ]) {
    await owner();
    await q(
      "update organization_staff_permissions set revoked_at=now()where organization_id=$1 and user_id=$2 and permission=$3",
      [f.org, f.admin, permission],
    );
    await as();
    const action = {
      "payments.manage": "note",
      "payments.refund.request": "refund_request",
      "payments.refund.approve": "refund_approve",
      "payments.refund.execute": "refund_execute",
      "payments.void.request": "void_request",
      "payments.void.approve": "void_approve",
      "payments.void.execute": "void_execute",
      "payments.method.manage": "method_remove",
      "payments.recurring.manage": "recurring_pause",
      "payments.reconcile": "reconcile",
      "payments.issue.assign": "claim",
    }[permission];
    await deny(
      () => rpc(action, { request_key: uid(), id: issue.id }),
      "same-session revocation " + permission,
    );
    await owner();
    await q(
      "update organization_staff_permissions set revoked_at=null where organization_id=$1 and user_id=$2 and permission=$3",
      [f.org, f.admin, permission],
    );
    await as();
  }

  await as(null, "service_role");
  const method = (
    await q("select payments_service('synthetic_method_attach',$1,$2)v", [
      f.org,
      {
        person_id: f.person,
        gateway_id: f.nmi,
        route_ids: [f.mainRoute],
        customer_reference: "synth:ops-customer",
        payment_reference: "synth:ops-method",
        brand: "Visa",
        last4: "1111",
        expiry_month: 12,
        expiry_year: 2099,
      },
    ])
  ).rows[0].v;
  await owner();
  await q("update private.payments_methods set status='active'where id=$1", [
    method.id,
  ]);
  await q(
    "update private.giving_payment_profiles set active=true,reference_status='active'where logical_method_id=$1",
    [method.id],
  );
  await as();
  const rec2 = (
    await q("select giving_workspace('recurring_create',$1,$2)v", [
      f.org,
      {
        request_key: uid(),
        person_id: f.person,
        currency: "USD",
        frequency: "monthly",
        starts_on: "2026-10-01",
        next_run_at: "2026-11-01T10:00:00Z",
        lines: [{ fund_id: f.mainFund, amount_minor: 1000 }],
      },
    ])
  ).rows[0].v;
  await rpc("recurring_list");
  await rpc("recurring_method", {
    request_key: uid(),
    id: rec2.id,
    revision: 1,
    method_id: method.id,
  });
  ok(
    (
      await rpc("recurring_resume", {
        request_key: uid(),
        id: rec2.id,
        revision: 2,
      })
    ).execution === "held",
    "reviewed compatible method resumes operational instruction, execution held",
  );
  await owner();
  ok(
    (
      await q("select status from giving_recurring_instructions where id=$1", [
        rec2.id,
      ])
    ).rows[0].status === "active",
    "reviewed resume restores canonical future schedule state, provider gates remain held",
  );
  await as(f.donor);
  ok(
    (await donor("method_default", { request_key: uid(), id: method.id }))
      .id === method.id,
    "owner selects default logical method",
  );
  ok(
    (await donor("history")).methods.filter((m) => m.id === method.id)
      .length === 1,
    "one logical method instead of duplicated gateway entries",
  );
  await deny(
    () => donor("method_remove", { request_key: uid(), id: method.id }),
    "active recurring method cannot be removed",
  );
  await deny(
    () =>
      q("select payments_donor('method_remove',$1,$2)", [
        f.org,
        { id: method.id },
      ]),
    "legacy donor remove cannot bypass recurring constraint",
  );
  ok(
    (await donor("method_replace", { request_key: uid(), id: method.id }))
      .status === "held",
    "method replacement uses disabled hosted-entry foundation",
  );
  await as();
  await rpc("recurring_cancel", {
    request_key: uid(),
    id: rec2.id,
    revision: 3,
  });
  await as(f.donor);
  ok(
    (await donor("method_remove", { request_key: uid(), id: method.id }))
      .execution === "held",
    "cancelled recurring allows logical method removal",
  );
  const addPayload = { request_key: uid() };
  const addResult = await donor("method_add", addPayload);
  ok(
    JSON.stringify(await donor("method_add", addPayload)) ===
      JSON.stringify(addResult),
    "donor held add replay retains owner-bound idempotency without invented method ID",
  );
  await as();
  const rejected = await rpc("refund_request", {
    request_key: uid(),
    leg_id: leg,
    amount_minor: "50",
    reason: "Synthetic rejected adjustment",
  });
  await as(f.reader);
  ok(
    (
      await rpc("refund_reject", {
        request_key: uid(),
        id: rejected.id,
        reason: "Request withdrawn after review",
      })
    ).status === "rejected",
    "rejection retained as canonical rejected state",
  );
  await as();
  await deny(
    () =>
      rpc("refund_execute", {
        request_key: uid(),
        id: rejected.id,
        reason: "Rejected cannot execute",
      }),
    "rejected adjustment cannot execute",
  );
  const beforeExpiry = (await rpc("options")).methods;
  ok(Array.isArray(beforeExpiry), "staff options are safe canonical choices");
  await rpc("incident", {
    request_key: uid(),
    id: f.nmi,
    status: "unavailable",
    reason: "Synthetic provider outage",
  });
  await deny(
    () =>
      q("select payments_workspace('checkout_prepare',$1,$2)", [
        f.org,
        checkout(uid()),
      ]),
    "provider outage checkout fails closed",
  );
  await rpc("incident", {
    request_key: uid(),
    id: f.nmi,
    status: "healthy",
    reason: "Synthetic outage cleared",
  });
  const unknownKey = {
    request_key: uid(),
    source_key: "synthetic-idempotent-observation",
    leg_id: leg,
    result: "still_pending",
  };
  await as(null, "service_role");
  const obs = await svc("observe", unknownKey);
  ok(
    (await svc("observe", unknownKey)).id === obs.id,
    "normalized observation replay idempotent",
  );
  await deny(
    () => svc("observe", { ...unknownKey, result: "paid" }),
    "normalized changed replay denied",
  );
  await as();
  const currentUnknown = (await rows()).find(
    (x) => x.issue_type === "payment_unknown",
  );
  await deny(
    () =>
      rpc("resolve", {
        request_key: uid(),
        id: currentUnknown.id,
        revision: currentUnknown.revision,
        resolution_type: "resolved",
        reason: "Older observations do not settle current uncertainty",
      }),
    "unknown resolution uses latest evidence rather than old paid/failed result",
  );
  ok(
    (await rpc("export")).issues.every(
      (x) => !("provider_payment_reference" in x),
    ),
    "operational export excludes tokens",
  );
  await owner();
  ok(
    (
      await q(
        "select bool_and(relrowsecurity)v from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'and c.relname like 'payment_ops_%'and c.relkind='r'",
      )
    ).rows[0].v,
    "local schema advisor: all operations tables RLS",
  );
  const tables = (
    await q(
      "select tablename from pg_tables where schemaname='private'and tablename like 'payment_ops_%'",
    )
  ).rows;
  for (const { tablename } of tables) {
    for (const role of ["anon", "authenticated", "service_role"]) {
      await as(null, role);
      await deny(
        () => q("select * from private." + tablename),
        "raw " + role + " denied " + tablename,
      );
    }
  }
  await owner();
  ok(
    (await q("select count(*)::int n from giving_ledger")).rows[0].n === 0,
    "zero new financial posting",
  );
  ok(
    (
      await q(
        "select bool_and(delivery_state='held')v from private.payment_ops_events",
      )
    ).rows[0].v,
    "events held no messages",
  );
  console.log(n + " GIV-3D database/security checks passed");
} finally {
  await db.close();
}
