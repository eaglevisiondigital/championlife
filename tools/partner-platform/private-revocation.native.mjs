// Disposable native PostgreSQL only. Synthetic Auth rows do not prove hosted Auth.
import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import{randomUUID as uuid}from'node:crypto';
import{localPostgres}from'../backend-tests/local-postgres.mjs';import{migrationOrder}from'../backend-tests/migration-order.mjs';
const db=await localPostgres(),q=(...a)=>db.query(...a),read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');let n=0;const check=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)},deny=async(fn,m)=>{await assert.rejects(fn,e=>['42501','40001','22023','22P02'].includes(e.code));check(true,m)};
try{
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(`alter table auth.users add column deleted_at timestamptz,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant execute on function auth.jwt() to authenticated;`);await db.exec(read('supabase/bootstrap/automatic-rls.sql'));for(const f of migrationOrder)await db.exec(read('supabase/migrations/'+f));await db.exec(read('supabase/migrations/20261101154618_partner_assigned_metadata_boundary.sql'));await db.exec(read('supabase/migrations/20261101164328_partner_private_revocation_preparation.sql'));
 const org=(await q("select id from organizations where slug='sowgo'")).rows[0].id,foreign=(await q("select id from organizations where slug='champion-life'")).rows[0].id;
 const actor=uuid(),other=uuid(),subject=uuid(),session=uuid(),otherSession=uuid(),campaign=uuid(),foreignCampaign=uuid(),partner=uuid(),person=uuid(),decision=uuid(),assignment=uuid(),unassigned=uuid(),registrant=uuid();
 for(const id of[actor,other,subject])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,id+'@example.invalid']);
 await q("insert into auth.sessions(id,user_id,not_after)values($1,$2,now()+interval '1 hour'),($3,$4,now()+interval '1 hour')",[session,actor,otherSession,other]);
 for(const[id,o]of[[campaign,org],[foreignCampaign,foreign]])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,'Fictional','Fictional','US','UTC','approved')",[id,o,'fictional_'+id.replaceAll('-','_')]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason)values($1,$2,'local_leader',array['view'],'Fictional explicit campaign')",[campaign,actor]);
 await db.exec('alter table organization_people disable trigger user');await q('insert into private.people(id)values($1)',[person]);await q("insert into organization_people(id,human_id,organization_id,first_name,last_name)values($1,$1,$2,'CHILD SECRET','PERSON')",[person,org]);await db.exec('alter table organization_people enable trigger user');
 await q("insert into portal_account_links(organization_id,person_id,user_id,verification_note)values($1,$2,$3,'Synthetic reviewed account link')",[org,person,subject]);
 await q("insert into outreach_registrations(id,first_name,last_name,email,phone,decision,source)values($1,'CHILD SECRET','PERSON','private@example.invalid','5550100','salvation','fictional_source')",[decision]);
 await q('insert into outreach_campaign_registrants(id,campaign_id,organization_id,legacy_registration_id,person_id)values($1,$2,$3,$4,$5)',[registrant,campaign,org,decision,person]);
 await q("insert into outreach_partner_churches(id,campaign_id,name,slug,created_by)values($1,$2,'Fictional church','fictional', $3)",[partner,campaign,other]);
 await q("insert into outreach_partner_users(partner_church_id,campaign_id,user_id,capabilities,granted_by,reason)values($1,$2,$3,array['partner.view'],$4,'Synthetic reviewed permission')",[partner,campaign,actor,other]);
 await q("insert into outreach_partner_assignments(id,campaign_id,partner_church_id,decision_registration_id,assigned_worker_user_id,assigned_by,assignment_reason)values($1,$2,$3,$4,$5,$6,'Synthetic exact record assignment')",[assignment,campaign,partner,decision,actor,other]);
 // Isolated owner invokes private preparation only; all actual application roles
 // remain denied even with the same fictional administrator claims.
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Fictional independent administrator')",[org,other]);
 await q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'staff.manage')",[org,other]);
 await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Fictional explicit authority')",[org,other]);
 const admin=await db.connect();await admin.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[other,JSON.stringify({session_id:otherSession})]);
 const args=(kind='access',revision=1,request=uuid())=>[campaign,partner,kind,kind==='access'?actor:assignment,revision,request,'Fictional reviewed revocation'];
 const call=(params=args(),client=admin)=>client.query('select private.partner_revoke_assigned_access($1,$2,$3,$4,$5,$6,$7) v',params).then(r=>r.rows[0].v);
 const audits=()=>q("select * from outreach_campaign_audit where kind='partner.private_revoked' order by created_at").then(r=>r.rows);
 const countBefore=(await q('select count(*) n from outreach_campaign_audit')).rows[0].n;
 for(const role of ['anon','authenticated','service_role']){await admin.query('set role '+role);await deny(()=>call(),'private execution denied to '+role);await admin.query('reset role');}
 check((await q("select to_regprocedure('public.partner_revoke_assigned_access(uuid,uuid,text,uuid,integer,uuid,text)') is null ok")).rows[0].ok,'no public execution wrapper');
 for(const revision of [null,0,-1,2,'false',1.5])await deny(()=>call(args('access',revision)),'missing negative or stale revision rejected');
 await deny(()=>call(args('grant')),'grant/issuance action is unsupported');
 const foreignArgs=args();foreignArgs[0]=foreignCampaign;await deny(()=>call(foreignArgs),'other campaign cannot borrow authority');
 for(const[change,restore,label]of[
 ["update organization_staff_permissions set revoked_at=now() where user_id=$1","update organization_staff_permissions set revoked_at=null where user_id=$1",'revoked staff.manage'],
 ["update outreach_campaign_admins set active=false where user_id=$1","update outreach_campaign_admins set active=true where user_id=$1",'revoked campaign manager'],
 ["update organization_staff_directory set active=false where user_id=$1","update organization_staff_directory set active=true where user_id=$1",'inactive staff directory'],
 ["update organization_staff_permissions set department_ids=array[$2::uuid] where user_id=$1","update organization_staff_permissions set department_ids=null where user_id=$1",'department-scoped staff.manage'],
 ["update auth.users set banned_until=now()+interval '1 hour' where id=$1","update auth.users set banned_until=null where id=$1",'banned administrator'],
 ["update auth.users set deleted_at=now() where id=$1","update auth.users set deleted_at=null where id=$1",'deleted administrator']]){await q(change,change.includes('$2')?[other,uuid()]:[other]);await deny(()=>call(),label);await q(restore,[other]);}
 await q('delete from auth.sessions where id=$1',[otherSession]);await deny(()=>call(),'retired administrator session denied');await q("insert into auth.sessions(id,user_id,not_after)values($1,$2,now()+interval '1 hour')",[otherSession,other]);

 await q('update organization_staff_directory set person_id=$1 where user_id=$2',[person,other]);await deny(()=>call(),'mismatched existing administrator portal link denied');await q('update organization_staff_directory set person_id=null where user_id=$1',[other]);
 const expiryBlocker=await db.connect();await expiryBlocker.query('begin');await expiryBlocker.query('select * from outreach_partner_users where user_id=$1 for update',[actor]);await q("update auth.sessions set not_after=clock_timestamp()+interval '250 milliseconds' where id=$1",[otherSession]);
 const expiryRequest=call().then(v=>({v}),e=>({e}));await new Promise(r=>setTimeout(r,350));await expiryBlocker.query('commit');check((await expiryRequest).e?.code==='42501','expired authority during target lock wait rolls back');await q("update auth.sessions set not_after=clock_timestamp()+interval '1 hour' where id=$1",[otherSession]);
 check((await audits()).length===0,'all denied preparation requests create zero successful audits');
 const first=args();const saved=await call(first);check(saved.revoked===true&&saved.revision===2,'exact access revision revoked atomically');
 const audit=(await audits())[0];check(audit.actor_user_id===other&&audit.campaign_id===campaign&&audit.metadata.before.revision===1&&audit.metadata.after.revision===2,'audit attribution and committed revision correct');
 check(JSON.stringify(await call(first))===JSON.stringify(saved),'same request replay idempotent');check((await audits()).length===1,'replay creates no duplicate audit');const altered=[...first];altered[6]='Different reviewed reason';await deny(()=>call(altered),'changed request replay rejected');
 const worker=await db.connect();await worker.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[actor,JSON.stringify({session_id:session})]);await worker.query('set role authenticated');await deny(()=>worker.query('select partner_assigned_metadata($1,$2)',[campaign,assignment]),'revoked access blocks actual read endpoint');
 await q('update outreach_partner_users set active=true,revision=3 where user_id=$1',[actor]);
 // Self-target and audit failure must not alter the assignment or leave events.
 await q('update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[other,assignment]);await deny(()=>call(args('assignment')),'self-assignment revocation denied');await q('update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[actor,assignment]);
 await db.exec("create function public.fixture_fail_partner_audit()returns trigger language plpgsql as $$begin if new.kind='partner.private_revoked' then raise exception 'Synthetic audit unavailable' using errcode='P0001';end if;return new;end$$;create trigger fixture_fail_partner_audit before insert on outreach_campaign_audit for each row execute function fixture_fail_partner_audit();");
 await assert.rejects(()=>call(args('assignment')),e=>e.code==='P0001');check((await q('select revision,status from outreach_partner_assignments where id=$1',[assignment])).rows[0].revision===1,'audit failure rolls back target revision');check((await audits()).length===1,'audit failure creates no success event');await db.exec('drop trigger fixture_fail_partner_audit on outreach_campaign_audit;drop function fixture_fail_partner_audit();');
 // Target-lock wait cannot outlive already-locked administrator authority.
 const blocker=await db.connect();await blocker.query('begin');await blocker.query('select * from outreach_partner_assignments where id=$1 for update',[assignment]);let done=false;
 const blocked=call(args('assignment')).then(v=>{done=true;return v});await new Promise(r=>setTimeout(r,50));check(!done,'revocation waits on target lock');
 const authorityRevoker=await db.connect();await authorityRevoker.query("set lock_timeout='100ms'");await assert.rejects(()=>authorityRevoker.query('update outreach_campaign_admins set active=false where user_id=$1',[other]),e=>e.code==='55P03');check(true,'authority revocation serialized behind authorized operation');await blocker.query('commit');const revoked=await blocked;check(revoked.revision===2,'serialized target revocation commits exact revision');await authorityRevoker.query('update outreach_campaign_admins set active=false where user_id=$1',[other]);await deny(()=>call(args('access',3)),'completed administrator revocation prevents subsequent mutation');check((await audits()).length===2,'serialized operations produce exactly two committed audit events');
 await q('update outreach_campaign_admins set active=true where user_id=$1',[other]);
 // Two owner test sessions compete at the same expected revision; only one wins.
 const second=await db.connect();await second.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[other,JSON.stringify({session_id:otherSession})]);
 const parallel=await Promise.allSettled([call(args('access',3)),call(args('access',3),second)]);check(parallel.filter(r=>r.status==='fulfilled').length===1&&parallel.filter(r=>r.status==='rejected').length===1,'concurrent CAS admits one revocation only');check((await audits()).length===3,'concurrent rejected write adds no successful audit');
 await assert.rejects(()=>q("delete from outreach_campaign_audit where kind='partner.private_revoked'"),e=>e.code==='42501');check(true,'audit history immutable even to test operator');
 check((await q('select count(*) n from outreach_registrations')).rows[0].n===1,'decision source preserved');check((await q('select count(*) n from organization_people where id=$1',[person])).rows[0].n===1,'People source preserved');
 console.log(n+' native private Partner revocation checks PASS');
}finally{await db.close()}
