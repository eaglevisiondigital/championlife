// Disposable, source-matched PostgreSQL only; fixture Auth is not provider acceptance.
import assert from 'node:assert/strict';
import {randomUUID as uuid,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {installCampaignBaseline} from './campaign-foundation-baseline.mjs';
import {FOUNDATION} from './campaign-assignment-contract.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const migration='supabase/migrations/20261103114754_campaign_decision_directory.sql',sql=read(migration);
const foundation=read(FOUNDATION.migration);assert.equal(createHash('sha256').update(foundation).digest('hex'),FOUNDATION.sha256);
console.log('Directory migration '+migration+' SHA256 '+createHash('sha256').update(sql).digest('hex'));
const db=await localPostgres(),q=(...a)=>db.query(...a);let count=0;
const check=(v,m)=>{assert.ok(v,m);console.log('PASS '+(++count)+' '+m)};
const reject=async(fn,m,codes=['42501'])=>{await assert.rejects(fn,e=>codes.includes(e.code));check(true,m)};
try {
 await installCampaignBaseline(db);await db.exec(foundation);
 const preserved=(await q("select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where pronamespace in ('public'::regnamespace,'private'::regnamespace) order by 1")).rows;
 for(const [change,label] of [
  ["grant execute on function public.campaign_decision_foundation(text,uuid,uuid,jsonb) to anon",'anonymous inherited foundation execute'],
  ["grant execute on function private.campaign_foundation_session() to authenticated",'exposed session helper'],
  ["grant select on outreach_decision_followup to authenticated",'raw followup table read'],
  ["alter table outreach_decision_followup disable row level security",'disabled foundation RLS'],
  ["create or replace function public.campaign_decision_foundation(p_action text,p_org uuid,p_campaign uuid,p_payload jsonb default '{}') returns jsonb language sql as 'select null::jsonb'",'foundation function source drift']
 ]) {
  await q('begin');await q(change);await reject(()=>db.exec(sql),label+' rejects installation',['P0001']);await q('rollback');
  check((await q("select to_regprocedure('public.campaign_decision_directory()') p")).rows[0].p===null,'failed preflight installs no directory');
 }
 for(const namespace of ['public','private']) {
  await q('begin');await q('create role unreviewed_directory_default');
  await q('alter default privileges in schema '+namespace+' grant execute on functions to unreviewed_directory_default');
  await reject(()=>db.exec(sql),namespace+' custom default EXECUTE rejects installation',['P0001']);await q('rollback');
  check((await q("select to_regprocedure('public.campaign_decision_directory()') p,to_regprocedure('private.campaign_decision_directory()') i")).rows.every(r=>r.p===null&&r.i===null),'default ACL rejection rolls back both directory functions');
 }
 await db.exec(sql);
 assert.deepEqual((await q("select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where pronamespace in ('public'::regnamespace,'private'::regnamespace) and proname<>'campaign_decision_directory' order by 1")).rows,preserved);check(true,'all existing functions and execute ACLs byte-identical');
 await reject(()=>db.exec(sql),'repeat installation requires reconciliation',['P0001']);await q('rollback');
 const org=(await q("select id from organizations where slug='sowgo'")).rows[0].id,otherOrg=(await q("select id from organizations where slug='champion-life'")).rows[0].id;
 const users=Object.fromEntries(['worker','reader','registration','people','none','unverified'].map(k=>[k,{id:uuid(),sid:uuid()}]));
 for(const [k,u] of Object.entries(users)){await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,$3)',[u.id,k+'@example.invalid',k==='unverified'?null:new Date()]);await q("insert into auth.sessions(id,user_id,not_after)values($1,$2,now()+interval '1 hour')",[u.sid,u.id]);}
 const ca='10000000-0000-4000-8000-000000000001',cb='20000000-0000-4000-8000-000000000002',foreign='30000000-0000-4000-8000-000000000003';
 for(const [id,o,name] of [[ca,org,'Assigned campaign'],[cb,org,'Second assigned campaign'],[foreign,otherOrg,'PRIVATE OTHER ORGANIZATION']]){await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,$4,'PRIVATE CITY','US','UTC','approved')",[id,o,'directory_'+id.replaceAll('-','_'),name]);await q('insert into outreach_decision_campaign_sources(campaign_id,source)values($1,$2)',[id,'directory_'+id.replaceAll('-','_')]);}
 for(const [key,campaign,caps] of [['worker',ca,['view','decisions.read','followup.manage']],['worker',cb,['view','decisions.read']],['reader',ca,['view','decisions.read']],['unverified',ca,['view','decisions.read']]])await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,care_scope,decision_effective_at,decision_expires_at,reason)values($1,$2,'local_leader',$3,'assigned',now()-interval '1 hour',now()+interval '1 hour','Synthetic fixture')",[campaign,users[key].id,caps]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'host_pastor',array['view','registration.view','registration.manage','registration.export','checkin.manage'],'Synthetic event only')",[ca,users.registration.id]);
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic unrelated broad authority')",[org,users.people.id]);
 for(const permission of ['people.read','outreach.view','followup.manage','staff.manage','finance.read'])await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[org,users.people.id,permission]);
 await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Synthetic event admin')",[org,users.people.id]);
 const connect=async(key='worker',override={})=>{const u=users[key],c=await db.connect();await c.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[u.id,JSON.stringify({sub:u.id,session_id:u.sid,exp:Math.floor(Date.now()/1000)+3600,...override})]);await c.query('set role authenticated');return c};
 const directory=c=>c.query('select public.campaign_decision_directory() v').then(r=>r.rows[0].v);
 const conn=await connect(),reader=await connect('reader');
 let result=await directory(conn);check(result.kind==='assigned-decision-campaign-directory'&&result.campaigns.length===2,'finite decision-only worker discovers exact two authorized campaigns');
 check(result.campaigns[0].campaign_id===ca&&result.campaigns[1].campaign_id===cb,'directory deterministic by UUID lock order');
 check(JSON.stringify(result.campaigns[0].capabilities)==='["decisions.read","followup.manage"]'&&JSON.stringify(result.campaigns[1].capabilities)==='["decisions.read"]','capabilities match each authoritative current context');
 check(Object.keys(result).sort().join(',')==='campaigns,kind'&&result.campaigns.every(c=>Object.keys(c).sort().join(',')==='campaign_id,campaign_name,capabilities,organization_id,scope'),'minimal exact metadata shape only');
 check(!/PRIVATE|source|city|count|total|email|phone|person|contact|export|learner/.test(JSON.stringify(result)),'no unrelated campaign names/source/person/contact/count disclosure');
 check((await conn.query("select public.campaign_decision_foundation('list',$1,$2,'{}') v",[org,ca])).rows[0].v.registrations.length===0,'campaign authority with no record assignments reveals no registrants');
 check((await directory(reader)).campaigns.length===1,'reader scope does not inherit another campaign');
 for(const role of ['registration','people','none'])check((await directory(await connect(role))).campaigns.length===0,role+' authority cannot discover decision campaigns');
 await reject(async()=>directory(await connect('unverified')),'unverified user denied');
 for(const role of ['anon','service_role']){const c=await db.connect();await c.query('set role '+role);await reject(()=>directory(c),role+' public wrapper execute denied');await reject(()=>c.query('select private.campaign_decision_directory()'),role+' private function execute denied');}
 await reject(()=>conn.query('select private.campaign_foundation_session()'),'session helper remains non-executable');
 await reject(()=>conn.query('select * from outreach_decision_followup'),'raw followup records remain denied');
 await reject(()=>conn.query('select * from outreach_decision_audit'),'raw immutable audits remain denied');
 for(const claims of [{session_id:null},{session_id:'bad'},{session_id:users.reader.sid},{exp:0}])await reject(async()=>directory(await connect('worker',claims)),'invalid/foreign/expired session claim denied');
 for(const [change,undo,label] of [
  ['active=false','active=true','revoked'],
  ["decision_effective_at=now()+interval '30 minutes'","decision_effective_at=now()-interval '1 hour'",'not yet effective'],
  ["decision_expires_at=now()-interval '1 minute'","decision_expires_at=now()+interval '1 hour'",'expired decision'],
  ["effective_at=now()-interval '2 hours',expires_at=now()-interval '1 minute'",'expires_at=null','expired campaign']
 ]){await q('update outreach_campaign_assignments set '+change+' where campaign_id=$1 and user_id=$2',[ca,users.worker.id]);check((await directory(conn)).campaigns.every(c=>c.campaign_id!==ca),label+' scope omitted');await q('update outreach_campaign_assignments set '+undo+' where campaign_id=$1 and user_id=$2',[ca,users.worker.id]);}
 await q('update outreach_decision_campaign_sources set active=false where campaign_id=$1',[ca]);check((await directory(conn)).campaigns.length===1,'inactive source mapping omitted');await q('update outreach_decision_campaign_sources set active=true where campaign_id=$1',[ca]);
 await q("update auth.sessions set not_after=now()-interval '1 minute' where id=$1",[users.worker.sid]);await reject(()=>directory(conn),'retired server session denied');await q("update auth.sessions set not_after=now()+interval '1 hour' where id=$1",[users.worker.sid]);
 const waitLock=async pid=>{for(let i=0;i<200;i++){if((await q("select wait_event_type='Lock' waiting from pg_stat_activity where pid=$1",[pid])).rows[0]?.waiting)return;await new Promise(r=>setTimeout(r,10));}throw Error('expected lock wait absent')};
 // Block campaign before context takes assignment lock, revoke authority, then release.
 for(const [mutation,undo,label] of [
  [()=>q('update outreach_campaign_assignments set active=false where campaign_id=$1 and user_id=$2',[ca,users.worker.id]),()=>q('update outreach_campaign_assignments set active=true where campaign_id=$1 and user_id=$2',[ca,users.worker.id]),'assignment revocation'],
  [()=>q('update outreach_decision_campaign_sources set active=false where campaign_id=$1',[ca]),()=>q('update outreach_decision_campaign_sources set active=true where campaign_id=$1',[ca]),'source revocation']
 ]){
  const locker=await db.connect();await locker.query('begin');await locker.query('select id from outreach_campaigns where id=$1 for update',[ca]);const pid=(await conn.query('select pg_backend_pid() pid')).rows[0].pid;const pending=directory(conn);await waitLock(pid);await mutation();await locker.query('commit');check((await pending).campaigns.every(c=>c.campaign_id!==ca),'completed '+label+' during earlier lock wait cannot leak campaign');await undo();await locker.end();
 }
 // After first context was accepted, waiting on later campaign must not retain expired first scope.
 const locker=await db.connect();await locker.query('begin');await locker.query('select id from outreach_campaigns where id=$1 for update',[cb]);
 await q("update outreach_campaign_assignments set decision_expires_at=clock_timestamp()+interval '600 milliseconds' where campaign_id=$1 and user_id=$2",[ca,users.worker.id]);
 const pid=(await conn.query('select pg_backend_pid() pid')).rows[0].pid,pending=directory(conn).then(v=>({value:v}),e=>({error:e}));await waitLock(pid);await new Promise(r=>setTimeout(r,750));await locker.query('commit');check((await pending).error?.code==='42501','earlier authority expiry during later campaign wait rejects whole result');await locker.end();await q("update outreach_campaign_assignments set decision_expires_at=now()+interval '1 hour' where campaign_id=$1 and user_id=$2",[ca,users.worker.id]);
 check((await directory(conn)).campaigns.length===2,'fresh legitimate authorization restores directory after expiry correction');
 const counts=(await q('select (select count(*) from outreach_decision_audit) audits,(select count(*) from outreach_decision_followup) records,(select count(*) from outreach_campaign_assignments) assignments')).rows[0];check(counts.audits===0&&counts.records===0&&counts.assignments===5,'read-only directory creates no audit, record or assignment');
 console.log('PASS '+count+' native directory checks. Synthetic local Auth only; no hosted acceptance.');
} finally {await db.close()}
