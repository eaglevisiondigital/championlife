// Disposable Unix-socket PostgreSQL only. No provider credentials or remote DB inputs.
import assert from 'node:assert/strict';
import {randomUUID as uuid,createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {installCampaignBaseline} from './campaign-foundation-baseline.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sqlRoot=resolve(process.env.CAMPAIGN_FOUNDATION_SQL_ROOT||root);
const files=readdirSync(join(sqlRoot,'supabase/migrations')).filter(f=>f.endsWith('_campaign_assigned_decision_foundation.sql'));
assert.equal(files.length,1,'exactly one candidate migration required');
const sql=readFileSync(join(sqlRoot,'supabase/migrations',files[0]),'utf8');
console.log('Candidate '+files[0]+' sha256 '+createHash('sha256').update(sql).digest('hex'));
const db=await localPostgres(),q=(...args)=>db.query(...args);let n=0;
const check=(v,m)=>{assert.ok(v,m);console.log('PASS '+(++n)+' '+m)};
const deny=async(fn,m,codes=['42501'])=>{await assert.rejects(fn,e=>codes.includes(e.code));check(true,m)};
try {
 const baseline=await installCampaignBaseline(db);check(baseline.persistentMigrations===27&&baseline.publicTables===49,'27 reviewed migrations / 49 current public tables replay');
 const preserved=(await q("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname in ('public','private','app_private') order by 1")).rows;
 await db.exec(sql);
 assert.deepEqual((await q("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname in ('public','private','app_private') and p.proname not in ('campaign_foundation_session','campaign_decision_foundation') order by 1")).rows,preserved);check(true,'existing application function definitions preserved');
 for(const table of ['outreach_decision_campaign_sources','outreach_decision_followup','outreach_decision_audit'])check((await q(`select count(*) n from public.${table}`)).rows[0].n===0,table+' installs empty');
 const org=(await q("select id from organizations where slug='sowgo'")).rows[0].id;
 const foreignOrg=(await q("select id from organizations where slug='champion-life'")).rows[0].id;
 const ids=Object.fromEntries(['actor','other','learner','unverified','campaign','otherCampaign','foreignCampaign','person','decision','unassigned','otherDecision','wrongSource','eventOnly','request'].map(k=>[k,uuid()]));
 const sessions={};
 for(const key of ['actor','other','learner','unverified']) {sessions[key]=uuid();await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,$3)',[ids[key],key+'@example.invalid',key==='unverified'?null:new Date()]);await q("insert into auth.sessions(id,user_id,not_after)values($1,$2,now()+interval '1 hour')",[sessions[key],ids[key]]);}
 for(const [id,o] of [[ids.campaign,org],[ids.otherCampaign,org],[ids.foreignCampaign,foreignOrg]])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,'Synthetic campaign','Synthetic city','US','UTC','approved')",[id,o,'synthetic_'+id.replaceAll('-','_')]);
 await q("insert into outreach_decision_campaign_sources(campaign_id,source)values($1,'synthetic_decision_a'),($2,'synthetic_decision_b'),($3,'synthetic_decision_foreign')",[ids.campaign,ids.otherCampaign,ids.foreignCampaign]);
 for(const key of ['actor','other'])await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,care_scope,decision_effective_at,decision_expires_at,reason)values($1,$2,'local_leader',array['view','decisions.read','followup.manage'],'assigned',now()-interval '1 hour',now()+interval '1 hour','Synthetic exact permission')",[ids.campaign,ids[key]]);
 for(const [key,source,user] of [['decision','synthetic_decision_a',ids.learner],['unassigned','synthetic_decision_a',null],['otherDecision','synthetic_decision_b',null],['wrongSource','synthetic_decision_b',null]])await q("insert into outreach_registrations(id,first_name,last_name,email,phone,decision,prayer_request,source,user_id,consent)values($1,'Synthetic','Person','PRIVATE-CONTACT@example.invalid','15555550123','salvation','PRIVATE-PRAYER',$2,$3,true)",[ids[key],source,user]);
 for(const [key,campaign,worker] of [['decision',ids.campaign,ids.actor],['unassigned',ids.campaign,ids.other],['otherDecision',ids.otherCampaign,ids.actor],['wrongSource',ids.campaign,ids.actor]])await q('insert into outreach_decision_followup(registration_id,campaign_id,assigned_user_id,updated_by)values($1,$2,$3,$4)',[ids[key],campaign,worker,ids.actor]);
 // A pre-reviewed synthetic identity relation is seeded explicitly. No email/name matching.
 await db.exec('alter table organization_people disable trigger user');
 await q('insert into private.people(id)values($1)',[ids.person]);
 await q("insert into organization_people(id,human_id,organization_id,first_name,last_name)values($1,$1,$2,'Synthetic','Person')",[ids.person,org]);
 await db.exec('alter table organization_people enable trigger user');
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic portal reviewer')",[org,ids.actor]);
 for(const permission of ['people.read','tags.read','portal.manage','staff.manage'])await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[org,ids.actor,permission]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[ids.actor]);
 await q("select public.set_portal_account_link($1,$2,'learner@example.invalid',true,'Synthetic reviewed identity linkage',0)",[org,ids.person]);
 await q("select public.set_portal_account_link($1,$2,'',true,'Synthetic reviewed continuation',1)",[org,ids.person]);
 await q("select set_config('request.jwt.claim.sub','',false)");
 await q('insert into outreach_campaign_registrants(campaign_id,organization_id,legacy_registration_id,person_id)values($1,$2,$3,$4)',[ids.campaign,org,ids.decision,ids.person]);
 await q("insert into outreach_event_registrations(id,campaign_id,organization_id,request_key,request_snapshot,first_name,last_name,email,phone,source)values($1,$2,$3,$4,'{}','Synthetic','Event','event@example.invalid','15555550124','public')",[ids.eventOnly,ids.campaign,org,uuid()]);
 const eventOriginals=(await q('select to_jsonb(r) r from outreach_event_registrations r order by id')).rows;
 const originals=(await q('select to_jsonb(r) r from outreach_registrations r order by id')).rows;
 const connect=async(key='actor',claims={})=>{const c=await db.connect();await c.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[ids[key],JSON.stringify({sub:ids[key],session_id:sessions[key],exp:Math.floor(Date.now()/1000)+3600,...claims})]);await c.query('set role authenticated');return c};
 const conn=await connect();const rpc=(action,payload={},c=conn,o=org,campaign=ids.campaign)=>c.query('select public.campaign_decision_foundation($1,$2,$3,$4) v',[action,o,campaign,payload]).then(r=>r.rows[0].v);
 const detail=()=>rpc('detail',{registration_id:ids.decision});
 check((await rpc('context')).scope==='assigned','fresh exact decision assignment authorized');
 let list=await rpc('list');check(list.registrations.length===1&&list.registrations[0].registration_id===ids.decision,'list excludes unassigned, foreign campaign and mismapped source records');
 check(!('total' in list),'list does not leak broad campaign total');
 let data=await detail();check(data.person_id===ids.person&&data.identity_status==='reviewed_existing_account_link','canonical existing verified Person link returned');
 check(data.kind==='decision-free-book-registration'&&data.book==='not_instrumented'&&data.course==='separate_permission_and_authority_required','event/book/course semantics remain distinct');
 check(data.contact_allowed===false&&!/PRIVATE|email|phone|prayer|answers|notes|human_id|user_id/.test(JSON.stringify(data)),'detail excludes raw contact, prayer, learner answers and internal identity fields');
 await deny(()=>rpc('detail',{registration_id:ids.unassigned}),'wrong assigned record denied');
 await deny(()=>rpc('detail',{registration_id:ids.eventOnly}),'event or unknown UUID cannot be queried as decision');
 await deny(()=>rpc('detail',{registration_id:ids.wrongSource}),'wrong source cannot join an assigned decision');
 await deny(()=>rpc('context',{},conn,foreignOrg,ids.campaign),'wrong organization denied');
 await deny(()=>rpc('context',{},conn,org,ids.otherCampaign),'other campaign denied');

 // Existing portal journal has service-role DML. Its provenance must stay stable
 // for the entire authorized projection, not just when an EXISTS subquery runs.
 const journals=(await q("select e.id,e.after_state from portal_admin_events e join portal_account_links l on l.id=e.subject_id where l.person_id=$1 and e.kind='account_link'",[ids.person])).rows;
 assert.equal(journals.length,2,'distinct original and current account-link journal rows');
 const journalWriter=await db.connect();await journalWriter.query('set role service_role');
 const writerPid=(await journalWriter.query('select pg_backend_pid() pid')).rows[0].pid;
 for(const journal of journals) {
 let journalWrite;
 await conn.query('begin');
 try {
  check((await detail()).person_id===ids.person,'reviewed journal identity projects inside transaction');
  journalWrite=journalWriter.query("update portal_admin_events set after_state=jsonb_set(after_state,'{person_id}',to_jsonb('00000000-0000-4000-8000-000000000000'::text)) where id=$1",[journal.id]);
  let blocked=false;
  for(let attempt=0;attempt<100;attempt++) {
   blocked=(await q("select wait_event_type='Lock' blocked from pg_stat_activity where pid=$1",[writerPid])).rows[0]?.blocked===true;
   if(blocked)break;
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  check(blocked,'service-role journal mutation waits on authorized projection lock');
 } finally {await conn.query('commit');if(journalWrite)await journalWrite;}
 check((await detail()).person_id===null,'completed journal provenance mutation suppresses next Person projection');
 await journalWriter.query('update portal_admin_events set after_state=$1 where id=$2',[journal.after_state,journal.id]);
 check((await detail()).person_id===ids.person,'exact original journal restoration permits fresh projection');
 }
 const learner=await connect('learner');await deny(()=>rpc('context',{},learner),'learner has no campaign authority');
 const unverified=await connect('unverified');await deny(()=>rpc('context',{},unverified),'unverified account denied');
 const anon=await db.connect();await anon.query('set role anon');await deny(()=>rpc('context',{},anon),'anonymous RPC execute denied');
 for(const claims of [{session_id:null},{session_id:'invalid'},{session_id:sessions.other},{exp:0},{exp:'invalid'}]) {const c=await connect('actor',claims);await deny(()=>rpc('context',{},c),'missing malformed foreign or expired session claim denied');}
 for(const [mutate,undo,label] of [
  ['update auth.users set email_confirmed_at=null where id=$1','update auth.users set email_confirmed_at=now() where id=$1','unverified actor'],
  ['update auth.users set deleted_at=now() where id=$1','update auth.users set deleted_at=null where id=$1','deleted actor'],
  ["update auth.users set banned_until=now()+interval '1 hour' where id=$1",'update auth.users set banned_until=null where id=$1','banned actor'],
  ['update auth.users set is_anonymous=true where id=$1','update auth.users set is_anonymous=false where id=$1','anonymous account']
 ]) {await q(mutate,[ids.actor]);await deny(()=>detail(),label+' denied');await q(undo,[ids.actor]);}
 for(const [mutate,undo,args,label] of [
  ['update outreach_campaign_assignments set active=false where user_id=$1','update outreach_campaign_assignments set active=true where user_id=$1',[ids.actor],'revoked campaign assignment'],
  ["update outreach_campaign_assignments set effective_at=now()+interval '1 hour' where user_id=$1","update outreach_campaign_assignments set effective_at=now()-interval '1 hour' where user_id=$1",[ids.actor],'future campaign assignment'],
  ["update outreach_campaign_assignments set expires_at=now()-interval '1 minute' where user_id=$1",'update outreach_campaign_assignments set expires_at=null where user_id=$1',[ids.actor],'expired campaign assignment'],
  ["update outreach_campaign_assignments set decision_expires_at=now()-interval '1 minute' where user_id=$1","update outreach_campaign_assignments set decision_expires_at=now()+interval '1 hour' where user_id=$1",[ids.actor],'expired finite decision authority'],
  ['update outreach_decision_campaign_sources set active=false where campaign_id=$1','update outreach_decision_campaign_sources set active=true where campaign_id=$1',[ids.campaign],'revoked source mapping'],
  ["update auth.sessions set not_after=now()-interval '1 minute' where id=$1","update auth.sessions set not_after=now()+interval '1 hour' where id=$1",[sessions.actor],'expired session row']
 ]) {await q(mutate,args);await deny(()=>detail(),label+' denied');await q(undo,args);}
 for(const [mutate,undo,args,label] of [
  ['update portal_account_links set active=false where person_id=$1','update portal_account_links set active=true where person_id=$1',[ids.person],'inactive portal link'],
  ['update outreach_registrations set user_id=null where id=$1','update outreach_registrations set user_id=$2 where id=$1',[ids.decision,ids.learner],'missing verified registration link'],
  ['update auth.users set email_confirmed_at=null where id=$1','update auth.users set email_confirmed_at=now() where id=$1',[ids.learner],'unverified linked learner']
 ]) {await q(mutate,args.slice(0,1));data=await detail();check(data.person_id===null&&data.identity_status==='not_linked',label+' never infers identity');await q(undo,args);}
 // Existing relationship/organization/admin powers must not substitute for new exact authority.
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic broad operator')",[org,ids.learner]);
 for(const permission of ['people.read','outreach.view','followup.manage','finance.read'])await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[org,ids.learner,permission]);
 await q("insert into organization_affiliations(organization_id,user_id,affiliation)values($1,$2,'partner')",[org,ids.learner]);
 await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Synthetic unrelated admin')",[org,ids.learner]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'host_pastor',array['view','registration.view','registration.manage','registration.export','checkin.manage'],'Synthetic event-only grant')",[ids.campaign,ids.learner]);
 await deny(()=>rpc('context',{},learner),'Partner affiliation, org People/finance, campaign admin and registration rights do not confer decision access');
 await q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'staff.manage')",[org,ids.learner]);
 const registrationAccess=capabilities=>learner.query('select public.outreach_registration_workspace($1,$2,$3) v',['access',ids.campaign,{user_id:ids.actor,revision:1,capabilities,reason:'Synthetic registration-only change'}]);
 for(const capability of ['decisions.read','followup.manage'])await deny(()=>registrationAccess([capability]),'existing registration access cannot issue '+capability,['P0001','42501']);
 await registrationAccess(['registration.view']);
 const retained=(await q('select capabilities,care_scope,decision_expires_at from outreach_campaign_assignments where campaign_id=$1 and user_id=$2',[ids.campaign,ids.actor])).rows[0];
 check(retained.capabilities.includes('decisions.read')&&retained.capabilities.includes('followup.manage')&&retained.care_scope==='assigned'&&retained.decision_expires_at!==null,'registration access edit preserves separately assigned decision scope');

 for(const action of ['export','contacts.export','assign','staff_summary','discipleship.summary.read','communications.send'])await deny(()=>rpc(action),action+' unsupported and denied',['22023']);
 for(const payload of [{person_id:ids.person},{page:-1},{page:10000},{page:'bad'},{search:'PRIVATE'}])await deny(()=>rpc('list',payload),'unaccepted list shape denied',['22023']);
 const save={registration_id:ids.decision,revision:1,status:'attempted',next_contact_on:'2027-01-01',request_id:ids.request};
 await q("update outreach_campaign_assignments set capabilities=array['view','decisions.read'] where user_id=$1",[ids.actor]);
 await deny(()=>rpc('followup_save',save),'read-only decision capability cannot manage follow-up');
 await q("update outreach_campaign_assignments set capabilities=array['view','decisions.read','followup.manage'] where user_id=$1",[ids.actor]);
 await q('update outreach_registrations set consent=false where id=$1',[ids.decision]);await deny(()=>rpc('followup_save',save),'absent ministry consent denies follow-up mutation');await q('update outreach_registrations set consent=true where id=$1',[ids.decision]);
 const saved=await rpc('followup_save',save);check(saved.saved&&saved.revision===2&&!saved.replayed,'save uses expected revision');
 const replay=await rpc('followup_save',save);check(replay.saved&&replay.revision===2&&replay.replayed,'identical retry returns original receipt');
 await deny(()=>rpc('followup_save',{...save,status:'completed'}),'same request ID with changed payload denied',['23505']);
 await deny(()=>rpc('followup_save',{...save,request_id:uuid()}),'stale revision denied',['40001']);
 await deny(()=>rpc('followup_save',{...save,revision:2,request_id:uuid(),person_id:ids.person}),'identity mutation fields rejected',['22023']);
 const audits=(await q('select * from outreach_decision_audit')).rows;
 check(audits.length===1&&audits[0].actor_user_id===ids.actor&&audits[0].before_state.revision===1&&audits[0].after_state.revision===2,'one immutable audit matches actor and revisions');
 check(!/PRIVATE|prayer|answers|notes/.test(JSON.stringify(audits)),'audit carries no contact/prayer/worksheet payload');
 const newer=await rpc('followup_save',{...save,revision:2,status:'connected',request_id:uuid()});check(newer.revision===3,'later revision can be recorded independently');
 await deny(()=>rpc('followup_save',save),'old receipt cannot conceal a later revision',['40001']);

 await deny(()=>q("update outreach_decision_audit set action='followup.updated'"),'audit immutable even for direct owner mutation',['42501','P0001']);
 // Learner-owned completion flags must never become trusted completion or staff progress.
 const course=(await q("select id from courses where slug='getting-a-grip-on-the-basics'")).rows[0].id;
 await q('insert into course_enrollments(user_id,course_id,completed_at)values($1,$2,now())',[ids.learner,course]);
 await q("insert into lesson_progress(user_id,course_id,lesson_number,status,completed_at)values($1,$2,1,'completed',now()),($1,$2,99,'completed',now())",[ids.learner,course]);
 await q("insert into lesson_answers(user_id,course_id,lesson_number,question_number,answer)values($1,$2,1,1,'PRIVATE-ANSWER')",[ids.learner,course]);
 const learning=await rpc('learner_status',{},learner,null,null);
 check(learning.kind==='own-learner-activity'&&learning.completion_authority==='unavailable'&&learning.book==='not_instrumented','owner-written completed flags produce honest activity only');
 check(learning.courses.length===1&&learning.courses[0].activity_recorded===true&&!/PRIVATE|completed_at|answer|lesson_number/.test(JSON.stringify(learning)),'own activity projection excludes answers and completion claims');
 check((await rpc('learner_status',{},conn,null,null)).courses.length===0,'staff cannot read another learner activity');
 await deny(()=>rpc('learner_status',{user_id:ids.learner},conn,null,null),'arbitrary learner selection denied',['22023']);
 for(const table of ['outreach_decision_campaign_sources','outreach_decision_followup','outreach_decision_audit']) {
  await deny(()=>conn.query('select * from public.'+table),'raw '+table+' read denied');
  await deny(()=>conn.query('delete from public.'+table),'raw '+table+' delete denied');
  for(const role of ['anon','authenticated','service_role'])check(!(await q("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') v",[role,'public.'+table])).rows[0].v,role+' has no raw '+table+' ACL');
 }
 await deny(()=>conn.query('select private.campaign_foundation_session()'),'private session helper is not exposed');
 assert.deepEqual((await q('select to_jsonb(r) r from outreach_registrations r order by id')).rows,originals);check(true,'decision source bytes unchanged');
 check((await q('select count(*) n from organization_people')).rows[0].n===1,'no duplicate canonical People created');
 assert.deepEqual((await q('select to_jsonb(r) r from outreach_event_registrations r order by id')).rows,eventOriginals);check(true,'separate nonempty event registration bytes preserved');
 console.log(n+' campaign foundation native checks PASS; synthetic Auth only; no hosted writes');
} finally {await db.close()}
