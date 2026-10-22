// Disposable synthetic upgrade/regression. No hosted connections or credentials.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID as uuid} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {localPostgres} from './local-postgres.mjs';
import {migrationOrder} from './migration-order.mjs';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const db=process.env.TEST_NATIVE_PG==='1'?await localPostgres():new PGlite(),q=(s,a=[])=>db.query(s,a);
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)},deny=async(fn,m)=>{await assert.rejects(fn,e=>e.code==='42501');ok(true,m)};
const owner=()=>db.exec('reset role');
const as=async(id,role='authenticated')=>{await owner();await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)};
const ops=uuid(),fin=uuid(),stranger=uuid(),unverified=uuid(),reader=uuid(),scoped=uuid(),admin=uuid();
const core=['people.read','people.create','people.update','people.export','households.read','households.manage','followup.read','followup.manage','registrations.view','registrations.manage','outreach.view'];
const reg=(c,a,p={})=>q('select public.outreach_registration_workspace($1,$2,$3) v',[a,c,p]).then(r=>r.rows[0].v);
const people=(o,a,p={})=>q('select public.people_workspace($1,$2,$3) v',[o,a,p]).then(r=>r.rows[0].v);
const partner=(o,a,p={})=>q('select public.outreach_partner_workspace($1,$2,$3) v',[o,a,p]).then(r=>r.rows[0].v);
const grants=async(o,u,keys)=>{await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic test operator')",[o,u]);for(const k of keys)await q('insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,$3)',[o,u,k])};
try{
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(read('supabase/bootstrap/automatic-rls.sql'));
 for(const f of migrationOrder.slice(0,-1))await db.exec(read('supabase/migrations/'+f));
 ok(migrationOrder.length===26,'exact 25-source production baseline plus one forward migration');
 const orgs=(await q("select id,slug from organizations where slug in ('champion-life','sowgo')")).rows;
 const church=orgs.find(o=>o.slug==='champion-life').id,sowgo=orgs.find(o=>o.slug==='sowgo').id,foreign=uuid(),future=uuid(),third=uuid();
 const huntsville=(await q("select id from outreach_campaigns where code='huntsville_al_2026'")).rows[0].id;
 await q("insert into organizations(id,slug,name,kind)values($1,'fictional-foreign','Fictional foreign','ministry')",[foreign]);
 for(const u of[ops,fin,stranger,unverified,reader,scoped,admin])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,$3)',[u,u+'@example.test',u===unverified?null:new Date()]);
 for(const o of[church,sowgo]){await grants(o,ops,core);await grants(o,fin,['people.read','people.create','people.update','finance.read','outreach.view','outreach.manage','followup.read','followup.manage']);}
 await grants(sowgo,reader,['registrations.view']);await grants(sowgo,unverified,core);await grants(sowgo,admin,['staff.manage']);
 await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Synthetic independent permission manager')",[sowgo,admin]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'other',array['view','registration.view'],'Synthetic campaign-only staff'),($1,$3,'other',array['view','registration.view'],'Synthetic manager own assignment')",[huntsville,scoped,admin]);
 // Nonempty pre-existing records: fixture setup only, never application execution.
 await db.exec('alter table organization_people disable trigger user; alter table households disable trigger user');
 const originalPerson=uuid(),originalHouse=uuid();await q('insert into private.people(id)values($1)',[originalPerson]);
 await q("insert into organization_people(id,human_id,organization_id,first_name,last_name)values($1,$1,$2,'Historical','Contact')",[originalPerson,church]);
 await q("insert into households(id,organization_id,name)values($1,$2,'Historical household')",[originalHouse,church]);
 await db.exec('alter table organization_people enable trigger user; alter table households enable trigger user');
 await q("insert into organization_admin_events(organization_id,actor_user_id,subject_id,kind,after_state)values($1,$2,$3,'person_created',$4)",[church,admin,originalPerson,{first_name:'Historical',last_name:'Contact'}]);
 const originalRecord=(await q('select to_jsonb(h) v from households h where id=$1',[originalHouse])).rows[0].v;
 const functions=async()=> (await q("select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' identity,pg_get_functiondef(p.oid) body,coalesce(p.proacl::text,'') acl,p.proowner owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' order by 1")).rows;
 const functionsBefore=await functions();
 // Existing historical evidence and permissions must survive the upgrade unchanged.
 const beforeGrants=(await q('select * from organization_staff_permissions order by organization_id,user_id,permission')).rows;
 const beforeKeys=(await q('select private.staff_permission_keys() v')).rows[0].v;
 const snapshot=async()=>JSON.stringify((await q("select to_jsonb(e) v from organization_admin_events e order by id")).rows);
 const beforeHistory=await snapshot();
 await as(ops);await assert.rejects(()=>q("insert into households(organization_id,name)values($1,'Baseline rejected household')",[church]),e=>e.code==='23514'&&e.constraint==='organization_admin_events_kind_check');ok(true,'reproduced exact household audit constraint before upgrade');
 await owner();
 // A changed child-workstream function must stop this production-baseline package.
 await db.exec("create or replace function private.outreach_registration_can(c uuid,cap text)returns boolean language sql stable security definer set search_path='' as $$select false$$");
 await assert.rejects(()=>db.exec(read('supabase/migrations/'+migrationOrder.at(-1))),e=>e.message.includes('Unreviewed baseline: private.outreach_registration_can'));await db.exec('rollback');
 ok((await q("select to_regprocedure('private.operational_followup_visible(uuid,uuid)') v")).rows[0].v===null,'unexpected baseline fails before any new object');
 await db.exec(functionsBefore.find(f=>f.identity.startsWith('private.outreach_registration_can(')).body);
 await db.exec(read('supabase/migrations/'+migrationOrder.at(-1)));
 assert.deepEqual((await q('select * from organization_staff_permissions order by organization_id,user_id,permission')).rows,beforeGrants);ok(true,'upgrade leaves all existing grants byte-for-byte equivalent');
 assert.deepEqual((await q('select private.staff_permission_keys() v')).rows[0].v,beforeKeys);ok(beforeKeys.length===29,'all 29 capability keys unchanged');ok(await snapshot()===beforeHistory&&JSON.parse(beforeHistory).length>0,'nonempty immutable audit rows unchanged by upgrade');
 assert.deepEqual((await q('select to_jsonb(h) v from households h where id=$1',[originalHouse])).rows[0].v,originalRecord);ok(true,'historical household remains byte-identical');
 const changed=[];for(const before of functionsBefore){const after=(await functions()).find(f=>f.identity===before.identity);assert.ok(after);assert.equal(after.acl,before.acl);assert.equal(after.owner,before.owner);if(after.body!==before.body)changed.push(before.identity.split('(')[0]);}
 assert.deepEqual(changed.sort(),['private.outreach_partner_workspace','private.outreach_registration_can','private.outreach_registration_workspace','private.people_workspace'].sort());ok(true,'exact four function replacements; every existing function ACL and owner preserved');
 ok((await q("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity")).rows[0].n===49,'49 existing public RLS tables unchanged');
 // New contacts/households work with attribution, without implicit Auth linking.
 const contacts={},houses={};
 for(const o of[church,sowgo]){
  await as(ops);contacts[o]=(await q("insert into organization_people(organization_id,first_name,last_name,email)values($1,'Fictional','Contact','contact@example.test') returning id",[o])).rows[0].id;
  houses[o]=(await q("insert into households(organization_id,name)values($1,'Fictional household')returning id",[o])).rows[0].id;
  await q("insert into household_members(organization_id,household_id,person_id,relationship)values($1,$2,$3,'adult')",[o,houses[o],contacts[o]]);
  await q("update households set name='Fictional revised household'where id=$1",[houses[o]]);
  await q("update household_members set relationship='other'where household_id=$1",[houses[o]]);
  ok((await people(o,'list')).some(p=>p.id===contacts[o]),'contact creation and INSERT RETURNING work in explicit organization');
  const audit=(await q("select * from organization_admin_events where organization_id=$1 and kind like 'household_%'",[o])).rows;
  ok(audit.length===4&&audit.every(a=>a.actor_user_id===ops),'all four household event kinds preserve exact actor');
  await people(o,'relationship',{person_id:contacts[o],relationship:'volunteer'});ok((await people(o,'detail',{person_id:contacts[o]})).relationships.some(r=>r.relationship==='volunteer'),'operational volunteer relationship preserved');
 }
 await assert.rejects(()=>q("insert into household_members(organization_id,household_id,person_id,relationship)values($1,$2,$3,'adult')",[church,houses[church],contacts[sowgo]]),e=>e.code==='23503'&&e.constraint==='household_members_organization_id_person_id_fkey');ok(true,'cross-organization household rejected by exact organization foreign key');
 await deny(()=>q('delete from organization_admin_events'),'immutable household audit cannot be deleted');await deny(()=>q("update organization_admin_events set kind='person_updated'"),'immutable audit cannot be rewritten');
 // Populate financial configuration before testing denial, so zero-row results prove RLS.
 await owner();await db.exec('alter table giving_funds disable trigger user; alter table giving_form_routes disable trigger user');
 const destination=(await q('select id from giving_destinations where organization_id=$1',[sowgo])).rows[0].id;
 const fund=(await q("insert into giving_funds(organization_id,destination_id,name,code)values($1,$2,'Synthetic confidential fund','synthetic-fund')returning id",[sowgo,destination])).rows[0].id;
 await q("insert into giving_form_routes(organization_id,destination_id,fund_id,name,form_key)values($1,$2,$3,'Synthetic financial route','synthetic-route')",[sowgo,destination,fund]);
 await q("insert into giving_configuration_events(organization_id,actor_user_id,entity_type,subject_id,action,after_state)values($1,$2,'fund',$3,'created',$4)",[sowgo,fin,fund,{name:'Synthetic confidential fund'}]);
 await db.exec('alter table giving_funds enable trigger user; alter table giving_form_routes enable trigger user');
 // Finance seed via the existing authorized workflow; operations cannot read any route.
 await owner();const intake=(await q("insert into outreach_partner_intakes(organization_id,source_site,source_path,raw_submission,email_normalized,phone_normalized,commitment_amount,commitment_frequency,request_key,payload_hash,person_id)values($1,'sowgo','/synthetic',$2,'donor@example.test','15555550100',37,'Monthly',$3,'synthetic',$4) returning id",[sowgo,{'first-name':'Fictional','last-name':'Donor',email:'donor@example.test','commitment-amount':'37','commitment-frequency':'Monthly'},uuid(),contacts[sowgo]])).rows[0].id;
 await as(fin);await people(sowgo,'relationship',{person_id:contacts[sowgo],relationship:'partner'});
 await partner(sowgo,'followup',{id:intake,revision:1});const financial=(await partner(sowgo,'detail',{id:intake}));ok(financial.commitment_amount===37&&financial.raw_submission.email==='donor@example.test','explicit financial reviewer retains donor-intake workflow');
 const financeTask=financial.followup_task_id;
 await q("update followup_tasks set title='Confidential donation intention 37 Monthly' where id=$1",[financeTask]);
 await as(ops);
 for(const action of['list','detail','review','followup','create_contact','link'])await deny(()=>partner(sowgo,action,{id:intake,revision:2,person_id:contacts[sowgo]}),'outreach.view alone denies donation workspace '+action);
 for(const table of['outreach_partner_intakes','private.outreach_partner_audit'])await deny(()=>q('select * from '+table),'raw financial table denied '+table);
 ok((await q('select * from followup_tasks where id=$1',[financeTask])).rows.length===0,'financial follow-up title/body hidden by direct RLS');
 ok((await q('select * from followup_task_events where task_id=$1',[financeTask])).rows.length===0,'financial follow-up history hidden');
 ok((await q("update followup_tasks set status='completed'where id=$1 returning id",[financeTask])).rows.length===0,'hidden financial task cannot be edited');
 const d=await people(sowgo,'detail',{person_id:contacts[sowgo]});ok(d.relationships.every(r=>r.relationship!=='partner'),'donation-linked partner labels withheld');
 ok((await people(sowgo,'list',{relationship:'partner'})).length===0,'relationship search cannot build an indirect donor report');
 ok((await q("select * from organization_admin_events where kind='person_relationship'and after_state->>'relationship' in ('partner')")).rows.length===0,'donor relationship audit snapshots hidden');
 await deny(()=>people(sowgo,'relationship',{person_id:contacts[sowgo],relationship:'partner'}),'operations cannot write financial classification');
 await deny(()=>people(sowgo,'relationship',{person_id:contacts[sowgo],id:financial.id,active:false}),'guessed financial relationship update fails closed');
 await q("insert into followup_tasks(organization_id,person_id,title)values($1,$2,'Nonfinancial volunteer call')",[sowgo,contacts[sowgo]]);ok((await q('select * from followup_tasks')).rows.length===1,'ordinary nonfinancial follow-up remains operational');
 for(const t of['giving_destinations','giving_funds','giving_form_routes','giving_configuration_events'])ok((await q('select * from '+t)).rows.length===0,'finance data denied '+t);
 await deny(()=>q("insert into giving_funds(organization_id,destination_id,name,code)values($1,$2,'Forbidden','forbidden')",[church,uuid()]),'financial configuration write denied');
 for(const k of['finance.read','finance.configure','staff.manage','staff.view','care.read','people.notes.view','people.notes.manage','portal.manage','tags.manage','communications.send'])ok(!(await q('select private.has_staff_permission($1,$2) v',[sowgo,k])).rows[0].v,'excluded capability '+k);
 // Organization operations cover future campaigns, not future privilege vocabulary.
 await owner();for(const[c,o,code]of[[future,church,'fictional_future'],[third,foreign,'fictional_foreign']])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,$3,'Test','US','UTC','approved')",[c,o,code]);
 await as(ops);ok((await reg(huntsville,'context')).capabilities.length===4,'current campaign gets four operations capabilities');ok((await reg(future,'context')).capabilities.length===4,'future campaign in separately assigned organization automatically covered');
 const ctx=await reg(huntsville,'context');ok(!ctx.admin&&!ctx.can_manage_access&&ctx.settings===null,'operations context never implies configuration or permissions administration');
 await deny(()=>reg(third,'list'),'unassigned organization registration denied');await deny(()=>people(foreign,'list'),'unassigned organization People denied');
 for(const action of['configure','waiver_publish','assignments','access'])await deny(()=>reg(huntsville,action,{user_id:ops,revision:1,reason:'Synthetic denied permission expansion',capabilities:['registration.manage']}),'operations denied privileged campaign action '+action);
 await deny(()=>people(church,'template',{name:'Escalate',permissions:['finance.read']}),'operations cannot bundle privileged template');await deny(()=>people(church,'grant',{person_id:contacts[church],permission:'staff.manage'}),'operations cannot self-grant');await deny(()=>q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'finance.read')",[church,ops]),'direct self-grant denied');
 // Even existing elevated administrator cannot edit own campaign capability assignment.
 await as(admin);await deny(()=>reg(huntsville,'access',{user_id:admin,revision:1,reason:'Synthetic self escalation blocked',capabilities:['registration.manage']}),'independent manager cannot target self');
 await reg(huntsville,'access',{user_id:scoped,revision:1,reason:'Independent synthetic reviewed export',capabilities:['registration.view','registration.export']});ok(true,'independent scoped staff manager may update another approved campaign assignment');
 await owner();await q("update organization_staff_permissions set revoked_at=now()where user_id=$1 and permission='staff.manage'",[admin]);await as(admin);await deny(()=>reg(huntsville,'access',{user_id:scoped,revision:2,reason:'Revoked independent manager blocked',capabilities:['registration.manage']}),'campaign admin alone cannot change anyone permissions');
 await as(scoped);ok((await reg(huntsville,'csv')).csv.startsWith('Registration Reference'),'existing scoped campaign export preserved');await deny(()=>reg(future,'list'),'campaign-only staff cannot see another campaign');
 await as(reader);ok((await reg(huntsville,'list')).summary.households===0,'organization read-only registration works');await deny(()=>reg(huntsville,'csv'),'read-only does not imply export');await deny(()=>reg(huntsville,'checkin'),'read-only does not imply check-in');
 for(const u of[stranger,unverified]){await as(u);await deny(()=>reg(huntsville,'list'),'ungranted/unverified cannot read registrations');await deny(()=>people(sowgo,'list'),'ungranted/unverified cannot read People');}
 await as(null,'anon');await deny(()=>reg(huntsville,'list'),'anonymous staff RPC denied');
 // Exercise a real synthetic household through unchanged registration/check-in/CSV.
 await owner();await q("insert into outreach_registration_settings(campaign_id,public_slug,enabled,waiver_required)values($1,'fictional-operations',false,false)",[future]);
 await as(ops);const attendees=[{client_key:uuid(),first_name:'Fictional',last_name:'Adult',age:34,relationship:'self',guardian_relationship:'',attending:true,prize_participation:false,bike_interest:false,tablet_only:false,prize_choice:null,answers:{}}];
 const walk=await reg(future,'walkup',{request_key:uuid(),first_name:'Fictional',last_name:'Adult',email:'fictional@example.test',phone:'+15555550100',attendees,consents:{},waiver:null});ok(walk.accepted,'authorized walk-up preserves disabled public intake');
 let list=await reg(future,'list'),record=list.registrations[0];ok(list.summary.households===1&&list.summary.attendees===1&&list.summary.adults===1,'household and attendee reporting exact');
 let detail=await reg(future,'detail',{registration_id:record.id}),attendee=detail.attendees[0];
 await reg(future,'checkin',{registration_id:record.id,attendee_id:attendee.id});ok((await reg(future,'list')).summary.checked_in===1,'operations check-in succeeds');
 await reg(future,'reverse',{registration_id:record.id,attendee_id:attendee.id,reason:'Synthetic reversal test reason'});ok((await reg(future,'list')).summary.checked_in===0,'operations check-in reversal succeeds with audit');
 const csv=await reg(future,'csv');ok(csv.csv.includes('Fictional')&&!/donation|Monthly|commitment/i.test(csv.csv),'scoped CSV includes only operational registration data');
 for(const table of['outreach_event_registrations','outreach_event_attendees','outreach_waiver_signatures','outreach_campaign_audit'])await deny(()=>q('select * from '+table),'raw sensitive registration table remains unavailable '+table);
 // Future/expired/revoked grants rechecked from current database state, never JWT roles.
 await owner();await q("update organization_staff_permissions set revoked_at=now()where user_id=$1 and organization_id=$2 and permission='registrations.view'",[ops,sowgo]);await as(ops);await deny(()=>reg(huntsville,'list'),'same-session organization registration revocation immediate');ok((await reg(future,'list')).summary.households===1,'revocation in SowGo does not revoke separate Church assignment');
 await owner();await q("update organization_staff_permissions set effective_at=now()+interval '1 hour'where user_id=$1 and organization_id=$2 and permission='registrations.view'",[ops,church]);await as(ops);await deny(()=>reg(future,'list'),'future registration grant not effective early');
 await owner();await q("update organization_staff_permissions set effective_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'where user_id=$1 and organization_id=$2 and permission='registrations.view'",[ops,church]);await as(ops);await deny(()=>reg(future,'list'),'expired organization registration grant denied');
 await owner();await q('update organization_staff_directory set active=false where user_id=$1',[ops]);await as(ops);await deny(()=>people(church,'list'),'stale claims cannot restore revoked People authority');ok((await q('select * from followup_tasks')).rows.length===0,'revocation clears direct operational follow-up');ok((await q('select staff_workspace_context() v')).rows[0].v.grants.length===0,'revoked navigation projection empty');
 await owner();ok((await q("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and has_function_privilege('anon',p.oid,'execute')")).rows[0].n===0,'no anonymous private function execution added');
 ok((await q('select count(*)::int n from auth.users')).rows[0].n===7,'no login/account created by operational workflows');
 console.log(`${n} Operations Administrator upgrade/security checks passed (${process.env.TEST_NATIVE_PG==='1'?'native PostgreSQL':'PGlite'}).`);
}finally{await db.close()}
