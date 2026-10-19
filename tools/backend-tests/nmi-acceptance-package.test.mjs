// Meaningful package-history safeguards: no database connection or hosted mutation.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {planAcceptanceMigrations} from '../nmi-acceptance/migrations.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline=JSON.parse(await readFile(new URL('../../docs/NMI-CUTOVER-PRODUCTION-BASELINE.json',import.meta.url),'utf8'));
const planned=await planAcceptanceMigrations(root,baseline);
assert.equal(planned.length,37);assert.equal(planned.filter(x=>x.kind==='production_baseline').length,25);
for(const [source,version] of [['20261016201932_huntsville_registration_foundation.sql','20261018113932'],['20261016201933_huntsville_registration_draft.sql','20261018113939'],['20261018121900_allow_huntsville_decision_registrations.sql','20261018144843']])assert(planned.some(x=>x.source===source&&x.file.startsWith(version+'_')));
for(const row of baseline.migrations){const staged=planned.find(x=>x.source===row.sourceFile);assert.equal(createHash('md5').update(staged.sql).digest('hex'),row.sql_md5);}
const bytes=await readFile(new URL('../../supabase/migrations/20261004154340_allow_bessemer_outreach_registrations.sql',import.meta.url),'utf8');assert.equal(planned.find(x=>x.source==='20261004154340_allow_bessemer_outreach_registrations.sql').sql,bytes.replace(/\n$/,''));
const bad=()=>structuredClone(baseline);
let x=bad();x.productionCommit='0'.repeat(40);await assert.rejects(()=>planAcceptanceMigrations(root,x),/commit mismatch/);
x=bad();x.migrations.pop();await assert.rejects(()=>planAcceptanceMigrations(root,x),/inventory/);
x=bad();x.migrations[0].sql_md5='0'.repeat(32);await assert.rejects(()=>planAcceptanceMigrations(root,x),/hash mismatch/);
x=bad();x.migrations[0].sourceNormalization='remove all whitespace';await assert.rejects(()=>planAcceptanceMigrations(root,x),/metadata/);
x=bad();x.migrations[1].version=x.migrations[0].version;await assert.rejects(()=>planAcceptanceMigrations(root,x),/unique and strictly ordered/);
assert.equal(baseline.provenance.primary_confirmation,'CONFIRMED_CURRENT_SNAPSHOT');
console.log('PASS offline acceptance migration history: 25 primary-confirmed live versions + 12 forward; three aliases; exact SQL hashes; controlled newline; wrong commit/hash/inventory/version denial; primary metadata confirmation recorded');
const pinned=JSON.parse(await readFile(new URL('../../docs/NMI-CUTOVER-ACCEPTANCE-MIGRATIONS.json',import.meta.url),'utf8'));
assert.deepEqual(pinned.order.map(x=>x.staged),planned.map(x=>x.file));
for(const item of planned){const row=pinned.order.find(x=>x.staged===item.file);assert.equal(row.staged_sha256,createHash('sha256').update(item.sql).digest('hex'));assert.equal(row.source_sha256,createHash('sha256').update(await readFile(new URL('../../supabase/migrations/'+item.source,import.meta.url))).digest('hex'));}
console.log('PASS committed acceptance worksheet exactly matches all 37 staged/source hashes and ordered versions');
