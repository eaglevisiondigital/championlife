// In-memory actual SQL replay. This suite does NOT claim concurrent lock proof.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {partnerAuthorityFixture,setWorker,readAssigned,authorityMutations} from './authority-fixture.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();let count=0;
const check=(value,label)=>{assert.ok(value,label);count++;console.log('PASS '+label)};
try{
 const f=await partnerAuthorityFixture(db);
 const safe=async()=>{await setWorker(db,f);const rows=await readAssigned(db,f);check(rows.length===1&&rows[0].personId===null&&rows[0].identityStatus==='unverified','metadata never upgrades canonical identity');await db.query('reset role');};
 await safe();
 for(const mutation of authorityMutations(f)){
  await db.query(mutation.sql,mutation.args);await setWorker(db,f);
  await assert.rejects(()=>readAssigned(db,f),e=>e.code==='42501');check(true,mutation.name+' committed revocation denies');
  await db.query('reset role');await db.query(mutation.undo,mutation.undoArgs??mutation.args);await safe();
 }
 const absent=(await db.query("select to_regclass('private.city_identity_requests') is null and to_regclass('private.city_identity_reviews') is null and to_regclass('private.city_care_requests') is null missing")).rows[0].missing;
 check(absent,'accepted baseline has no Issue50 identity receipts/reviews');
 // Existing non-null registrant/person/account rows cannot fill that provenance gap.
 await db.query('update portal_account_links set active=false where person_id=$1',[f.person]);await safe();
 await db.query('update auth.users set email_confirmed_at=null where id=$1',[f.subject]);await safe();
 check((await db.query('select count(*)::int n from organization_people where id=$1',[f.person])).rows[0].n===1,'canonical Person preserved');
 check((await db.query('select count(*)::int n from outreach_registrations')).rows[0].n===1,'decision source preserved');
 console.log(count+' PGlite Partner authority checks PASS (no concurrency claim)');
}finally{await db.close()}
