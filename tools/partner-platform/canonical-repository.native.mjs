// Linux CI only while the Mac's native PostgreSQL IPC allocation is unavailable.
// Genuine independent sessions; no hosted URL, port or credential is accepted.
import assert from 'node:assert/strict';
import {diagnoseCanonicalFixtureCatalog} from './canonical-catalog-diagnostics.mjs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {canonicalSourceFixture} from './canonical-source-fixture.mjs';
import {createCanonicalPartnerRepository} from './canonical-repository.mjs';
import {createCanonicalPartnerIdentityBoundary} from './canonical-identity-boundary.mjs';
const db=await localPostgres();let n=0;
const check=(value,label)=>{assert.ok(value,label);n++;console.log('PASS '+label)};
try{
 const f=await canonicalSourceFixture(db),reader=await db.connect(),writer=await db.connect(),foreign=await db.connect();
 // Emit only disposable schema diagnostics before the public boundary conceals
 // the denial reason. A mismatch remains a failing assertion; no pin changes.
 const catalogReport=await diagnoseCanonicalFixtureCatalog(db);
 console.log('CANONICAL_CATALOG_DIAGNOSTICS '+JSON.stringify(catalogReport));
 assert.equal(catalogReport.mismatches.length,0,'native catalog must match reviewed provenance');
 await writer.query("set lock_timeout='150ms'");await foreign.query("set lock_timeout='150ms'");
 const principal={userId:f.actor,sessionId:f.session,verified:true,expiresAt:new Date(Date.now()+3600000).toISOString()};
 const request={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment};
 let reached,release,hold=false;
 const repository=createCanonicalPartnerRepository({acquire:async()=>({
  async query(sql,args){if(sql==='commit'&&hold){reached();await new Promise(r=>release=r)}return reader.query(sql,args)},
  async release(){}
 })});
 const boundary=createCanonicalPartnerIdentityBoundary({getPrincipal:()=>principal,repository});
 const read=()=>boundary.read(request),verified={identityStatus:'verified',personId:f.person},unknown={identityStatus:'unverified',personId:null};
 assert.deepEqual(await read(),verified);check(true,'native exact accepted writer provenance integrates');
 const mutations=[
  ['source mapping','update outreach_campaign_sources set campaign_id=$1 where source=$2',[f.foreignCampaign,'fictional_source'],'update outreach_campaign_sources set campaign_id=$1 where source=$2',[f.campaign,'fictional_source']],
  ['source revision',"update outreach_registrations set first_name='Changed' where id=$1",[f.decision],"update outreach_registrations set first_name='CHILD SECRET' where id=$1",[f.decision]],
  ['review revision','update private.city_identity_reviews set revision=2 where source_id=$1',[f.decision],'update private.city_identity_reviews set revision=1 where source_id=$1',[f.decision]],
  ['registrant revision','update outreach_campaign_registrants set revision=3 where id=$1',[f.registrant],'update outreach_campaign_registrants set revision=2 where id=$1',[f.registrant]],
  ['account revocation','update portal_account_links set active=false where person_id=$1',[f.person],'update portal_account_links set active=true where person_id=$1',[f.person]],
  ['account replacement','update portal_account_links set user_id=$1 where person_id=$2',[f.other,f.person],'update portal_account_links set user_id=$1 where person_id=$2',[f.subject,f.person]],
  ['subject Auth ban',"update auth.users set banned_until=now()+interval '1 hour' where id=$1",[f.subject],'update auth.users set banned_until=null where id=$1',[f.subject]],
  ['actor Auth ban',"update auth.users set banned_until=now()+interval '1 hour' where id=$1",[f.actor],'update auth.users set banned_until=null where id=$1',[f.actor]],
  ['assigned worker','update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.other,f.assignment],'update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.actor,f.assignment]],
  ['Partner grant','update outreach_partner_users set active=false where user_id=$1',[f.actor],'update outreach_partner_users set active=true where user_id=$1',[f.actor]],
  ['campaign grant','update outreach_campaign_assignments set active=false where user_id=$1 and campaign_id=$2',[f.actor,f.campaign],'update outreach_campaign_assignments set active=true where user_id=$1 and campaign_id=$2',[f.actor,f.campaign]]
 ];
 for(const [label,sql,args,undo,undoArgs]of mutations){
  hold=true;const ready=new Promise(r=>reached=r),pending=read();await Promise.race([ready,pending.then(()=>{throw Error('Read completed before lock checkpoint')})]);
  await assert.rejects(()=>writer.query(sql,args),e=>e.code==='55P03');check(true,label+' blocks behind exact positive read');
  // Unrelated actor and campaign remain writable while this identity is held.
  await foreign.query('update auth.users set banned_until=null where id=$1',[f.other]);
  await foreign.query('update outreach_campaigns set name=name where id=$1',[f.foreignCampaign]);
  check(true,label+' permits unrelated account/campaign write');
  hold=false;release();assert.deepEqual(await pending,verified);
  await writer.query(sql,args);assert.deepEqual(await read(),unknown);check(true,label+' committed change denies');await writer.query(undo,undoArgs);
  await writer.query('begin');await writer.query(sql,args);
  assert.deepEqual(await read(),unknown);check(true,label+' write-before-read lock timeout fails closed');
  await writer.query('commit');assert.deepEqual(await read(),unknown);await writer.query(undo,undoArgs);assert.deepEqual(await read(),verified);
 }
 hold=true;const ready=new Promise(r=>reached=r),pending=read();await Promise.race([ready,pending.then(()=>{throw Error('Read completed before lock checkpoint')})]);
 await writer.query('begin');await assert.rejects(()=>writer.query('delete from portal_account_links where person_id=$1',[f.person]),e=>e.code==='55P03');await writer.query('rollback');check(true,'delete-and-reinsert account replacement cannot pass locked existing unique row');
 await writer.query('begin');await assert.rejects(()=>writer.query('delete from outreach_campaign_sources where source=$1',['fictional_source']),e=>e.code==='55P03');await writer.query('rollback');check(true,'delete-and-reinsert source mapping cannot pass locked source primary key');
 for(const relation of ['private.city_identity_requests','private.city_care_requests','public.outreach_campaign_audit']){
  await writer.query('begin');await assert.rejects(()=>writer.query('select * from '+relation+' for update'),e=>e.code==='55P03');await writer.query('rollback');check(true,relation+' exact receipt/audit locked through completion');
 }
 hold=false;release();assert.deepEqual(await pending,verified);
 console.log(n+' native canonical repository checks PASS');
}finally{await db.close()}
