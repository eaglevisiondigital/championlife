import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createCanonicalPartnerHostIngress} from './canonical-host-ingress.mjs';
import {signedHostFixture} from './signed-host-fixture.mjs';
import {currentSchemaSourceFixture} from './current-schema-source-fixture.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const unknown={identityStatus:'unverified',personId:null};

test('signed host ingress composes real current-schema authority and unchanged strict provenance',async t=>{
 const db=new PGlite();try{
  const f=await currentSchemaSourceFixture(db),signer=signedHostFixture(f);
  await db.exec(readFileSync(new URL('./canonical-host-envelope.sql',import.meta.url),'utf8'));
  let acquisitions=0,hook=async()=>{};const releases=[],signals=[];
  const options={issuer:signer.issuer,publicJwk:structuredClone(signer.publicJwk),acquire:async({signal})=>{
   acquisitions++;signals.push(signal);await db.exec('set role partner_canonical_reader');
   return {query:async(sql,args)=>{const result=await db.query(sql,args);await hook(sql,args);return result},
    release:async discard=>{releases.push(discard);await db.exec('rollback; reset role')}};
  }};
  const ingress=createCanonicalPartnerHostIngress(options);
  const request={organizationId:f.org,campaignId:f.campaign,assignmentId:f.assignment};
  const input=(accessToken=signer.token())=>({...request,accessToken});
  const read=(value=input(),signal=new AbortController().signal)=>ingress.read(value,signal);
  const verified={identityStatus:'verified',personId:f.person};
  await t.test('actual accepted writer receipts verify under fictional ES256 issuer',async()=>{
   assert.deepEqual(await read(),verified);assert.equal(releases.at(-1),false);
   assert.deepEqual(Object.keys(ingress),['retire','read']);
  });
  await t.test('trusted key config copied once; request cannot mutate it',async()=>{
   options.publicJwk.kid='changed';options.publicJwk.x='changed';options.issuer='https://wrong.invalid/auth/v1';
   assert.deepEqual(await read(),verified);
  });
  for(const [name,overrides]of[
   ['wrong issuer',{iss:'https://other.invalid/auth/v1'}],['wrong audience',{aud:'service_role'}],
   ['multi audience',{aud:['authenticated','other']}],['service role',{role:'service_role'}],
   ['anonymous',{is_anonymous:true}],['missing anonymous flag',{is_anonymous:undefined}],
   ['missing subject',{sub:undefined}],['missing session',{session_id:undefined}],
   ['invalid subject',{sub:'not-uuid'}],['expired',{exp:1}],['noninteger expiry',{exp:1.5}],
   ['future issued',{iat:Math.floor(Date.now()/1000)+3600}],['future nbf',{nbf:Math.floor(Date.now()/1000)+3600}],
   ['missing issued',{iat:undefined}],['unsafe expiry',{exp:Number.MAX_SAFE_INTEGER}]
  ])await t.test('claims deny before database: '+name,async()=>{const before=acquisitions;assert.deepEqual(await read(input(signer.token(overrides))),unknown);assert.equal(acquisitions,before)});
  for(const [name,headers]of[
   ['unknown kid',{kid:randomUUID()}],['missing kid',{kid:undefined}],['HS fallback',{alg:'HS256'}],
   ['none',{alg:'none'}],['wrong type',{typ:'ID'}],['critical headers',{crit:['b64']}],
   ['remote key URL',{jku:'https://attacker.invalid/jwks'}],['embedded JWK',{jwk:signer.publicJwk}]
  ])await t.test('header deny before SDK/database: '+name,async()=>{const before=acquisitions;assert.deepEqual(await read(input(signer.token({},headers))),unknown);assert.equal(acquisitions,before)});
  for(const [name,token]of[
   ['bad signature',signer.token().replace(/.$/,value=>value==='A'?'B':'A')],
   ['unsigned','e30.e30.'],['invalid JSON','e30.bm90anNvbg.YQ'],['oversized','a'.repeat(16385)],
   ['different signing key same kid',signedHostFixture(f).token({},{kid:signer.publicJwk.kid})]
  ])await t.test('invalid token '+name,async()=>{const before=acquisitions;assert.deepEqual(await read(input(token)),unknown);assert.equal(acquisitions,before)});
  for(const extra of ['userId','sessionId','personId','verified','issuer','publicJwk','repository','signal'])await t.test('caller injection denied '+extra,async()=>{
   const before=acquisitions;assert.deepEqual(await read({...input(),[extra]:f.actor}),unknown);assert.equal(acquisitions,before);
  });
  await t.test('metadata is ignored and cannot substitute signed actor/session',async()=>{
   assert.deepEqual(await read(input(signer.token({user_metadata:{userId:f.actor,sessionId:f.session,permissions:['partner.view']},sub:f.other,session_id:f.otherSession}))),unknown);
   assert.deepEqual(await read(input(signer.token({user_metadata:{userId:f.other,sessionId:f.otherSession},app_metadata:{role:'administrator'}}))),verified);
  });
  for(const [name,claims]of[
   ['borrowed other session',{session_id:f.otherSession}],['unknown session',{session_id:randomUUID()}],
   ['borrowed other actor',{sub:f.other}],['different account session',{sub:f.other,session_id:f.otherSession}]
  ])await t.test('signed token does not override database '+name,async()=>assert.deepEqual(await read(input(signer.token(claims))),unknown));
  for(const [name,sql,args,undo,undoArgs]of[
   ['session retired','delete from auth.sessions where id=$1',[f.session],'insert into auth.sessions(id,user_id)values($1,$2)',[f.session,f.actor]],
   ['session expired',"update auth.sessions set not_after=now()-interval '1 minute' where id=$1",[f.session],'update auth.sessions set not_after=null where id=$1',[f.session]],
   ['actor banned',"update auth.users set banned_until=now()+interval '1 hour' where id=$1",[f.actor],'update auth.users set banned_until=null where id=$1',[f.actor]],
   ['account revoked','update portal_account_links set active=false where person_id=$1',[f.person],'update portal_account_links set active=true where person_id=$1',[f.person]],
   ['partner revoked','update outreach_partner_users set active=false where user_id=$1',[f.actor],'update outreach_partner_users set active=true where user_id=$1',[f.actor]],
   ['assignment changed','update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.other,f.assignment],'update outreach_partner_assignments set assigned_worker_user_id=$1 where id=$2',[f.actor,f.assignment]],
   ['source consent revoked','update outreach_registrations set consent=false where id=$1',[f.decision],'update outreach_registrations set consent=true where id=$1',[f.decision]],
   ['review provenance changed','update private.city_identity_reviews set revision=revision+1 where source_id=$1',[f.decision],'update private.city_identity_reviews set revision=revision-1 where source_id=$1',[f.decision]]
  ])await t.test('same signed token rechecked after '+name,async()=>{
   const token=signer.token();assert.deepEqual(await read(input(token)),verified);
   await db.query(sql,args);assert.deepEqual(await read(input(token)),unknown);
   await db.query(undo,undoArgs);assert.deepEqual(await read(input(token)),verified);
  });
  await t.test('cross organization/campaign/assignment denial',async()=>{
   for(const [key,value]of [['organizationId',f.foreign],['campaignId',f.foreignCampaign],['assignmentId',randomUUID()]])assert.deepEqual(await read({...input(),[key]:value}),unknown);
  });
  for(const signature of ['private.city_decision_reconcile(uuid,jsonb)','private.city_care_workspace(uuid,text,jsonb)'])await t.test('historical writer grant still rejected '+signature,async()=>{
   await db.exec('grant execute on function '+signature+' to authenticated');assert.deepEqual(await read(),unknown);
   await db.exec('revoke execute on function '+signature+' from authenticated');assert.deepEqual(await read(),verified);
  });
  await t.test('aborted transport never acquires database',async()=>{
   const before=acquisitions,controller=new AbortController();controller.abort();
   assert.deepEqual(await read(input(),controller.signal),unknown);assert.equal(acquisitions,before);
  });
  await t.test('abort after locked snapshot destroys lease once and withholds result',async()=>{
   const controller=new AbortController(),before=releases.length;
   hook=async sql=>{if(sql.startsWith('select snapshot from'))controller.abort()};
   assert.deepEqual(await read(input(),controller.signal),unknown);assert.equal(releases.length,before+1);assert.equal(releases.at(-1),true);
   hook=async()=>{};assert.deepEqual(await read(),verified);
  });
  await t.test('request actor and target are snapshotted before awaiting SDK',async()=>{
   const value=input(),pending=read(value);value.organizationId=f.foreign;value.accessToken=signer.token({sub:f.other});
   assert.deepEqual(await pending,verified);
  });
  await t.test('expiry after snapshot rolls back and discards lease',async()=>{
   const exp=Math.floor(Date.now()/1000)+2;
   hook=async sql=>{if(sql.startsWith('select snapshot from'))await new Promise(resolve=>setTimeout(resolve,Math.max(0,exp*1000-Date.now()+10)))};
   assert.deepEqual(await read(input(signer.token({exp}))),unknown);assert.equal(releases.at(-1),true);
   hook=async()=>{};assert.deepEqual(await read(),verified);
  });
  await t.test('all public results exclude private data and tokens',async()=>{
   const result=await read();assert.deepEqual(Object.keys(result),['identityStatus','personId']);assert.equal(Object.isFrozen(result),true);
  });
  await t.test('parallel reads have independent principal and connection state',async()=>{
   // Two isolated PG18 engines share a fictional snapshot. This tests ingress
   // lifetime isolation; native PG18 separately tests shared-database locks.
   const twin=new PGlite({loadDataDir:await db.dumpDataDir()});let resume,arrived,count=0;
   const ready=new Promise(resolve=>arrived=resolve);
   const concurrent=createCanonicalPartnerHostIngress({issuer:signer.issuer,publicJwk:signer.publicJwk,acquire:async()=>{
    const connection=count++===0?db:twin;await connection.exec('set role partner_canonical_reader');
    return {query:async(sql,args)=>{if(connection===db&&sql==='commit'){arrived();await new Promise(resolve=>resume=resolve)}return connection.query(sql,args)},
     release:async()=>connection.exec('rollback; reset role')};
   }});
   try{
    const first=concurrent.read(input(),new AbortController().signal);
    await Promise.race([ready,first.then(()=>{throw Error('First read missed barrier')})]);
    assert.deepEqual(await concurrent.read(input(signer.token({sub:f.other,session_id:f.otherSession})),new AbortController().signal),unknown);
    resume();assert.deepEqual(await first,verified);assert.equal(count,2);
   }finally{if(resume)resume();concurrent.retire();await twin.close()}
  });
  await t.test('permanent host/key retirement cancels existing read and rejects later reads',async()=>{
   hook=async sql=>{if(sql.startsWith('select snapshot from'))ingress.retire()};
   assert.deepEqual(await read(),unknown);assert.equal(signals.at(-1).aborted,true);
   const before=acquisitions;assert.deepEqual(await read(),unknown);assert.equal(acquisitions,before);
  });
 }finally{await db.close()}
});

test('trusted configuration rejects private, unsupported or incomplete keys',()=>{
 const signer=signedHostFixture({actor:randomUUID(),session:randomUUID()});
 const options={issuer:signer.issuer,publicJwk:signer.publicJwk,acquire:async()=>{throw Error('Never acquired')}};
 for(const change of [{issuer:'http://fictional.invalid/auth/v1'},{issuer:'https://fictional.invalid/auth/v1?key=private'},
  {issuer:'https://user:pass@fictional.invalid/auth/v1'},{issuer:'https://fictional.invalid/wrong'},
  {acquire:null},{publicJwk:{...signer.publicJwk,d:'private'}},{publicJwk:{...signer.publicJwk,alg:'HS256'}},
  {publicJwk:{...signer.publicJwk,crv:'P-384'}},{publicJwk:{...signer.publicJwk,key_ops:['sign']}},
  {publicJwk:{...signer.publicJwk,kid:''}},{publicJwk:{...signer.publicJwk,x:'invalid'}}])assert.throws(()=>createCanonicalPartnerHostIngress({...options,...change}));
 assert.throws(()=>createCanonicalPartnerHostIngress({...options,verifyClaims:()=>({verified:true})}));
});

test('SDK verifier never discovers keys or falls back to provider/network',async()=>{
 const original=globalThis.fetch;let network=0,acquisitions=0;
 globalThis.fetch=async()=>{network++;throw Error('Forbidden test network')};
 try{
  const signer=signedHostFixture({actor:randomUUID(),session:randomUUID()});
  const ingress=createCanonicalPartnerHostIngress({issuer:signer.issuer,publicJwk:signer.publicJwk,acquire:async()=>{acquisitions++;throw Error('No fixture database')}});
  for(const headers of [{alg:'HS256'},{kid:randomUUID()},{}])assert.deepEqual(await ingress.read({accessToken:signer.token({},headers),organizationId:randomUUID(),campaignId:randomUUID(),assignmentId:randomUUID()},new AbortController().signal),unknown);
  assert.equal(network,0);assert.equal(acquisitions,1);ingress.retire();
 }finally{globalThis.fetch=original}
});
