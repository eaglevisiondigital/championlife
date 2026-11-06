import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {plan,verifyInventory,verifySuccessor,pins,sha} from './composition.mjs';
const target=process.argv[2];if(!target||!path.isAbsolute(target))throw Error('Pass absolute disposable directory');
const source=verifySuccessor(),plans=plan(),results={};
for(const name of Object.keys(plans)){
 const dir=path.join(target,name);
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim(),pins[name==='outreach'?'outreach':'partner'],`actual ${name} checkpoint`);
 results[name]=verifyInventory(dir,plans[name]);
}
const composed=path.join(target,'composition'),publicPaths=JSON.parse(fs.readFileSync(path.join(composed,'tools/site-build/public-files.json')));
const {buildSite}=await import(pathToFileURL(path.join(composed,'tools/site-build/build.mjs')));
const hashes=()=>Object.fromEntries(publicPaths.map(p=>[p,sha(fs.readFileSync(path.join(composed,'dist',p)))]));
await buildSite({root:composed+path.sep,env:{}});const first=hashes();
await buildSite({root:composed+path.sep,env:{}});assert.deepEqual(hashes(),first,'deterministic composed build');
for(const p of publicPaths)assert.equal(first[p],sha(fs.readFileSync(path.join(composed,p))),`built source equality: ${p}`);
console.log(JSON.stringify({status:'PASS',source,results,build:{publicFiles:publicPaths.length,twoBuildsEqual:true,allOutputsMatchVerifiedSource:true,publicSha256:sha(JSON.stringify(first)),hashes:first},hostedAcceptance:false}));
