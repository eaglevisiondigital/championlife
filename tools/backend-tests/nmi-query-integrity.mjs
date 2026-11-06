import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../site-build/build.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='b59e1afcbe2978d16e27883750ce20adb7d3a23d';
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:40*1024*1024}),old=p=>git('show',base+':'+p),sha=b=>createHash('sha256').update(b).digest('hex');
const allow=new Set(['supabase/functions/_shared/payments/nmi-query.mjs','tools/backend-tests/nmi-query-structure.test.mjs','tools/backend-tests/nmi-query-structure.native.mjs','tools/backend-tests/nmi-query-independent.test.mjs','tools/backend-tests/nmi-query-integrity.mjs','docs/NMI-QUERY-STRUCTURE.md','.github/workflows/nmi-query-structure-review.yml','CURRENT_BUILD_STATE.md','SECURITY_MODEL.md']);
const changed=git('diff','--name-only',base).toString().trim().split('\n').filter(Boolean);assert.ok(changed.every(p=>allow.has(p)),'unexpected source scope');
for(const p of git('ls-tree','-r','--name-only',base,'supabase').toString().trim().split('\n'))if(p!=='supabase/functions/_shared/payments/nmi-query.mjs')assert.deepEqual(fs.readFileSync(root+p),old(p),p);
const paths=JSON.parse(fs.readFileSync(root+'tools/site-build/public-files.json'));assert.deepEqual(fs.readFileSync(root+'tools/site-build/public-files.json'),old('tools/site-build/public-files.json'));
for(const p of paths)assert.deepEqual(fs.readFileSync(root+p),old(p),p);
await buildSite({root,env:{}});const first=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(root+'dist/'+p))]));
await buildSite({root,env:{}});const second=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(root+'dist/'+p))]));assert.deepEqual(first,second);for(const p of paths){
 // This historical builder injects its approved allowlisted staff routes.
 const expected=p==='assets/js/staff-workspace.js'?old(p).toString().replace('/* GATE0_ROUTES */ []',JSON.stringify(paths.filter(v=>/^staff-[a-z0-9-]+\.html$/.test(v)))):old(p);
 assert.equal(first[p],sha(expected),p);
}
console.log(JSON.stringify({status:'PASS',checks:6,baseline:base,publicFiles:paths.length,publicManifestSha256:sha(JSON.stringify(first)),hostedAcceptance:false,paymentActivation:false}));
