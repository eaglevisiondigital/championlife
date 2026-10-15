import assert from "node:assert/strict";
import { randomUUID as uid } from "node:crypto";
import { database, f, ids, anet, checkout } from "./anet-fixture.mjs";
const db = await database(),
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
  };
const as = async (user = f.admin, role = "authenticated") => {
  await db.exec("reset role");
  await q("select set_config('request.jwt.claim.sub',$1,false)", [user || ""]);
  await db.exec("set role " + role);
};
const rpc = (a, p = {}, o = f.org) =>
    q("select payments_workspace($1,$2,$3)v", [a, o, p]).then(
      (r) => r.rows[0].v,
    ),
  svc = (a, p = {}, o = f.org) =>
    q("select payments_service($1,$2,$3)v", [a, o, p]).then((r) => r.rows[0].v);
try {
  await as();
  const config = await rpc("configuration");
  const gateways = config.gateways.filter(
    (g) => g.provider === "authorize_net",
  );
  ok(
    gateways.length === 5 &&
      gateways.every((g) => !g.enabled && g.environment === "sandbox"),
    "five independent disabled Authorize.Net accounts",
  );
  ok(
    gateways.every(
      (g) => g.credential_status === "Missing" && g.last_verified === null,
    ),
    "safe credential status only, no key or account verification fabricated",
  );
  const s = await rpc("checkout_prepare", checkout(uid())),
    v = await rpc("session", { id: s.id });
  ok(
    v.legs.length === 3 && v.session.total_minor === "28500",
    "200/50/35 single canonical session, three accounts",
  );
  ok(
    v.receipt.charitable_minor === "25000" &&
      v.receipt.non_charitable_minor === "3500",
    "mixed receipt classifies gifts and merchandise",
  );
  await db.exec("reset role");
  let rows = (
    await q("select * from giving_transaction_legs where session_id=$1", [s.id])
  ).rows;
  ok(
    new Set(rows.map((l) => l.route_snapshot.gateway_id)).size === 3,
    "frozen distinct account routes",
  );
  ok(
    rows.every(
      (l) =>
        l.route_snapshot.provider === "authorize_net" &&
        l.route_snapshot.environment === "sandbox",
    ),
    "only explicit Authorize.Net sandbox snapshots",
  );
  await as();
  const events = await rpc(
    "checkout_prepare",
    checkout(uid(), {
      intended_minor: "1000",
      lines: [
        {
          destination_id: ids.eventsDest,
          purpose: "event_fee",
          amount_minor: "1000",
        },
      ],
    }),
  );
  await db.exec("reset role");
  ok(
    (
      await q(
        "select route_snapshot from giving_transaction_legs where session_id=$1",
        [events.id],
      )
    ).rows[0].route_snapshot.gateway_id === anet.events,
    "event fee independent purpose routes Events account",
  );
  const attach = {
    person_id: f.person,
    gateway_id: f.an,
    route_ids: [f.anRoute],
    customer_reference: "synth:anet-main-customer",
    payment_reference: "synth:anet-main-payment",
    brand: "Visa",
    last4: "1111",
  };
  await as(null, "service_role");
  const m = await svc("synthetic_method_attach", attach);
  ok(
    (await svc("synthetic_method_attach", attach)).id === m.id,
    "profile retry one logical method",
  );
  await deny(
    () =>
      svc("synthetic_method_attach", {
        ...attach,
        route_ids: [ids.secondANRoute],
      }),
    "Main profile cannot attach to Youth gateway route",
  );
  const y = await svc("synthetic_method_attach", {
    ...attach,
    logical_method_id: m.id,
    gateway_id: ids.secondAN,
    route_ids: [ids.secondANRoute],
    customer_reference: "synth:anet-youth-customer",
    payment_reference: "synth:anet-youth-payment",
  });
  ok(
    y.id === m.id,
    "same logical descriptor has distinct gateway-specific profiles",
  );
  await as();
  const methods = await rpc("methods");
  ok(
    methods.methods[0].gateway_count === 2 &&
      !JSON.stringify(methods).includes("synth:"),
    "method UI brand/last4, no provider references",
  );
  await as(f.donor);
  const donor = (
    await q("select payments_donor($1,$2,$3)v", ["methods", f.org, {}])
  ).rows[0].v;
  ok(
    donor.methods.every((m) => m.person_id === f.person),
    "reviewed donor only own logical method",
  );
  await deny(
    () => rpc("session", { id: s.id }, f.other),
    "cross-org session denied",
  );
  for (const user of [f.reader, f.reporter, f.ordinary]) {
    await as(user);
    await deny(
      () =>
        rpc("gateway_create", {
          label: "blocked",
          provider: "authorize_net",
          environment: "sandbox",
        }),
      "read/Pastor/ordinary cannot configure " + user.slice(-2),
    );
    await deny(
      () => rpc("activation_request", { id: f.an }),
      "read/Pastor/ordinary cannot activate " + user.slice(-2),
    );
  }
  const leg = rows.find((l) => l.route_snapshot.gateway_id === ids.secondAN),
    merch = rows.find((l) => l.route_snapshot.gateway_id === anet.merch);
  await db.exec("reset role");
  await q(
    "update giving_transaction_legs set status='captured'where id=any($1::uuid[])",
    [[leg.id, merch.id]],
  );
  await q("update giving_transaction_legs set status='authorized'where id=$1", [
    merch.id,
  ]);
  await as();
  const recurring = (
    await q("select giving_workspace('recurring_create',$1,$2)v", [
      f.org,
      {
        request_key: uid(),
        person_id: f.person,
        currency: "USD",
        frequency: "monthly",
        starts_on: "2026-01-01",
        next_run_at: "2027-01-01T00:00:00Z",
        lines: [
          { fund_id: f.mainFund, amount_minor: 20000 },
          { fund_id: f.youthFund, amount_minor: 5000 },
        ],
      },
    ])
  ).rows[0].v;
  for (const [permission, action, payload] of [
    [
      "payments.configure",
      "gateway_create",
      {
        label: "AN test disabled",
        provider: "authorize_net",
        environment: "sandbox",
      },
    ],
    [
      "payments.refund",
      "refund_request",
      {
        request_key: uid(),
        leg_id: leg.id,
        amount_minor: "1000",
        reason: "Synthetic refund review",
      },
    ],
    [
      "payments.void",
      "void_request",
      {
        request_key: uid(),
        leg_id: merch.id,
        amount_minor: merch.amount_minor.toString(),
        reason: "Synthetic void review",
      },
    ],
    ["payments.recurring.manage", "recurring_map", { id: recurring.id }],
    ["payments.provider.activate", "activation_request", { id: f.an }],
  ]) {
    await as();
    await rpc(action, payload);
    await db.exec("reset role");
    await q(
      "update organization_staff_permissions set revoked_at=now()where organization_id=$1 and user_id=$2 and permission=$3",
      [f.org, f.admin, permission],
    );
    await as();
    await deny(
      () => rpc(action, payload),
      "same-session revoke enforced " + permission,
    );
    await db.exec("reset role");
    await q(
      "update organization_staff_permissions set revoked_at=null where organization_id=$1 and user_id=$2 and permission=$3",
      [f.org, f.admin, permission],
    );
  }
  await as();
  ok(
    (await rpc("recurring_map", { id: recurring.id })).routes === 2,
    "canonical recurring parent separate gateway children",
  );
  await db.exec("reset role");
  ok(
    (await q("select count(*)::int n from giving_ledger")).rows[0].n === 0,
    "all build operations preserve real ledger zero",
  );
  ok(
    (await q("select payments_enabled_global from private.payments_control"))
      .rows[0].payments_enabled_global === false,
    "global live gate remains off",
  );
  for (const role of ["anon", "authenticated", "service_role"]) {
    await as(null, role);
    for (const table of [
      "payments_journal",
      "payments_customers",
      "giving_payment_profiles",
      "payments_gateway_bindings",
    ])
      await deny(
        () => q("select * from private." + table),
        role + " direct private access denied " + table,
      );
  }
  console.log(
    n +
      " GIV-3C database/security/topology checks passed; synthetic local data only",
  );
} finally {
  await db.close();
}
