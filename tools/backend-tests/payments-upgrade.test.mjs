// Verify additive GIV-3A migration preserves accepted historical Form fees and snapshots.
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID as uid } from "node:crypto";
import { migrationOrder } from "./migration-order.mjs";
import {
  f,
  formsFixtureSQL,
  createPayload,
  paymentDefinition,
} from "./forms-fixture.mjs";
const db = new PGlite(),
  q = (s, p = []) => db.query(s, p);
let n = 0;
const ok = (v, m) => {
  assert.ok(v, m);
  n++;
  console.log("PASS " + m);
};
async function as(user = f.admin, role = "authenticated") {
  await db.exec("reset role");
  await q("select set_config('request.jwt.claim.sub',$1,false)", [user || ""]);
  await db.exec("set role " + role);
}
const form = (a, p) =>
  q("select forms_workspace($1,$2,$3)v", [a, f.org, p]).then(
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
  const upgrade = "20261014171912_giving_provider_foundation_giv_3a.sql";
  for (const m of migrationOrder.slice(0,migrationOrder.indexOf(upgrade)))
    await db.exec(
      readFileSync(
        new URL("../../supabase/migrations/" + m, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(formsFixtureSQL);
  await as();
  const fee = await form(
    "create",
    createPayload("synthetic-legacy-fee", paymentDefinition("event_fee")),
  );
  await form("publish", {
    id: fee.form.id,
    version_id: fee.version.id,
    revision: 1,
  });
  await as(null, "service_role");
  await q("select forms_gateway($1,$2,$3,$4,$5)", [
    "submit",
    f.org,
    "synthetic-legacy-fee",
    {
      request_key: uid(),
      version_id: fee.version.id,
      answers: {
        name: "Synthetic Legacy Participant",
        email: "synthetic@example.test",
        children: false,
        signature: "Synthetic Participant",
        consent: false,
        fund: f.mainFund,
        amount: "2500",
      },
    },
    "b".repeat(64),
  ]);
  await db.exec("reset role");
  const before = (
    await q(
      "select l.id,l.session_id,l.amount_minor,l.route_snapshot,l.tax_eligible from giving_session_lines l join giving_sessions s on s.id=l.session_id where s.source=$1",
      ["platform_form"],
    )
  ).rows[0];
  ok(
    before.tax_eligible === false,
    "accepted Form fee already non-tax-eligible",
  );
  await db.exec(
    readFileSync(
      new URL("../../supabase/migrations/" + upgrade, import.meta.url),
      "utf8",
    ),
  );
  await q(
    "insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)",
    [f.org, f.admin, "payments.view"],
  );
  const after = (
    await q(
      "select id,session_id,amount_minor,route_snapshot,tax_eligible from giving_session_lines where id=$1",
      [before.id],
    )
  ).rows[0];
  ok(
    JSON.stringify(before) === JSON.stringify(after),
    "additive migration preserves original amounts/routing/tax/identity",
  );
  await as();
  const detail = (
    await q("select payments_workspace($1,$2,$3)v", [
      "session",
      f.org,
      { id: before.session_id },
    ])
  ).rows[0].v;
  ok(
    detail.lines[0].purpose === "event_fee",
    "pre-upgrade Form purpose derives from exact original version",
  );
  ok(
    detail.receipt.charitable_minor === "0" &&
      detail.receipt.non_charitable_minor === "2500",
    "pre-upgrade event fee receipt remains non-charitable",
  );
  const draft = await form("draft", { id: fee.form.id });
  // Publishing a donation revision must not reclassify the old event-fee session.
  const saved = await form("save", {
    id: fee.form.id,
    revision: draft.version.revision,
    definition: paymentDefinition("donation"),
  });
  await form("publish", {
    id: fee.form.id,
    version_id: draft.version.id,
    revision: saved.version.revision,
  });
  const still = (
    await q("select payments_workspace($1,$2,$3)v", [
      "session",
      f.org,
      { id: before.session_id },
    ])
  ).rows[0].v;
  ok(
    still.lines[0].purpose === "event_fee" &&
      still.receipt.non_charitable_minor === "2500",
    "later Form publication never changes old fee classification",
  );
  await db.exec("reset role");
  for(const m of migrationOrder.slice(migrationOrder.indexOf(upgrade)+1))await db.exec(readFileSync(new URL('../../supabase/migrations/'+m,import.meta.url),'utf8'));
  await as();const afterNmi=(await q('select payments_workspace($1,$2,$3)v',['session',f.org,{id:before.session_id}])).rows[0].v;
  ok(afterNmi.lines[0].purpose==='event_fee'&&afterNmi.receipt.non_charitable_minor==='2500','GIV-3B preserves accepted old Form classification');
  await db.exec('reset role');ok((await q('select count(*)::int n from private.payments_nmi_accounts')).rows[0].n===0,'upgrade creates no sandbox account or activation');
  console.log(n + " GIV-3A/GIV-3B upgrade compatibility checks passed");
} catch (e) {
  console.error(e.message, e.where || "");
  process.exitCode = 1;
} finally {
  await db.close();
}
