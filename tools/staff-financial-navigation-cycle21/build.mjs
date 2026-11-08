import assert from 'node:assert/strict';
import {current as cycle22Current,expectedRuntime as cycle22Expected,runtime as cycle22Runtime,expectedRouter as cycle22Router} from '../partner-home-cycle22/source.mjs';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {buildSite} from '../site-build/build.mjs';
import {verifyActual,root,hash,current,original,runtime} from './source.mjs';
const source=verifyActual(),files=JSON.parse(current('tools/site-build/public-files.json'));
function inventory(dir,prefix=''){return readdirSync(dir).sort().flatMap(name=>{const p=new URL(name,dir);assert(!lstatSync(p).isSymbolicLink());return lstatSync(p).isDirectory()?inventory(new URL(name+'/',dir),prefix+name+'/'):[[prefix+name,hash(readFileSync(p))]]})}
await buildSite({env:{}});const first=inventory(new URL('dist/',root));await buildSite({env:{}});assert.deepEqual(inventory(new URL('dist/',root)),first,'Two actual reproducible builds');assert.deepEqual(first.map(([p])=>p).sort(),files);
for(const[p,digest]of first){assert.equal(digest,hash(cycle22Current(p)),'Actual source/build '+p);if(p!==runtime)assert.equal(digest,hash(p==='assets/js/staff-events.js'?cycle22Router(p):p===cycle22Runtime?cycle22Expected():original(p)),'Unchanged122 public '+p)}
console.log(JSON.stringify({status:'PASS',...source,builds:2,outputs:first.length,unchangedPublic:first.length-2-1,changedPublic:['assets/js/staff-events.js',runtime,cycle22Runtime],buildInventorySHA256:hash(JSON.stringify(first))}));
