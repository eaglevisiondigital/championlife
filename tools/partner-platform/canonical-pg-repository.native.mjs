// Invoked only inside the existing disposable PostgreSQL18 fixture. No second
// cluster, hosted address, external credentials or real identity is accepted.
import assert from 'node:assert/strict';
import {createCanonicalPartnerPgRepository} from './canonical-pg-repository.mjs';
import {createCanonicalPartnerIdentityBoundary} from './canonical-identity-boundary.mjs';
export async function checkCanonicalOwnedConnections(db,f){
 let checks=0;
 const pass=label=>{checks++;console.log('PASS owned connection '+label)};
 const observer=await db.connect(),writer=await db.connect();
 const socketDirectory=observer.connectionParameters.host;
 const principal={userId:f.actor,sessionId:f.session,verified:true,expiresAt:new Date(Date.now()+3600000).toISOString()};
 const scope={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment};
 const request={...scope,userId:f.actor,sessionId:f.session};
 const expected={identityStatus:'verified',personId:f.person},unknown={identityStatus:'unverified',personId:null};
 const make=()=>{const controller=new AbortController(),repository=createCanonicalPartnerPgRepository({socketDirectory,signal:controller.signal});return{controller,repository,boundary:createCanonicalPartnerIdentityBoundary({repository,getPrincipal:()=>principal})}};
 const active=async()=>Number((await observer.query("select count(*) n from pg_stat_activity where application_name='partner_canonical_disposable'")).rows[0].n);
 const settled=async()=>{for(let i=0;i<50;i++){if(await active()===0)return;await new Promise(r=>setTimeout(r,20))}assert.fail('owned connection remained active')};
 const m=make();assert.deepEqual(await m.boundary.read(scope),expected);await settled();pass('fresh native driver authorized read closes connection');
 assert.deepEqual(await m.boundary.read(scope),expected);await settled();pass('next read opens fresh connection');
 await writer.query('create temporary table owned_connection_probe(v int)');await writer.query('begin');await writer.query('insert into owned_connection_probe values(1)');
 assert.deepEqual(await m.boundary.read(scope),expected);await writer.query('rollback');assert.equal(Number((await writer.query('select count(*) n from owned_connection_probe')).rows[0].n),0);pass('repository cannot commit caller-owned transaction');
 await assert.rejects(()=>m.repository.withCurrentIdentity(request,()=>{throw Error('private callback failure')}),e=>e.message==='Canonical identity unavailable');await settled();pass('callback failure closes without leaking error');
 await assert.rejects(()=>m.repository.withCurrentIdentity(request,async()=>{}),/Canonical identity unavailable/);await settled();pass('asynchronous consumer rejected and connection retired');
 const pids=new Set();await Promise.all(Array.from({length:4},async()=>{
  const {repository}=make();await repository.withCurrentIdentity(request,()=>{});
 }));await settled();pass('four simultaneous repository reads complete without shared lease');
 // Terminate a blocked socket, then stop a different blocked read. Observe actual
 // server lock wait; never infer transport cancellation from a client timeout.
 for(const mode of ['terminate','abort']){
  const x=make();await writer.query('begin');await writer.query('select * from outreach_partner_assignments where id=$1 for update',[f.assignment]);
  const pending=x.boundary.read(scope);let pid;
  for(let i=0;i<50;i++){
   pid=(await observer.query("select pid from pg_stat_activity where application_name='partner_canonical_disposable' and wait_event_type='Lock' order by pid limit 1")).rows[0]?.pid;
   if(pid)break;await new Promise(r=>setTimeout(r,10));
  }
  assert.ok(pid,'owned repository reaches actual blocked request');pids.add(pid);
  if(mode==='abort')x.controller.abort();else await observer.query('select pg_terminate_backend($1)',[pid]);
  assert.deepEqual(await pending,unknown);await writer.query('rollback');await settled();pass(mode+' during pending query prevents result and closes server connection');
  if(mode==='abort'){assert.deepEqual(await x.boundary.read(scope),unknown);pass('aborted repository cannot authorize later reads')}
 }
 assert.equal(pids.size,2);pass('independent pending requests use distinct backend sessions');
 const stopped=make();await assert.rejects(()=>stopped.repository.withCurrentIdentity(request,()=>stopped.controller.abort()),/Canonical identity unavailable/);await settled();pass('abort during consumer prevents successful commit/result');
 await writer.query('update portal_account_links set active=false where person_id=$1',[f.person]);assert.deepEqual(await m.boundary.read(scope),unknown);await settled();pass('fresh connection observes committed account-link revocation');await writer.query('update portal_account_links set active=true where person_id=$1',[f.person]);
 assert.deepEqual(await m.boundary.read(scope),expected);pass('fresh current authorization can recover after legitimate restoration');
 // Establish rather than assume SELECT-only role limitations. Fictional role
 // exists only in the disposable cluster; no role or grant is a release artifact.
 await writer.query('create role canonical_select_probe nologin');await writer.query('grant usage on schema public to canonical_select_probe');await writer.query('grant select on outreach_partner_assignments to canonical_select_probe');
 await writer.query('begin');await writer.query('set local role canonical_select_probe');
 await assert.rejects(()=>writer.query('select id from outreach_partner_assignments for share'),e=>e.code==='42501');await writer.query('rollback');
 await writer.query('drop owned by canonical_select_probe');await writer.query('drop role canonical_select_probe');pass('SELECT-only cannot satisfy row-locking repository; live least-privilege gate remains held');
 console.log(checks+' native owned PostgreSQL connection checks PASS');return checks;
}
