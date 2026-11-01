// Disposable native PostgreSQL only. Synthetic Auth rows do not prove hosted Auth.
import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import{randomUUID as uuid}from'node:crypto';
import{localPostgres}from'../backend-tests/local-postgres.mjs';import{migrationOrder}from'../backend-tests/migration-order.mjs';
const db=await localPostgres(),q=(...a)=>db.query(...a),read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');let n=0;const check=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)},deny=async(fn,m)=>{await assert.rejects(fn,e=>['42501','40001'].includes(e.code));check(true,m)};
try{
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(`alter table auth.users add column deleted_at timestamptz,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant execute on function auth.jwt() to authenticated;`);await db.exec(read('supabase/bootstrap/automatic-rls.sql'));for(const f of migrationOrder)await db.exec(read('supabase/migrations/'+f));await db.exec(read('supabase/migrations/20261101154618_partner_assigned_metadata_boundary.sql'));
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
 const beforeAudit=(await q('select count(*) n from outreach_campaign_audit')).rows[0].n;
 const connect=async(user=actor,sid=session)=>{const c=await db.connect();await c.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({sub:user,session_id:sid})]);await c.query('set role authenticated');return c};
 const conn=await connect(),rpc=(c=conn,camp=campaign,a=assignment)=>c.query('select public.partner_assigned_metadata($1,$2) v',[camp,a]).then(r=>r.rows[0].v);
 const data=await rpc();check(data.length===1&&data[0].personId===null&&data[0].identityStatus==='unverified','exact assignment allowed without inferring canonical identity');check(Object.keys(data[0]).length===8,'only eight metadata keys');check(!JSON.stringify(data).includes('SECRET')&&!JSON.stringify(data).includes('email'),'child/contact/financial/notes/answers omitted');
 await q('update outreach_campaign_registrants set person_id=null where id=$1',[registrant]);check((await rpc())[0].identityStatus==='unverified','absent People mapping never inferred');await q('update outreach_campaign_registrants set person_id=$1 where id=$2',[person,registrant]);check((await rpc())[0].personId===null,'unreviewed People mapping never exported');
 await q("update auth.sessions set not_after=now()-interval '1 minute' where id=$1",[session]);await deny(()=>rpc(),'expired actual session row denied');await q("update auth.sessions set not_after=now()+interval '1 hour' where id=$1",[session]);
 for(const table of['outreach_partner_churches','outreach_partner_users','outreach_partner_assignments']){
  await deny(()=>conn.query('select * from public.'+table),'raw '+table+' select denied');await deny(()=>conn.query('delete from public.'+table),'raw '+table+' delete denied');
 }
 await deny(()=>conn.query("insert into outreach_partner_users(partner_church_id,campaign_id,user_id,capabilities,granted_by,reason)values($1,$2,$3,array['partner.view'],$3,'Attempted own grant')",[partner,campaign,actor]),'self-grant denied');
 await deny(()=>rpc(conn,foreignCampaign),'foreign campaign detail denied');check((await rpc(conn,foreignCampaign,null)).length===0,'foreign campaign listing leaks no total');await deny(()=>rpc(conn,campaign,unassigned),'unassigned record denied');
 const stranger=await connect(other,otherSession);check((await rpc(stranger,campaign,null)).length===0,'other verified identity sees no assignments');await deny(()=>rpc(stranger),'other worker detail denied');
 for(const claim of [null,'malformed',otherSession]){const c=await connect(actor,claim);await deny(()=>rpc(c),'missing malformed foreign session denied');}
 for(const[sql,undo,label]of[
 ['update auth.users set email_confirmed_at=null where id=$1','update auth.users set email_confirmed_at=now() where id=$1','unverified actor'],
 ['update auth.users set deleted_at=now() where id=$1','update auth.users set deleted_at=null where id=$1','deleted actor'],
 ["update auth.users set banned_until=now()+interval '1 hour' where id=$1",'update auth.users set banned_until=null where id=$1','banned actor'],
 ['update auth.users set is_anonymous=true where id=$1','update auth.users set is_anonymous=false where id=$1','anonymous actor']]){await q(sql,[actor]);await deny(()=>rpc(),label);await q(undo,[actor]);}
 for(const[sql,undo,args,label]of[
 ["update outreach_campaign_assignments set effective_at=now()+interval '1 hour' where user_id=$1","update outreach_campaign_assignments set effective_at=now()-interval '1 hour' where user_id=$1",[actor],'future campaign authority'],
 ["update outreach_campaign_assignments set effective_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where user_id=$1","update outreach_campaign_assignments set expires_at=null where user_id=$1",[actor],'expired campaign authority'],

 ["update outreach_partner_users set active=false where user_id=$1","update outreach_partner_users set active=true where user_id=$1",[actor],'Partner grant revocation'],
 ["update outreach_partner_users set effective_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where user_id=$1","update outreach_partner_users set expires_at=null where user_id=$1",[actor],'Partner grant expiry'],
 ["update outreach_campaign_assignments set active=false where user_id=$1","update outreach_campaign_assignments set active=true where user_id=$1",[actor],'campaign assignment revocation'],
 ["update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2","update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2",[other,assignment],'worker reassignment'],
 ["update outreach_partner_churches set active=false where id=$1","update outreach_partner_churches set active=true where id=$1",[partner],'partner church revoked']]){await q(sql,args);await deny(()=>rpc(),label);await q(undo,label==='worker reassignment'?[actor,assignment]:args);}
 // Revocation after a successful read must wait for the read transaction. After
 // commit the next call must deny. Compatible real row UPDATE/DELETE locks.
 for(const kind of ['grant','session','mapping']){
  await conn.query('begin');await rpc();const writer=await db.connect();await writer.query('begin');let done=false;
  const sql=kind==='grant'?'update outreach_partner_users set active=false where user_id=$1':kind==='session'?'delete from auth.sessions where id=$1':'delete from outreach_campaign_registrants where id=$1';const val=kind==='grant'?actor:kind==='session'?session:registrant;
  const pending=writer.query(sql,[val]).then(()=>{done=true});await new Promise(r=>setTimeout(r,30));check(!done,kind+' revocation waits behind authorized read');await conn.query('commit');await pending;await writer.query('commit');await deny(()=>rpc(),kind+' completed revocation prevents next read');
  if(kind==='grant')await q('update outreach_partner_users set active=true where user_id=$1',[actor]);if(kind==='session')await q("insert into auth.sessions(id,user_id,not_after)values($1,$2,now()+interval '1 hour')",[session,actor]);if(kind==='mapping')await q('insert into outreach_campaign_registrants(id,campaign_id,organization_id,legacy_registration_id,person_id)values($1,$2,$3,$4,$5)',[registrant,campaign,org,decision,person]);
 }
 // Establish stale snapshots in repeatable-read/serializable before another
 // transaction revokes. Locking reads must abort/retry rather than use old authority.
 for(const isolation of ['repeatable read','serializable']){
  const c=await connect();await c.query('begin isolation level '+isolation);await c.query('select count(*) from public.organizations');await q('update outreach_partner_users set active=false where user_id=$1',[actor]);await deny(()=>rpc(c),isolation+' stale authority serialization denies');await c.query('rollback');await q('update outreach_partner_users set active=true where user_id=$1',[actor]);
 }
 // A session that expires while waiting cannot authorize a late projection.
 const expiryBlocker=await db.connect();await expiryBlocker.query('begin');await expiryBlocker.query('select * from outreach_partner_assignments where id=$1 for update',[assignment]);
 await q("update auth.sessions set not_after=clock_timestamp()+interval '250 milliseconds' where id=$1",[session]);
 const expiring=await connect();const expiryPending=rpc(expiring).then(v=>({v}),e=>({e}));await new Promise(r=>setTimeout(r,350));await expiryBlocker.query('commit');const expiryResult=await expiryPending;check(expiryResult.e?.code==='42501','session expires during blocked projection fails closed');await q("update auth.sessions set not_after=now()+interval '1 hour' where id=$1",[session]);
 // Reader blocks on a target assignment before concurrent revocation commits.
 // Release the assignment only after the authority update completed.
 const blocker=await db.connect();await blocker.query('begin');await blocker.query('select * from outreach_partner_assignments where id=$1 for update',[assignment]);
 const waiting=await connect();let finished=false;const pending=rpc(waiting).then(v=>{finished=true;return{v}},e=>{finished=true;return{e}});await new Promise(r=>setTimeout(r,30));check(!finished,'read blocked on assignment lock');
 // Lock order may already protect the grant; use short lock_timeout and accept
 // only serialized revocation-before-read or read-before-revocation ordering.
 const revoker=await db.connect();await revoker.query("set lock_timeout='100ms'");let revoked=false;try{await revoker.query('update outreach_partner_users set active=false where user_id=$1',[actor]);revoked=true}catch(e){assert.equal(e.code,'55P03')}
 await blocker.query('commit');const completed=await pending;if(revoked){check(!completed.v,'completed revocation cannot return stale record')}else{check(completed.v?.length===1,'read was ordered before blocked revocation');await revoker.query('update outreach_partner_users set active=false where user_id=$1',[actor]);}await deny(()=>rpc(),'final revoked permission denies');
 check((await q('select count(*) n from outreach_campaign_audit')).rows[0].n===beforeAudit,'read/rejected operations never create successful-change audit');
 check((await q('select count(*) n from outreach_registrations')).rows[0].n===1,'original decision row retained');check((await q('select count(*) n from organization_people where id=$1',[person])).rows[0].n===1,'canonical Person preserved');
 console.log(n+' native assigned Partner checks PASS');
}finally{await db.close()}
