import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID as uid } from "node:crypto";
import { migrationOrder } from "./migration-order.mjs";
import { f, ids, paymentsFixtureSQL, checkout } from "./payments-fixture.mjs";
import { createPayload, paymentDefinition } from "./forms-fixture.mjs";
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
  };
const owner = () => db.exec("reset role"),
  as = async (u = f.admin, role = "authenticated") => {
    await owner();
    await q("select set_config('request.jwt.claim.sub',$1,false)", [u || ""]);
    await db.exec("set role " + role);
  },
  rpc = (a, p = {}, o = f.org) =>
    q("select payments_workspace($1,$2,$3)v", [a, o, p]).then(
      (r) => r.rows[0].v,
    ),
  svc = (a, p = {}, o = f.org) =>
    q("select payments_service($1,$2,$3)v", [a, o, p]).then((r) => r.rows[0].v),
  donor = (a, p = {}, o = f.org) =>
    q("select payments_donor($1,$2,$3)v", [a, o, p]).then((r) => r.rows[0].v),
  count = async (s, p = []) => {
    await owner();
    return Number((await q(s, p)).rows[0].n);
  };
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
  await db.exec(paymentsFixtureSQL);

  ok(
    (
      await q(
        "select count(*)::int n,bool_and(c.relrowsecurity)enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'and c.relname like 'payments_%'and c.relkind='r'",
      )
    ).rows[0].enabled,
    "local schema advisor: all payment tables have RLS",
  );
  ok(
    (
      await q(
        "select bool_and(not p.prosecdef and 'search_path=\"\"'=any(p.proconfig))v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('payments_workspace','payments_service','payments_donor')",
      )
    ).rows[0].v,
    "local schema advisor: public payment wrappers invoker with empty search path",
  );
  await as(null, "anon");
  await deny(() => rpc("context"), "anonymous config context denied");
  await deny(
    () => svc("operation_claim", { id: uid() }),
    "anonymous service denied",
  );
  await as(f.reporter);
  await deny(
    () => rpc("configuration"),
    "reports-only Pastor cannot configure payments",
  );
  await deny(
    () => rpc("activation_request", { id: f.nmi }),
    "reports-only cannot activate",
  );
  await as(f.ordinary);
  await deny(
    () => rpc("configuration"),
    "ordinary staff cannot read configuration",
  );
  await as(f.reader);
  const view = await rpc("configuration");
  ok(
    view.gateways.every((x) => !x.enabled) &&
      view.routes.every((x) => !x.enabled),
    "gateway and MID kill switches default false",
  );
  ok(
    !JSON.stringify(view).includes("credential_reference") &&
      !JSON.stringify(view).includes("mid_reference"),
    "view projection never exposes credential/MID references",
  );
  await deny(
    () =>
      rpc("gateway_create", {
        label: "No",
        provider: "nmi",
        environment: "sandbox",
      }),
    "payment viewer cannot configure",
  );
  await deny(
    () =>
      rpc("route_bind", {
        id: f.mainDest,
        revision: 1,
        gateway_id: f.an,
        route_id: f.anRoute,
      }),
    "payment viewer cannot route",
  );
  await deny(
    () => rpc("activation_request", { id: f.nmi }),
    "finance read cannot activate provider",
  );
  await as();
  const ctx = await rpc("context");
  ok(
    ctx.organizations.length === 1 &&
      ctx.organizations[0].permissions.length === 7,
    "current explicit seven-payment-key context",
  );
  await deny(
    () => rpc("configuration", {}, f.other),
    "cross-org configuration denied",
  );
  const key = uid(),
    payload = checkout(key),
    session = await rpc("checkout_prepare", payload);
  ok(session.execution === "held", "canonical native checkout held");
  ok(
    (await rpc("checkout_prepare", payload)).id === session.id,
    "duplicate checkout one canonical session",
  );
  await deny(
    () => rpc("checkout_prepare", { ...payload, intended_minor: "38501" }),
    "changed checkout idempotency denied",
  );
  const detail = await rpc("session", { id: session.id });
  ok(
    detail.session.total_minor === "38500" &&
      detail.lines.length === 4 &&
      detail.legs.length === 4,
    "385-dollar total splits canonical four-MID legs",
  );
  ok(
    detail.receipt.reference === session.id &&
      detail.receipt.total_minor === "38500" &&
      !!detail.receipt.date &&
      detail.receipt.payment_method_summary ===
        "Not selected — processing held",
    "receipt preview has canonical date/reference/total and honest method state",
  );
  ok(
    detail.receipt.charitable_minor === "35000" &&
      detail.receipt.non_charitable_minor === "3500",
    "mixed receipt distinguishes merchandise",
  );
  ok(
    detail.lines.find((x) => x.purpose === "merchandise").tax_eligible ===
      false,
    "merchandise cannot become deductible gift",
  );
  ok(
    detail.legs.every(
      (x) =>
        x.gate.execution_allowed === false && x.gate.stage_enabled === false,
    ),
    "global stage execution cannot be enabled",
  );
  await deny(
    () => rpc("session", { id: uid() }),
    "direct session guessing denied",
  );
  await deny(
    () =>
      rpc("checkout_prepare", checkout(uid(), { intended_minor: "38500.0" })),
    "floating-point amount rejected",
  );
  await deny(
    () => rpc("checkout_prepare", checkout(uid(), { currency: "EUR" })),
    "currency conversion not inferred",
  );
  await deny(
    () =>
      rpc(
        "checkout_prepare",
        checkout(uid(), {
          lines: [
            {
              fund_id: f.mainFund,
              purpose: "merchandise",
              amount_minor: "38500",
              cvv: "123",
            },
          ],
        }),
      ),
    "raw CVV key rejected",
  );
  await deny(
    () =>
      rpc("checkout_prepare", checkout(uid(), { person_id: f.foreignPerson })),
    "cross-owner Person denied",
  );
  await deny(
    () =>
      rpc(
        "checkout_prepare",
        checkout(uid(), {
          lines: [
            {
              destination_id: ids.merchDest,
              purpose: "charitable_contribution",
              amount_minor: "38500",
            },
          ],
        }),
      ),
    "charitable contribution requires canonical designation",
  );
  const consolidated = await rpc(
    "checkout_prepare",
    checkout(uid(), {
      intended_minor: "3000",
      lines: [
        {
          fund_id: f.mainFund,
          purpose: "charitable_contribution",
          amount_minor: "1000",
        },
        {
          fund_id: f.mainFund,
          purpose: "charitable_contribution",
          amount_minor: "2000",
        },
      ],
    }),
  );
  ok(
    (await rpc("session", { id: consolidated.id })).legs.length === 1,
    "same destination/account/MID consolidates",
  );

  const form = (
    await q("select forms_workspace($1,$2,$3)v", [
      "create",
      f.org,
      createPayload(
        "synthetic-payment-integration",
        paymentDefinition("event_fee"),
      ),
    ])
  ).rows[0].v;
  await q("select forms_workspace($1,$2,$3)", [
    "publish",
    f.org,
    { id: form.form.id, version_id: form.version.id, revision: 1 },
  ]);
  await as(null, "service_role");
  const submitted = (
    await q("select forms_gateway($1,$2,$3,$4,$5)v", [
      "submit",
      f.org,
      "synthetic-payment-integration",
      {
        request_key: uid(),
        version_id: form.version.id,
        answers: {
          name: "Synthetic Participant",
          email: "synthetic@example.test",
          children: false,
          signature: "Synthetic Participant",
          consent: false,
          fund: f.mainFund,
          amount: "2500",
        },
      },
      "c".repeat(64),
    ])
  ).rows[0].v;
  ok(
    submitted.accepted &&
      submitted.payment_status === "provider_not_configured",
    "published event-fee Form remains payment held",
  );
  await owner();
  const formSubmission = (
    await q(
      "select id,giving_session_id from platform_form_submissions where form_id=$1",
      [form.form.id],
    )
  ).rows[0];
  await as();
  const linked = await rpc("form_checkout", {
    submission_id: formSubmission.id,
  });
  ok(
    linked.session.id === formSubmission.giving_session_id &&
      linked.lines.length === 1,
    "Forms checkout reuses canonical Giving session and lines",
  );
  ok(
    linked.lines[0].purpose === "event_fee" &&
      !linked.lines[0].tax_eligible &&
      linked.receipt.non_charitable_minor === "2500",
    "published Form event purpose and receipt stay non-charitable",
  );
  ok(
    (await rpc("form_checkout", { submission_id: formSubmission.id })).session
      .id === linked.session.id,
    "Form checkout retry does not create another payment session",
  );
  await deny(
    () =>
      rpc(
        "checkout_prepare",
        checkout(uid(), {
          form_version_id: form.version.id,
          intended_minor: "2500",
          lines: [
            {
              fund_id: f.mainFund,
              purpose: "charitable_contribution",
              amount_minor: "2500",
            },
          ],
        }),
      ),
    "client cannot change published Form purpose into a gift",
  );
  await as(f.reader);
  await deny(
    () => rpc("form_checkout", { submission_id: formSubmission.id }),
    "payment view alone cannot read protected Form submission",
  );
  await as();
  await owner();
  await q(
    "update giving_processor_routes set capabilities=array['no_consolidation']where id=$1",
    [f.mainRoute],
  );
  await as();
  const unmerged = await rpc(
    "checkout_prepare",
    checkout(uid(), {
      intended_minor: "3000",
      lines: [
        {
          fund_id: f.mainFund,
          purpose: "charitable_contribution",
          amount_minor: "1000",
        },
        {
          fund_id: f.mainFund,
          purpose: "charitable_contribution",
          amount_minor: "2000",
        },
      ],
    }),
  );
  ok(
    (await rpc("session", { id: unmerged.id })).legs.length === 2,
    "route can disallow line consolidation",
  );
  const gw = await rpc("gateway_create", {
    label: "NMI foundation",
    provider: "nmi",
    environment: "sandbox",
    capabilities: ["sale"],
  });
  ok(gw.enabled === false, "new gateway disabled without credentials");
  await deny(
    () => rpc("gateway_create", { label: "No env", provider: "nmi" }),
    "explicit environment required",
  );
  await deny(
    () =>
      rpc("gateway_create", {
        label: "No secret",
        provider: "nmi",
        environment: "sandbox",
        transaction_key: "bad",
      }),
    "raw credential field denied",
  );
  const route = await rpc("route_create", {
    gateway_id: gw.id,
    label: "Main",
    provider_route_key: "MAIN",
    external_processor_id: "opaque-main",
    currency: "USD",
    country: "US",
  });
  ok(route.payments_enabled === false, "new route switch disabled");
  await deny(
    () =>
      rpc("route_create", {
        gateway_id: gw.id,
        label: "Ambiguous",
        provider_route_key: "MAIN",
        currency: "USD",
        country: "US",
      }),
    "ambiguous duplicate route key denied",
  );
  await deny(
    () =>
      rpc("route_create", {
        gateway_id: f.foreignGateway,
        label: "Wrong owner",
        provider_route_key: "OTHER",
        currency: "USD",
        country: "US",
      }),
    "gateway ID guessing bound to owner",
  );
  const oldSnapshot = detail.legs[0].id;
  await rpc("route_bind", {
    id: f.mainDest,
    revision: 1,
    gateway_id: gw.id,
    route_id: route.id,
  });
  const frozen = await rpc("session", { id: session.id });
  ok(
    frozen.legs.some((x) => x.id === oldSnapshot && x.provider === "nmi"),
    "later route changes retain snapshot",
  );
  await deny(
    () =>
      rpc("route_bind", {
        id: f.mainDest,
        revision: 1,
        gateway_id: f.nmi,
        route_id: f.mainRoute,
      }),
    "stale route config safe409",
  );
  const activation = await rpc("activation_request", { id: gw.id });
  ok(
    !activation.enabled && activation.status === "held",
    "even elevated payment key cannot bypass separate release",
  );
  await owner();
  await q("select set_config('request.jwt.claim.sub',$1,false)", [f.admin]);
  await q("update giving_transaction_legs set status='captured'where id=$1", [
    oldSnapshot,
  ]);
  await as(null, "service_role");
  await deny(
    () =>
      q("select giving_service('finalize',$1,$2)", [
        f.org,
        { session_id: session.id },
      ]),
    "legacy finalizer cannot post held native checkout",
  );
  ok(
    (await count("select count(*)n from giving_ledger")) === 0,
    "no fabricated native ledger postings",
  );
  await as();
  const refundKey = uid(),
    refund = {
      request_key: refundKey,
      leg_id: oldSnapshot,
      amount_minor: "1000",
      reason: "Synthetic refund request only",
    };
  const refund1 = await rpc("refund_request", refund);
  ok(
    (await rpc("refund_request", refund)).id === refund1.id,
    "refund request exact idempotency canonical",
  );
  await deny(
    () => rpc("refund_request", { ...refund, amount_minor: "1001" }),
    "changed refund request rejected",
  );
  await deny(
    () =>
      rpc("void_request", {
        request_key: uid(),
        leg_id: oldSnapshot,
        amount_minor: "20000",
        reason: "Synthetic void",
      }),
    "captured transaction cannot be voided",
  );
  await as(null, "service_role");
  const operation = await svc("operation_prepare", {
    request_key: uid(),
    leg_id: detail.legs[1].id,
    operation: "sale",
    amount_minor: detail.legs[1].amount_minor,
  });
  const first = await svc("operation_claim", { id: operation.id }),
    second = await svc("operation_claim", { id: operation.id });
  ok(
    first.claimed && !second.claimed && first.gate.execution_allowed === false,
    "one held provider execution lease",
  );
  await deny(
    () => svc("operation_claim", { id: uid() }),
    "operation ID guessing denied",
  );
  const methodPayload = {
    person_id: f.person,
    gateway_id: f.nmi,
    route_ids: [f.mainRoute, f.youthRoute],
    customer_reference: "synth:customer-A",
    payment_reference: "synth:payment-A",
    brand: "Visa",
    last4: "4242",
    expiry_month: 12,
    expiry_year: 2030,
    billing_name: "Synthetic Donor",
  };
  const method = await svc("synthetic_method_attach", methodPayload);
  ok(method.status === "held", "synthetic profile stored privately and held");
  ok(
    (await svc("synthetic_method_attach", methodPayload)).id === method.id,
    "unchanged method retry keeps one logical identity",
  );
  await deny(
    () => svc("synthetic_method_attach", { ...methodPayload, last4: "9999" }),
    "changed retry descriptor rejected",
  );
  await deny(
    () =>
      svc("synthetic_method_attach", {
        ...methodPayload,
        route_ids: [f.mainRoute],
      }),
    "changed retry token scope rejected",
  );
  await svc("synthetic_method_attach", {
    ...methodPayload,
    logical_method_id: method.id,
    gateway_id: ids.secondAN,
    route_ids: [ids.secondANRoute],
    customer_reference: "synth:customer-B",
    payment_reference: "synth:payment-B",
  });
  await deny(
    () =>
      svc("synthetic_method_attach", {
        ...methodPayload,
        logical_method_id: method.id,
        gateway_id: ids.secondAN,
        route_ids: [f.mainRoute],
        customer_reference: "synth:wrong",
        payment_reference: "synth:wrong",
      }),
    "token cannot cross account/MID",
  );
  await deny(
    () =>
      svc("synthetic_method_attach", {
        ...methodPayload,
        payment_reference: "4111111111111111",
      }),
    "real/PAN-like token reference rejected",
  );
  await as(f.reader);
  const methods = await rpc("methods");
  ok(
    methods.methods.length === 1 && methods.methods[0].gateway_count === 2,
    "one logical method projects several scoped token bindings",
  );
  ok(
    !JSON.stringify(methods).includes("synth:") &&
      !JSON.stringify(methods).includes("billing_name"),
    "staff sees masked methods only",
  );
  await deny(
    () => q("select * from private.giving_payment_profiles"),
    "ordinary staff raw tokens denied",
  );
  await as(f.donor);
  ok(
    (await donor("methods")).methods[0].last4 === "4242",
    "reviewed donor sees own masked method",
  );
  await deny(
    () => donor("session", { id: uid() }),
    "donor direct ID guessing denied",
  );
  await as(f.otherDonor);
  await deny(
    () => donor("methods"),
    "matching portal/user without financial link denied",
  );
  const wh = {
    gateway_id: f.nmi,
    route_id: f.youthRoute,
    leg_id: detail.legs[1].id,
    event_reference: "synth:webhook",
    body_digest: "a".repeat(64),
    normalized_status: "captured",
    signature_verified: true,
  };
  await as(null, "service_role");
  const e = await svc("synthetic_webhook", wh);
  ok(
    (await svc("synthetic_webhook", wh)).duplicate,
    "normalized webhook exactly once",
  );
  await deny(
    () => svc("synthetic_webhook", { ...wh, body_digest: "b".repeat(64) }),
    "conflicting webhook replay denied",
  );
  await deny(
    () =>
      svc("synthetic_webhook", {
        ...wh,
        event_reference: "synth:bad",
        signature_verified: false,
      }),
    "unverified webhook denied",
  );
  await deny(
    () =>
      svc("synthetic_webhook", {
        ...wh,
        event_reference: "synth:foreign",
        gateway_id: f.foreignGateway,
      }),
    "webhook route/account binding exact",
  );
  ok(
    (await count("select count(*)n from giving_ledger")) === 0,
    "normalized synthetic webhook cannot post finances",
  );
  await as(null, "service_role");
  const st = await svc("synthetic_settlement", {
    gateway_id: f.nmi,
    route_id: f.youthRoute,
    batch_reference: "synth:batch",
    settlement_date: "2026-10-14",
    currency: "USD",
    gross_minor: "5000",
    transaction_count: 1,
  });
  await owner();
  const unknown = (
    await q(
      "select fee_minor,net_minor from private.payments_settlements where id=$1",
      [st.id],
    )
  ).rows[0];
  ok(
    unknown.fee_minor === null && unknown.net_minor === null,
    "unknown processor fees/net stay null",
  );
  await as(null, "service_role");
  await deny(
    () =>
      svc("synthetic_settlement", {
        gateway_id: f.nmi,
        route_id: f.youthRoute,
        batch_reference: "synth:batch",
        settlement_date: "2026-10-14",
        currency: "USD",
        gross_minor: "5001",
        transaction_count: 1,
      }),
    "changed settlement replay rejected",
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
        starts_on: "2026-01-01",
        next_run_at: "2026-10-14T00:00:00Z",
        lines: [
          { fund_id: f.youthFund, amount_minor: 1000 },
          { fund_id: ids.outreachFund, amount_minor: 2000 },
        ],
      },
    ])
  ).rows[0].v;
  ok(
    (await rpc("recurring_map", { id: recurring.id })).routes === 2,
    "one recurring plan maps separate routes",
  );
  await as(null, "service_role");
  const rc = await svc("recurring_claim", {
    id: recurring.id,
    scheduled_at: "2026-10-14T00:00:00Z",
  });
  ok(
    rc.claimed &&
      !(
        await svc("recurring_claim", {
          id: recurring.id,
          scheduled_at: "2026-10-14T00:00:00Z",
        })
      ).claimed,
    "one held recurring charge job",
  );
  await owner();
  await q(
    "update organization_staff_permissions set revoked_at=now()where organization_id=$1 and user_id=$2 and permission='payments.view'",
    [f.org, f.reader],
  );
  await as(f.reader);
  await deny(
    () => rpc("session", { id: session.id }),
    "same-session revocation denies old session access",
  );
  await owner();
  ok(
    (
      await q("select private.payments_actor_current($1,$2)v", [
        f.org,
        f.reader,
      ])
    ).rows[0].v === false,
    "worker gate rechecks revoked initiating authority",
  );
  await deny(
    () => q("update private.payments_control set payments_enabled_global=true"),
    "GIV-3A global release cannot be enabled",
  );
  await deny(
    () =>
      q(
        "insert into private.payments_gateway_bindings(organization_id,gateway_id,environment,credential_reference,secret_version) values($1,$2,$3,$4,1)",
        [
          f.org,
          f.nmi,
          "sandbox",
          "payments/" + f.other + "/" + f.nmi + "/sandbox/v1",
        ],
      ),
    "credential reference cannot bind another owner",
  );
  await owner();
  for (const t of [
    "payments_control",
    "payments_platform_authority",
    "payments_org_control",
    "payments_gateway_bindings",
    "payments_methods",
    "payments_customers",
    "payments_token_routes",
    "payments_checkout_context",
    "payments_operations",
    "payments_journal",
    "payments_webhooks",
    "payments_settlements",
    "payments_recurring_routes",
    "payments_recurring_jobs",
  ]) {
    await as(null, "anon");
    await deny(() => q("select * from private." + t), "anonymous denied " + t);
    await as(null, "service_role");
    await deny(
      () => q("select * from private." + t),
      "raw service denied " + t,
    );
  }
  console.log(n + " GIV-3A database/security checks passed");
} catch (e) {
  console.error(e.message, e.where || "");
  process.exitCode = 1;
} finally {
  await db.close();
}
