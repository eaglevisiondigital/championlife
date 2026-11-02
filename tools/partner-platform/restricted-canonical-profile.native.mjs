// Disposable native sessions only. Current-schema composition + strict profile;
// fictional Auth and owner SET ROLE do not prove a deployed credential binding.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {currentSchemaSourceFixture} from './current-schema-source-fixture.mjs';
import {createRestrictedCanonicalPartnerRoutineRepository,createCanonicalPartnerRoutineRepository} from './canonical-repository.mjs';
import {createCanonicalPartnerIdentityBoundary} from './canonical-identity-boundary.mjs';
const db=await localPostgres();let checks=0;
const pass=name=>{checks++;console.log('PASS strict native '+name)};
try{
 const f=await currentSchemaSourceFixture(db),reader=await db.connect(),writer=await db.connect(),observer=await db.connect();
 await db.exec(readFileSync(new URL('./canonical-host-envelope.sql',import.meta.url),'utf8'));
 await reader.query('set role partner_canonical_reader');await writer.query("set lock_timeout='150ms'");
 let hold=false,reached,release;
 const acquire=async()=>({query:async(sql,args)=>{if(hold&&sql==='commit'){reached();await new Promise(r=>release=r)}return reader.query(sql,args)},release:async()=>{}});
 const principal={userId:f.actor,sessionId:f.session,verified:true,expiresAt:new Date(Date.now()+3600000).toISOString()};
 const request={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment};
 const bind=factory=>createCanonicalPartnerIdentityBoundary({repository:factory({acquire}),getPrincipal:()=>principal});
 const boundary=bind(createRestrictedCanonicalPartnerRoutineRepository),read=()=>boundary.read(request);
 const unknown={identityStatus:'unverified',personId:null},verified={identityStatus:'verified',personId:f.person};
 assert.deepEqual(await bind(createCanonicalPartnerRoutineRepository).read(request),unknown);pass('historical repository still denies restricted privileges');
 const version=(await db.query('show server_version_num')).rows[0].server_version_num;
 if(Number(version)<180000||Number(version)>=190000){
  assert.deepEqual(await read(),unknown);pass('unsupported catalog version fails closed');
  console.log('SKIP positive/concurrency native coverage: exact PG18 catalog required; actual version '+version);
 }else{
  assert.deepEqual(await read(),verified);pass('PG18 strict profile authorizes actual current-schema canonical join');
  for(const [name,sql,args,undo,undoArgs]of[
   ['account','update portal_account_links set active=false where person_id=$1',[f.person],'update portal_account_links set active=true where person_id=$1',[f.person]],
   ['review','update private.city_identity_reviews set revision=2 where source_id=$1',[f.decision],'update private.city_identity_reviews set revision=1 where source_id=$1',[f.decision]],
   ['source consent','update outreach_registrations set consent=false where id=$1',[f.decision],'update outreach_registrations set consent=true where id=$1',[f.decision]],
   ['assignment','update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.other,f.assignment],'update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.actor,f.assignment]],
   ['Partner revocation','update outreach_partner_users set active=false where user_id=$1',[f.actor],'update outreach_partner_users set active=true where user_id=$1',[f.actor]],
   ['Auth ban',"update auth.users set banned_until=now()+interval '1 hour' where id=$1",[f.actor],'update auth.users set banned_until=null where id=$1',[f.actor]]
  ]){
   hold=true;const ready=new Promise(r=>reached=r),pending=read();
   await Promise.race([ready,pending.then(()=>{throw Error('Read completed before locked checkpoint')})]);
   await assert.rejects(()=>writer.query(sql,args),e=>e.code==='55P03');pass(name+' change waits behind positive read');
   await writer.query('update outreach_campaigns set name=name where id=$1',[f.foreignCampaign]);pass(name+' leaves unrelated campaign writable');
   hold=false;release();assert.deepEqual(await pending,verified);
   await writer.query(sql,args);assert.deepEqual(await read(),unknown);pass(name+' committed change denies');
   await writer.query(undo,undoArgs);assert.deepEqual(await read(),verified);
   await writer.query('begin');await writer.query(sql,args);assert.deepEqual(await read(),unknown);await writer.query('rollback');assert.deepEqual(await read(),verified);pass(name+' write-first timeout discards read, then fresh authorization succeeds');
  }
  for(const signature of ['private.city_decision_reconcile(uuid,jsonb)','private.city_care_workspace(uuid,text,jsonb)']){
   await writer.query('grant execute on function '+signature+' to authenticated');assert.deepEqual(await read(),unknown);
   await writer.query('revoke execute on function '+signature+' from authenticated');assert.deepEqual(await read(),verified);pass('broader writer grant rejected '+signature);
  }
  await writer.query('begin');await writer.query('select * from outreach_partner_assignments where id=$1 for update',[f.assignment]);
  const pid=(await reader.query('select pg_backend_pid() pid')).rows[0].pid,pending=read();let waiting=false;
  for(let i=0;i<50;i++){waiting=(await observer.query("select wait_event_type='Lock' waiting from pg_stat_activity where pid=$1",[pid])).rows[0]?.waiting;if(waiting)break;await new Promise(r=>setTimeout(r,10))}
  assert.equal(waiting,true);await observer.query('select pg_cancel_backend($1)',[pid]);assert.deepEqual(await pending,unknown);await writer.query('rollback');assert.deepEqual(await read(),verified);pass('actual blocked read cancellation rolls back; fresh request reauthorizes');
  const repository=createRestrictedCanonicalPartnerRoutineRepository({acquire});
  await assert.rejects(()=>repository.withCurrentIdentity({...request,userId:f.actor,sessionId:f.session},()=>{throw Error('Synthetic consumer failure')}));
  await writer.query('update portal_account_links set active=active where person_id=$1',[f.person]);assert.deepEqual(await read(),verified);pass('consumer failure rolls back account locks');
  assert.equal(checks,30);console.log('30 native PG18 restricted-profile checks PASS');
 }
}finally{await db.close()}
