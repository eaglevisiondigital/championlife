// Fictional disposable PostgreSQL only. This review fixture creates no hosted
// identities, grants, mappings or evidence. It is not a production producer.
import {randomUUID as uuid} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';

export async function fixture(root, candidateSql) {
 const {localPostgres}=await import(pathToFileURL(join(root,'tools/backend-tests/local-postgres.mjs')));
 const {installCampaignBaseline}=await import(pathToFileURL(join(root,'tools/outreach/campaign-foundation-baseline.mjs')));
 const db=await localPostgres();
 try {
  await installCampaignBaseline(db);
  await db.exec(await readFile(join(root,'supabase/migrations/20261103035250_campaign_assigned_decision_foundation.sql'),'utf8'));
  const q=(...args)=>db.query(...args);
  const org=(await q("select id from public.organizations where slug='sowgo'")).rows[0].id;
  const foreignOrg=(await q("select id from public.organizations where slug='champion-life'")).rows[0].id;
  const ids=Object.fromEntries(['dual','campaignOnly','peopleOnly','reviewer','subject','otherSubject','campaign','otherCampaign','foreignCampaign','person','otherPerson','registration','ordinaryTask','department'].map(k=>[k,uuid()]));
  const sessions={};
  for(const key of ['dual','campaignOnly','peopleOnly','reviewer','subject','otherSubject']) {
   sessions[key]=uuid();
   await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,clock_timestamp())',[ids[key],key+'@independent.invalid']);
   await q("insert into auth.sessions(id,user_id,not_after)values($1,$2,clock_timestamp()+interval '1 hour')",[sessions[key],ids[key]]);
  }
  for(const key of ['dual','peopleOnly','reviewer']) {
   await q("insert into public.organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Independent fictional worker')",[org,ids[key]]);
   const permissions=key==='reviewer'?['people.read','tags.read','portal.manage','staff.manage']:['people.read','followup.read','followup.manage'];
   for(const p of permissions)await q('insert into public.organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[org,ids[key],p]);
  }
  for(const [key,o] of [['campaign',org],['otherCampaign',org],['foreignCampaign',foreignOrg]])await q("insert into public.outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,'Independent fictional campaign','Synthetic','US','UTC','approved')",[ids[key],o,'independent_'+key.toLowerCase()]);
  await q("insert into public.outreach_decision_campaign_sources(campaign_id,source)values($1,'independent_primary'),($2,'independent_other')",[ids.campaign,ids.otherCampaign]);
  for(const key of ['dual','campaignOnly'])await q("insert into public.outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,care_scope,decision_effective_at,decision_expires_at,reason)values($1,$2,'local_leader',array['view','decisions.read','followup.manage'],'assigned',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour','Independent fictional scope')",[ids.campaign,ids[key]]);
  await q("insert into public.outreach_registrations(id,first_name,last_name,email,phone,decision,prayer_request,source,user_id,consent)values($1,'PRIVATE-FIRST','PRIVATE-LAST','PRIVATE-CONTACT@independent.invalid','15555550111','prayer_followup','PRIVATE-PRAYER','independent_primary',$2,true)",[ids.registration,ids.subject]);
  await q('insert into public.outreach_decision_followup(registration_id,campaign_id,assigned_user_id,updated_by)values($1,$2,$3,$3)',[ids.registration,ids.campaign,ids.dual]);
  // Canonical fixture identities are explicitly different UUIDs, never inferred
  // from names/emails. Accepted link RPC supplies its own audit/revision contract.
  await db.exec('alter table public.organization_people disable trigger user');
  for(const key of ['person','otherPerson']) {
   await q('insert into private.people(id)values($1)',[ids[key]]);
   await q("insert into public.organization_people(id,human_id,organization_id,first_name,last_name)values($1,$1,$2,'Synthetic','Person')",[ids[key],org]);
  }
  await db.exec('alter table public.organization_people enable trigger user');
  await q("select set_config('request.jwt.claim.sub',$1,false)",[ids.reviewer]);
  await q("select public.set_portal_account_link($1,$2,'subject@independent.invalid',true,'Independent fixture account review',0)",[org,ids.person]);
  await q("select public.set_portal_account_link($1,$2,'',true,'Independent fixture continued review',1)",[org,ids.person]);
  await q("select set_config('request.jwt.claim.sub','',false)");
  await q('insert into public.outreach_campaign_registrants(campaign_id,organization_id,legacy_registration_id,person_id)values($1,$2,$3,$4)',[ids.campaign,org,ids.registration,ids.person]);
  if(candidateSql)await db.exec(await readFile(candidateSql,'utf8'));
  const connect=async(key='dual',claims={})=>{
   const c=await db.connect();
   await c.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ids[key],JSON.stringify({sub:ids[key],session_id:sessions[key],exp:Math.floor(Date.now()/1000)+3600,...claims})]);
   await c.query('set role authenticated');return c;
  };
  const actor=await connect('dual');
  const ordinary=(await actor.query("insert into public.followup_tasks(organization_id,person_id,title,due_on)values($1,$2,'Ordinary unrelated task','2026-12-01')returning id",[org,ids.otherPerson])).rows[0].id;
  ids.ordinaryTask=ordinary;
  return{db,q,ids,sessions,org,foreignOrg,connect};
 }catch(error){await db.close();throw error}
}
