import assert from "node:assert/strict";
import { randomUUID as uid } from "node:crypto";
import { nmiDatabase, f, ids, checkout, seedRoutes } from "./nmi-fixture.mjs";
const db = await nmiDatabase(),
  q = (s, p = []) => db.query(s, p),
  owner = () => db.exec("reset role");
let n = 0;
const ok = (v, m) => {
    assert.ok(v, m);
    n++;
    console.log("PASS " + m);
  },
  deny = async (fn, m) => {
    await assert.rejects(fn);
    ok(true, m);
  };
const as = async (u = f.admin, role = "authenticated") => {
  await owner();
  await q("select set_config('request.jwt.claim.sub',$1,false)", [u || ""]);
  await db.exec("set role " + role);
};
const rpc = (a, p = {}, o = f.org) =>
    q("select payments_nmi_workspace($1,$2,$3)v", [a, o, p]).then(
      (r) => r.rows[0].v,
    ),
  svc = (a, p = {}, o = f.org) =>
    q("select payments_nmi_service($1,$2,$3)v", [a, o, p]).then(
      (r) => r.rows[0].v,
    );
const existing = (a, p = {}) =>
  q("select payments_workspace($1,$2,$3)v", [a, f.org, p]).then(
    (r) => r.rows[0].v,
  );
