import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {migrationOrder} from './migration-order.mjs';
const db=new PGlite(),q=(sql,args=[])=>db.query(sql,args);
await db.exec(readFileSync(new URL('fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));
for(const name of migrationOrder)await db.exec(readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
assert.deepEqual((await q("select private.outreach_abuse_limit('network') n,private.outreach_abuse_limit('email') e,private.outreach_abuse_limit('phone') p,private.outreach_abuse_limit('other') unknown")).rows[0],{n:120,e:5,p:5,unknown:0});
for(const role of ['anon','authenticated','service_role']){
 await db.exec('set role '+role);
 await assert.rejects(()=>q('select private.outreach_abuse_cleanup()'));
 await assert.rejects(()=>q("select private.outreach_abuse_limit('network')"));
 await db.exec('reset role');
}
console.log('PASS centralized 120/5/5 policy and cleanup/helper execution denied to API roles');
await db.exec(`
insert into auth.users(id,email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cleanup@example.test');
-- Synthetic fixture setup only, following the existing People test convention.
alter table public.organization_people disable trigger user;
insert into private.people(id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.organization_people(organization_id,first_name,last_name,human_id)
select id,'Synthetic','Retained','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' from public.organizations where slug='sowgo';
alter table public.organization_people enable trigger user;
insert into public.outreach_partner_intakes(organization_id,source_site,source_path,raw_submission,email_normalized,phone_normalized,commitment_amount,commitment_frequency,request_key,payload_hash)
select id,'sowgo','/outreach-partner.html','{}','cleanup@example.test','15555555555',25,'Monthly',gen_random_uuid(),'synthetic' from public.organizations where slug='sowgo';
insert into private.outreach_partner_audit(intake_id,actor_id,action)
select id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','synthetic-test' from public.outreach_partner_intakes;
insert into private.outreach_abuse_windows
select 'network',lpad(to_hex(n),64,'0'),clock_timestamp()-interval '25 hours',1 from generate_series(1,1001) n;
insert into private.outreach_abuse_windows values
('email',repeat('e',64),clock_timestamp()+interval '1 hour',5),
('phone',repeat('f',64),clock_timestamp()-interval '1 hour',5);
`);
const snapshot=async()=>{
 const rows=[];
 for(const table of ['public.outreach_partner_intakes','private.outreach_partner_audit','public.organization_people','private.people','public.organization_admin_events'])
  rows.push((await q(`select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') v from ${table} t`)).rows[0].v);
 return rows;
};
const before=await snapshot();
assert.equal((await q('select private.outreach_abuse_cleanup() n')).rows[0].n,1000);
assert.equal((await q('select count(*)::int n from private.outreach_abuse_windows')).rows[0].n,3);
assert.equal((await q('select private.outreach_abuse_cleanup() n')).rows[0].n,1);
assert.equal((await q('select private.outreach_abuse_cleanup() n')).rows[0].n,0);
assert.deepEqual((await q('select dimension,attempts from private.outreach_abuse_windows order by dimension')).rows,[{dimension:'email',attempts:5},{dimension:'phone',attempts:5}]);
assert.deepEqual(await snapshot(),before);
assert.deepEqual((await q("select column_name from information_schema.columns where table_schema='private' and table_name='outreach_abuse_windows' order by column_name")).rows.map(r=>r.column_name),['attempts','dimension','fingerprint','window_ends_at']);
console.log('PASS 1001 stale windows removed in 1000+1 batches; active/recent windows and intake/audit/People bytes preserved; no raw-IP column');
await db.close();
