import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { migrationOrder } from "./migration-order.mjs";
import {
  f,
  ids,
  paymentsFixtureSQL,
  checkout as prepare,
} from "./payments-fixture.mjs";
export { f, ids };
export const anet = {
  outreach: "92000000-0000-4000-8000-000000000001",
  events: "92000000-0000-4000-8000-000000000002",
  merch: "92000000-0000-4000-8000-000000000003",
};
export const fixtureSQL =
  paymentsFixtureSQL +
  `
update giving_gateway_accounts set label='Authorize.Net Main'where id='${f.an}';
insert into giving_gateway_accounts(id,organization_id,provider,label)values('${anet.outreach}','${f.org}','authorize_net','Authorize.Net Outreach'),('${anet.events}','${f.org}','authorize_net','Authorize.Net Events'),('${anet.merch}','${f.org}','authorize_net','Authorize.Net Merch');
insert into giving_processor_routes(id,organization_id,gateway_id,label,processor_reference,provider_route_key)values('${anet.outreach}','${f.org}','${anet.outreach}','AN Outreach','AN_OUTREACH','AN_OUTREACH'),('${anet.events}','${f.org}','${anet.events}','AN Events','AN_EVENTS','AN_EVENTS'),('${anet.merch}','${f.org}','${anet.merch}','AN Merch','AN_MERCH','AN_MERCH');
update giving_destinations set provider='authorize_net',gateway_id='${f.an}',processor_route_id='${f.anRoute}'where id='${f.mainDest}';
update giving_destinations set provider='authorize_net',gateway_id='${ids.secondAN}',processor_route_id='${ids.secondANRoute}'where id='${f.youthDest}';
update giving_destinations set provider='authorize_net',gateway_id='${anet.outreach}',processor_route_id='${anet.outreach}'where id='${ids.outreachDest}';
update giving_destinations set provider='authorize_net',gateway_id='${anet.events}',processor_route_id='${anet.events}'where id='${ids.eventsDest}';
update giving_destinations set provider='authorize_net',gateway_id='${anet.merch}',processor_route_id='${anet.merch}'where id='${ids.merchDest}';
update giving_funds set name='Tithe'where id='${f.mainFund}';update giving_funds set name='Youth'where id='${f.youthFund}';
`;
export const checkout = (key, extra = {}) =>
  prepare(key, {
    intended_minor: "28500",
    lines: [
      {
        fund_id: f.mainFund,
        purpose: "charitable_contribution",
        amount_minor: "20000",
      },
      {
        fund_id: f.youthFund,
        purpose: "charitable_contribution",
        amount_minor: "5000",
      },
      {
        destination_id: ids.merchDest,
        purpose: "merchandise",
        amount_minor: "3500",
      },
    ],
    ...extra,
  });
export async function database() {
  const db = new PGlite();
  for (const path of [
    "fixtures/supabase-test-bootstrap.sql",
    "../../supabase/bootstrap/automatic-rls.sql",
    ...migrationOrder.map((m) => "../../supabase/migrations/" + m),
  ])
    await db.exec(readFileSync(new URL(path, import.meta.url), "utf8"));
  await db.exec(fixtureSQL);
  return db;
}
