// No provider calls. Preserve every accepted public byte and prove deterministic output.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildSite} from '../site-build/build.mjs';
const base='3574ca964b22c962e72b618467bda72eb1d5f39e';
const git=p=>execFileSync('git',['show',`${base}:${p}`],{maxBuffer:64*1024*1024});
const hash=x=>createHash('sha256').update(x).digest('hex');
for(const p of ['tools/site-build/build.mjs','tools/site-build/public-files.json'])assert.deepEqual(readFileSync(p),git(p),p);
const files=JSON.parse(git('tools/site-build/public-files.json'));
for(const p of files)assert.deepEqual(readFileSync(p),git(p),p);
const manifests=[];
for(let n=0;n<2;n++){
 await buildSite({env:{}});
 const manifest={};
 for(const p of files){const b=readFileSync(`dist/${p}`);assert.deepEqual(b,git(p),p);manifest[p]=hash(b)}
 manifests.push(manifest);
}
assert.deepEqual(manifests[0],manifests[1]);
console.log(JSON.stringify({publicFiles:files.length,unchanged:files.length,builds:2,manifestSHA256:hash(JSON.stringify(manifests[0])),base,hosted:false}));
