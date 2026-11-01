// Disposable PostgreSQL only. Fictional Auth table rows, NOT hosted authentication.
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';import {migrationOrder} from '../backend-tests/migration-order.mjs';import {createCampaignSummaryReader} from './campaign-summary.mjs';
const db=await localPostgres(),q=(...a)=>db.query(...a),read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');let n=0;const ck=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
try{
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(read('supabase/bootstrap/automatic-rls.sql'));for(const f of migrationOrder)await db.exec(read('supabase/migrations/'+f));
 const org=(await q("select id from organizations where slug='sowgo'")).rows[0].id;const user=randomUUID(),other=randomUUID(),campaign=randomUUID(),foreign=randomUUID();
 for(const id of[user,other])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,id+'@example.invalid']);
 for(const id of[campaign,foreign])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,'Fictional','Fictional','US','UTC','approved')",[id,org,'fictional_'+id.replaceAll('-','_')]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'local_leader',array['view','registration.view'],'Fictional adapter test')",[campaign,user]);
 let current=user,revokeOnList=false;const admin=await db.connect();
 const as=async id=>{current=id;await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const rpc=async(name,p)=>{assert.equal(name,'outreach_registration_workspace');assert.ok(['list','context'].includes(p.p_action));try{const data=(await q('select public.outreach_registration_workspace($1,$2,$3) v',[p.p_action,p.p_campaign,p.p_payload])).rows[0].v;if(revokeOnList&&p.p_action==='list')await admin.query('update outreach_campaign_assignments set active=false where user_id=$1',[user]);return {data};}catch(e){return {error:{code:e.code}}}};
 const reader=createCampaignSummaryReader({getVerifiedSession:async()=>({verified:true,userId:current,sessionId:'fictional',generation:1}),rpc});
 await as(user);const dto=await reader.read(campaign);ck(dto.counts.households===0&&dto.counts.attendees===0,'real SQL summary maps empty campaign');ck(dto.kind==='event-registration-summary'&&dto.decisionEngagement==='not-linked','event/decision separation');
 await assert.rejects(reader.read(foreign),{code:'ACCESS_DENIED'});ck(true,'other campaign denied by native RPC');
 await as(other);await assert.rejects(reader.read(campaign),{code:'ACCESS_DENIED'});ck(true,'unassigned user denied');
 await as(user);await admin.query('update auth.users set email_confirmed_at=null where id=$1',[user]);await assert.rejects(reader.read(campaign),{code:'ACCESS_DENIED'});ck(true,'server denies unverified subject despite adapter session claim');await admin.query('update auth.users set email_confirmed_at=now() where id=$1',[user]);
 await admin.query("update outreach_campaign_assignments set effective_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where user_id=$1",[user]);await assert.rejects(reader.read(campaign),{code:'ACCESS_DENIED'});ck(true,'expired campaign assignment denied');await admin.query('update outreach_campaign_assignments set expires_at=null where user_id=$1',[user]);
 revokeOnList=true;await assert.rejects(reader.read(campaign),{code:'ACCESS_DENIED'});ck(true,'native revocation after list blocks DTO release');revokeOnList=false;
 await admin.query('update outreach_campaign_assignments set active=true where user_id=$1',[user]);ck((await reader.read(campaign)).counts.attendees===0,'fresh reauthorization works');
 for(const cap of ['finance.read','people.read','staff.manage']){ck(!(await q('select private.has_staff_permission($1,$2) v',[org,cap])).rows[0].v,'no '+cap+' inherited');}
 console.log(n+' native integration assertions PASS');
}finally{await db.close();}
