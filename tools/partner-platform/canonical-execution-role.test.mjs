import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {currentSchemaSourceFixture} from './current-schema-source-fixture.mjs';
import {executionRoleFixture} from './execution-role-fixture.mjs';
import {verifyCanonicalExecutionHostEnvelope,verifyCanonicalHostEnvelope} from './canonical-host-envelope.mjs';
import {createCanonicalPartnerExecutionIngress} from './canonical-host-ingress.mjs';
import {signedHostFixture} from './signed-host-fixture.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const unknown={identityStatus:'unverified',personId:null};
test('separate fixed execution role preserves pins, denies excess authority and uses signed ingress',async t=>{
 const db=new PGlite();
 try{
  const f=await currentSchemaSourceFixture(db);await db.exec(readFileSync(new URL('./canonical-host-envelope.sql',import.meta.url),'utf8'));await executionRoleFixture(db);
  const owner=()=>db.exec('set session authorization postgres; reset role');
  const caller=()=>db.exec('set session authorization partner_identity_host_login; set role partner_canonical_reader');
  const signer=signedHostFixture(f),request={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment,accessToken:signer.token()};
  const ingress=createCanonicalPartnerExecutionIngress({issuer:signer.issuer,publicJwk:signer.publicJwk,acquire:async()=>{await caller();return {query:db.query.bind(db),release:async()=>{}}}});
  const read=()=>ingress.read(request,new AbortController().signal);
  const verified={identityStatus:'verified',personId:f.person};
  await caller();await t.test('exact execution profile positive and old zero-membership profile still rejects',async()=>{await verifyCanonicalExecutionHostEnvelope(db);await assert.rejects(()=>verifyCanonicalHostEnvelope(db));assert.deepEqual(await read(),verified)});
  for(const statement of ['set role postgres','set role authenticated','set role service_role','select * from auth.users','select * from portal_account_links','create temp table shadow(id int)','create schema hostile'])await t.test('dedicated caller cannot '+statement,async()=>{await caller();await assert.rejects(()=>db.exec(statement),e=>e.code==='42501')});
  await t.test('RESET ROLE restores only minimal login; no direct routine or relation access',async()=>{await caller();await db.exec('reset role');for(const statement of ['select * from auth.users','select * from partner_identity_host.current_snapshot(null,null,null,null,null)','create temp table hostile(id int)'])await assert.rejects(()=>db.exec(statement),e=>e.code==='42501')});
  const mutations=[
   ['superuser','alter role partner_identity_host_login superuser','alter role partner_identity_host_login nosuperuser'],
   ['login disabled','alter role partner_identity_host_login nologin','alter role partner_identity_host_login login'],
   ['reader login','alter role partner_canonical_reader login','alter role partner_canonical_reader nologin'],
   ['reader temporary','grant temp on database postgres to partner_canonical_reader','revoke temp on database postgres from partner_canonical_reader'],
   ['login bypass','alter role partner_identity_host_login bypassrls','alter role partner_identity_host_login nobypassrls'],
   ['login create role','alter role partner_identity_host_login createrole','alter role partner_identity_host_login nocreaterole'],
   ['login create database','alter role partner_identity_host_login createdb','alter role partner_identity_host_login nocreatedb'],
   ['login replication','alter role partner_identity_host_login replication','alter role partner_identity_host_login noreplication'],
   ['inherit flag','alter role partner_identity_host_login inherit','alter role partner_identity_host_login noinherit'],
   ['expired login',"alter role partner_identity_host_login valid until '2000-01-01'","alter role partner_identity_host_login valid until 'infinity'"],
   ['role settings',"alter role partner_identity_host_login set search_path='public'",'alter role partner_identity_host_login reset all'],
   ['inherit edge','grant partner_canonical_reader to partner_identity_host_login with inherit true','grant partner_canonical_reader to partner_identity_host_login with inherit false'],
   ['admin edge','grant partner_canonical_reader to partner_identity_host_login with admin true','grant partner_canonical_reader to partner_identity_host_login with admin false'],
   ['extra membership','grant authenticated to partner_identity_host_login','revoke authenticated from partner_identity_host_login'],
   ['reader delegate','grant partner_canonical_reader to authenticated','revoke partner_canonical_reader from authenticated'],
   ['login delegate','grant partner_identity_host_login to authenticated','revoke partner_identity_host_login from authenticated'],
   ['PUBLIC temporary','grant temp on database postgres to public','revoke temp on database postgres from public'],
   ['database create','grant create on database postgres to partner_identity_host_login','revoke create on database postgres from partner_identity_host_login'],
   ['login table read','grant select on portal_account_links to partner_identity_host_login','revoke select on portal_account_links from partner_identity_host_login'],
   ['login column write','grant update(active) on portal_account_links to partner_identity_host_login','revoke update(active) on portal_account_links from partner_identity_host_login'],
   ['schema create','grant create on schema public to partner_identity_host_login','revoke create on schema public from partner_identity_host_login'],
   ['foreign schema relation','create schema foreign_data;create table foreign_data.secret(id int);grant select on foreign_data.secret to partner_identity_host_login','drop schema foreign_data cascade'],
   ['foreign sequence','create schema foreign_data;create sequence foreign_data.ids;grant usage on sequence foreign_data.ids to partner_identity_host_login','drop schema foreign_data cascade'],
   ['foreign PUBLIC relation','create schema foreign_data;create table foreign_data.secret(id int);grant select on foreign_data.secret to public','drop schema foreign_data cascade'],
   ['foreign PUBLIC definer',"create schema foreign_data;create function foreign_data.elevate() returns int language sql security definer as 'select 1';grant usage on schema foreign_data to public",'drop schema foreign_data cascade'],
   ['owned schema','create schema foreign_data authorization partner_identity_host_login','drop schema foreign_data cascade'],
  ];
  for(const [name,change,undo]of mutations)await t.test('profile drift fails closed: '+name,async()=>{await owner();await db.exec(change);await caller();await assert.rejects(()=>verifyCanonicalExecutionHostEnvelope(db));assert.deepEqual(await read(),unknown);await owner();await db.exec(undo);assert.deepEqual(await read(),verified)});
  await t.test('SET-only membership is mandatory; missing or non-SET edge fails closed',async()=>{for(const [change,undo]of[
   ['revoke partner_canonical_reader from partner_identity_host_login','grant partner_canonical_reader to partner_identity_host_login with admin false, inherit false, set true'],
   ['grant partner_canonical_reader to partner_identity_host_login with set false','grant partner_canonical_reader to partner_identity_host_login with set true']
  ]){await owner();await db.exec(change);await assert.rejects(caller);assert.deepEqual(await read(),unknown);await owner();await db.exec(undo);assert.deepEqual(await read(),verified)}});
  await t.test('current real-schema identity/session/consent is still mandatory',async()=>{for(const [change,undo]of [
   ['update portal_account_links set active=false','update portal_account_links set active=true'],
   ["update auth.sessions set not_after=now()-interval '1 second'",'update auth.sessions set not_after=null'],
   ['update outreach_registrations set consent=false','update outreach_registrations set consent=true']
  ]){await owner();await db.exec(change);assert.deepEqual(await read(),unknown);await owner();await db.exec(undo);assert.deepEqual(await read(),verified)}});
 }finally{await db.close()}
});
