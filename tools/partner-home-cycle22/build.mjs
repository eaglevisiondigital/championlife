import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {buildSite} from '../site-build/build.mjs';
import {verifyActual,root,hash,current,original,runtime,expectedRouter} from './source.mjs';
const source=verifyActual(),files=JSON.parse(current('tools/site-build/public-files.json'));
function inventory(dir,prefix=''){return readdirSync(dir).sort().flatMap(name=>{const p=new URL(name,dir);assert(!lstatSync(p).isSymbolicLink());return lstatSync(p).isDirectory()?inventory(new URL(name+'/',dir),prefix+name+'/'):[[prefix+name,hash(readFileSync(p))]]})}
await buildSite({env:{}});const first=inventory(new URL('dist/',root));await buildSite({env:{}});assert.deepEqual(inventory(new URL('dist/',root)),first,'Two actual reproducible builds');assert.deepEqual(first.map(([p])=>p).sort(),files);
for(const[p,digest]of first){assert.equal(digest,hash(current(p)),'Actual source/build '+p);if(p!==runtime)assert.equal(digest,hash(p==='assets/js/staff-events.js'?expectedRouter(p):original(p)),'Exact reviewed123-derived public '+p)}
const parent='95723fae9d4cbc16eb80e350191495b4d37d4498';for(const[p,digest]of first)if(p!=='assets/js/staff-events.js')assert.equal(digest,hash(execFileSync('git',['--no-replace-objects','show',parent+':'+p],{cwd:root,maxBuffer:80*1024*1024})),'Unchanged126 output '+p);
console.log(JSON.stringify({status:'PASS',...source,builds:2,outputs:first.length,cycle23Base:parent,unchangedFrom126:first.length-1,unchangedPublic:first.length-2,changedPublic:[runtime,'assets/js/staff-events.js'],buildInventorySHA256:hash(JSON.stringify(first))}));
