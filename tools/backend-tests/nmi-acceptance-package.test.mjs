// Meaningful package-history safeguards: no database connection or hosted mutation.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {planAcceptanceMigrations} from '../nmi-acceptance/migrations.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline=JSON.parse(await readFile(new URL('../../docs/NMI-CUTOVER-PRODUCTION-BASELINE.json',import.meta.url),'utf8'));
const planned=await planAcceptanceMigrations(root,baseline);
assert.equal(planned.length,38);assert.equal(planned.filter(x=>x.kind==='production_baseline').length,25);
assert.equal(planned.filter(x=>x.kind==='giving_candidate').length,12);
assert.equal(planned.filter(x=>x.kind==='shared_platform_gate0').length,1);
assert.equal(planned.at(-1).file,'20261019012735_shared_platform_gate0.sql');
const dependency=JSON.parse(await readFile(new URL('../../docs/NMI-CUTOVER-GATE0-DEPENDENCY.json',import.meta.url),'utf8'));
assert.equal(createHash('sha256').update(planned.at(-1).sql).digest('hex'),dependency.sha256);
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
console.log('PASS offline acceptance migration history: 25 primary-confirmed live versions + 12 Giving forward + 1 pinned Gate0; three aliases; exact SQL hashes; controlled newline; wrong commit/hash/inventory/version denial; primary metadata confirmation recorded');
const pinned=JSON.parse(await readFile(new URL('../../docs/NMI-CUTOVER-ACCEPTANCE-MIGRATIONS.json',import.meta.url),'utf8'));
assert.deepEqual(pinned.order.map(x=>x.staged),planned.map(x=>x.file));
for(const item of planned){const row=pinned.order.find(x=>x.staged===item.file);assert.equal(row.staged_sha256,createHash('sha256').update(item.sql).digest('hex'));assert.equal(row.source_sha256,createHash('sha256').update(await readFile(new URL('../../supabase/migrations/'+item.source,import.meta.url))).digest('hex'));}
assert.equal(pinned.baseline_count,25);assert.equal(pinned.giving_forward_count,12);assert.equal(pinned.gate0_count,1);assert.equal(pinned.forward_count,13);
console.log('PASS committed acceptance worksheet exactly matches all 38 staged/source hashes and ordered versions');
// Corrupt only disposable copies; never rewrite the real pin or source SQL for a test.
const fixture=await mkdtemp(join(tmpdir(),'nmi-gate0-plan-'));
try{
 await mkdir(join(fixture,'docs'));await mkdir(join(fixture,'supabase/migrations'),{recursive:true});
 await copyFile(join(root,'docs/NMI-CUTOVER-PROTECTED-FILES.json'),join(fixture,'docs/NMI-CUTOVER-PROTECTED-FILES.json'));
 for(const row of planned)await copyFile(join(root,'supabase/migrations',row.source),join(fixture,'supabase/migrations',row.source));
 const pin=join(fixture,'docs/NMI-CUTOVER-GATE0-DEPENDENCY.json');
 await writeFile(pin,JSON.stringify({...dependency,sha256:'0'.repeat(64)}));await assert.rejects(()=>planAcceptanceMigrations(fixture,baseline),/Gate0 SQL hash mismatch/);
 await writeFile(pin,JSON.stringify({...dependency,gate0_authoritative_commit:null}));await assert.rejects(()=>planAcceptanceMigrations(fixture,baseline),/not pinned/);
 await writeFile(pin,JSON.stringify({...dependency,nmi_source_checkpoint:'3a8317fb265c0cabb894133ac169100aaea83622'}));await assert.rejects(()=>planAcceptanceMigrations(fixture,baseline),/not pinned/);
 await writeFile(pin,JSON.stringify(dependency));await rm(join(fixture,'supabase/migrations',dependency.migration));await assert.rejects(()=>planAcceptanceMigrations(fixture,baseline),/ENOENT/);
}finally{await rm(fixture,{recursive:true,force:true});}
console.log('PASS Gate0 packaging rejects changed SQL, unreviewed authority/checkpoint and missing dependency');
