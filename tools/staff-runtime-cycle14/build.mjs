import assert from 'node:assert/strict';
import {current as cycle22Current,expectedRuntime as cycle22Expected,runtime as cycle22Runtime,registrationRuntime,expectedRegistrationRuntime,dispatchRuntimes,expectedDispatchRuntime} from '../partner-home-cycle22/source.mjs';
import {current as cycle21Current,expectedRuntime as cycle21Expected,runtime as cycle21Runtime} from '../staff-financial-navigation-cycle21/source.mjs';
import {expectedRuntime as cycle19Expected,current as actualCurrent} from '../staff-create-lifetime-cycle20/source.mjs';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {buildSite} from '../site-build/build.mjs';
import {verifyActual,root,hash,original,runtime} from './source.mjs';
import {expected as cycle16Expected,runtimePaths as cycle16Paths} from '../staff-integration-cycle16/source.mjs';
const verified=verifyActual(),files=JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root)));
function inventory(dir,prefix=''){return readdirSync(dir).sort().flatMap(name=>{const path=new URL(name,dir);assert(!lstatSync(path).isSymbolicLink());return lstatSync(path).isDirectory()?inventory(new URL(name+'/',dir),prefix+name+'/'):[[prefix+name,hash(readFileSync(path))]]})}
await buildSite({env:{}});const first=inventory(new URL('dist/',root));await buildSite({env:{}});assert.deepEqual(inventory(new URL('dist/',root)),first);assert.deepEqual(first.map(([p])=>p).sort(),files);for(const[path,digest]of first){assert.equal(digest,hash(cycle22Current(path)));if(path===runtime)assert.equal(digest,hash(cycle19Expected()),'Reviewed permanent lifetime runtime output');if(path!==runtime)assert.equal(digest,hash(dispatchRuntimes.includes(path)?expectedDispatchRuntime(path):path===registrationRuntime?expectedRegistrationRuntime():path===cycle22Runtime?cycle22Expected():path===cycle21Runtime?cycle21Expected():cycle16Paths.includes(path)?cycle16Expected(path):original(path)))}
for(const p of dispatchRuntimes)assert.equal(first.find(([name])=>name===p)?.[1],hash(expectedDispatchRuntime(p)),'Exact reviewed transport output '+p);
const changedPublic=[...new Set([...[runtime,...cycle16Paths,cycle21Runtime,registrationRuntime],...dispatchRuntimes])];
console.log(JSON.stringify({status:'PASS',...verified,builds:2,outputs:first.length,unchangedPublic:first.length-changedPublic.length,buildInventorySHA256:hash(JSON.stringify(first)),changedPublic}));
