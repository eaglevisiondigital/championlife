import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {canonicalSourceFixture} from './canonical-source-fixture.mjs';
import {createCanonicalPartnerRoutineRepository,verifyCanonicalRepositoryProvenance} from './canonical-repository.mjs';
import {verifyCanonicalHostEnvelope,CANONICAL_HOST_ROLE,CANONICAL_HOST_SIGNATURE} from './canonical-host-envelope.mjs';
import {createCanonicalPartnerIdentityBoundary} from './canonical-identity-boundary.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const envelope=readFileSync(new URL('./canonical-host-envelope.sql',import.meta.url),'utf8');
const sql=readFileSync(new URL('./canonical-repository.sql',import.meta.url),'utf8');
const unknown={identityStatus:'unverified',personId:null};
test('envelope contains exact existing query and no dynamic SQL or data mutation',()=>{
 assert.equal(envelope.split(sql).length,2);
 assert.doesNotMatch(envelope.split('$envelope$')[1],/\b(execute|insert|update|delete|truncate)\s/i);
 assert.match(envelope,/set search_path=''/);
});
test('least-privilege envelope preserves canonical authorization and pins',async t=>{
 const db=new PGlite();
 try{
  const f=await canonicalSourceFixture(db);await db.exec(envelope);
  const owner=()=>db.exec('reset role'),caller=()=>db.exec('set role '+CANONICAL_HOST_ROLE);
  const request={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment,userId:f.actor,sessionId:f.session};
  let releases=[];
  const repository=createCanonicalPartnerRoutineRepository({acquire:async()=>{await caller();return{query:db.query.bind(db),release:async x=>releases.push(x)}}});
  let principal={userId:f.actor,sessionId:f.session,verified:true,expiresAt:new Date(Date.now()+3600000).toISOString()};
  const boundary=createCanonicalPartnerIdentityBoundary({getPrincipal:()=>principal,repository});
  const scope={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment};
  const read=()=>boundary.read(scope),verified={identityStatus:'verified',personId:f.person};
  await t.test('actual accepted writer links through restricted caller and existing adapter',async()=>{assert.deepEqual(await read(),verified);assert.equal(releases.at(-1),false);await verifyCanonicalRepositoryProvenance(db);await verifyCanonicalHostEnvelope(db)});
  for(const role of ['anon','authenticated','service_role'])await t.test(role+' cannot execute host routine',async()=>{await owner();await db.exec('set role '+role);await assert.rejects(()=>db.query('select * from partner_identity_host.current_snapshot($1,$2,$3,$4,$5)',Object.values(request)),e=>e.code==='42501');await caller()});
  for(const statement of ['select * from auth.users','select * from auth.sessions','select * from private.city_identity_requests','select * from private.people','select * from portal_account_links','update outreach_partner_assignments set status=status','select private.partner_assigned_metadata(null,null)','create table partner_identity_host.untrusted(id int)'])await t.test('direct caller denied '+statement,async()=>{await caller();await assert.rejects(()=>db.query(statement),e=>e.code==='42501')});
  await t.test('mismatched claim user/session cannot select a supplied principal',async()=>{
   await caller();for(const claims of [{sub:f.other,sid:f.session},{sub:f.actor,sid:f.otherSession},{sub:f.actor,sid:'malformed'}]){
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[claims.sub,JSON.stringify({session_id:claims.sid})]);
    await assert.rejects(()=>db.query('select * from partner_identity_host.current_snapshot($1,$2,$3,$4,$5)',Object.values(request)),e=>e.code==='42501');
   }
  });
  for(const [name,change,undo,args]of[
   ['account revocation','update portal_account_links set active=false where person_id=$1','update portal_account_links set active=true where person_id=$1',[f.person]],
   ['subject ban',"update auth.users set banned_until=now()+interval '1 hour' where id=$1",'update auth.users set banned_until=null where id=$1',[f.subject]],
   ['source consent','update outreach_registrations set consent=false where id=$1','update outreach_registrations set consent=true where id=$1',[f.decision]],
   ['worker scope','update outreach_partner_users set active=false where user_id=$1','update outreach_partner_users set active=true where user_id=$1',[f.actor]],
   ['session retirement','update auth.sessions set not_after=now() where id=$1',"update auth.sessions set not_after=now()+interval '1 hour' where id=$1",[f.session]]
  ])await t.test(name+' remains denied with no callback result',async()=>{await owner();await db.query(change,args);assert.deepEqual(await read(),unknown);assert.equal(releases.at(-1),true);await owner();await db.query(undo,args);assert.deepEqual(await read(),verified)});
  await t.test('foreign organization and campaign denied',async()=>{assert.deepEqual(await boundary.read({...scope,organizationId:f.foreign}),unknown);assert.deepEqual(await boundary.read({...scope,campaignId:f.foreignCampaign}),unknown)});
  await t.test('callback/async failure rolls back and valid later read works',async()=>{for(const callback of [()=>{throw Error('private detail')},async()=>{}])await assert.rejects(()=>repository.withCurrentIdentity(request,callback));assert.equal(releases.at(-1),true);assert.deepEqual(await read(),verified)});
  await t.test('changing host principal retires result',async()=>{const base=principal;principal={...base,verified:false};assert.deepEqual(await read(),unknown);principal=base;assert.deepEqual(await read(),verified)});
  for(const [name,change,undo]of[
   ['table SELECT','grant select on auth.users to partner_canonical_reader','revoke select on auth.users from partner_canonical_reader'],
   ['column UPDATE','grant update(active) on portal_account_links to partner_canonical_reader','revoke update(active) on portal_account_links from partner_canonical_reader'],
   ['role login','alter role partner_canonical_reader login','alter role partner_canonical_reader nologin'],
   ['role bypass','alter role partner_canonical_reader bypassrls','alter role partner_canonical_reader nobypassrls'],
   ['role membership','grant authenticated to partner_canonical_reader','revoke authenticated from partner_canonical_reader'],
   ['caller member','grant partner_canonical_reader to authenticated','revoke partner_canonical_reader from authenticated'],
   ['other definer execute','grant execute on function private.partner_assigned_metadata(uuid,uuid) to partner_canonical_reader','revoke execute on function private.partner_assigned_metadata(uuid,uuid) from partner_canonical_reader'],
   ['routine PUBLIC execute','grant execute on function '+CANONICAL_HOST_SIGNATURE+' to public','revoke execute on function '+CANONICAL_HOST_SIGNATURE+' from public'],
   ['routine volatility','alter function '+CANONICAL_HOST_SIGNATURE+' stable','alter function '+CANONICAL_HOST_SIGNATURE+' volatile'],
   ['routine search path',"alter function "+CANONICAL_HOST_SIGNATURE+" set search_path=public",'alter function '+CANONICAL_HOST_SIGNATURE+" set search_path=''"],
   ['private schema CREATE','grant create on schema private to partner_canonical_reader','revoke create on schema private from partner_canonical_reader'],
   ['schema anonymous usage','grant usage on schema partner_identity_host to anon','revoke usage on schema partner_identity_host from anon'],
   ['schema CREATE','grant create on schema partner_identity_host to partner_canonical_reader','revoke create on schema partner_identity_host from partner_canonical_reader']
  ])await t.test('envelope drift denies '+name,async()=>{await owner();await db.exec(change);assert.deepEqual(await read(),unknown);await owner();await db.exec(undo);assert.deepEqual(await read(),verified)});
  await t.test('missing envelope is unverified',async()=>{await owner();await db.exec('drop function '+CANONICAL_HOST_SIGNATURE);assert.deepEqual(await read(),unknown)});
 }finally{await db.close()}
});
