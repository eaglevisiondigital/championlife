// Synthetic local-only financial fixture. Never apply to hosted projects.
export const id=n=>`74000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const f={org:id(1),other:id(2),admin:id(10),reader:id(11),reporter:id(12),ordinary:id(13),donor:id(14),otherDonor:id(15),person:id(20),secondPerson:id(21),foreignPerson:id(22),household:id(25),an:id(30),nmi:id(31),foreignGateway:id(32),mainRoute:id(40),youthRoute:id(41),anRoute:id(42),mainDest:id(50),youthDest:id(51),anDest:id(52),parent:id(60),mainFund:id(61),youthFund:id(62),anFund:id(63),batch:id(70),scope:id(80)};
export const fixtureSQL=`
insert into organizations(id,slug,name,kind)values('${f.org}','synthetic-giving','Synthetic Giving','church'),('${f.other}','synthetic-other-giving','Synthetic Other','ministry');
insert into auth.users(id,email,email_confirmed_at)select x,'synthetic-'||x||'@example.test',now() from unnest(array['${f.admin}','${f.reader}','${f.reporter}','${f.ordinary}','${f.donor}','${f.otherDonor}']::uuid[])x;
insert into private.people(id)values('${f.person}'),('${f.secondPerson}'),('${f.foreignPerson}');
alter table organization_people disable trigger user;
insert into organization_people(id,organization_id,human_id,first_name,last_name,user_id)values('${f.person}','${f.org}','${f.person}','Synthetic','Donor','${f.donor}'),('${f.secondPerson}','${f.org}','${f.secondPerson}','Second','Donor','${f.otherDonor}'),('${f.foreignPerson}','${f.other}','${f.foreignPerson}','Foreign','Donor',null);
alter table organization_people enable trigger user;
insert into organization_staff_directory(organization_id,user_id,display_name)select '${f.org}',x,'Synthetic Finance' from unnest(array['${f.admin}','${f.reader}','${f.reporter}','${f.ordinary}']::uuid[])x;
insert into organization_staff_permissions(organization_id,user_id,permission)select '${f.org}','${f.admin}',k from unnest(private.giving_permissions())k;
insert into organization_staff_permissions(organization_id,user_id,permission)values('${f.org}','${f.reader}','finance.read'),('${f.org}','${f.reader}','finance.gifts.read'),('${f.org}','${f.reporter}','finance.reports.read'),('${f.org}','${f.ordinary}','outreach.view');
set request.jwt.claim.sub='${f.admin}';
alter table households disable trigger user;alter table household_members disable trigger user;
insert into households(id,organization_id,name)values('${f.household}','${f.org}','Synthetic Household');
insert into household_members(organization_id,household_id,person_id,relationship)values('${f.org}','${f.household}','${f.person}','adult');
alter table households enable trigger user;alter table household_members enable trigger user;
insert into giving_gateway_accounts(id,organization_id,provider,label)values('${f.an}','${f.org}','authorize_net','Synthetic AN'),('${f.nmi}','${f.org}','nmi','Synthetic NMI'),('${f.foreignGateway}','${f.other}','nmi','Foreign gateway');
insert into giving_processor_routes(id,organization_id,gateway_id,label,processor_reference,mid_reference)values('${f.mainRoute}','${f.org}','${f.nmi}','Main MID','synthetic-main','synthetic-mid-main'),('${f.youthRoute}','${f.org}','${f.nmi}','Youth MID','synthetic-youth','synthetic-mid-youth'),('${f.anRoute}','${f.org}','${f.an}','AN MID','synthetic-an','synthetic-mid-an');
insert into giving_destinations(id,organization_id,purpose,provider,checkout_label,merchant_label,gateway_id,processor_route_id)values('${f.mainDest}','${f.org}','main','nmi','Main','Main Merchant','${f.nmi}','${f.mainRoute}'),('${f.youthDest}','${f.org}','youth','nmi','Youth','Youth Merchant','${f.nmi}','${f.youthRoute}'),('${f.anDest}','${f.org}','an','authorize_net','AN','Separate Gateway','${f.an}','${f.anRoute}');
insert into giving_funds(id,organization_id,destination_id,name,code,parent_id,tax_eligible)values('${f.parent}','${f.org}','${f.mainDest}','MISSIONS','missions',null,true),('${f.mainFund}','${f.org}','${f.mainDest}','Foreign Missions','foreign-missions','${f.parent}',true),('${f.youthFund}','${f.org}','${f.youthDest}','Local Missions','local-missions','${f.parent}',true),('${f.anFund}','${f.org}','${f.anDest}','Event Fees','event-fees',null,false);
insert into giving_organization_config(organization_id,timezone,recurring_enabled,currency,service_weekday,service_boundary)values('${f.org}','America/Chicago',true,'USD',0,'06:00'),('${f.other}','UTC',false,'USD',0,'00:00');
insert into giving_batches(id,organization_id,kind,label,currency,batch_date,created_by)values('${f.batch}','${f.org}','service','Synthetic service','USD','2026-10-10','${f.admin}');
insert into giving_text_scopes(id,organization_id,sender_scope)values('${f.scope}','${f.org}','synthetic-shared-number');
`;
export const sessionPayload=(key,extra={})=>({request_key:key,person_id:f.person,household_id:f.household,currency:'USD',intended_minor:45000,source:'web',lines:[{fund_id:f.mainFund,amount_minor:30000},{fund_id:f.youthFund,amount_minor:10000},{fund_id:f.anFund,amount_minor:5000}],...extra});
export const manualPayload=(key,extra={})=>({request_key:key,person_id:f.person,household_id:f.household,fund_id:f.mainFund,amount_minor:10000,currency:'USD',gift_at:'2026-10-10T15:00:00Z',payment_method:'cash',batch_id:f.batch,notes:'Synthetic fixture',...extra});
