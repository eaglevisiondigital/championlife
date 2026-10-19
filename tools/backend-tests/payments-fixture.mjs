import { f, fixtureSQL, sessionPayload } from "./giving-fixture.mjs";
export { f, fixtureSQL };
export const ids = {
  outreachRoute: "91000000-0000-4000-8000-000000000001",
  eventsRoute: "91000000-0000-4000-8000-000000000002",
  merchRoute: "91000000-0000-4000-8000-000000000003",
  outreachDest: "91000000-0000-4000-8000-000000000004",
  eventsDest: "91000000-0000-4000-8000-000000000005",
  merchDest: "91000000-0000-4000-8000-000000000006",
  outreachFund: "91000000-0000-4000-8000-000000000007",
  secondAN: "91000000-0000-4000-8000-000000000008",
  secondANRoute: "91000000-0000-4000-8000-000000000009",
};
export const paymentsFixtureSQL =
  fixtureSQL +
  `
update giving_funds set is_public=true where organization_id='${f.org}';
insert into organization_staff_permissions(organization_id,user_id,permission)select '${f.org}','${f.admin}',k from unnest(private.payments_permissions()||private.forms_permissions())k;
insert into organization_staff_permissions(organization_id,user_id,permission)values('${f.org}','${f.reader}','payments.view');
insert into private.giving_donor_account_links(organization_id,person_id,user_id,active,verification_reference)values('${f.org}','${f.person}','${f.donor}',true,'synthetic-local-review');
insert into giving_processor_routes(id,organization_id,gateway_id,label,processor_reference,provider_route_key,external_processor_id)values('${ids.outreachRoute}','${f.org}','${f.nmi}','Outreach MID','OUTREACH','OUTREACH','synthetic-outreach'),('${ids.eventsRoute}','${f.org}','${f.nmi}','Events MID','EVENTS','EVENTS','synthetic-events'),('${ids.merchRoute}','${f.org}','${f.nmi}','Merch MID','MERCH','MERCH','synthetic-merch');
insert into giving_destinations(id,organization_id,purpose,provider,checkout_label,merchant_label,gateway_id,processor_route_id)values('${ids.outreachDest}','${f.org}','outreach','nmi','Outreach','Outreach Merchant','${f.nmi}','${ids.outreachRoute}'),('${ids.eventsDest}','${f.org}','event','nmi','Events','Events Merchant','${f.nmi}','${ids.eventsRoute}'),('${ids.merchDest}','${f.org}','merch','nmi','Book','Merch Merchant','${f.nmi}','${ids.merchRoute}');
insert into giving_funds(id,organization_id,destination_id,name,code,tax_eligible)values('${ids.outreachFund}','${f.org}','${ids.outreachDest}','OUTREACH','outreach',true);
insert into giving_gateway_accounts(id,organization_id,provider,label)values('${ids.secondAN}','${f.org}','authorize_net','Authorize.Net Youth');
insert into giving_processor_routes(id,organization_id,gateway_id,label,processor_reference,provider_route_key)values('${ids.secondANRoute}','${f.org}','${ids.secondAN}','AN Youth','AN_YOUTH','AN_YOUTH');
`;
export function checkout(key, extra = {}) {
  return {
    request_key: key,
    person_id: f.person,
    household_id: f.household,
    currency: "USD",
    intended_minor: "38500",
    source: "web",
    receipt_email: "synthetic@example.test",
    recurring_choice: "once",
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
        fund_id: ids.outreachFund,
        purpose: "charitable_contribution",
        amount_minor: "10000",
      },
      {
        destination_id: ids.merchDest,
        purpose: "merchandise",
        amount_minor: "3500",
      },
    ],
    ...extra,
  };
}
