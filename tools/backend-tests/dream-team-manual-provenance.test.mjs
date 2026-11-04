// Additional provenance/rollback coverage. No intake, real identities, grants or provider calls.
import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {fixture,id,binding} from './dream-team-manual-fixture.mjs';
const db=new PGlite();let checks=0;
const q=(sql,args=[])=>db.query(sql,args);
const ok=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS '+label)};
const reject=async(run,code,label)=>{let error;try{await run()}catch(e){error=e}ok(error?.code===code,label)};
try {
 const {org,other}=await fixture(db);
 const as=async n=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);if(n)await db.exec('set role authenticated')};
 const rpc=(action,data)=>q('select public.dream_team_manual_followup($1,$2,$3) result',[org,action,JSON.stringify(data)]).then(r=>r.rows[0].result);
 const snapshot=async()=>{
  await as(0);
  return (await q(`select jsonb_build_object('application',(select to_jsonb(a) from private.dream_team_applications a where id=$1),
   'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.followup_tasks t),
   'task_audit',(select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]') from public.followup_task_events e),
   'application_audit',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from private.dream_team_audit a)) state`,[id(202)])).rows[0].state;
 };
 await as(2);
 await reject(()=>q("insert into private.dream_team_applications(organization_id,user_id,person_id,form_version,available_reason)values($1,$2,$3,'dream-team-v1-20261002','netlify_interest')",[org,id(2),id(102)]),'42501','applicant cannot turn an interest entry into canonical application');
 await reject(()=>rpc('import',{email:'fictional-2@example.test'}),'22023','no application import RPC action exists');
 await as(1);
 await reject(()=>rpc('create_task',{...binding(),request_id:id(500),assignment:'self',source:'netlify',answers:{name:'Fictional'}}),'22023','interest source or copied answers cannot be submitted as handoff authority');
 await as(0);
 await reject(()=>q("update private.dream_team_forms set definition='{}'"),'42501','approved form definition cannot be rewritten');
 await reject(()=>q('delete from private.dream_team_forms'),'42501','approved form definition cannot be removed');
 await reject(()=>q('update private.dream_team_applications set person_id=$1 where id=$2',[id(104),id(202)]),'23503','canonical Person foreign key rejects another organization');
 await reject(()=>q("update private.dream_team_applications set form_version='unreviewed-form' where id=$1",[id(202)]),'23503','unreviewed form provenance rejected');
 await q('update private.dream_team_applications set id=$1 where id=$2',[id(503),id(203)]);
 await as(1);
 await reject(()=>rpc('create_task',{...binding(3),request_id:id(501),assignment:'self'}),'40001','old application UUID cannot target replacement at same revision');
 await as(0);await q('update private.dream_team_applications set id=$1 where id=$2',[id(203),id(503)]);
 await q('update private.dream_team_applications set person_id=$1,revision=revision+1 where id=$2',[id(103),id(202)]);
 await as(1);
 await reject(()=>rpc('create_task',{...binding(),request_id:id(502),assignment:'self'}),'40001','changed canonical Person rejects originally reviewed handoff');
 await reject(()=>rpc('create_task',{...binding(),revision:2,person_id:id(103),request_id:id(502),assignment:'self'}),'42501','updated application Person is insufficient without exact verified account relationship');
 await as(0);await q('update private.dream_team_applications set person_id=$1,revision=1 where id=$2',[id(102),id(202)]);
 await q('update portal_account_links set active=false,revision=revision+1 where organization_id=$1 and user_id=$2',[org,id(2)]);
 await q('update portal_account_links set active=true,revision=revision+1 where organization_id=$1 and user_id=$2',[org,id(2)]);
 await as(1);
 await reject(()=>rpc('create_task',{...binding(),request_id:id(504),assignment:'self'}),'42501','revocation/reactivation does not revive old reviewed link revision');
 const fresh={...binding(),link_revision:3};
 const current=await rpc('detail',fresh);
 ok(current.link_revision===3&&current.person_id===id(102)&&current.account_id===id(2),'fresh review uses exact current canonical relationship');
 await as(0);
 await reject(()=>q('delete from private.dream_team_applications where id=$1',[id(202)]),'23503','audited canonical application cannot be deleted and replaced');
 await db.exec(`create function private.fail_read_audit_fixture() returns trigger language plpgsql as $$begin if new.action='manual_restricted_access' then raise exception 'fictional read audit failure';end if;return new;end$$;
 create trigger fail_read_audit_fixture before insert on private.dream_team_audit for each row execute function private.fail_read_audit_fixture()`);
 let before=await snapshot();await as(1);
 await reject(()=>rpc('detail',fresh),'P0001','restricted answer read fails when its mandatory access audit fails');
 ok(JSON.stringify(await snapshot())===JSON.stringify(before),'failed restricted read leaves complete canonical state unchanged');
 await db.exec('drop trigger fail_read_audit_fixture on private.dream_team_audit');
 await as(1);const created=await rpc('create_task',{...fresh,request_id:id(505),assignment:'self'});
 await as(0);
 const journal=(await q("select binding from private.dream_team_audit where action='manual_task_created'")).rows[0].binding;
 ok(journal.account_id===id(2)&&journal.person_id===id(102)&&journal.organization_id===org&&journal.link_revision===3,'successful immutable journal records exact current provenance');
 await db.exec(`create function private.fail_task_audit_fixture() returns trigger language plpgsql as $$begin raise exception 'fictional canonical task audit failure';end$$;
 create trigger fail_task_audit_fixture before insert on public.followup_task_events for each row execute function private.fail_task_audit_fixture()`);
 before=await snapshot();await as(1);
 const update={...fresh,revision:2,task_id:created.task.id,task_revision:1,request_id:id(506),assignment:'keep',status:'completed',due_on:'2026-11-12'};
 await reject(()=>rpc('update_task',update),'P0001','canonical task audit failure rejects update');
 ok(JSON.stringify(await snapshot())===JSON.stringify(before),'canonical audit failure rolls back task/app revisions and every audit');
 await db.exec('drop trigger fail_task_audit_fixture on public.followup_task_events');
 await db.exec(`create function private.fail_update_journal_fixture() returns trigger language plpgsql as $$begin if new.action='manual_task_updated' then raise exception 'fictional journal failure';end if;return new;end$$;
 create trigger fail_update_journal_fixture before insert on private.dream_team_audit for each row execute function private.fail_update_journal_fixture()`);
 before=await snapshot();await as(1);
 await reject(()=>rpc('update_task',update),'P0001','application journal failure after canonical task audit rejects update');
 ok(JSON.stringify(await snapshot())===JSON.stringify(before),'late journal failure rolls back earlier canonical task and audit writes');
 await db.exec('drop trigger fail_update_journal_fixture on private.dream_team_audit');
 await as(1);const saved=await rpc('update_task',update);
 ok(saved.task.revision===2&&saved.application_revision===3,'rolled-back request ID remains available for a deliberate fresh successful attempt');
 await as(0);
 ok((await q("select count(*)::int n from private.dream_team_audit where request_id=$1",[id(506)])).rows[0].n===1,'only successful committed retry records one journal entry');
 ok((await q('select answers from private.dream_team_applications where id=$1',[id(202)])).rows[0].answers.id_11.first_11==='RESTRICTED ANSWER','manual follow-up never rewrites applicant answers');
 console.log(JSON.stringify({checks,failures:0,nativeConcurrency:false,providerAcceptance:false}));
}finally{await db.close()}
