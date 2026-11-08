// Current source/build acceptance precedes explicitly historical immutable recipes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../site-build/build.mjs';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const base='c97d9dcf3a72bb75278cc7468bba7fbb861cef38';
const runtime='assets/js/grip-course.js',prefix='tools/discipleship-progression/course-draft-session';
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=args=>execFileSync('git',['--no-replace-objects',...args],{cwd:root,maxBuffer:512*1024*1024});
const entries=git(['ls-tree','-rz',base]).toString().split('\0').filter(Boolean).map(line=>{const [meta,p]=line.split('\t'),[mode,type,blob]=meta.split(' ');assert.equal(type,'blob');return{p,blob}});
const blobs=[...new Set(entries.map(e=>e.blob))],data=execFileSync('git',['--no-replace-objects','cat-file','--batch'],{cwd:root,input:blobs.join('\n')+'\n',maxBuffer:512*1024*1024}),byBlob=new Map();let offset=0;
for(const blob of blobs){const end=data.indexOf(10,offset),[actual,type,size]=data.subarray(offset,end).toString().split(' ');assert.equal(actual,blob);assert.equal(type,'blob');offset=end+1;byBlob.set(blob,data.subarray(offset,offset+Number(size)));offset+=Number(size)+1}
export const original=new Map(entries.map(e=>[e.p,byBlob.get(e.blob)]));
const manifestHash='b7aba3877702a84fdc553e12160e473d9cf5aa72aef840620a720b6190bbc821',manifestBytes=fs.readFileSync(path.join(root,prefix+'.json'));
assert.equal(sha(manifestBytes),manifestHash,'Unreviewed manifest');
const manifest=JSON.parse(manifestBytes);
assert.equal(manifest.base,base);
assert.deepEqual(Object.keys(manifest.added).sort(),[prefix+'.test.mjs',prefix+'.integrity.test.mjs','tools/discipleship-progression/COURSE-DRAFT-SESSION.md'].sort());
const additions=[prefix+'.test.mjs',prefix+'.integrity.mjs',prefix+'.integrity.test.mjs',prefix+'.json','tools/discipleship-progression/COURSE-DRAFT-SESSION.md'];
export function verify(overrides=new Map(),extra=[]){
 const read=p=>overrides.has(p)?overrides.get(p):fs.readFileSync(path.join(root,p));
 assert.equal(sha(read(prefix+'.json')),manifestHash,'Unreviewed manifest');
 for(const {p}of entries)assert.equal(sha(read(p)),manifest.changed[p]??sha(original.get(p)),'Unreviewed source: '+p);
 for(const [p,hash]of Object.entries(manifest.added))assert.equal(sha(read(p)),hash,'Unreviewed addition: '+p);
 const files=git(['ls-files','--cached','--others','--exclude-standard']).toString().trim().split('\n');
 for(const p of [...files,...extra])assert.ok(original.has(p)||additions.includes(p),'Unexpected addition: '+p);
 assert.deepEqual(Object.keys(manifest.changed).sort(),['assets/js/grip-course.js','.github/workflows/discipleship-source-review.yml','tools/discipleship-progression/course-retirement.test.mjs','tools/discipleship-progression/course-retirement.browser.mjs','tools/backend-tests/general-resource-corrections.test.mjs','CURRENT_BUILD_STATE.md'].sort());
 return true;
}
// The historical inventory ignores dependency directories, not a symlink named
// node_modules. Keep the directory real and link only its installed entries.
export function linkHistoricalDependencies(source,destination){
 fs.mkdirSync(destination);
 for(const entry of fs.readdirSync(source))fs.symlinkSync(path.join(source,entry),path.join(destination,entry));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 verify();console.log('PASS actual Cycle21 source plus all frozen PR120 source; bounded additions');
 const mode=process.argv[2];assert.ok([undefined,'--source-only','--current-contracts','contracts','notes-session','worksheet-export','worksheet-retirement'].includes(mode));
 if(mode==='--source-only')process.exit(0);
 if(mode==='contracts'||mode==='--current-contracts'){
  const tests=fs.readdirSync(path.join(root,'tools/discipleship-progression')).filter(p=>p.endsWith('.test.mjs')&&(!p.includes('.integrity.')||p==='course-draft-session.integrity.test.mjs')).sort().map(p=>'tools/discipleship-progression/'+p);
  execFileSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});
 }else{
  const paths=JSON.parse(fs.readFileSync(path.join(root,'tools/site-build/public-files.json')));
  await buildSite({root,env:{}});const first=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(path.join(root,'dist',p)))]));
  await buildSite({root,env:{}});const second=Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(path.join(root,'dist',p)))]));assert.deepEqual(second,first);
  assert.deepEqual(paths.filter(p=>sha(original.get(p))!==first[p]),[runtime]);
  console.log(JSON.stringify({candidateBuilds:2,publicFiles:paths.length,changed:[runtime],buildSHA256:sha(JSON.stringify(first)),hostedAcceptance:false}));
 }
 if(mode&&mode!=='--current-contracts'){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'course-draft-history-'));
  try{
   execFileSync('git',['--no-replace-objects','clone','--quiet','--shared','--no-checkout',root,temp]);execFileSync('git',['--no-replace-objects','checkout','--quiet','--detach',base],{cwd:temp});
   assert.equal(execFileSync('git',['--no-replace-objects','rev-parse','HEAD'],{cwd:temp,encoding:'utf8'}).trim(),base);
   linkHistoricalDependencies(path.join(root,'tools/backend-tests/node_modules'),path.join(temp,'tools/backend-tests/node_modules'));
   console.log('HISTORICAL ONLY: unchanged PR120 recipe at '+base+'; never current runtime acceptance');
   if(mode==='notes-session')execFileSync(process.execPath,['--test','tools/discipleship-progression/course-retirement.integrity.test.mjs'],{cwd:temp,stdio:'inherit'});
   execFileSync(process.execPath,['tools/discipleship-progression/course-retirement.integrity.mjs',mode],{cwd:temp,stdio:'inherit'});
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
 }
}
