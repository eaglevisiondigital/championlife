import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../site-build/build.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='676abc58c3da3b082c1f95ef15c8c33c3aa91e33';
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:40*1024*1024});
const old=p=>git('show',base+':'+p),sha=b=>createHash('sha256').update(b).digest('hex');
const allow=new Set(['assets/js/outreach-people.js','tools/outreach/people-followup-pagination.browser.mjs','tools/outreach/people-followup-pagination-independent.browser.mjs','tools/outreach/people-followup-pagination-integrity.mjs','docs/PEOPLE-FOLLOWUP-PAGINATION-20261106.md','docs/PEOPLE-FOLLOWUP-COMPOSITION-20261106.md','tools/outreach/people-followup-composition.browser.mjs','tools/outreach/people-followup-composition-independent.browser.mjs','.github/workflows/outreach-summary-review.yml','CURRENT_BUILD_STATE.md','SECURITY_MODEL.md']);
const changed=git('diff','--name-only',base).toString().trim().split('\n').filter(Boolean);
// Narrow composition of the accepted PR90 search resets onto current PR72.
// Keep the original baseline and all other protected output comparisons.
for(const p of ['assets/js/outreach-registration-staff.js','tools/outreach/registration-search-composition.browser.mjs','tools/outreach/registration-search-composition-independent.browser.mjs','docs/REGISTRATION-SEARCH-COMPOSITION-20261106.md'])allow.add(p);
// Reviewed read-only history increment; no SQL, public manifest or other output exception.
for(const p of ['tools/outreach/people-followup-history.browser.mjs','tools/outreach/people-followup-history-independent.browser.mjs','tools/outreach/people-followup-history.native.mjs','docs/PEOPLE-FOLLOWUP-HISTORY-20261106.md','.github/workflows/people-followup-history.yml'])allow.add(p);
// Reviewed task-status filter tests; original source and protected output guards remain intact.
for(const p of ['tools/outreach/people-followup-filter.browser.mjs','tools/outreach/people-followup-filter-independent.browser.mjs','tools/outreach/people-followup-filter.native.mjs','docs/PEOPLE-FOLLOWUP-FILTER-20261106.md','.github/workflows/people-followup-filter.yml'])allow.add(p);
// Reviewed read-only history pagination; exact test/document/workflow additions only.
for(const p of ['tools/outreach/people-followup-history-pagination.browser.mjs','tools/outreach/people-followup-history-pagination-independent.browser.mjs','tools/outreach/people-followup-history-pagination.native.mjs','docs/PEOPLE-FOLLOWUP-HISTORY-PAGINATION-20261106.md','.github/workflows/people-followup-history-pagination.yml'])allow.add(p);
// Bounded task-control lifetime successor; prior source and output comparisons retained.
for(const p of ['tools/outreach/people-task-lifetime.test.mjs','tools/outreach/people-task-lifetime.integrity.mjs','tools/outreach/people-task-lifetime.integrity.test.mjs','tools/outreach/people-task-lifetime-independent.browser.mjs','docs/PEOPLE-TASK-LIFETIME-20261107.md'])allow.add(p);
assert.equal(sha(fs.readFileSync(root+'assets/js/outreach-registration-staff.js')),'665236df4f5eb52f25e4bcc5560a0e8fda4feae139b4f0b17265d10964ca4f2a','exact reviewed registration composition');
assert.ok(changed.every(p=>allow.has(p)),'unexpected source change');
const paths=JSON.parse(fs.readFileSync(root+'tools/site-build/public-files.json'));
assert.deepEqual(fs.readFileSync(root+'tools/site-build/public-files.json'),old('tools/site-build/public-files.json'));
for(const p of git('ls-tree','-r','--name-only',base,'supabase').toString().trim().split('\n'))assert.deepEqual(fs.readFileSync(root+p),old(p),p);
for(const p of paths)if(!['assets/js/outreach-people.js','assets/js/outreach-registration-staff.js'].includes(p))assert.deepEqual(fs.readFileSync(root+p),old(p),p);
await buildSite({root,env:{}});const first=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(root+'dist/'+p))]));
await buildSite({root,env:{}});const second=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(root+'dist/'+p))]));
assert.deepEqual(first,second,'deterministic build');for(const p of paths)assert.equal(first[p],sha(fs.readFileSync(root+p)),p);
console.log(JSON.stringify({status:'PASS',checks:7,baseline:base,publicFiles:paths.length,changedPublic:['assets/js/outreach-people.js','assets/js/outreach-registration-staff.js'],publicManifestSha256:sha(JSON.stringify(first)),hostedAcceptance:false}));
