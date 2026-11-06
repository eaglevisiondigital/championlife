import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {canonicalSourceFixture} from './canonical-source-fixture.mjs';
import {captureCanonicalCatalog,compareCanonicalCatalog} from './canonical-catalog-diagnostics.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));const {PGlite}=require('@electric-sql/pglite');
test('catalog-only diagnostics reproduce pins and identify drift without raw fixture values',async()=>{
 const db=new PGlite();try{
  const f=await canonicalSourceFixture(db),baseline=await captureCanonicalCatalog(db);
  assert.equal(compareCanonicalCatalog(baseline,baseline).mismatches.length,0);
  assert.match(baseline.version.version_num,/^\d+$/);
  await db.exec('grant update(user_id) on portal_account_links to authenticated');
  const report=compareCanonicalCatalog(await captureCanonicalCatalog(db),baseline);
  assert.equal(report.mismatches.length,1);assert.equal(report.mismatches[0].name,'public.portal_account_links');
  assert.ok(report.mismatches[0].fields.some(item=>item.field==='columns'));
  const text=JSON.stringify(report);for(const value of [f.actor,f.subject,f.person,'CHILD SECRET','private@example.invalid','5550100'])assert.equal(text.includes(value),false);
  // Comparator also names the exact catalog constraint field without adjusting
  // any expected digest, as needed for cross-version NOT NULL representations.
  const different=structuredClone(baseline);different.relations['public.portal_account_links'][0].constraints.push('NOT NULL synthetic_column');
  const changed=compareCanonicalCatalog(different,baseline);assert.deepEqual(changed.mismatches[0].fields.map(item=>item.field),['constraints']);
  console.log('Accepted fixture PostgreSQL '+baseline.version.version+'; diagnostics pin/column/constraint/privacy checks PASS');
 }finally{await db.close()}
});
