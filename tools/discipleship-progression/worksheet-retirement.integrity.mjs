// Exact current-source gate plus immutable historical integrity replay. No hosted I/O.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../site-build/build.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='40f319487164c9314de7bea64d41cf412b184306';
const sha=b=>createHash('sha256').update(b).digest('hex'),git=args=>execFileSync('git',['--no-replace-objects',...args],{cwd:root,maxBuffer:50*1024*1024});
const runtime='assets/js/grip-worksheet.js',workflow='.github/workflows/discipleship-source-review.yml';
const additions=new Set(['tools/discipleship-progression/worksheet-retirement.browser.mjs','tools/discipleship-progression/worksheet-retirement-independent.browser.mjs','tools/discipleship-progression/worksheet-retirement.integrity.mjs','tools/discipleship-progression/WORKSHEET-RETIREMENT.md','tools/discipleship-progression/worksheet-retirement.integrity.test.mjs']);
const entries=git(['ls-tree','-rz',base]).toString().split('\0').filter(Boolean).map(line=>{const[meta,p]=line.split('\t');const[mode,type,blob]=meta.split(' ');assert.equal(type,'blob');return{p,mode,blob}});
const baseline=entries.map(e=>e.p),blobs=[...new Set(entries.map(e=>e.blob))],data=execFileSync('git',['--no-replace-objects','cat-file','--batch'],{cwd:root,input:blobs.join('\n')+'\n',maxBuffer:512*1024*1024}),byBlob=new Map();let offset=0;
for(const blob of blobs){const end=data.indexOf(10,offset),[actual,type,size]=data.subarray(offset,end).toString().split(' ');assert.equal(actual,blob);assert.equal(type,'blob');offset=end+1;byBlob.set(blob,data.subarray(offset,offset+Number(size)));offset+=Number(size)+1}
const original=new Map(entries.map(e=>[e.p,byBlob.get(e.blob)]));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
for(const p of baseline){if([runtime,workflow].includes(p))continue;assert.deepEqual(fs.readFileSync(path.join(root,p)),original.get(p),'Unexpected baseline change: '+p)}
ok(true,'every other baseline source, SQL, public page, historical guard, SDK and dependency remains byte-identical');
ok(sha(fs.readFileSync(path.join(root,runtime)))==='a84362c65ef43de1e1db4f3832b3c24ce7f146500614bd8d930cbd8d569fdd8b','exact reviewed worksheet retirement runtime');
ok(sha(fs.readFileSync(path.join(root,workflow)))==='8edd0d031a375d6ae20fe695d9f8dbedec558a2e831d8644851fac66b1513e23','exact independently reviewed workflow');
for(const p of git(['ls-files','--cached','--others','--exclude-standard']).toString().trim().split('\n'))assert.ok(baseline.includes(p)||additions.has(p),'Unexpected source addition: '+p);
ok(true,'tracked and untracked additions are bounded to retirement review files');
if(process.argv[2]==='--source-only'){console.log(JSON.stringify({checks,sourceOnly:true,baseline:base}));process.exit(0)}
const paths=JSON.parse(fs.readFileSync(path.join(root,'tools/site-build/public-files.json')));
await buildSite({root,env:{}});const first=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(path.join(root,'dist',p)))]));
await buildSite({root,env:{}});const second=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(path.join(root,'dist',p)))]));
assert.deepEqual(second,first);ok(true,'two actual candidate public builds reproduce');
const changed=paths.filter(p=>sha(original.get(p))!==first[p]);assert.deepEqual(changed,[runtime]);ok(true,'only reviewed worksheet runtime changes in public output');
const historical=process.argv[2];
if(historical){
 assert.ok(['notes-session','worksheet-export'].includes(historical),'Unknown historical integrity target');
 // Original guard executes unchanged in a detached, exact accepted source tree.
 // This is historical verification only; current-source and current-build gates above are mandatory first.
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'worksheet-retirement-history-'));
 try{
  execFileSync('git',['clone','--quiet','--shared','--no-checkout',root,temp]);
  execFileSync('git',['checkout','--quiet','--detach',base],{cwd:temp});
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:temp,encoding:'utf8'}).trim(),base);
  execFileSync(process.execPath,['tools/discipleship-progression/'+historical+'.integrity.mjs'],{cwd:temp,stdio:'inherit'});
  ok(true,'unchanged '+historical+' historical integrity on exact accepted checkpoint');
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
console.log(JSON.stringify({checks,baseline:base,publicFiles:paths.length,changed,buildSHA256:sha(JSON.stringify(first)),historical:historical||null,hostedAcceptance:false}));
