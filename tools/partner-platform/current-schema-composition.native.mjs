// Native local integration of the NEW grant-free composition, not provider
// acceptance. Direct routine calls below inspect locking mechanics only; they
// never replace the unchanged canonical repository's failing provenance gate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {currentSchemaSourceFixture} from './current-schema-source-fixture.mjs';
import {createCanonicalPartnerRoutineRepository} from './canonical-repository.mjs';
import {createCanonicalPartnerIdentityBoundary} from './canonical-identity-boundary.mjs';
const db=await localPostgres();let checks=0;
const pass=name=>{checks++;console.log('PASS current schema '+name)};
try{
 const f=await currentSchemaSourceFixture(db),reader=await db.connect(),writer=await db.connect(),observer=await db.connect();
 console.log('Native version '+(await db.query('show server_version')).rows[0].server_version);
 pass('27-source fictional schema plus accepted writer installed atomically');
 await db.exec(readFileSync(new URL('./canonical-host-envelope.sql',import.meta.url),'utf8'));
 await reader.query('set role partner_canonical_reader');await writer.query("set lock_timeout='150ms'");
 const args=[f.org,f.campaign,f.assignment,f.actor,f.session];
 const claims=async()=>reader.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[f.actor,JSON.stringify({session_id:f.session})]);
 const rawRead=()=>reader.query('select snapshot from partner_identity_host.current_snapshot($1,$2,$3,$4,$5)',args);
 const repository=createCanonicalPartnerRoutineRepository({acquire:async()=>({query:reader.query.bind(reader),release:async()=>{}})});
 const boundary=createCanonicalPartnerIdentityBoundary({repository,getPrincipal:()=>({userId:f.actor,sessionId:f.session,verified:true,expiresAt:new Date(Date.now()+3600000).toISOString()})});
 const scope={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment};
 assert.deepEqual(await boundary.read(scope),{identityStatus:'unverified',personId:null});pass('existing verifier denies withheld writer privileges');
 await reader.query('begin');await claims();const snapshot=(await rawRead()).rows[0]?.snapshot;
 assert.equal(snapshot.person.id,f.person);assert.equal(snapshot.review.revision,1);pass('fixed routine joins accepted synthetic writer receipt without runtime authority claim');
 for(const [relation,sql,values]of[
  ['account','update portal_account_links set active=false where person_id=$1',[f.person]],
  ['review','update private.city_identity_reviews set revision=revision+1 where source_id=$1',[f.decision]],
  ['source map','update outreach_campaign_sources set campaign_id=$1 where source=$2',[f.foreignCampaign,'fictional_source']],
  ['immutable receipt','select * from private.city_identity_requests for update',[]],
  ['assignment','update outreach_partner_assignments set revision=revision+1 where id=$1',[f.assignment]]
 ]){await assert.rejects(()=>writer.query(sql,values),e=>e.code==='55P03');pass(relation+' change blocked behind exact routine transaction')}
 await writer.query('update outreach_campaigns set name=name where id=$1',[f.foreignCampaign]);pass('unrelated campaign remains writable');
 await reader.query('rollback');
 await writer.query('update outreach_partner_users set active=false where user_id=$1',[f.actor]);
 await reader.query('begin');await claims();await assert.rejects(rawRead,e=>e.code==='42501');await reader.query('rollback');pass('committed Partner revocation denies fixed routine');
 await writer.query('update outreach_partner_users set active=true where user_id=$1',[f.actor]);
 await writer.query('begin');await writer.query('select * from outreach_partner_assignments where id=$1 for update',[f.assignment]);
 await reader.query('begin');await claims();
 const pid=(await reader.query('select pg_backend_pid() pid')).rows[0].pid;
 const pending=rawRead();let waiting=false;
 for(let i=0;i<50;i++){
  waiting=(await observer.query("select wait_event_type='Lock' waiting from pg_stat_activity where pid=$1",[pid])).rows[0]?.waiting;
  if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));
 }
 assert.equal(waiting,true);await observer.query('select pg_cancel_backend($1)',[pid]);
 await assert.rejects(()=>pending,e=>e.code==='57014');await reader.query('rollback');await writer.query('rollback');
 await writer.query('update portal_account_links set active=active where person_id=$1',[f.person]);pass('actual blocked request cancellation rolls back locks');
 assert.deepEqual(await boundary.read(scope),{identityStatus:'unverified',personId:null});pass('fresh repository request remains held after rollback');
 console.log(checks+' native current-schema composition checks PASS');
}finally{await db.close()}
