import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import '../staff-cycle11/verify.mjs';
const root=new URL('../../',import.meta.url),base='3b68441aeb54a0c5d6b21a57d2814d64918f854d';
for(const name of ['legacy.browser.mjs','observe.mjs','initiation.mjs']) {
 const path='tools/staff-cycle11/'+name;
 assert.equal(readFileSync(new URL(path,root),'utf8'),execFileSync('git',['--no-replace-objects','show',base+':'+path],{cwd:root,encoding:'utf8'}));
}
assert.equal(readFileSync(new URL('./legacy.browser.mjs',import.meta.url),'utf8'),readFileSync(new URL('../staff-cycle11/legacy.browser.mjs',import.meta.url),'utf8'),'driver bytes unchanged; relative observer resolves explicit intervention');
console.log(JSON.stringify({status:'PASS',cycle:12,driverBytesUnchanged:true,originalClassifierChanged:false,fixtureTimingIntervention:true}));
