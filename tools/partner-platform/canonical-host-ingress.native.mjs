// Separate native connections + genuine SDK/ephemeral fictional signatures.
// This still does NOT establish a deployed principal or Supabase Auth acceptance.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {currentSchemaSourceFixture} from './current-schema-source-fixture.mjs';
import {signedHostFixture} from './signed-host-fixture.mjs';
import {createCanonicalPartnerHostIngress} from './canonical-host-ingress.mjs';
const db=await localPostgres();let checks=0;
const pass=name=>{checks++;console.log('PASS signed ingress native '+name)};
const unknown={identityStatus:'unverified',personId:null};
try{
 const f=await currentSchemaSourceFixture(db),signer=signedHostFixture(f);
 await db.exec(readFileSync(new URL('./canonical-host-envelope.sql',import.meta.url),'utf8'));
 const writer=await db.connect(),observer=await db.connect();await writer.query("set lock_timeout='150ms'");
 const pids=[],releases=[];let hold=false,reached,release;
 const ingress=createCanonicalPartnerHostIngress({issuer:signer.issuer,publicJwk:signer.publicJwk,acquire:async()=>{
  const client=await db.connect();client.on('error',()=>{});
  pids.push((await client.query('select pg_backend_pid() pid')).rows[0].pid);
  await client.query('set role partner_canonical_reader');
  return {query:async(sql,args)=>{
   if(hold&&sql==='commit'){reached();await new Promise(resolve=>release=resolve)}
   return client.query(sql,args);
  },release:async discard=>{releases.push(discard);await client.end()}};
 }});
 const request={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment};
 const read=(claims={},signal=new AbortController().signal)=>ingress.read({...request,accessToken:signer.token(claims)},signal);
 const verified={identityStatus:'verified',personId:f.person};
 const version=Number((await db.query('show server_version_num')).rows[0].server_version_num);
 if(version<180000||version>=190000){
  assert.deepEqual(await read(),unknown);pass('unsupported exact catalog version fails closed');
  console.log('SKIP signed ingress positive/concurrency coverage: exact PostgreSQL18 required, actual '+version);
 }else{
  assert.deepEqual(await read(),verified);pass('current-schema SDK signature to canonical People join');
  // A concurrent borrowed-session request cannot replace the first request's
  // principal or inherit its transaction-local claims, even at a commit barrier.
  hold=true;let ready=new Promise(resolve=>reached=resolve),pending=read();
  await Promise.race([ready,pending.then(()=>{throw Error('Read escaped commit barrier')})]);
  assert.deepEqual(await read({sub:f.other,session_id:f.otherSession}),unknown);
  hold=false;release();assert.deepEqual(await pending,verified);pass('parallel requests keep separate principals and connections');
  assert.equal(new Set(pids).size,pids.length);pass('every request uses an exclusively owned fresh database connection');
  for(const [name,sql,args,undo,undoArgs]of[
   ['session retirement','delete from auth.sessions where id=$1',[f.session],'insert into auth.sessions(id,user_id)values($1,$2)',[f.session,f.actor]],
   ['account revocation','update portal_account_links set active=false where person_id=$1',[f.person],'update portal_account_links set active=true where person_id=$1',[f.person]],
   ['assignment replacement','update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.other,f.assignment],'update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.actor,f.assignment]]
  ]){
   hold=true;ready=new Promise(resolve=>reached=resolve);pending=read();
   await Promise.race([ready,pending.then(()=>{throw Error('Read escaped lock barrier')})]);
   await assert.rejects(()=>writer.query(sql,args),error=>error.code==='55P03');pass(name+' waits behind signed positive read');
   hold=false;release();assert.deepEqual(await pending,verified);
   await writer.query(sql,args);assert.deepEqual(await read(),unknown);pass(name+' committed change denies still-valid signature');
   await writer.query(undo,undoArgs);assert.deepEqual(await read(),verified);
  }
  const exp=Math.floor(Date.now()/1000)+2;
  hold=true;ready=new Promise(resolve=>reached=resolve);pending=read({exp});
  await Promise.race([ready,pending.then(()=>{throw Error('Read escaped expiry barrier')})]);
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,exp*1000-Date.now()+10)));
  hold=false;release();assert.deepEqual(await pending,unknown);pass('token expiry while read is pending withholds Person result');
  // Hold a real row in another transaction, then cancel the caller transport.
  await writer.query('begin');await writer.query('select * from outreach_partner_assignments where id=$1 for update',[f.assignment]);
  const controller=new AbortController(),pidCount=pids.length;pending=read({},controller.signal);let waiting=false;
  for(let i=0;i<100;i++){
   if(pids.length>pidCount)waiting=(await observer.query("select wait_event_type='Lock' waiting from pg_stat_activity where pid=$1",[pids.at(-1)])).rows[0]?.waiting;
   if(waiting)break;await new Promise(resolve=>setTimeout(resolve,5));
  }
  assert.equal(waiting,true);controller.abort();assert.deepEqual(await pending,unknown);assert.equal(releases.at(-1),true);
  await writer.query('rollback');assert.deepEqual(await read(),verified);pass('transport abort destroys blocked native session; fresh request succeeds');
  // Cancellation after a complete snapshot must release all identity locks.
  const lastController=new AbortController();hold=true;ready=new Promise(resolve=>reached=resolve);pending=read({},lastController.signal);
  await Promise.race([ready,pending.then(()=>{throw Error('Read escaped cancellation barrier')})]);
  lastController.abort();hold=false;release();assert.deepEqual(await pending,unknown);
  await writer.query('update portal_account_links set active=active where person_id=$1',[f.person]);pass('post-snapshot abort withholds identity and releases account locks');
  ingress.retire();assert.deepEqual(await read(),unknown);pass('retired issuer instance rejects subsequent reads');
  assert.equal(checks,13);console.log('13 native PG18 signed-ingress checks PASS');
 }
}finally{await db.close()}
