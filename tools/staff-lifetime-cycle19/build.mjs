import assert from 'node:assert/strict';
import {current as cycle22Current,expectedRuntime as cycle22Expected,runtime as cycle22Runtime,registrationRuntime,expectedRegistrationRuntime} from '../partner-home-cycle22/source.mjs';
import {current as cycle21Current,expectedRuntime as cycle21Expected,runtime as cycle21Runtime} from '../staff-financial-navigation-cycle21/source.mjs';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {buildSite} from '../site-build/build.mjs';
import {verifyActual,root,hash,original,runtime} from './source.mjs';
import {current} from '../staff-create-lifetime-cycle20/source.mjs';
const source=verifyActual(),files=JSON.parse(current('tools/site-build/public-files.json'));
function inventory(dir,prefix=''){return readdirSync(dir).sort().flatMap(name=>{const p=new URL(name,dir);assert(!lstatSync(p).isSymbolicLink());return lstatSync(p).isDirectory()?inventory(new URL(name+'/',dir),prefix+name+'/'):[[prefix+name,hash(readFileSync(p))]]})}
await buildSite({env:{}});const first=inventory(new URL('dist/',root));await buildSite({env:{}});assert.deepEqual(inventory(new URL('dist/',root)),first,'Two actual reproducible builds');assert.deepEqual(first.map(([p])=>p).sort(),files);
for(const[p,digest]of first){assert.equal(digest,hash(cycle22Current(p)),'Actual source/build '+p);if(p!==runtime)assert.equal(digest,hash(p===registrationRuntime?expectedRegistrationRuntime():p===cycle22Runtime?cycle22Expected():p===cycle21Runtime?cycle21Expected():original(p)),'Unchanged117 public '+p)}
console.log(JSON.stringify({status:'PASS',...source,builds:2,outputs:first.length,unchangedPublic:first.length-4,changedPublic:[runtime,cycle21Runtime,cycle22Runtime,registrationRuntime],buildInventorySHA256:hash(JSON.stringify(first))}));
