// Exact reviewed parent; public changes are limited to the session correction.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildSite} from '../site-build/build.mjs';
const baseline='1260684cc5d9f9d374158d88304d233f7d19c969',changed='assets/js/communications.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=JSON.parse(fs.readFileSync('tools/site-build/public-files.json','utf8'));
assert.equal(fs.readFileSync('tools/site-build/public-files.json','utf8'),execFileSync('git',['show',baseline+':tools/site-build/public-files.json'],{encoding:'utf8'}));
for(const file of files){if(file===changed)continue;assert.equal(hash(fs.readFileSync(file)),hash(execFileSync('git',['show',baseline+':'+file],{maxBuffer:64*1024*1024})),file+' must remain unchanged');}
await buildSite({env:{}});
const first=Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync('dist/'+file))]));
await buildSite({env:{}});
const second=Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync('dist/'+file))]));
assert.deepEqual(second,first,'two deterministic builds');
assert.equal(first[changed],hash(fs.readFileSync(changed)));
console.log(JSON.stringify({baseline,publicFiles:files.length,unchangedPublicFiles:files.length-1,onlyPublicChange:changed,twoBuildsIdentical:true,buildManifestSHA256:hash(JSON.stringify(first)),runtimeSHA256:first[changed],hosted:false}));
