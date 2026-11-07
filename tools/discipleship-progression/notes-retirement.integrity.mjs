// Current candidate gates precede separately labeled immutable historical replay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../site-build/build.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='f6e0f4b0db6751b8912fad904b8be8056546d9ac';
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=args=>execFileSync('git',['--no-replace-objects',...args],{cwd:root,maxBuffer:512*1024*1024});
const runtime='assets/js/grip-notes.js',workflow='.github/workflows/discipleship-source-review.yml';
const additions=['notes-retirement.test.mjs','notes-retirement.browser.mjs','notes-retirement.integrity.mjs','notes-retirement.integrity.test.mjs','NOTES-RETIREMENT.md'].map(p=>'tools/discipleship-progression/'+p);
const entries=git(['ls-tree','-rz',base]).toString().split('\0').filter(Boolean).map(line=>{const [meta,p]=line.split('\t'),[mode,type,blob]=meta.split(' ');assert.equal(type,'blob');return {p,blob}});
const blobs=[...new Set(entries.map(e=>e.blob))],data=execFileSync('git',['--no-replace-objects','cat-file','--batch'],{cwd:root,input:blobs.join('\n')+'\n',maxBuffer:512*1024*1024}),byBlob=new Map();let offset=0;
for(const blob of blobs){const end=data.indexOf(10,offset),[actual,type,size]=data.subarray(offset,end).toString().split(' ');assert.equal(actual,blob);assert.equal(type,'blob');offset=end+1;byBlob.set(blob,data.subarray(offset,offset+Number(size)));offset+=Number(size)+1}
const original=new Map(entries.map(e=>[e.p,byBlob.get(e.blob)]));
for(const {p} of entries)if(p!==runtime&&p!==workflow)assert.deepEqual(fs.readFileSync(path.join(root,p)),original.get(p),'Unexpected baseline change: '+p);
assert.equal(sha(fs.readFileSync(path.join(root,runtime))),'817100d99612cba48e1e9eeeb1beb2b8daa205c25ef757de9385178239a86a6d','Unreviewed notes runtime');
assert.equal(sha(fs.readFileSync(path.join(root,workflow))),'95ce02d72ad8da85700fac6b88745f9488d0407acc3a75be6d5eef0adc410d7e','Unreviewed workflow');
for(const p of git(['ls-files','--cached','--others','--exclude-standard']).toString().trim().split('\n'))assert.ok(original.has(p)||additions.includes(p),'Unexpected source addition: '+p);
console.log('PASS exact candidate runtime/workflow and all frozen baseline files; bounded additions');
const mode=process.argv[2];
assert.ok([undefined,'--source-only','contracts','notes-session','worksheet-export','worksheet-retirement'].includes(mode),'Unknown integrity mode');
if(mode==='--source-only')process.exit(0);
if(mode==='contracts'){
 const historical='worksheet-retirement.integrity.test.mjs';
 const tests=fs.readdirSync(path.join(root,'tools/discipleship-progression')).filter(p=>p.endsWith('.test.mjs')&&p!==historical).sort().map(p=>'tools/discipleship-progression/'+p);
 console.log('CURRENT CANDIDATE contracts, including new notes negatives; old immutable guard test follows in frozen source.');
 execFileSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});
}else{
 const paths=JSON.parse(fs.readFileSync(path.join(root,'tools/site-build/public-files.json')));
 await buildSite({root,env:{}});const first=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(path.join(root,'dist',p)))]));
 await buildSite({root,env:{}});const second=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(path.join(root,'dist',p)))]));assert.deepEqual(second,first);
 const changed=paths.filter(p=>sha(original.get(p))!==first[p]);assert.deepEqual(changed,[runtime]);
 console.log(JSON.stringify({candidateBuilds:2,publicFiles:paths.length,changed,buildSHA256:sha(JSON.stringify(first)),hostedAcceptance:false}));
}
if(mode){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'notes-retirement-history-'));
 try{
  execFileSync('git',['--no-replace-objects','clone','--quiet','--shared','--no-checkout',root,temp]);execFileSync('git',['--no-replace-objects','checkout','--quiet','--detach',base],{cwd:temp});
  assert.equal(execFileSync('git',['--no-replace-objects','rev-parse','HEAD'],{cwd:temp,encoding:'utf8'}).trim(),base);
  console.log('HISTORICAL ONLY: immutable worksheet retirement guards on frozen '+base);
  const args=mode==='contracts'?['--test','tools/discipleship-progression/worksheet-retirement.integrity.test.mjs']:['tools/discipleship-progression/worksheet-retirement.integrity.mjs',...(mode==='worksheet-retirement'?[]:[mode])];
  execFileSync(process.execPath,args,{cwd:temp,stdio:'inherit'});
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
