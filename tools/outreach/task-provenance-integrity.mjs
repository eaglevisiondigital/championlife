import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../site-build/build.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline='403b6d6624c0e182fecaab16a57261b900142a4b';
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:40*1024*1024});
const old=p=>git('show',baseline+':'+p);
const sha=b=>createHash('sha256').update(b).digest('hex');
const allow=new Set([
 'CURRENT_BUILD_STATE.md','SECURITY_MODEL.md',
 'tools/outreach/task-admission-proof.sql','tools/outreach/task-admission-proof.native.mjs',
 'tools/outreach/task-admission-independent.native.mjs','docs/TASK-ADMISSION-PROOF-20261106.md',
 'docs/TASK-INTENT-CONTRACT-20261106.md',
 'tools/outreach/task-writer-plan.sql','tools/outreach/task-writer-plan.native.mjs',
 'tools/outreach/task-writer-plan-independent.native.mjs',
 'tools/outreach/task-intent-fixture.sql','tools/outreach/task-intent-contract.native.mjs',
 'tools/outreach/task-intent-independent.native.mjs',
 'docs/TASK-WRITER-HELD-CONTRACT-20261105.md',
 'docs/CAMPAIGN-PROVENANCE-CONTRACT-20261105.md',
 'tools/outreach/task-writer-prepare.sql','tools/outreach/task-writer-outcome.mjs',
 'tools/outreach/task-writer.native.mjs','tools/outreach/task-writer-independent.native.mjs',
 'tools/outreach/task-writer-reconcile.sql','tools/outreach/task-writer-reconcile.native.mjs',
 'tools/outreach/task-writer-reconcile-independent.native.mjs',
 'tools/outreach/campaign-provenance-contract.mjs','tools/outreach/campaign-provenance-fixture.mjs',
 'tools/outreach/campaign-provenance-contract.native.mjs','tools/outreach/campaign-provenance-independent.native.mjs',
 'tools/outreach/campaign-provenance-custody.native.mjs','tools/outreach/campaign-provenance-custody-independent.native.mjs',
 'tools/outreach/task-provenance-integrity.mjs','.github/workflows/task-provenance-contracts.yml'
]);
const changed=git('diff','--name-only',baseline).toString().trim().split('\n').filter(Boolean);
const untracked=git('ls-files','--others','--exclude-standard').toString().trim().split('\n').filter(Boolean);
assert.ok([...changed,...untracked].every(p=>allow.has(p)),'unexpected source change');
const paths=JSON.parse(fs.readFileSync(root+'tools/site-build/public-files.json'));
assert.deepEqual(fs.readFileSync(root+'tools/site-build/public-files.json'),old('tools/site-build/public-files.json'));
const sql=git('ls-tree','-r','--name-only',baseline,'supabase').toString().trim().split('\n');
for(const p of sql)assert.deepEqual(fs.readFileSync(root+p),old(p),p);
for(const p of paths)assert.deepEqual(fs.readFileSync(root+p),old(p),p);
await buildSite({root,env:{}});
const first=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(root+'dist/'+p))]));
await buildSite({root,env:{}});
const second=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(root+'dist/'+p))]));
assert.deepEqual(first,second,'build is deterministic');
for(const p of paths)assert.equal(first[p],sha(old(p)),p);
console.log(JSON.stringify({status:'PASS',checks:6,publicFiles:paths.length,backendFiles:sql.length,baseline,
 publicManifestSha256:sha(JSON.stringify(first)),hostedAcceptance:false,writeAuthority:false}));
