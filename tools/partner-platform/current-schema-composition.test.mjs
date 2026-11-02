import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {canonicalSourceFixture} from './canonical-source-fixture.mjs';
import {installCurrentReaderPrerequisite} from './current-schema-source-fixture.mjs';
import {partnerAuthorityFixture} from './authority-fixture.mjs';
import {captureCanonicalCatalog,compareCanonicalCatalog} from './canonical-catalog-diagnostics.mjs';
import {createCanonicalPartnerRoutineRepository} from './canonical-repository.mjs';
import {createCanonicalPartnerIdentityBoundary} from './canonical-identity-boundary.mjs';
import {captureCompositionCatalog,composeCurrentSchemaSql,installCurrentSchemaComposition,compositionRelations,compositionFunctions} from './current-schema-composition.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const envelope=readFileSync(new URL('./canonical-host-envelope.sql',import.meta.url),'utf8');

test('narrow composition contains no grant, public function, host or role installation',()=>{
 const sql=composeCurrentSchemaSql().replace(/--[^\n]*/g,'');
 assert.doesNotMatch(sql,/\bgrant\s|create\s+(?:or\s+replace\s+)?function\s+public\.|create\s+role|create\s+schema|\blogin\b/i);
 assert.equal((sql.match(/create table /g)||[]).length,6);
 assert.equal((sql.match(/create (?:or replace )?function /g)||[]).length,10); // original reconcile is renamed, then replaced
});

test('current-base composition installs dependencies and accepted writer without application grants',async t=>{
 const db=new PGlite(),legacy=new PGlite();
 try{
  let before;
  const f=await canonicalSourceFixture(db,{installIssue50:async c=>{await installCurrentReaderPrerequisite(c);before=await captureCompositionCatalog(c);await installCurrentSchemaComposition(c)}});
  await t.test('accepted writer creates canonical review, receipt and audit against existing People',async()=>{
   assert.equal((await db.query('select person_id from outreach_campaign_registrants where id=$1',[f.registrant])).rows[0].person_id,f.person);
   for(const relation of ['private.city_identity_requests','private.city_care_requests','private.city_identity_reviews'])assert.equal(Number((await db.query('select count(*) n from '+relation)).rows[0].n),1);
  });
  await t.test('existing public RPC and all existing function definitions and ACLs unchanged',async()=>{
   const after=await captureCompositionCatalog(db);
   for(const fn of before.functions)assert.deepEqual(after.functions.find(x=>x.name===fn.name),fn);
   assert.deepEqual(after.functions.filter(x=>x.name.startsWith('public.')),before.functions.filter(x=>x.name.startsWith('public.')));
   assert.deepEqual(after.defaults,before.defaults);
  });
  await t.test('six relations retain RLS; no PUBLIC, anon, authenticated or service-role access',async()=>{
   for(const relation of compositionRelations){
    const {rows}=await db.query('select relrowsecurity rls from pg_class where oid=to_regclass($1)',[relation]);assert.equal(rows[0].rls,true);
    assert.equal(Number((await db.query(`select count(*) n from pg_class c,lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid=to_regclass($1) and a.grantee=0`,[relation])).rows[0].n),0);
    for(const role of ['anon','authenticated','service_role'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal((await db.query('select has_table_privilege($1,$2,$3) yes',[role,relation,privilege])).rows[0].yes,false);
   }
  });
  await t.test('every private writer and helper denies all application callers including PUBLIC',async()=>{
   for(const signature of compositionFunctions){
    assert.equal(Number((await db.query(`select count(*) n from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=to_regprocedure($1) and a.grantee=0`,[signature])).rows[0].n),0);
    for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') yes',[role,signature])).rows[0].yes,false);
   }
   for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_sequence_privilege($1,'private.city_followup_events_id_seq','USAGE') yes",[role])).rows[0].yes,false);
   for(const role of ['anon','authenticated','service_role']){
    await db.exec('set role '+role);
    await assert.rejects(()=>db.query("select private.city_care_workspace($1,'context','{}')",[f.campaign]),e=>e.code==='42501');
    await assert.rejects(()=>db.query('select * from public.outreach_campaign_sources'),e=>e.code==='42501');
    await db.exec('reset role');
   }
  });
  await t.test('sealed provenance differs ONLY at the two deliberately withheld caller grants',async()=>{
   await canonicalSourceFixture(legacy);
   const baseline=await captureCanonicalCatalog(legacy),actual=await captureCanonicalCatalog(db);
   const report=compareCanonicalCatalog(actual,baseline);
   assert.deepEqual(report.mismatches.map(x=>[x.kind,x.name,x.fields.map(f=>f.field)]),[
    ['functions','private.city_decision_reconcile(uuid,jsonb)',['privileges']],
    ['functions','private.city_care_workspace(uuid,text,jsonb)',['privileges']]
   ]);
   for(const mismatch of report.mismatches){assert.deepEqual(mismatch.fields[0].expected,[false,true,false]);assert.deepEqual(mismatch.fields[0].actual,[false,false,false])}
  });
  await t.test('registration administrator cannot issue expanded capabilities or change care scope',async()=>{
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[f.other]);
   await db.exec('set role authenticated');
   for(const capability of ['decisions.read','followup.manage','contacts.export','communications.send','staff.manage','discipleship.summary.read','decision.view','team.manage','travel.manage']){
    await assert.rejects(()=>db.query("select public.outreach_registration_workspace('access',$1,$2)",[f.campaign,{user_id:f.actor,revision:1,capabilities:[capability],reason:'Synthetic no expanded authority'}]),/Only registration capabilities permitted/);
   }
   await assert.rejects(()=>db.query("update outreach_campaign_assignments set care_scope='campaign' where campaign_id=$1",[f.campaign]),e=>e.code==='42501');
   await db.exec('reset role');
   await db.query("update outreach_campaign_assignments set care_scope='assigned' where campaign_id=$1 and user_id=$2",[f.campaign,f.actor]);
   await db.exec('set role authenticated');
   const result=await db.query("select public.outreach_registration_workspace('access',$1,$2) value",[f.campaign,{user_id:f.actor,revision:1,capabilities:['registration.view'],care_scope:'campaign',reason:'Synthetic permitted registration edit'}]);
   assert.deepEqual(result.rows[0].value,{saved:true});
   await db.exec('reset role');
   assert.equal((await db.query('select care_scope from outreach_campaign_assignments where campaign_id=$1 and user_id=$2',[f.campaign,f.actor])).rows[0].care_scope,'assigned');
   // Existing trusted service role still has assignment DML; this candidate is
   // explicitly not permission to install the expanded vocabulary in a host.
   assert.equal((await db.query("select has_table_privilege('service_role','outreach_campaign_assignments','UPDATE') yes")).rows[0].yes,true);
   await db.query("update outreach_campaign_assignments set care_scope='campaign',capabilities=array['view'],revision=1 where campaign_id=$1 and user_id=$2",[f.campaign,f.actor]);
   await db.query("select set_config('request.jwt.claim.sub','',false)");
  });
  await t.test('unchanged production candidate verifier remains unverified; no relaxed profile',async()=>{
   await db.exec(envelope);
   const repository=createCanonicalPartnerRoutineRepository({acquire:async()=>{await db.exec('set role partner_canonical_reader');return {query:db.query.bind(db),release:async()=>db.exec('reset role')}}});
   const boundary=createCanonicalPartnerIdentityBoundary({repository,getPrincipal:()=>({userId:f.actor,sessionId:f.session,verified:true,expiresAt:new Date(Date.now()+3600000).toISOString()})});
   assert.deepEqual(await boundary.read({organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment}),{identityStatus:'unverified',personId:null});
  });
 }finally{await db.close();await legacy.close()}
});

