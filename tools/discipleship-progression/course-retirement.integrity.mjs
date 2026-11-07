// Current candidate gates precede separately labeled immutable historical replay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../site-build/build.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='3bd5e6e0cf0ccfa10c15f9a8a8d6a32fcdcc52b1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=args=>execFileSync('git',['--no-replace-objects',...args],{cwd:root,maxBuffer:512*1024*1024});
const runtime='assets/js/grip-course.js',workflow='.github/workflows/discipleship-source-review.yml',fixture='tools/backend-tests/general-resource-corrections.test.mjs';
const additions=['course-retirement.test.mjs','course-retirement.browser.mjs','course-retirement.integrity.mjs','course-retirement.integrity.test.mjs','COURSE-RETIREMENT.md'].map(p=>'tools/discipleship-progression/'+p);
const entries=git(['ls-tree','-rz',base]).toString().split('\0').filter(Boolean).map(line=>{const [meta,p]=line.split('\t'),[mode,type,blob]=meta.split(' ');assert.equal(type,'blob');return {p,blob}});
const blobs=[...new Set(entries.map(e=>e.blob))],data=execFileSync('git',['--no-replace-objects','cat-file','--batch'],{cwd:root,input:blobs.join('\n')+'\n',maxBuffer:512*1024*1024}),byBlob=new Map();let offset=0;
for(const blob of blobs){const end=data.indexOf(10,offset),[actual,type,size]=data.subarray(offset,end).toString().split(' ');assert.equal(actual,blob);assert.equal(type,'blob');offset=end+1;byBlob.set(blob,data.subarray(offset,offset+Number(size)));offset+=Number(size)+1}
const original=new Map(entries.map(e=>[e.p,byBlob.get(e.blob)]));
for(const {p} of entries)if(p!==runtime&&p!==workflow&&p!==fixture)assert.deepEqual(fs.readFileSync(path.join(root,p)),original.get(p),'Unexpected baseline change: '+p);
assert.equal(sha(fs.readFileSync(path.join(root,runtime))),'994cedeb25a59da20e2cd70c40e8ac05454bc808ec3cf8d57ccc0119de4480b4','Unreviewed course runtime');
assert.equal(sha(fs.readFileSync(path.join(root,workflow))),'8b39d9fc2df0912269bce60ef39d4f86f7ac5bdcbaaea14991e9aa3f46bce895','Unreviewed workflow');
assert.equal(sha(fs.readFileSync(path.join(root,fixture))),'9c55dccac9880b9e32eb1b0b1810fe807485802810d4cff369dfa5256a5a094b','Unreviewed fixture teardown');
for(const p of git(['ls-files','--cached','--others','--exclude-standard']).toString().trim().split('\n'))assert.ok(original.has(p)||additions.includes(p),'Unexpected source addition: '+p);
console.log('PASS exact candidate runtime/workflow and all frozen baseline files; bounded additions');
const mode=process.argv[2];
assert.ok([undefined,'--source-only','contracts','notes-session','worksheet-export','worksheet-retirement'].includes(mode),'Unknown integrity mode');
if(mode==='--source-only')process.exit(0);
if(mode==='contracts'){
 const historical=['worksheet-retirement.integrity.test.mjs','notes-retirement.integrity.test.mjs'];
 const tests=fs.readdirSync(path.join(root,'tools/discipleship-progression')).filter(p=>p.endsWith('.test.mjs')&&!historical.includes(p)).sort().map(p=>'tools/discipleship-progression/'+p);
 console.log('CURRENT CANDIDATE contracts, including new course negatives; old immutable guard test follows in frozen source.');
 execFileSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});
}else{
 const paths=JSON.parse(fs.readFileSync(path.join(root,'tools/site-build/public-files.json')));
 await buildSite({root,env:{}});const first=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(path.join(root,'dist',p)))]));
 await buildSite({root,env:{}});const second=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(path.join(root,'dist',p)))]));assert.deepEqual(second,first);
 const changed=paths.filter(p=>sha(original.get(p))!==first[p]);assert.deepEqual(changed,[runtime]);
 console.log(JSON.stringify({candidateBuilds:2,publicFiles:paths.length,changed,buildSHA256:sha(JSON.stringify(first)),hostedAcceptance:false}));
}
if(mode){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'course-retirement-history-'));
 try{
  execFileSync('git',['--no-replace-objects','clone','--quiet','--shared','--no-checkout',root,temp]);execFileSync('git',['--no-replace-objects','checkout','--quiet','--detach',base],{cwd:temp});
  assert.equal(execFileSync('git',['--no-replace-objects','rev-parse','HEAD'],{cwd:temp,encoding:'utf8'}).trim(),base);
  console.log('HISTORICAL ONLY: immutable device-notes retirement guards on frozen '+base);
  if(mode==='contracts'){
   // Behavior tests above already ran on the actual successor. Only immutable
   // integrity-negative tests need historical source, not duplicate DOM suites.
   execFileSync(process.execPath,['--test','tools/discipleship-progression/notes-retirement.integrity.test.mjs'],{cwd:temp,stdio:'inherit'});
   const worksheetBase='f6e0f4b0db6751b8912fad904b8be8056546d9ac';
   execFileSync('git',['--no-replace-objects','checkout','--quiet','--detach',worksheetBase],{cwd:temp});
   assert.equal(execFileSync('git',['--no-replace-objects','rev-parse','HEAD'],{cwd:temp,encoding:'utf8'}).trim(),worksheetBase);
   execFileSync(process.execPath,['--test','tools/discipleship-progression/worksheet-retirement.integrity.test.mjs'],{cwd:temp,stdio:'inherit'});
  }else{
   if(mode==='notes-session')execFileSync(process.execPath,['--test','tools/discipleship-progression/notes-retirement.integrity.test.mjs'],{cwd:temp,stdio:'inherit'});
   execFileSync(process.execPath,['tools/discipleship-progression/notes-retirement.integrity.mjs',mode],{cwd:temp,stdio:'inherit'});
  }
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
