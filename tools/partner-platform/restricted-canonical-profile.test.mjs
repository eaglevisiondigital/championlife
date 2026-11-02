import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {currentSchemaSourceFixture} from './current-schema-source-fixture.mjs';
import {canonicalSourceFixture} from './canonical-source-fixture.mjs';
import {createRestrictedCanonicalPartnerRoutineRepository,createCanonicalPartnerRoutineRepository,verifyCanonicalRepositoryProvenance,verifyRestrictedCanonicalRepositoryProvenance} from './canonical-repository.mjs';
import {createCanonicalPartnerIdentityBoundary} from './canonical-identity-boundary.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const envelope=readFileSync(new URL('./canonical-host-envelope.sql',import.meta.url),'utf8');
const profile=JSON.parse(readFileSync(new URL('./fixtures/restricted-canonical-profile.json',import.meta.url),'utf8'));
const original=readFileSync(new URL('./fixtures/issue50-installed-provenance.json',import.meta.url));
const pins=JSON.parse(original),unknown={identityStatus:'unverified',personId:null};
function bind(db,f,factory=createRestrictedCanonicalPartnerRoutineRepository,intercept=async()=>{}){
 const releases=[];
 const repository=factory({acquire:async()=>{
  await db.exec('set role partner_canonical_reader');
  return {query:async(...args)=>{const result=await db.query(...args);await intercept(...args);return result},release:async discard=>{releases.push(discard);await db.exec('reset role')}};
 }});
 const request={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment};
 const principal={userId:f.actor,sessionId:f.session,verified:true,expiresAt:new Date(Date.now()+3600000).toISOString()};
 const boundary=createCanonicalPartnerIdentityBoundary({repository,getPrincipal:()=>principal});
 return {read:()=>boundary.read(request),releases,repository,fullRequest:{...request,userId:f.actor,sessionId:f.session}};
}

