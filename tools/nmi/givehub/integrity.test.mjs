import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSite} from '../../site-build/build.mjs';
const base='9fae30cc246de10768a78f5158a845ef101882b3',root=new URL('../../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
test('PR73 protected source stays exact; migration tool never enters public build',async()=>{
 const paths=execFileSync('git',['ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n');
 for(const path of paths){if(path==='.github/workflows/nmi-mid-readiness.yml')continue;assert.deepEqual(readFileSync(new URL(path,root)),execFileSync('git',['show',base+':'+path],{cwd:root,maxBuffer:32*1024*1024}),'unchanged baseline '+path)}
 const files=JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root)));assert(!files.some(x=>x.includes('givehub/')));
 const inventory=()=>files.map(p=>[p,sha(readFileSync(new URL('dist/'+p,root)))]);
 await buildSite({env:{}});const a=inventory();await buildSite({env:{}});assert.deepEqual(inventory(),a);
 for(const[path,hash]of a)assert.equal(hash,sha(execFileSync('git',['show',base+':'+path],{cwd:root,maxBuffer:32*1024*1024})),path);
 console.log(JSON.stringify({outputs:files.length,builds:2,publicUnchanged:true,inventorySHA256:sha(JSON.stringify(a))}));
});
