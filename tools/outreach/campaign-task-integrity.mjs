// Fail closed on changed public assets; never replace pinned reviewed source hashes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../site-build/build.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const base='24f93a42732626efddad08da26e968d529ec029f';
const files=JSON.parse(readFileSync(new URL('../site-build/public-files.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(files.length,411,'Unexpected public allowlist');
const hashes=()=>Object.fromEntries(files.map(p=>[p,hash(readFileSync(new URL('../../dist/'+p,import.meta.url)))]));
await buildSite({root,env:{}});const first=hashes();await buildSite({root,env:{}});assert.deepEqual(hashes(),first,'Nonreproducible public output');
const verify=()=>{for(const p of files)assert.equal(hash(readFileSync(new URL('../../dist/'+p,import.meta.url))),hash(execFileSync('git',['show',base+':'+p],{cwd:root,maxBuffer:30*1024*1024})),`Protected public file changed: ${p}`)};
verify();
// Demonstrate integrity rejection in generated disposable output, never in source.
const path=new URL('../../dist/'+files[0],import.meta.url),original=readFileSync(path);let rejected=false;
try{writeFileSync(path,Buffer.concat([original,Buffer.from('\nfictional tamper\n')]));try{verify()}catch(e){assert.match(e.message,/Protected public file changed/);rejected=true}}finally{writeFileSync(path,original)}
assert.equal(rejected,true,'Tamper comparison did not fail');verify();
console.log(JSON.stringify({status:'PASS',base,publicFiles:files.length,reproducibleBuilds:2,tamperRejected:true}));
