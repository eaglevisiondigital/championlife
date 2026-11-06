import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {canonicalSourceFixture} from './canonical-source-fixture.mjs';
import {partnerAuthorityFixture} from './authority-fixture.mjs';
import {createCanonicalPartnerIdentityBoundary} from './canonical-identity-boundary.mjs';
import {createCanonicalPartnerRepository} from './canonical-repository.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const expected=JSON.parse(readFileSync(new URL('./fixtures/issue50-installed-provenance.json',import.meta.url),'utf8'));
const unknown={identityStatus:'unverified',personId:null};
function bind(db,f){
 const releases=[];
 const repository=createCanonicalPartnerRepository({acquire:async()=>({query:db.query.bind(db),release:async discard=>releases.push(discard)})});
 const principal={userId:f.actor,sessionId:f.session,verified:true,expiresAt:new Date(Date.now()+3600000).toISOString()};
 const boundary=createCanonicalPartnerIdentityBoundary({getPrincipal:()=>principal,repository});
 return {releases,repository,read:()=>boundary.read({organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment})};
}
test('current Partner baseline stays unverified without installing historical identity schema',async()=>{
 const db=new PGlite();try{const f=await partnerAuthorityFixture(db),b=bind(db,f);assert.deepEqual(await b.read(),unknown);assert.deepEqual(b.releases,[true]);}finally{await db.close()}
});
test('accepted Issue50 writer produces canonical provenance for the scoped repository',async t=>{
 const db=new PGlite();try{
  const f=await canonicalSourceFixture(db),b=bind(db,f),verified={identityStatus:'verified',personId:f.person};
  await t.test('exact accepted writer result integrates with existing adapter',async()=>{assert.deepEqual(await b.read(),verified);assert.equal(b.releases.at(-1),false)});
  const mutations=[
   ['source mapping','update outreach_campaign_sources set campaign_id=$1 where source=$2',[f.foreignCampaign,'fictional_source'],'update outreach_campaign_sources set campaign_id=$1 where source=$2',[f.campaign,'fictional_source']],
   ['source account','update outreach_registrations set user_id=$1 where id=$2',[f.other,f.decision],'update outreach_registrations set user_id=$1 where id=$2',[f.subject,f.decision]],
   ['source consent','update outreach_registrations set consent=false where id=$1',[f.decision],'update outreach_registrations set consent=true where id=$1',[f.decision]],
   ['source content revision',"update outreach_registrations set first_name='Changed' where id=$1",[f.decision],"update outreach_registrations set first_name='CHILD SECRET' where id=$1",[f.decision]],
   ['review revision','update private.city_identity_reviews set revision=2 where source_id=$1',[f.decision],'update private.city_identity_reviews set revision=1 where source_id=$1',[f.decision]],
   ['review outcome',"update private.city_identity_reviews set outcome='unlinked' where source_id=$1",[f.decision],"update private.city_identity_reviews set outcome='linked' where source_id=$1",[f.decision]],
   ['registrant revision','update outreach_campaign_registrants set revision=3 where id=$1',[f.registrant],'update outreach_campaign_registrants set revision=2 where id=$1',[f.registrant]],
   ['account revoked','update portal_account_links set active=false where person_id=$1',[f.person],'update portal_account_links set active=true where person_id=$1',[f.person]],
   ['account replacement','update portal_account_links set user_id=$1 where person_id=$2',[f.other,f.person],'update portal_account_links set user_id=$1 where person_id=$2',[f.subject,f.person]],
   ['subject ban',"update auth.users set banned_until=now()+interval '1 hour' where id=$1",[f.subject],'update auth.users set banned_until=null where id=$1',[f.subject]],
   ['actor ban',"update auth.users set banned_until=now()+interval '1 hour' where id=$1",[f.actor],'update auth.users set banned_until=null where id=$1',[f.actor]],
   ['Partner grant','update outreach_partner_users set active=false where user_id=$1',[f.actor],'update outreach_partner_users set active=true where user_id=$1',[f.actor]],
   ['assigned worker','update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.other,f.assignment],'update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.actor,f.assignment]]
  ];
  for(const [name,sql,args,undo,undoArgs]of mutations)await t.test(name+' denies without exposing Person',async()=>{await db.query(sql,args);assert.deepEqual(await b.read(),unknown);await db.query(undo,undoArgs);assert.deepEqual(await b.read(),verified)});
  for(const signature of Object.keys(expected.functions))await t.test('changed installed function '+signature+' denies',async()=>{
   const definition=(await db.query('select pg_get_functiondef(to_regprocedure($1)) definition',[signature])).rows[0].definition;
   // A volatility change preserves function body but invalidates its contract.
   await db.query('alter function '+signature+' '+(expected.functions[signature].volatility==='v'?'stable':'volatile'));
   assert.deepEqual(await b.read(),unknown);await db.exec(definition);assert.deepEqual(await b.read(),verified);
  });
  for(const relation of Object.keys(expected.relations))await t.test('changed table privilege '+relation+' denies',async()=>{
   await db.exec('grant truncate on '+relation+' to authenticated');assert.deepEqual(await b.read(),unknown);
   await db.exec('revoke truncate on '+relation+' from authenticated');assert.deepEqual(await b.read(),verified);
  });
  await t.test('column-level account grant denies',async()=>{await db.exec('grant select(user_id) on portal_account_links to authenticated');assert.deepEqual(await b.read(),unknown);await db.exec('revoke select(user_id) on portal_account_links from authenticated');assert.deepEqual(await b.read(),verified)});
  await t.test('broadened audit function execute denies',async()=>{await db.exec('grant execute on function private.outreach_audit(uuid,uuid,text,uuid,jsonb) to anon');assert.deepEqual(await b.read(),unknown);await db.exec('revoke execute on function private.outreach_audit(uuid,uuid,text,uuid,jsonb) from anon');assert.deepEqual(await b.read(),verified)});
  await t.test('removed account uniqueness denies even with otherwise valid evidence',async()=>{
   const name=(await db.query("select conname from pg_constraint where conrelid='portal_account_links'::regclass and pg_get_constraintdef(oid)='UNIQUE (organization_id, user_id)' ")).rows[0].conname;
   await db.exec('alter table portal_account_links drop constraint '+name);assert.deepEqual(await b.read(),unknown);
   await db.exec('alter table portal_account_links add constraint '+name+' unique(organization_id,user_id)');assert.deepEqual(await b.read(),verified);
  });
  await t.test('disabled immutable audit trigger denies',async()=>{await db.exec('alter table outreach_campaign_audit disable trigger user');assert.deepEqual(await b.read(),unknown);await db.exec('alter table outreach_campaign_audit enable trigger user');assert.deepEqual(await b.read(),verified)});
  await t.test('server snapshot excludes source contact and pastoral content',async()=>{
   let snapshot;await b.repository.withCurrentIdentity({organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment,userId:f.actor,sessionId:f.session},value=>{snapshot=value});
   const json=JSON.stringify(snapshot);for(const forbidden of ['CHILD SECRET','private@example.invalid','5550100','verification_note','prayer_request','reason','encrypted_password'])assert.equal(json.includes(forbidden),false);
  });
  await t.test('untrusted additional input rejected before acquisition',async()=>{let connected=false;const r=createCanonicalPartnerRepository({acquire:()=>{connected=true}});await assert.rejects(()=>r.withCurrentIdentity({organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment,userId:f.actor,sessionId:f.session,proof:true},()=>{}));assert.equal(connected,false)});
  await t.test('callback failure rolls back and discards connection',async()=>{await assert.rejects(()=>b.repository.withCurrentIdentity({organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment,userId:f.actor,sessionId:f.session},()=>{throw Error('stop')}));assert.equal(b.releases.at(-1),true);assert.deepEqual(await b.read(),verified)});
  await t.test('immutable accepted identity/care receipt and audit rows remain protected',async()=>{for(const relation of ['private.city_identity_requests','private.city_care_requests','public.outreach_campaign_audit'])await assert.rejects(()=>db.query('delete from '+relation),e=>e.code==='42501')});
 }finally{await db.close()}
});
