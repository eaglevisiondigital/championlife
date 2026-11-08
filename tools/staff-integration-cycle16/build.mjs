import assert from 'node:assert/strict';
import {current as cycle22Current,expectedRuntime as cycle22Expected,runtime as cycle22Runtime} from '../partner-home-cycle22/source.mjs';
import {current as cycle21Current,expectedRuntime as cycle21Expected,runtime as cycle21Runtime} from '../staff-financial-navigation-cycle21/source.mjs';
import {current as actualCurrent,expectedRuntime,runtime as cycle19Runtime} from '../staff-create-lifetime-cycle20/source.mjs';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {buildSite} from '../site-build/build.mjs';
import {verifyActual,root,hash,original,current,runtimePaths} from './source.mjs';
const verified=verifyActual(),files=JSON.parse(current('tools/site-build/public-files.json'));
function inventory(dir,prefix=''){return readdirSync(dir).sort().flatMap(name=>{const p=new URL(name,dir);assert(!lstatSync(p).isSymbolicLink());return lstatSync(p).isDirectory()?inventory(new URL(name+'/',dir),prefix+name+'/'):[[prefix+name,hash(readFileSync(p))]]})}
await buildSite({env:{}});const first=inventory(new URL('dist/',root));await buildSite({env:{}});assert.deepEqual(inventory(new URL('dist/',root)),first);assert.deepEqual(first.map(([p])=>p).sort(),files);
for(const[p,digest]of first){assert.equal(digest,hash(cycle22Current(p)),'Actual output '+p);if(!runtimePaths.includes(p))assert.equal(digest,hash(p===cycle21Runtime?cycle21Expected():p===cycle19Runtime?expectedRuntime():original(p)),'Unchanged public '+p)}
console.log(JSON.stringify({status:'PASS',...verified,builds:2,outputs:first.length,unchangedPublic:first.length-runtimePaths.length-2,buildInventorySHA256:hash(JSON.stringify(first)),changedPublic:[...runtimePaths,cycle19Runtime,cycle21Runtime]}));
