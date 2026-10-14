// Real local RPC orchestration with mock HTTP transport. Never a provider acceptance claim.
import assert from "node:assert/strict";
import { randomUUID as uid } from "node:crypto";
import { nmiDatabase, f, checkout, seedRoutes } from "./nmi-fixture.mjs";
import { createNmiHandler } from "../../supabase/functions/payments-nmi/gateway.mjs";
import {
  ACCEPTANCE,
  NMI_BASE,
} from "../../supabase/functions/_shared/payments/nmi.mjs";
const db = await nmiDatabase(),
  q = (s, p = []) => db.query(s, p);
let n = 0,
  network = [],
  user = f.admin;
const ok = (v, m) => {
    assert.ok(v, m);
    n++;
    console.log("PASS " + m);
  },
  as = async (u, role) => {
    await db.exec("reset role");
    await q("select set_config('request.jwt.claim.sub',$1,false)", [u || ""]);
    await db.exec("set role " + role);
  };
const origin = "https://isolated--championlifechurch.netlify.app";
try {
  await as(f.admin, "authenticated");
  const s = (
    await q("select payments_workspace($1,$2,$3)v", [
      "checkout_prepare",
      f.org,
      checkout(uid()),
    ])
  ).rows[0].v.id;
  await db.exec("reset role");
  await db.exec(seedRoutes);
  await q("insert into private.payments_nmi_sessions values($1,$2,true)", [
    f.org,
    s,
  ]);
  const leg = (
    await q(
      "select * from giving_transaction_legs where session_id=$1 and route_snapshot->>'processor_route_id'=$2",
      [s, f.mainRoute],
    )
  ).rows[0];
  const fetcher = async (url, options) => {
    network.push({ url, options });
    if (url === ACCEPTANCE + "/auth/v1/user")
      return new Response(
        JSON.stringify({
          id: user,
          email_confirmed_at: "2026-10-14T00:00:00Z",
        }),
      );
    if (url.includes("/rest/v1/rpc/")) {
      const a = JSON.parse(options.body),
        service = url.endsWith("payments_nmi_service");
      assert(!options.body.includes("fake_transient_token"));
      await as(
        service ? null : user,
        service ? "service_role" : "authenticated",
      );
      try {
        const data = (
          await q(
            "select " +
              (service ? "payments_nmi_service" : "payments_nmi_workspace") +
              "($1,$2,$3)v",
            [a.p_action, a.p_org, a.p_payload],
          )
        ).rows[0].v;
        return new Response(JSON.stringify(data));
      } catch {
        return new Response("{}", { status: 403 });
      }
    }
    assert.equal(url, NMI_BASE + "/payments/sale");
    assert.equal(options.headers.Authorization, "LOCAL_MOCK_NMI_KEY");
    const body = JSON.parse(options.body);
    assert.equal(body.payment_details.payment_token, "fake_transient_token");
    return new Response(
      JSON.stringify({
        id: "mock-flow-tx",
        response: "1",
        amount: "20.00",
        processor_id: "mock-MAIN",
        customer_vault_id: "mock-flow-vault",
        payment_details: { card_number: "4***********1111", card_type: "Visa" },
      }),
    );
  };
  const handler = createNmiHandler(
    {
      project: ACCEPTANCE,
      enabled: true,
      serviceKey: "fake_service_only",
      publicKey: "fake_public_only",
      origins: [origin],
    },
    fetcher,
    () => "LOCAL_MOCK_NMI_KEY",
  );
  const payload = {
    organization_id: f.org,
    session_id: s,
    leg_id: leg.id,
    operation: "sale",
    request_key: uid(),
    payment_token: "fake_transient_token",
    save_method: true,
  };
  const request = (body = payload) =>
    new Request("https://local.invalid", {
      method: "POST",
      headers: { Origin: origin, Authorization: "Bearer fake.jwt.token" },
      body: JSON.stringify(body),
    });
  const response = await handler(request());
  ok(
    response.status === 200,
    "normal authenticated HTTP -> guarded RPC -> sandbox adapter -> outcome orchestration",
  );
  const body = await response.json();
  ok(
    body.status === "captured" &&
      body.method_id &&
      body.ledger_posted === false,
    "safe canonical response saves masked method without real ledger",
  );
  ok(
    network.filter((x) => x.url.startsWith(NMI_BASE)).length === 1,
    "only one mocked NMI handoff",
  );
  const again = await handler(request());
  ok(again.status === 409, "same request retry cannot re-execute");
  ok(
    network.filter((x) => x.url.startsWith(NMI_BASE)).length === 1,
    "duplicate retry zero extra provider calls",
  );
  const before = network.length;
  ok(
    (await handler(request({ ...payload, card_number: "not_allowed" })))
      .status === 403,
    "raw input key rejected",
  );
  ok(
    network.length === before,
    "raw body never reaches auth/database/provider",
  );
  ok(
    (
      await handler(
        new Request("https://local.invalid", {
          method: "POST",
          headers: { Origin: origin },
          body: "x".repeat(1600),
        }),
      )
    ).status === 400,
    "stream body bound protects request memory before parse",
  );
  await db.exec("reset role");
  const stored = (
    await q(
      "select string_agg(to_jsonb(a)::text,'')v from private.payments_nmi_attempts a",
    )
  ).rows[0].v;
  ok(
    !stored.includes("fake_transient_token") &&
      !stored.includes("LOCAL_MOCK_NMI_KEY"),
    "transient token/secret not persisted in attempts",
  );
  const audit = (
    await q("select string_agg(to_jsonb(a)::text,'')v from giving_audit a")
  ).rows[0].v;
  ok(
    !audit.includes("fake_transient_token") &&
      !audit.includes("LOCAL_MOCK_NMI_KEY"),
    "audit metadata excludes keys/tokens",
  );
  user = f.ordinary;
  ok(
    (await handler(request({ ...payload, request_key: uid() }))).status === 403,
    "ordinary signed-in user cannot borrow fixture authority",
  );
  ok(
    network.filter((x) => x.url.startsWith(NMI_BASE)).length === 1,
    "authorization denial no extra sandbox calls",
  );
  await db.exec("reset role");
  ok(
    (await q("select count(*)::int n from giving_ledger")).rows[0].n === 0,
    "gateway pipeline produces no real financial posting",
  );
  console.log(
    n +
      " GIV-3B local gateway integration checks passed; HTTP transport mocked",
  );
} finally {
  await db.close();
}
