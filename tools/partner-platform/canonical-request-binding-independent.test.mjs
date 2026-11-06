// Independent narrow capture/release checks against actual accepted fictional SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {canonicalSourceFixture} from './canonical-source-fixture.mjs';
import {createCanonicalPartnerRepository} from './canonical-repository.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));

test('independent canonical capture and disposal',async t=>{
 const native=process.env.TEST_NATIVE_PG==='1';
 const db=native?await(await import('../backend-tests/local-postgres.mjs')).localPostgres():new(require('@electric-sql/pglite').PGlite)();
 try{
  console.log('ENGINE '+(native?'native disposable PostgreSQL':'PGlite')+' '+(await db.query('show server_version')).rows[0].server_version);
  const f=await canonicalSourceFixture(db),exact=()=>({organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment,userId:f.actor,sessionId:f.session});
  // Identify the unchanged actual SQL by byte equality, without substituting its result.
  const {readFileSync}=await import('node:fs');const canonicalSQL=readFileSync(new URL('./canonical-repository.sql',import.meta.url),'utf8');
  function bind(before=()=>{}){
   const calls=[],releases=[];let acquired=0;
   const repository=createCanonicalPartnerRepository({acquire:async()=>{acquired++;return {async query(sql,args){calls.push({sql,args:structuredClone(args)});await before(sql,args);return db.query(sql,args)},async release(discard){releases.push(discard)}}}});
   return {repository,calls,releases,get acquired(){return acquired}};
  }
  async function positive(b,input){let seen=0;await b.repository.withCurrentIdentity(input,s=>{seen++;assert.equal(s.person.id,f.person);assert.equal(s.campaign.organization_id,f.org);assert.equal(s.actor.id,f.actor)});assert.equal(seen,1);assert.deepEqual(b.releases,[false]);}
  const baseline=bind();await positive(baseline,exact());
  await t.test('frozen nonenumerable own data retains exact identity',async()=>{
   const input={};for(const [key,value]of Object.entries(exact()))Object.defineProperty(input,key,{value,enumerable:false,writable:false,configurable:false});Object.freeze(input);
   const b=bind();await positive(b,input);assert.deepEqual(b.calls,baseline.calls);
  });
  await t.test('descriptor-time mixed foreign organization and assigned campaign cannot redirect scope',async()=>{
   const target={...exact(),organizationId:f.foreign,campaignId:f.foreignCampaign};
   const input=new Proxy(target,{getOwnPropertyDescriptor(object,key){const descriptor=Reflect.getOwnPropertyDescriptor(object,key);if(key==='organizationId')Object.assign(object,exact());return descriptor}});
   const b=bind();let consumed=0;await assert.rejects(b.repository.withCurrentIdentity(input,()=>consumed++));assert.equal(consumed,0);assert.deepEqual(b.releases,[true]);assert.equal(b.calls.at(-1).sql,'rollback');
   assert.equal(b.calls.some(c=>c.sql===canonicalSQL),false,'metadata scope mismatch precedes canonical identity projection');
  });
  await t.test('deletion and new throwing accessors after identity configuration cannot alter captured SQL',async()=>{
   const input=exact();let getters=0,mutated=false;
   const b=bind(sql=>{if(!mutated&&sql.includes("set_config('request.jwt.claim.sub'")){mutated=true;for(const key of Object.keys(input)){delete input[key];Object.defineProperty(input,key,{get(){getters++;throw Error('retained request must not be reread')}})}}});
   await positive(b,input);assert.equal(mutated,true);assert.equal(getters,0);assert.deepEqual(b.calls,baseline.calls);
  });
  await t.test('descriptor exceptions reject before acquiring a lease',async()=>{
   const b=bind(),input=new Proxy(exact(),{getOwnPropertyDescriptor(){throw Error('descriptor trap')}});
   await assert.rejects(b.repository.withCurrentIdentity(input,()=>{}),/descriptor trap/);assert.equal(b.acquired,0);assert.deepEqual(b.releases,[]);
  });
  await t.test('symbol and accessor substitution reject without invoking their getters',async()=>{
   let getters=0;const input=exact();delete input.assignmentId;Object.defineProperty(input,'assignmentId',{get(){getters++;return f.assignment}});input[Symbol('authority')]=f.assignment;
   const b=bind();await assert.rejects(b.repository.withCurrentIdentity(input,()=>{}));assert.equal(getters,0);assert.equal(b.acquired,0);
  });
  await t.test('canonical query rejection never publishes and discards exactly once',async()=>{
   const b=bind(sql=>{if(sql===canonicalSQL)throw Error('controlled canonical query failure')});let calls=0;
   await assert.rejects(b.repository.withCurrentIdentity(exact(),()=>calls++),/controlled canonical query failure/);assert.equal(calls,0);assert.equal(b.calls.at(-1).sql,'rollback');assert.deepEqual(b.releases,[true]);
  });
  await t.test('consumer exception rolls back after exact snapshot and discards once',async()=>{
   const b=bind();let calls=0;await assert.rejects(b.repository.withCurrentIdentity(exact(),s=>{calls++;assert.equal(s.person.id,f.person);throw Error('controlled consumer failure')}),/controlled consumer failure/);
   assert.equal(calls,1);assert.equal(b.calls.at(-1).sql,'rollback');assert.equal(b.calls.some(c=>c.sql==='commit'),false);assert.deepEqual(b.releases,[true]);
  });
  await t.test('rollback failure still discards lease exactly once',async()=>{
   const b=bind(sql=>{if(sql==='rollback')throw Error('controlled rollback failure')});
   try{await assert.rejects(b.repository.withCurrentIdentity(exact(),()=>{throw Error('original consumer failure')}),/original consumer failure/);assert.deepEqual(b.releases,[true]);assert.equal(b.calls.filter(c=>c.sql==='rollback').length,1)}finally{await db.query('rollback')}
  });
  await t.test('begin failure discards acquired lease without publishing or false rollback',async()=>{
   const b=bind(sql=>{if(sql==='begin isolation level read committed')throw Error('controlled begin failure')});let calls=0;
   await assert.rejects(b.repository.withCurrentIdentity(exact(),()=>calls++),/controlled begin failure/);assert.equal(calls,0);assert.deepEqual(b.releases,[true]);assert.equal(b.calls.length,1);
  });
  await t.test('successful read remains available after independent disposal negatives',async()=>{const b=bind();await positive(b,exact());assert.deepEqual(b.calls,baseline.calls)});
 }finally{await db.close()}
});
