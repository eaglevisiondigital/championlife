// Existing production RPC discovery, native PostgreSQL, fictional subjects only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID as uuid} from 'node:crypto';
import {localPostgres} from './local-postgres.mjs';
import {migrationOrder} from './migration-order.mjs';
const db=await localPostgres(),q=(s,p=[])=>db.query(s,p),read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const user=uuid(),other=uuid(),campaign=uuid(),foreign=uuid();
const as=async(id,role='authenticated')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)};
const staff=async()=> (await q('select public.staff_workspace_context() v')).rows[0].v;
const reg=async(action,c=null)=>(await q('select public.outreach_registration_workspace($1,$2,$3) v',[action,c,{}])).rows[0].v;
const deny=async(fn,m)=>{await assert.rejects(fn);ok(true,m)};
try{
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(read('supabase/bootstrap/automatic-rls.sql'));for(const f of migrationOrder)await db.exec(read('supabase/migrations/'+f));
 const org=(await q("select id from organizations where slug='sowgo'")).rows[0].id;
 for(const id of[user,other])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,id+'@example.test']);
 for(const[c,code]of[[campaign,'shell_synthetic_a'],[foreign,'shell_synthetic_b']])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,$3,'Fictional','US','UTC','approved')",[c,org,code]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'local_leader',array['view','registration.view'],'Synthetic shell scope')",[campaign,user]);
 await as(user);let s=await staff();ok(!s.organizations.length&&!s.grants.length,'campaign-only user receives no organization People projection');
 ok((await reg('campaigns')).map(c=>c.id).join()===campaign,'campaign discovery exposes only assigned campaign');
 const ctx=await reg('context',campaign);ok(ctx.capabilities.includes('registration.view'),'assigned view is effective');
 for(const cap of['registration.manage','registration.export','checkin.manage'])ok(!ctx.capabilities.includes(cap),'no inferred '+cap);
 await deny(()=>reg('context',foreign),'guessed other campaign context denied');await deny(()=>reg('list',foreign),'guessed other campaign records denied');await deny(()=>reg('csv',campaign),'view-only CSV denied');
 await deny(()=>q('select public.people_workspace($1,$2,$3)',[org,'list',{}]),'campaign grant cannot enumerate organization People');
 for(const permission of['finance.read','staff.manage','followup.read','care.read'])ok(!(await q('select private.has_staff_permission($1,$2) v',[org,permission])).rows[0].v,'no inherited '+permission);
 await as(other);ok((await reg('campaigns')).length===0,'unassigned user sees zero campaign names');await deny(()=>reg('context',campaign),'unassigned direct context denied');
 await as(null,'anon');await deny(()=>staff(),'anonymous staff projection denied');await deny(()=>reg('campaigns'),'anonymous campaign projection denied');
 await as(user);await db.exec('reset role');await q('update auth.users set email_confirmed_at=null where id=$1',[user]);await as(user);ok((await reg('campaigns')).length===0,'unverified subject has no campaign projection');await deny(()=>reg('context',campaign),'unverified direct context denied');
 await db.exec('reset role');await q('update auth.users set email_confirmed_at=now() where id=$1',[user]);await q("update outreach_campaign_assignments set expires_at=now()-interval '1 minute',effective_at=now()-interval '1 day' where user_id=$1",[user]);await as(user);ok((await reg('campaigns')).length===0,'expired grant removed from discovery');await deny(()=>reg('context',campaign),'expired direct context denied');
 await db.exec('reset role');await q('update outreach_campaign_assignments set expires_at=null,active=false where user_id=$1',[user]);await as(user);ok((await reg('campaigns')).length===0,'revoked grant removed from discovery');await deny(()=>reg('context',campaign),'same subject revoked context denied');
 console.log(checks+' shared-shell native authorization checks passed');
}finally{await db.close()}
