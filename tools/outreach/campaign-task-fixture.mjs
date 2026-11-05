// Disposable native PostgreSQL fixture ONLY. No remote URL, real account or provider authentication.
import {randomUUID as uuid,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {installCampaignBaseline} from './campaign-foundation-baseline.mjs';
import {FOUNDATION} from './campaign-assignment-contract.mjs';
export const TASK_MIGRATION='supabase/migrations/20261105223940_campaign_person_task_boundary.sql';
export async function createCampaignTaskFixture({install=true,seedBinding=true}={}){
 const db=await localPostgres(),q=(...a)=>db.query(...a);
 try{
 await installCampaignBaseline(db);
 const foundation=readFileSync(new URL('../../'+FOUNDATION.migration,import.meta.url),'utf8');assert.equal(createHash('sha256').update(foundation).digest('hex'),FOUNDATION.sha256);await db.exec(foundation);
 if(install)await db.exec(readFileSync(new URL('../../'+TASK_MIGRATION,import.meta.url),'utf8'));
 const orgId=(await q("select id from organizations where slug='sowgo'")).rows[0].id;
 const foreignOrgId=(await q("select id from organizations where slug='champion-life'")).rows[0].id;
 const users=Object.fromEntries(['worker','other','campaignOnly','peopleOnly','reviewer','learner','minor','unknown','unverified'].map(k=>[k,{id:uuid(),sessionId:uuid(),token:'fictional-'+k}]));
 for(const [k,u] of Object.entries(users)){
  await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,$3)',[u.id,k+'@example.invalid',k==='unverified'?null:new Date()]);
  await q("insert into auth.sessions(id,user_id,not_after)values($1,$2,clock_timestamp()+interval '1 hour')",[u.sessionId,u.id]);
 }
 const setClaims=async(c,u)=>{await c.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[u.id,JSON.stringify({sub:u.id,session_id:u.sessionId,exp:Math.floor(Date.now()/1000)+3600})]);};
 const authenticatedQuery=async(who,sql,args=[])=>{const u=typeof who==='string'?Object.values(users).find(x=>x.token===who)||users[who]:who;if(!u)throw Error('Unknown fictional account');const c=await db.connect();try{await setClaims(c,u);await c.query('set role authenticated');return await c.query(sql,args)}finally{await c.end()}};
 const campaignId=uuid(),otherCampaignId=uuid(),foreignCampaignId=uuid(),personId=uuid(),taskId=uuid(),ordinaryTaskId=uuid(),registrationId=uuid(),bindingId=uuid(),registrantId=uuid();
 for(const [cid,org]of[[campaignId,orgId],[otherCampaignId,orgId],[foreignCampaignId,foreignOrgId]])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,'Fictional campaign','Fixture','US','UTC','approved')",[cid,org,'fixture_'+cid.replaceAll('-','_')]);
 await q("insert into outreach_decision_campaign_sources(campaign_id,source)values($1,'fictional_task_source')",[campaignId]);
 for(const key of ['worker','other','campaignOnly','unverified'])await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,care_scope,decision_effective_at,decision_expires_at,reason)values($1,$2,'local_leader',array['view','decisions.read','followup.manage'],'assigned',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour','Fictional task test only')",[campaignId,users[key].id]);
 for(const key of ['worker','other','peopleOnly','reviewer']){
  await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Fictional worker')",[orgId,users[key].id]);
  for(const permission of ['people.read','followup.read','followup.manage',...(key==='reviewer'?['people.create','portal.manage','staff.manage','tags.read']:[])])await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[orgId,users[key].id,permission]);
 }
 await setClaims(db,users.reviewer);
 await q('insert into private.people(id)values($1)',[personId]);
 await q("insert into organization_people(id,human_id,organization_id,first_name,last_name)values($1,$1,$2,'Fictional','Person')",[personId,orgId]);
 await authenticatedQuery('reviewer','select public.set_portal_account_link($1,$2,$3,true,$4,0)',[orgId,personId,'learner@example.invalid','Fictional independently reviewed linkage only']);
 const link=(await q('select * from portal_account_links where person_id=$1',[personId])).rows[0];
 await q("insert into outreach_registrations(id,user_id,first_name,last_name,email,phone,source,decision,prayer_request,consent)values($1,$2,'Private','Source','private@example.invalid','15555550123','fictional_task_source','salvation','PRIVATE-PRAYER',true)",[registrationId,users.learner.id]);
 await q('insert into outreach_decision_followup(registration_id,campaign_id,assigned_user_id,updated_by)values($1,$2,$3,$3)',[registrationId,campaignId,users.worker.id]);
 await q('insert into outreach_campaign_registrants(id,campaign_id,organization_id,legacy_registration_id,person_id)values($1,$2,$3,$4,$5)',[registrantId,campaignId,orgId,registrationId,personId]);
 // Existing canonical task/audit is created with its own accepted ordinary authority first.
 await setClaims(db,users.worker);
 for(const id of [taskId,ordinaryTaskId])await q("insert into followup_tasks(id,organization_id,person_id,title,due_on,assigned_user_id)values($1,$2,$3,'Outreach follow-up','2026-11-10',$4)",[id,orgId,personId,users.worker.id]);
 const binding={id:bindingId,task_id:taskId,organization_id:orgId,campaign_id:campaignId,registration_id:registrationId,person_id:personId,account_id:users.learner.id,portal_link_id:link.id,portal_link_revision:link.revision,campaign_registrant_id:registrantId,campaign_registrant_revision:1,source:'fictional_task_source',source_evidence_sha256:'1'.repeat(64),identity_evidence_sha256:'2'.repeat(64),adult_evidence_sha256:'3'.repeat(64),reviewer_authority_sha256:'4'.repeat(64),requested_by:users.worker.id,reviewed_by:users.reviewer.id,reviewed_at:new Date(Date.now()-60000),valid_until:new Date(Date.now()+3600000),eligibility:'verified_adult',revision:1};
 const insertBinding=async(value=binding)=>{const fields=Object.keys(value);return q(`insert into private.campaign_person_task_bindings(${fields.join(',')})values(${fields.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(value))};
 await setClaims(db,users.reviewer);
 if(install&&seedBinding)await insertBinding();
 const selection={organizationId:orgId,campaignId,registrationId,taskId,bindingId,bindingRevision:1};
 const args={p_org:orgId,p_campaign:campaignId,p_registration:registrationId,p_payload:{task_id:taskId,binding_id:bindingId,binding_revision:1}};
 const requests=[];
 const rpc=async(token,a=args)=>{requests.push({token,args:structuredClone(a)});return(await authenticatedQuery(token,'select public.campaign_person_task_context($1,$2,$3,$4) v',[a.p_org,a.p_campaign,a.p_registration,a.p_payload])).rows[0].v};
 return {db,q,users,orgId,foreignOrgId,campaignId,otherCampaignId,foreignCampaignId,personId,taskId,ordinaryTaskId,registrationId,bindingId,bindingRevision:1,registrantId,link,binding,selection,args,requests,authenticatedQuery,rpc,context:rpc,insertBinding,setClaims,
  revoke:who=>q('update outreach_campaign_assignments set active=false where user_id=$1',[users[who]?.id||who]),
  retire:who=>q("update auth.sessions set not_after=clock_timestamp()-interval '1 minute' where user_id=$1",[users[who]?.id||who]),
  withdraw:()=>q('update outreach_registrations set consent=false where id=$1',[registrationId]),
  reset:async()=>{await q('update outreach_campaign_assignments set active=true');await q("update auth.sessions set not_after=clock_timestamp()+interval '1 hour'");await q('update outreach_registrations set consent=true where id=$1',[registrationId]);},
  counts:async()=>({tasks:(await q('select count(*) n from followup_tasks')).rows[0].n,audits:(await q('select count(*) n from followup_task_events')).rows[0].n}),
  close:()=>db.close()};
 }catch(e){await db.close();throw e}
}
