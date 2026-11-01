// Linux CI only while Mac native IPC is unavailable. Actual independent PG
// transactions and bounded lock_timeout prove contention, not timer guesses.
import assert from 'node:assert/strict';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {partnerAuthorityFixture,setWorker,readAssigned,authorityMutations} from './authority-fixture.mjs';
const db=await localPostgres();let count=0;
const check=(v,label)=>{assert.ok(v,label);count++;console.log('PASS '+label)};
try{
 const f=await partnerAuthorityFixture(db),reader=await db.connect(),writer=await db.connect();
 await setWorker(reader,f);await writer.query("set lock_timeout='150ms'");
 const safe=async()=>{const rows=await readAssigned(reader,f);check(rows.length===1&&rows[0].personId===null&&rows[0].identityStatus==='unverified','only unverified metadata returned');};
 for(const m of authorityMutations(f)){
  // An authorized transaction must hold every current authority row through COMMIT.
  await reader.query('begin');await safe();await writer.query('begin');
  await assert.rejects(()=>writer.query(m.sql,m.args),e=>e.code==='55P03');check(true,m.name+' writer contends with authorized read');
  await writer.query('rollback');await reader.query('commit');
  await writer.query(m.sql,m.args);
  await assert.rejects(()=>readAssigned(reader,f),e=>e.code==='42501');check(true,m.name+' completed revocation prevents read');
  await writer.query(m.undo,m.undoArgs??m.args);
  // A retained old snapshot must abort rather than resurrect removed authority.
  for(const level of ['repeatable read','serializable']){
   await reader.query('begin isolation level '+level);
   await reader.query('select count(*) from public.organizations');
   await writer.query(m.sql,m.args);
   await assert.rejects(()=>readAssigned(reader,f),e=>e.code==='40001');check(true,m.name+' '+level+' old snapshot aborts');
   await reader.query('rollback');await writer.query(m.undo,m.undoArgs??m.args);
  }
  // Revocation acquires the row first: read cannot return while it is unresolved.
  await writer.query('begin');await writer.query(m.sql,m.args);
  await reader.query('begin');await reader.query("set local lock_timeout='150ms'");
  await assert.rejects(()=>readAssigned(reader,f),e=>e.code==='55P03');check(true,m.name+' read contends with pending revocation');
  await reader.query('rollback');await writer.query('commit');
  await assert.rejects(()=>readAssigned(reader,f),e=>e.code==='42501');check(true,m.name+' first read after revocation commit denies');
  await writer.query(m.undo,m.undoArgs??m.args);await safe();
 }
 // Campaign organization is also a locked authorization input. Avoid changing
 // tenancy in fixtures: a harmless non-key update proves the actual row lock.
 await reader.query('begin');await safe();await writer.query('begin');
 await assert.rejects(()=>writer.query('update outreach_campaigns set name=name where id=$1',[f.campaign]),e=>e.code==='55P03');check(true,'campaign row held through read commit');
 await writer.query('rollback');await reader.query('commit');
 console.log(count+' native Partner authority serialization checks PASS');
}finally{await db.close()}
