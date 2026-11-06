// Actual accepted canonical SQL; no hosted connection, grant, or provider authority.
// TEST_NATIVE_PG=1 uses the existing disposable harness and unchanged PG18 pins.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {canonicalSourceFixture} from './canonical-source-fixture.mjs';
import {createCanonicalPartnerRepository,createCanonicalPartnerRoutineRepository,createRestrictedCanonicalPartnerRoutineRepository,createExecutionCanonicalPartnerRoutineRepository} from './canonical-repository.mjs';
import {createCanonicalPartnerIdentityBoundary} from './canonical-identity-boundary.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const fields=['organizationId','campaignId','assignmentId','userId','sessionId'];
const unknown={identityStatus:'unverified',personId:null};

test('canonical request binding with actual accepted writer and SQL',async t=>{
 const native=process.env.TEST_NATIVE_PG==='1';
 const db=native?await (await import('../backend-tests/local-postgres.mjs')).localPostgres():new (require('@electric-sql/pglite').PGlite)();
 try{
  console.log('ENGINE '+(native?'native disposable PostgreSQL':'PGlite')+' '+(await db.query('show server_version')).rows[0].server_version);
  const f=await canonicalSourceFixture(db);
  const exact=()=>({organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment,userId:f.actor,sessionId:f.session});
  const foreign=()=>({...exact(),organizationId:f.foreign,campaignId:f.foreignCampaign});
  function bind({acquire=()=>{},query=()=>{}}={}){
   const statements=[],releases=[];
   const repository=createCanonicalPartnerRepository({acquire:async()=>{
    await acquire();
    return {async query(sql,args){statements.push([sql,args]);await query(sql,args);return db.query(sql,args)},async release(discard){releases.push(discard)}};
   }});
   return {repository,statements,releases};
  }
  async function read(b,input){let calls=0,snapshot;await b.repository.withCurrentIdentity(input,value=>{calls++;snapshot=value});assert.equal(calls,1);assert.equal(snapshot.campaign.id,f.campaign);assert.equal(snapshot.campaign.organization_id,f.org);assert.equal(snapshot.actor.id,f.actor);assert.equal(snapshot.session.id,f.session);assert.equal(snapshot.person.id,f.person);assert.deepEqual(b.releases,[false]);return snapshot}
  const baseline=bind();await read(baseline,exact());
  await t.test('original foreign scope cannot be changed into assigned scope during acquire',async()=>{
   const input=foreign(),b=bind({acquire:()=>Object.assign(input,exact())});let calls=0;
   await assert.rejects(()=>b.repository.withCurrentIdentity(input,()=>{calls++}));assert.equal(calls,0);assert.deepEqual(b.releases,[true]);assert.equal(b.statements.at(-1)[0],'rollback');
  });
  for(const phase of ['acquire','catalog'])for(const field of fields)await t.test(phase+' mutation of '+field+' preserves captured exact request',async()=>{
   const input=exact(),replacement={...foreign(),assignmentId:f.registrant,userId:f.other,sessionId:f.otherSession};let changed=false;
   const mutate=()=>{if(!changed){changed=true;input[field]=replacement[field]}};
   const b=bind(phase==='acquire'?{acquire:mutate}:{query:sql=>{if(sql.includes('from pg_proc'))mutate()}});
   await read(b,input);assert.equal(changed,true);
   assert.deepEqual(b.statements,baseline.statements,'all SQL and bound parameters exactly match original read');
  });
  await t.test('mutation after metadata read does not redirect snapshot',async()=>{
   const input=exact(),b=bind({query:sql=>{if(sql.startsWith('select private.partner_assigned_metadata'))Object.assign(input,foreign())}});
   await read(b,input);assert.deepEqual(b.statements,baseline.statements);
  });
  await t.test('proxy property reads cannot substitute identity or scope',async()=>{
   let gets=0;const input=new Proxy(exact(),{get(){gets++;throw Error('dynamic value must not be read')}}),b=bind();
   await read(b,input);assert.equal(gets,0);assert.deepEqual(b.statements,baseline.statements);
  });
  await t.test('proxy descriptor reentrancy still uses only captured values',async()=>{
   const target=exact();let gets=0;
   const input=new Proxy(target,{get(){gets++;throw Error('unexpected get')},getOwnPropertyDescriptor(o,k){const d=Reflect.getOwnPropertyDescriptor(o,k);if(k==='sessionId')Object.assign(o,foreign());return d}}),b=bind();
   await read(b,input);assert.equal(gets,0);assert.deepEqual(b.statements,baseline.statements);
  });
  const constructors=[createCanonicalPartnerRepository,createCanonicalPartnerRoutineRepository,createRestrictedCanonicalPartnerRoutineRepository,createExecutionCanonicalPartnerRoutineRepository];
  for(const create of constructors)await t.test(create.name+' rejects accessors and invalid shapes before any acquisition',async()=>{
   let acquisitions=0,getters=0;const repository=create({acquire:()=>{acquisitions++;throw Error('must not acquire')}});
   const getter=exact();Object.defineProperty(getter,'userId',{get(){getters++;return f.actor},enumerable:true});
   const revoked=Proxy.revocable(exact(),{});revoked.revoke();
   const cases=[getter,{...exact(),proof:true},{...exact(),[Symbol('claim')]:true},{...exact(),sessionId:f.session+'\n'},Object.create(exact()),{...exact(),assignmentId:42},revoked.proxy];
   const missing=exact();delete missing.sessionId;cases.push(missing);
   for(const input of cases)await assert.rejects(()=>repository.withCurrentIdentity(input,()=>{}));
   assert.equal(getters,0);assert.equal(acquisitions,0);
  });
  const principal={userId:f.actor,sessionId:f.session,verified:true,expiresAt:new Date(Date.now()+3600000).toISOString()};
  const scope={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment};
  const verified={identityStatus:'verified',personId:f.person};
  const boundary=b=>createCanonicalPartnerIdentityBoundary({getPrincipal:()=>principal,repository:b.repository});
  await t.test('exact canonical result remains minimized by existing boundary',async()=>{assert.deepEqual(await boundary(bind()).read(scope),verified)});
  for(const [name,sql,args,undo]of[
   ['session deadline',"update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",[f.session],"update auth.sessions set not_after=clock_timestamp()+interval '1 hour' where id=$1"],
   ['campaign deadline',"update outreach_campaign_assignments set expires_at=clock_timestamp()-interval '1 second' where campaign_id=$1 and user_id=$2",[f.campaign,f.actor],'update outreach_campaign_assignments set expires_at=null where campaign_id=$1 and user_id=$2'],
   ['Partner revocation','update outreach_partner_users set active=false where partner_church_id=$1 and user_id=$2',[f.partner,f.actor],'update outreach_partner_users set active=true where partner_church_id=$1 and user_id=$2'],
   ['account revocation','update portal_account_links set active=false where person_id=$1',[f.person],'update portal_account_links set active=true where person_id=$1']
  ])await t.test(name+' still denies after request capture',async()=>{
   await db.query(sql,args);try{assert.deepEqual(await boundary(bind()).read(scope),unknown)}finally{await db.query(undo,args)}
   assert.deepEqual(await boundary(bind()).read(scope),verified);
  });
  for(const retire of ['invalidate','principal deadline'])await t.test(retire+' during acquire discards result and rolls back',async()=>{
   let reached,resume;const ready=new Promise(r=>reached=r),hold=new Promise(r=>resume=r);
   const b=bind({acquire:async()=>{reached();await hold}}),adapter=boundary(b),pending=adapter.read(scope);
   await ready;if(retire==='invalidate')adapter.invalidate();else principal.expiresAt=new Date(Date.now()-1000).toISOString();
   resume();assert.deepEqual(await pending,unknown);assert.deepEqual(b.releases,[true]);assert.equal(b.statements.at(-1)[0],'rollback');
   principal.expiresAt=new Date(Date.now()+3600000).toISOString();assert.deepEqual(await boundary(bind()).read(scope),verified);
  });
 }finally{await db.close()}
});
