import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {migrationOrder} from './migration-order.mjs';
import {paymentsFixtureSQL,f} from './payments-fixture.mjs';
export {f};
export const form='b1000000-0000-4000-8000-000000000001',cap='a'.repeat(64),network='b'.repeat(64);
export async function database(){const db=new PGlite();for(const name of ['fixtures/supabase-test-bootstrap.sql','../../supabase/bootstrap/automatic-rls.sql',...migrationOrder.map(x=>'../../supabase/migrations/'+x)])await db.exec(readFileSync(new URL(name,import.meta.url),'utf8'));await db.exec(paymentsFixtureSQL);return db;}
export const seed=`
insert into private.nmi_giving_control(organization_id,enabled,receipt_identity,fallback_path)values('${f.org}',true,'SYNTHETIC receipt identity','/give.html');
insert into private.nmi_giving_forms(id,organization_id,slug,label,enabled,recurring_allowed)values('${form}','${f.org}','synthetic-main','SYNTHETIC GIVING',true,true);
insert into private.nmi_giving_form_funds(organization_id,form_id,fund_id)values('${f.org}','${form}','${f.mainFund}');
update giving_processor_routes set mid_reference='synthetic-mid-main'where id='${f.mainRoute}';
insert into private.payments_nmi_accounts(organization_id,gateway_id,enabled,last_verified_at,merchant_reference,subscription_default_verified,subscription_default_route_id,gateway_timezone)values('${f.org}','${f.nmi}',true,now(),'synthetic-merchant',true,'${f.mainRoute}','America/Chicago');
insert into private.payments_nmi_routes(organization_id,gateway_id,route_id,processor_id,enabled,verified_at,proof_reference)values('${f.org}','${f.nmi}','${f.mainRoute}','synthetic-main',true,now(),'SYNTHETIC isolated proof');
insert into private.nmi_giving_route_proofs(organization_id,gateway_id,route_id,enabled,mid_reference,settlement_reference,merchant_reference,public_tokenization_key,verified_at,proof_reference)values('${f.org}','${f.nmi}','${f.mainRoute}',true,'synthetic-mid-main','synthetic-settlement','synthetic-merchant','xxxxxx-xxxxxx-xxxxxx-xxxxxx',now(),'SYNTHETIC isolated proof');
insert into organization_staff_permissions(organization_id,user_id,permission)select '${f.org}','${f.admin}',k from unnest(private.payment_ops_permissions())k on conflict do nothing;
`;