test('current baseline preflight rejects drift and partial/repeated installation atomically',async t=>{
 const db=new PGlite();
 try{
  await partnerAuthorityFixture(db);
  await assert.rejects(()=>installCurrentSchemaComposition(db),/Unreviewed current Partner schema baseline/);
  await installCurrentReaderPrerequisite(db);
  const capability=(await db.query("select pg_get_constraintdef(oid) value from pg_constraint where conname='outreach_campaign_assignments_capabilities_check'")).rows[0].value;
  for(const [name,sql] of [
   ['operations security function',"alter function private.operational_relationship_visible(uuid,uuid,text) volatile"],
   ['function privilege','grant execute on function private.operational_relationship_visible(uuid,uuid,text) to anon'],
   ['People privilege','grant select on private.people to authenticated'],
   ['existing RLS','alter table public.outreach_registrations disable row level security'],
   ['capability constraint','alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check'],
   ['partial installation','create table public.outreach_campaign_sources(source text)'],
   ['hostile defaults','alter default privileges grant execute on functions to service_role']
   ,['schema privilege','grant create on schema private to authenticated']
   ,['role login','alter role authenticated login']
   ,['role membership','grant service_role to authenticated']
  ])await t.test(name,async()=>{
   // Drift lives outside the install transaction, and must not be silently fixed.
   await db.query('begin');
   try{await db.exec(sql)}catch(error){await db.query('rollback');throw error}
   const drift=await captureCompositionCatalog(db);await db.query('commit');
   await assert.rejects(()=>installCurrentSchemaComposition(db),/Unreviewed current Partner schema baseline/);
   assert.deepEqual(await captureCompositionCatalog(db),drift);
   // Restore exact baseline via the captured original DDL or explicit inverse.
   if(name==='operations security function')await db.exec('alter function private.operational_relationship_visible(uuid,uuid,text) stable');
   if(name==='function privilege')await db.exec('revoke execute on function private.operational_relationship_visible(uuid,uuid,text) from anon');
   if(name==='People privilege')await db.exec('revoke select on private.people from authenticated');
   if(name==='existing RLS')await db.exec('alter table public.outreach_registrations enable row level security');
   if(name==='capability constraint'){
    await db.exec('alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check '+capability);
   }
   if(name==='partial installation')await db.exec('drop table public.outreach_campaign_sources');
   if(name==='hostile defaults')await db.exec('alter default privileges revoke execute on functions from service_role');
   if(name==='schema privilege')await db.exec('revoke create on schema private from authenticated');
   if(name==='role login')await db.exec('alter role authenticated nologin');
   if(name==='role membership')await db.exec('revoke service_role from authenticated');
  });
  for(const [name,change]of[
   ['mid-install failure',null],
   ['unexpected assignment column','alter table outreach_campaign_assignments add column unreviewed boolean'],
   ['unexpected old-function change','alter function private.operational_relationship_visible(uuid,uuid,text) volatile']
  ])await t.test(name+' rolls back all six relations and capability changes',async()=>{
   const before=await captureCompositionCatalog(db);
   const interrupted={query:db.query.bind(db),exec:async sql=>{await db.exec(sql);if(change)await db.exec(change);else throw Error('Synthetic interruption')}};
   await assert.rejects(()=>installCurrentSchemaComposition(interrupted),/Synthetic interruption|Unexpected assignment shape|Existing function changed/);
   assert.deepEqual(await captureCompositionCatalog(db),before);
  });
  await installCurrentSchemaComposition(db);
  const installed=await captureCompositionCatalog(db);
  await assert.rejects(()=>installCurrentSchemaComposition(db),/Unreviewed current Partner schema baseline/);
  assert.deepEqual(await captureCompositionCatalog(db),installed);
 }finally{await db.close()}
});
