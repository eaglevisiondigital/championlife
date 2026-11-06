// Test-only package: current-main public assets and build policy must stay exact.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../site-build/build.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline='999f4a75eeb8e4a05580dc603dda39ba64eb0409';
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{cwd:root,maxBuffer:64*1024*1024});
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(git('show',baseline+':tools/site-build/public-files.json'));
const protectedPaths=[...manifest,'tools/site-build/public-files.json','tools/site-build/build.mjs','tools/backend-tests/package.json','tools/backend-tests/package-lock.json'];
for(const path of protectedPaths)assert.equal(sha(readFileSync(root+path)),sha(git('show',baseline+':'+path)),'PROTECTED_SOURCE_CHANGED '+path);
const changed=git('diff','--name-only',baseline).toString().trim().split('\n').filter(Boolean);
for(const path of changed)assert(path.startsWith('tools/staff-cycle7/')||path==='.github/workflows/staff-cycle7-review.yml','UNEXPECTED_CHANGED_PATH '+path);
const inventory=dir=>readdirSync(dir).sort().flatMap(name=>{const path=dir+'/'+name;assert(!lstatSync(path).isSymbolicLink());return lstatSync(path).isDirectory()?inventory(path):[[path.slice((root+'dist/').length),sha(readFileSync(path))]]});
// Deliberately remove deployment environment influence; no hosted operation.
await buildSite({root,env:{}});const first=inventory(root+'dist');
await buildSite({root,env:{}});const second=inventory(root+'dist');
assert.deepEqual(first,second,'NONDETERMINISTIC_PUBLIC_BUILD');
assert.deepEqual(first.map(([p])=>p).sort(),[...manifest].sort(),'PUBLIC_OUTPUT_INVENTORY_CHANGED');
for(const [path,hash] of first)assert.equal(hash,sha(git('show',baseline+':'+path)),'PUBLIC_OUTPUT_CHANGED '+path);
console.log(JSON.stringify({status:'PASS',baseline,protectedPaths:protectedPaths.length,publicFiles:first.length,builds:2,changed,outputManifestSha256:sha(JSON.stringify(first)),releaseAuthorized:false}));
