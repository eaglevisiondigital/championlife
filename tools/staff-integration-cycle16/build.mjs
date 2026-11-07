import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {buildSite} from '../site-build/build.mjs';
import {verifyActual,root,hash,original,current,runtimePaths} from './source.mjs';
const verified=verifyActual(),files=JSON.parse(current('tools/site-build/public-files.json'));
function inventory(dir,prefix=''){return readdirSync(dir).sort().flatMap(name=>{const p=new URL(name,dir);assert(!lstatSync(p).isSymbolicLink());return lstatSync(p).isDirectory()?inventory(new URL(name+'/',dir),prefix+name+'/'):[[prefix+name,hash(readFileSync(p))]]})}
await buildSite({env:{}});const first=inventory(new URL('dist/',root));await buildSite({env:{}});assert.deepEqual(inventory(new URL('dist/',root)),first);assert.deepEqual(first.map(([p])=>p).sort(),files);
for(const[p,digest]of first){assert.equal(digest,hash(current(p)),'Actual output '+p);if(!runtimePaths.includes(p))assert.equal(digest,hash(original(p)),'Unchanged public '+p)}
console.log(JSON.stringify({status:'PASS',...verified,builds:2,outputs:first.length,unchangedPublic:first.length-runtimePaths.length,buildInventorySHA256:hash(JSON.stringify(first)),changedPublic:runtimePaths}));
