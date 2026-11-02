import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCanonicalPartnerPgRepository} from './canonical-pg-repository.mjs';
const root=mkdtempSync(join(tmpdir(),'huntsville-minimal-pg-')),socketDirectory=join(root,'socket');mkdirSync(socketDirectory);
const signal=new AbortController().signal;
try{
 const invalid=[null,{}, {socketDirectory}, {socketDirectory,signal,client:{}}, {socketDirectory,signal,password:'never-use'},
 {socketDirectory,signal,host:'production.supabase.co'}, {socketDirectory,signal,port:5432},
 {socketDirectory:'https://exdocjbmylgxssanymjk.supabase.co',signal},{socketDirectory:'localhost',signal},
 {socketDirectory:'/var/run/postgresql',signal},{socketDirectory:root,signal},{socketDirectory,signal:{aborted:false}},
 {socketDirectory:'/nonexistent/huntsville-minimal-pg-test/socket',signal}];
 for(const [i,input]of invalid.entries())await test('unsafe connection configuration '+i+' is rejected before connect',()=>{assert.throws(()=>createCanonicalPartnerPgRepository(input),/Canonical identity unavailable/)});
 await test('explicit isolated factory construction opens no connection and cannot expose client',()=>{const r=createCanonicalPartnerPgRepository({socketDirectory,signal});assert.deepEqual(Object.keys(r),['sourceHashes','withCurrentIdentity']);assert.ok(Object.isFrozen(r))});
 await test('aborted lifetime rejects before connect',async()=>{const a=new AbortController(),r=createCanonicalPartnerPgRepository({socketDirectory,signal:a.signal});a.abort();await assert.rejects(()=>r.withCurrentIdentity({},()=>{}),/Canonical identity unavailable/)});
 await test('missing socket connection failure is sanitized and closes',async()=>{
  const r=createCanonicalPartnerPgRepository({socketDirectory,signal});
  const id='11111111-1111-4111-8111-111111111111';
  await assert.rejects(()=>r.withCurrentIdentity({organizationId:id,campaignId:id,assignmentId:id,userId:id,sessionId:id},()=>{}),e=>e.message==='Canonical identity unavailable'&&!e.cause);
 });
}finally{rmSync(root,{recursive:true,force:true})}