try {
  await as();
  let session = await existing("checkout_prepare", checkout(uid()));
  const s = session.id;
  const data = await existing("session", { id: s }),
    leg = data.legs.find((l) => l.route_label === "Main MID");
  await deny(
    () =>
      rpc("prepare", {
        session_id: s,
        leg_id: leg.id,
        operation: "sale",
        request_key: uid(),
      }),
    "default sandbox account/route/session switches deny",
  );
  await owner();
  await db.exec(seedRoutes);
  await q("insert into private.payments_nmi_sessions values($1,$2,true)", [
    f.org,
    s,
  ]);
  await as();
  const nativeView = await rpc("session", { session_id: s });
  ok(
    nativeView.session.total_minor === "3850" &&
      nativeView.receipt.charitable_minor === "3500" &&
      nativeView.receipt.non_charitable_minor === "350",
    "exact 38.50 native checkout preserves four route legs and classifications",
  );
  ok(
    nativeView.sandbox_ready === true,
    "verified mock route/session opt-in enables only sandbox",
  );
  await as(f.reader);
  ok(
    (await rpc("session", { session_id: s })).can_prepare === false,
    "view-only staff never receive editable/tokenizing checkout authority",
  );
  await as();
  for (const [who, label] of [
    [null, "anonymous"],
    [f.reporter, "Pastor"],
    [f.ordinary, "ordinary"],
  ]) {
    await as(who, who ? "authenticated" : "anon");
    await deny(
      () =>
        rpc("prepare", {
          session_id: s,
          leg_id: leg.id,
          operation: "sale",
          request_key: uid(),
        }),
      label + " cannot prepare sandbox charge",
    );
  }
  await as();
  await deny(
    () =>
      rpc("prepare", {
        session_id: s,
        leg_id: leg.id,
        operation: "create_customer",
        request_key: uid(),
      }),
    "customer vault creation requires explicit save choice",
  );
  const intent = {
    save_method: true,
    session_id: s,
    leg_id: leg.id,
    operation: "sale",
    request_key: uid(),
  };
  const p = await rpc("prepare", intent);
  ok(
    (await rpc("prepare", intent)).id === p.id,
    "canonical retry identity returns same operation",
  );
  await deny(
    () => rpc("prepare", { ...intent, operation: "authorize" }),
    "changed operation under key cannot bypass unresolved charge",
  );
  await deny(
    () => rpc("prepare", { ...intent, request_key: uid() }),
    "different key cannot create second unresolved charge for same leg",
  );
  await deny(
    () => rpc("prepare", { ...intent, payment_token: "not-an-rpc-field" }),
    "payment token never accepted by database intent",
  );
  await deny(
    () => svc("claim", { id: p.id, actor_id: f.admin }),
    "ordinary authenticated caller cannot use service lease",
  );
  await as(null, "service_role");
  let c = await svc("claim", { id: p.id, actor_id: f.admin });
  ok(
    c.claimed &&
      c.scope.environment === "sandbox" &&
      c.scope.processor_id === "mock-MAIN",
    "lease resolves frozen canonical route, environment and amount",
  );
  ok(
    !(await svc("claim", { id: p.id, actor_id: f.admin })).claimed,
    "one service execution lease",
  );
  await owner();
  await q(
    "update organization_staff_permissions set revoked_at=now()where user_id=$1 and permission='payments.configure'",
    [f.admin],
  );
  await as(null, "service_role");
  await deny(
    () => svc("handoff", { id: p.id, actor_id: f.admin, lease: c.lease }),
    "revocation after claim prevents provider handoff",
  );
  await owner();
  await q(
    "update organization_staff_permissions set revoked_at=null where user_id=$1 and permission='payments.configure'",
    [f.admin],
  );
  await as(null, "service_role");
  c = await svc("handoff", { id: p.id, actor_id: f.admin, lease: c.lease });
  await deny(
    () => svc("handoff", { id: p.id, actor_id: f.admin, lease: c.lease }),
    "handoff cannot execute twice",
  );
  await deny(
    () => svc("complete", { id: p.id, lease: uid(), status: "captured" }),
    "wrong outcome lease rejected",
  );
  const result = await svc("complete", {
    id: p.id,
    lease: c.lease,
    status: "captured",
    provider_reference: "mock-tx-1",
    customer_reference: "mock-vault-1",
    brand: "Visa",
    last4: "1111",
    amount_minor: leg.amount_minor,
  });
  ok(
    result.ledger_posted === false && result.method_id,
    "captured sandbox result attaches masked logical method without ledger posting",
  );
  await deny(
    () =>
      svc("complete", {
        id: p.id,
        lease: c.lease,
        status: "captured",
        provider_reference: "mock-tx-1",
      }),
    "completion cannot replay mutations",
  );
  await as();
  const methods = await existing("methods");
  ok(
    methods.methods.find((m) => m.id === result.method_id)?.gateway_count === 1,
    "accepted logical method UI counts NMI vault gateway without exposing reference",
  );
  const view = await rpc("session", { session_id: s });
  ok(
    !JSON.stringify(view).includes("mock-vault-1") &&
      !JSON.stringify(view).includes("mock-MAIN"),
    "browser session excludes vault and processor identifiers",
  );
  const youth = data.legs.find((l) => l.route_label === "Youth MID");
  await deny(
    () =>
      rpc("prepare", {
        session_id: s,
        leg_id: youth.id,
        operation: "sale",
        request_key: uid(),
        method_id: result.method_id,
      }),
    "vault cannot cross unproven processor route",
  );
  await as(f.donor);
  ok(
    (await rpc("session", { session_id: s })).methods[0].last4 === "1111",
    "reviewed donor sees only own safe method",
  );
  await deny(
    () => rpc("session", { session_id: uid() }),
    "donor direct session guessing denied",
  );
  await as();
  await deny(
    () => rpc("session", { session_id: s }, f.other),
    "cross-organization checkout denied",
  );
  await owner();
  await q("update giving_transaction_legs set status='settled'where id=$1", [
    leg.id,
  ]);
  await as();
  const refund = await existing("refund_request", {
    leg_id: leg.id,
    request_key: uid(),
    amount_minor: "1000",
    reason: "synthetic partial refund",
  });
  const ri = {
    session_id: s,
    leg_id: leg.id,
    operation: "refund",
    request_key: uid(),
    refund_id: refund.id,
  };
  const rp = await rpc("prepare", ri);
  await as(null, "service_role");
  let rc = await svc("claim", { id: rp.id, actor_id: f.admin });
  await svc("handoff", { id: rp.id, actor_id: f.admin, lease: rc.lease });
  let rr = await svc("complete", {
    id: rp.id,
    lease: rc.lease,
    status: "refunded",
    provider_reference: "mock-refund-1",
    amount_minor: "1000",
  });
  ok(
    rr.status === "partially_refunded",
    "partial refund preserves canonical amount and original transaction",
  );
  await as();
  const rest = await existing("refund_request", {
    leg_id: leg.id,
    request_key: uid(),
    amount_minor: "1000",
    reason: "synthetic remaining refund",
  });
  const restIntent = await rpc("prepare", {
    session_id: s,
    leg_id: leg.id,
    operation: "refund",
    request_key: uid(),
    refund_id: rest.id,
  });
  await as(null, "service_role");
  const restClaim = await svc("claim", {
    id: restIntent.id,
    actor_id: f.admin,
  });
  await svc("handoff", {
    id: restIntent.id,
    actor_id: f.admin,
    lease: restClaim.lease,
  });
  ok(
    (
      await svc("complete", {
        id: restIntent.id,
        lease: restClaim.lease,
        status: "refunded",
        provider_reference: "mock-rest-refund",
        amount_minor: "1000",
      })
    ).status === "refunded",
    "cumulative exact remaining refund produces fully refunded state",
  );
  await as();
  const second = await existing("checkout_prepare", checkout(uid()));
  const secondView = await existing("session", { id: second.id });
  const secondLeg = secondView.legs.find((l) => l.route_label === "Main MID");
  await owner();
  await q("insert into private.payments_nmi_sessions values($1,$2,true)", [
    f.org,
    second.id,
  ]);
  await as();
  const saved = await rpc("prepare", {
    session_id: second.id,
    leg_id: secondLeg.id,
    operation: "sale",
    request_key: uid(),
    method_id: result.method_id,
  });
  await as(null, "service_role");
  const savedClaim = await svc("claim", { id: saved.id, actor_id: f.admin });
  ok(
    savedClaim.vault_reference === "mock-vault-1" &&
      savedClaim.initial_transaction_id === "mock-tx-1",
    "second charge resolves scoped vault and original credential-on-file transaction",
  );
  await svc("handoff", {
    id: saved.id,
    actor_id: f.admin,
    lease: savedClaim.lease,
  });
  await svc("complete", {
    id: saved.id,
    lease: savedClaim.lease,
    status: "captured",
    provider_reference: "mock-second-tx",
    amount_minor: secondLeg.amount_minor,
    customer_reference: "unexpected-unsaved-vault",
    last4: "2222",
    brand: "Visa",
  });
  await owner();
  ok(
    (
      await q(
        "select verified_at from private.payments_nmi_vault_routes where method_id=$1",
        [result.method_id],
      )
    ).rows[0].verified_at !== null,
    "successful saved charge verifies only exact route scope",
  );
  ok(
    (
      await q(
        "select count(*)::int n from private.payments_nmi_vaults where provider_reference='unexpected-unsaved-vault'",
      )
    ).rows[0].n === 0,
    "no-save choice prevents unsolicited new vault persistence",
  );
  await as();
  const instruction = (
    await q("select giving_workspace('recurring_create',$1,$2)v", [
      f.org,
      {
        request_key: uid(),
        person_id: f.person,
        currency: "USD",
        frequency: "monthly",
        starts_on: "2026-01-01",
        next_run_at: "2026-10-14T00:00:00Z",
        lines: [
          { fund_id: f.mainFund, amount_minor: 2000 },
          { fund_id: f.youthFund, amount_minor: 500 },
        ],
      },
    ])
  ).rows[0].v;
  await owner();
  await q(
    "insert into private.payments_nmi_plans values($1,$2,'mock-monthly','monthly',2000,'USD',now(),'OFFLINE TEST ONLY')",
    [f.org, f.nmi],
  );
  await q(
    "update private.payments_nmi_accounts set subscription_default_verified=true,subscription_default_route_id=$1,gateway_timezone='America/Chicago'where gateway_id=$2",
    [f.mainRoute, f.nmi],
  );
  await as();
  const recurring = await rpc("prepare", {
    session_id: second.id,
    leg_id: secondLeg.id,
    operation: "create_recurring_profile",
    request_key: uid(),
    method_id: result.method_id,
    instruction_id: instruction.id,
    plan_reference: "mock-monthly",
  });
  await as(null, "service_role");
  const recurringClaim = await svc("claim", {
    id: recurring.id,
    actor_id: f.admin,
  });
  ok(
    recurringClaim.scope.subscription_default_verified &&
      recurringClaim.amount_minor === "2000" &&
      recurringClaim.start_date === "20261013",
    "recurring binds exact canonical route amount and verified gateway timezone",
  );
  await svc("handoff", {
    id: recurring.id,
    actor_id: f.admin,
    lease: recurringClaim.lease,
  });
  await svc("complete", {
    id: recurring.id,
    lease: recurringClaim.lease,
    status: "pending",
    provider_reference: "mock-subscription",
  });
  await as();
  for (const [operation, status] of [
    ["update_recurring_profile", "pending"],
    ["cancel_recurring_profile", "voided"],
  ]) {
    const next = await rpc("prepare", {
      session_id: second.id,
      leg_id: secondLeg.id,
      operation,
      request_key: uid(),
      instruction_id: instruction.id,
    });
    await as(null, "service_role");
    const cl = await svc("claim", { id: next.id, actor_id: f.admin });
    ok(
      cl.subscription_reference === "mock-subscription",
      operation + " resolves original scoped subscription",
    );
    await svc("handoff", { id: next.id, actor_id: f.admin, lease: cl.lease });
    await svc("complete", {
      id: next.id,
      lease: cl.lease,
      status,
      provider_reference: "mock-subscription",
    });
    await as();
  }
  await owner();
  ok(
    (
      await q("select status from giving_recurring_instructions where id=$1", [
        instruction.id,
      ])
    ).rows[0].status === "cancelled",
    "parent recurring cancellation follows successful child cancellation only",
  );
  await as(null, "service_role");
  const event = {
    gateway_id: f.nmi,
    event_id: "mock-event-1",
    digest: "a".repeat(64),
    provider_reference: "mock-tx-1",
    processor_id: "mock-MAIN",
    status: "captured",
    merchant_reference: "mock-merchant",
    kind: "transaction",
  };
  ok(
    (await svc("webhook", event)).accepted,
    "normalized signed test webhook binds transaction, gateway and route",
  );
  ok(
    (await svc("webhook", event)).duplicate,
    "webhook same event/digest dedupes",
  );
  await deny(
    () => svc("webhook", { ...event, digest: "b".repeat(64) }),
    "altered webhook replay denied",
  );
  await deny(
    () =>
      svc("webhook", {
        ...event,
        event_id: "other",
        merchant_reference: "foreign",
      }),
    "webhook merchant owner mismatch denied",
  );
  const batch = {
    gateway_id: f.nmi,
    event_id: "mock-batch-event",
    digest: "d".repeat(64),
    provider_reference: "mock-batch",
    processor_id: "mock-MAIN",
    status: "settled",
    merchant_reference: "mock-merchant",
    kind: "batch",
    gross_minor: "1000",
    transaction_count: 1,
  };
  ok(
    (await svc("webhook", batch)).accepted,
    "verified batch metadata ingested without fabricated fees/net",
  );
  ok(
    (
      await svc("webhook", {
        ...batch,
        event_id: "mock-batch-second",
        digest: "e".repeat(64),
      })
    ).accepted,
    "identical batch metadata under a new event remains idempotent",
  );
  await deny(
    () =>
      svc("webhook", {
        ...batch,
        event_id: "mock-batch-changed",
        digest: "f".repeat(64),
        gross_minor: "1001",
      }),
    "changed settlement metadata cannot be silently accepted",
  );
  await deny(
    () =>
      svc("webhook", {
        ...batch,
        event_id: "mock-batch-negative",
        provider_reference: "mock-batch-negative",
        gross_minor: "-1",
      }),
    "negative batch gross rejected",
  );
  await owner();
  let b = (
    await q(
      "select fee_minor,net_minor,settlement_date from private.payments_nmi_batches",
    )
  ).rows[0];
  ok(
    b.fee_minor === null && b.net_minor === null && b.settlement_date === null,
    "unknown settlement fee/net/date remains unknown",
  );
  ok(
    (
      await q(
        "select count(*)::int n from giving_ledger where organization_id=$1",
        [f.org],
      )
    ).rows[0].n === 0,
    "sandbox never creates real giving ledger entry",
  );
  ok(
    (await q("select payments_enabled_global from private.payments_control"))
      .rows[0].payments_enabled_global === false,
    "global live kill switch remains false",
  );
  ok(
    (
      await q(
        "select actor_user_id from giving_audit where action='payments.nmi.sandbox.outcome'limit 1",
      )
    ).rows[0].actor_user_id === f.admin,
    "original initiator preserved in service outcome audit",
  );
  await deny(
    () => q("update private.payments_nmi_observations set status='failed'"),
    "provider observation immutable",
  );
  for (const role of ["anon", "authenticated", "service_role"]) {
    await as(null, role);
    for (const table of [
      "accounts",
      "routes",
      "plans",
      "sessions",
      "attempts",
      "observations",
      "vaults",
      "vault_routes",
      "subscriptions",
      "events",
      "batches",
    ])
      await deny(
        () => q("select * from private.payments_nmi_" + table),
        role + " raw access denied " + table,
      );
  }
  console.log(n + " GIV-3B database/security checks passed");
} finally {
  await db.close();
}