test('restricted source profile changes exactly two privileges and retains literal catalog checks',()=>{
 assert.equal(createHash('sha256').update(original).digest('hex'),profile.historicalManifestSha256);
 assert.deepEqual(profile.withheldAuthenticatedExecution,['private.city_decision_reconcile(uuid,jsonb)','private.city_care_workspace(uuid,text,jsonb)']);
 assert.equal(verifyRestrictedCanonicalRepositoryProvenance.toString(),verifyCanonicalRepositoryProvenance.toString());
 assert.equal([...verifyCanonicalRepositoryProvenance.toString().matchAll(/connection\.query\(`/g)].length,2);
});

test('current-schema restricted profile uses exact accepted writer and mandatory host envelope',async t=>{
 const db=new PGlite();try{
  const f=await currentSchemaSourceFixture(db),b=bind(db,f),verified={identityStatus:'verified',personId:f.person};
  await t.test('no envelope means no identity',async()=>assert.deepEqual(await b.read(),unknown));
  await db.exec(envelope);
  await t.test('restricted caller verifies accepted canonical writer with both application writer grants absent',async()=>{
   assert.deepEqual(await b.read(),verified);assert.equal(b.releases.at(-1),false);
   for(const signature of profile.withheldAuthenticatedExecution)for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,$2,'execute') yes",[role,signature])).rows[0].yes,false);
  });
  await t.test('historical factory still denies restricted profile',async()=>assert.deepEqual(await bind(db,f,createCanonicalPartnerRoutineRepository).read(),unknown));
  for(const signature of profile.withheldAuthenticatedExecution)for(const role of ['public','anon','authenticated','service_role'])await t.test('new writer grant denies '+role+' '+signature,async()=>{
   await db.exec('grant execute on function '+signature+' to '+role);assert.deepEqual(await b.read(),unknown);assert.equal(b.releases.at(-1),true);
   await db.exec('revoke execute on function '+signature+' from '+role);assert.deepEqual(await b.read(),verified);
  });
  for(const signature of Object.keys(pins.functions))await t.test('all historical function pins retained: '+signature,async()=>{
   const original=(await db.query('select pg_get_functiondef(to_regprocedure($1)) definition',[signature])).rows[0].definition;
   await db.exec('alter function '+signature+' '+(pins.functions[signature].volatility==='v'?'stable':'volatile'));
   assert.deepEqual(await b.read(),unknown);await db.exec(original);assert.deepEqual(await b.read(),verified);
  });
  for(const relation of Object.keys(pins.relations))await t.test('all historical relation pins retained: '+relation,async()=>{
   await db.exec('grant truncate on '+relation+' to authenticated');assert.deepEqual(await b.read(),unknown);
   await db.exec('revoke truncate on '+relation+' from authenticated');assert.deepEqual(await b.read(),verified);
  });
  for(const [name,sql,undo]of[
   ['direct caller data','grant select on portal_account_links to partner_canonical_reader','revoke select on portal_account_links from partner_canonical_reader'],
   ['caller login','alter role partner_canonical_reader login','alter role partner_canonical_reader nologin'],
   ['caller membership','grant authenticated to partner_canonical_reader','revoke authenticated from partner_canonical_reader'],
   ['extra definer','grant execute on function private.partner_assigned_metadata(uuid,uuid) to partner_canonical_reader','revoke execute on function private.partner_assigned_metadata(uuid,uuid) from partner_canonical_reader']
  ])await t.test('mandatory envelope rejects '+name,async()=>{await db.exec(sql);assert.deepEqual(await b.read(),unknown);await db.exec(undo);assert.deepEqual(await b.read(),verified)});
  for(const [name,sql,args,undo,undoArgs]of[
   ['account revocation','update portal_account_links set active=false where person_id=$1',[f.person],'update portal_account_links set active=true where person_id=$1',[f.person]],
   ['current Partner revocation','update outreach_partner_users set active=false where user_id=$1',[f.actor],'update outreach_partner_users set active=true where user_id=$1',[f.actor]],
   ['current assignment','update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.other,f.assignment],'update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.actor,f.assignment]],
   ['review revision','update private.city_identity_reviews set revision=2 where source_id=$1',[f.decision],'update private.city_identity_reviews set revision=1 where source_id=$1',[f.decision]],
   ['source consent','update outreach_registrations set consent=false where id=$1',[f.decision],'update outreach_registrations set consent=true where id=$1',[f.decision]]
  ])await t.test('current authority/provenance rejects '+name,async()=>{await db.query(sql,args);assert.deepEqual(await b.read(),unknown);await db.query(undo,undoArgs);assert.deepEqual(await b.read(),verified)});
  await t.test('no source contact, pastoral notes or credentials in snapshot',async()=>{
   let snapshot;await b.repository.withCurrentIdentity(b.fullRequest,value=>{snapshot=value});
   for(const secret of ['CHILD SECRET','private@example.invalid','5550100','verification_note','prayer_request','encrypted_password'])assert.equal(JSON.stringify(snapshot).includes(secret),false);
  });
  await t.test('callback rejection rolls back and discards connection',async()=>{
   await assert.rejects(()=>b.repository.withCurrentIdentity(b.fullRequest,()=>{throw Error('Fixture callback rejection')}));
   assert.equal(b.releases.at(-1),true);assert.deepEqual(await b.read(),verified);
  });
  await t.test('post-read catalog drift denies before consumer',async()=>{
   let called=false,changed=false;
   const race=bind(db,f,createRestrictedCanonicalPartnerRoutineRepository,async sql=>{
    if(!changed&&sql.startsWith('select snapshot from')){changed=true;await db.exec('reset role; grant execute on function private.city_decision_reconcile(uuid,jsonb) to authenticated; set role partner_canonical_reader')}
   });
   await assert.rejects(()=>race.repository.withCurrentIdentity(race.fullRequest,()=>{called=true}));
   assert.equal(called,false);assert.equal(race.releases.at(-1),true);assert.deepEqual(await b.read(),verified);
  });
 }finally{await db.close()}
});

test('legacy broad profile never silently falls back into restricted repository',async()=>{
 const db=new PGlite();try{
  const f=await canonicalSourceFixture(db);await db.exec(envelope);
  assert.deepEqual(await bind(db,f).read(),unknown);
  assert.deepEqual(await bind(db,f,createCanonicalPartnerRoutineRepository).read(),{identityStatus:'verified',personId:f.person});
 }finally{await db.close()}
});
