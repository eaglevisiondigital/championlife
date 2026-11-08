import assert from 'node:assert/strict';
import {expectedRuntime as cycle19Expected,current as actualCurrent} from '../staff-lifetime-cycle19/source.mjs';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {buildSite} from '../site-build/build.mjs';
import {verifyActual,root,hash,original,runtime} from './source.mjs';
import {expected as cycle16Expected,runtimePaths as cycle16Paths} from '../staff-integration-cycle16/source.mjs';
const verified=verifyActual(),files=JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root)));
function inventory(dir,prefix=''){return readdirSync(dir).sort().flatMap(name=>{const path=new URL(name,dir);assert(!lstatSync(path).isSymbolicLink());return lstatSync(path).isDirectory()?inventory(new URL(name+'/',dir),prefix+name+'/'):[[prefix+name,hash(readFileSync(path))]]})}
await buildSite({env:{}});const first=inventory(new URL('dist/',root));await buildSite({env:{}});assert.deepEqual(inventory(new URL('dist/',root)),first);assert.deepEqual(first.map(([p])=>p).sort(),files);for(const[path,digest]of first){assert.equal(digest,hash(actualCurrent(path)));if(path===runtime)assert.equal(digest,hash(cycle19Expected()),'Reviewed permanent lifetime runtime output');if(path!==runtime)assert.equal(digest,hash(cycle16Paths.includes(path)?cycle16Expected(path):original(path)))}
console.log(JSON.stringify({status:'PASS',...verified,builds:2,outputs:first.length,unchangedPublic:first.length-1-cycle16Paths.length,buildInventorySHA256:hash(JSON.stringify(first)),changedPublic:[runtime,...cycle16Paths]}));
