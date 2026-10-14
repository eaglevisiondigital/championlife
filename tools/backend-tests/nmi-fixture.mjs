import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { migrationOrder } from "./migration-order.mjs";
import {
  f,
  ids,
  paymentsFixtureSQL,
  checkout as givingCheckout,
} from "./payments-fixture.mjs";
export { f, ids };
export const checkout = (key, extra = {}) =>
  givingCheckout(key, {
    intended_minor: "3850",
    lines: [
      {
        fund_id: f.mainFund,
        purpose: "charitable_contribution",
        amount_minor: "2000",
      },
      {
        fund_id: f.youthFund,
        purpose: "charitable_contribution",
        amount_minor: "500",
      },
      {
        fund_id: ids.outreachFund,
        purpose: "charitable_contribution",
        amount_minor: "1000",
      },
      {
        destination_id: ids.merchDest,
        purpose: "merchandise",
        amount_minor: "350",
      },
    ],
    ...extra,
  });
export async function nmiDatabase() {
  const db = new PGlite();
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
  return db;
}
export const seedRoutes = `insert into private.payments_nmi_accounts(organization_id,gateway_id,enabled,last_verified_at,merchant_reference)values('${f.org}','${f.nmi}',true,now(),'mock-merchant');insert into private.payments_nmi_routes(organization_id,gateway_id,route_id,processor_id,enabled,verified_at,proof_reference)select organization_id,gateway_id,id,'mock-'||coalesce(provider_route_key,case when id='${f.mainRoute}'then 'MAIN'else 'YOUTH'end),true,now(),'OFFLINE TEST FIXTURE ONLY'from giving_processor_routes where gateway_id='${f.nmi}';`;
