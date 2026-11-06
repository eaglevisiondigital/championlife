// Real independent native sessions, fictional data, Unix socket only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {currentSchemaSourceFixture} from './current-schema-source-fixture.mjs';
import {executionRoleFixture} from './execution-role-fixture.mjs';
import {verifyCanonicalExecutionHostEnvelope,verifyCanonicalHostEnvelope} from './canonical-host-envelope.mjs';
import {createCanonicalPartnerExecutionIngress} from './canonical-host-ingress.mjs';
import {signedHostFixture} from './signed-host-fixture.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {Client}=require('pg');
const db=await localPostgres(),clients=[];let count=0;
const pass=name=>{count++;console.log('PASS native execution role '+name)};
try{
 const f=await currentSchemaSourceFixture(db),owner=await db.connect();
 await db.exec(readFileSync(new URL('./canonical-host-envelope.sql',import.meta.url),'utf8'));await executionRoleFixture(db);
 const connect=async()=>{const c=new Client({host:owner.connectionParameters.host,port:55488,database:'postgres',user:'partner_identity_host_login',password:()=>'',ssl:false,connectionTimeoutMillis:1000,query_timeout:4000});await c.connect();clients.push(c);await c.query('set role partner_canonical_reader');return c};
 const c=await connect();await verifyCanonicalExecutionHostEnvelope(c);pass('actual LOGIN and SET-only membership verified');
 await assert.rejects(()=>verifyCanonicalHostEnvelope(c));pass('old zero-membership profile still denies new role');
 for(const sql of ['set role postgres','set role authenticated','set role service_role','set session authorization postgres','create temp table bad(id int)','create schema bad','select * from auth.users','select * from portal_account_links']){
  await assert.rejects(()=>c.query(sql),e=>e.code==='42501');pass('actual credential denied '+sql);
 }
 for(const schema of ['pgx_sensitive','pgX_sensitive']){
  const q='"'+schema+'"';await owner.query(`create schema ${q};create function ${q}.owner_probe() returns text language sql security definer as 'select current_user::text';grant usage on schema ${q} to public`);
  assert.equal((await c.query(`select ${q}.owner_probe() owner`)).rows[0].owner,'postgres');await assert.rejects(()=>verifyCanonicalExecutionHostEnvelope(c));pass('ordinary '+schema+' PUBLIC definer is rejected');
  await owner.query(`drop function ${q}.owner_probe();create table ${q}.hidden(id int);grant select on ${q}.hidden to public`);await assert.rejects(()=>verifyCanonicalExecutionHostEnvelope(c));pass('ordinary '+schema+' PUBLIC table is rejected');
  await owner.query(`drop schema ${q} cascade`);await verifyCanonicalExecutionHostEnvelope(c);
 }
 await c.query('reset role');await assert.rejects(()=>c.query('select * from partner_identity_host.current_snapshot(null,null,null,null,null)'),e=>e.code==='42501');await c.query('set role partner_canonical_reader');pass('RESET ROLE cannot use definer');
 const signer=signedHostFixture(f),request={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment,accessToken:signer.token()};
 let beforeCommit=false,reached,release;
 const ingress=createCanonicalPartnerExecutionIngress({issuer:signer.issuer,publicJwk:signer.publicJwk,acquire:async()=>{const connection=await connect();return {query:async(sql,args)=>{if(beforeCommit&&sql==='commit'){reached();await new Promise(r=>release=r)}return connection.query(sql,args)},release:async()=>connection.end()}}});
 const read=()=>ingress.read(request,new AbortController().signal),unknown={identityStatus:'unverified',personId:null},verified={identityStatus:'verified',personId:f.person};
 const version=Number((await db.query('show server_version_num')).rows[0].server_version_num);
 if(version<180000||version>=190000){assert.deepEqual(await read(),unknown);pass('unsupported exact catalog denies');console.log('SKIP canonical positive/concurrency requires PG18, actual '+version)}else{
  assert.deepEqual(await read(),verified);pass('actual login signed ingress current schema positive');
  await db.exec('grant temp on database postgres to public');assert.deepEqual(await read(),unknown);await db.exec('revoke temp on database postgres from public');assert.deepEqual(await read(),verified);pass('PUBLIC privilege widening denies then requires fresh valid check');
  for(const [name,sql,undo]of[
   ['session',`delete from auth.sessions where id='${f.session}'`,`insert into auth.sessions(id,user_id)values('${f.session}','${f.actor}')`],
   ['assignment',`update outreach_partner_assignments set assigned_worker_user_id='${f.other}' where id='${f.assignment}'`,`update outreach_partner_assignments set assigned_worker_user_id='${f.actor}' where id='${f.assignment}'`],
   ['account',`update portal_account_links set active=false where person_id='${f.person}'`,`update portal_account_links set active=true where person_id='${f.person}'`]
  ]){
   beforeCommit=true;const ready=new Promise(r=>reached=r),pending=read();await Promise.race([ready,pending.then(()=>{throw Error('read escaped barrier')})]);
   await owner.query("set lock_timeout='100ms'");await assert.rejects(()=>owner.query(sql),e=>e.code==='55P03');beforeCommit=false;release();assert.deepEqual(await pending,verified);await owner.query(sql);assert.deepEqual(await read(),unknown);await owner.query(undo);assert.deepEqual(await read(),verified);pass(name+' revocation serialized then rechecked');
  }
 }
 await db.exec('grant authenticated to partner_identity_host_login');await assert.rejects(()=>verifyCanonicalExecutionHostEnvelope(c));await db.exec('revoke authenticated from partner_identity_host_login');await verifyCanonicalExecutionHostEnvelope(c);pass('changed membership denies existing connection');
 console.log(count+' native execution-role checks PASS');
}finally{for(const c of clients)try{await c.end()}catch{}await db.close()}
