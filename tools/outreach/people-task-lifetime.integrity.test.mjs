import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {additions,acceptedTaskActions} from './people-task-lifetime.integrity.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='91ebfeea001babf5851690076e9ef6d71e91b19a',guard='tools/outreach/people-task-lifetime.integrity.mjs';
test('source guard rejects runtime, workflow, historical assertion, SQL, public and extra-path drift',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'people-lifetime-integrity-'));
 try{
  execFileSync('git',['--no-replace-objects','clone','--quiet','--shared','--no-checkout',root,temp]);execFileSync('git',['--no-replace-objects','checkout','--quiet','--detach',base],{cwd:temp});
  for(const p of ['assets/js/outreach-people.js','.github/workflows/outreach-summary-review.yml','tools/outreach/people-followup-composition.browser.mjs','tools/outreach/people-followup-pagination-integrity.mjs',...additions])fs.copyFileSync(path.join(root,p),path.join(temp,p));
  const run=()=>spawnSync(process.execPath,[guard,'--source-only'],{cwd:temp,encoding:'utf8',maxBuffer:5*1024*1024});
  let result=run();assert.equal(result.status,0,result.stdout+result.stderr);
  for(const p of ['assets/js/outreach-people.js','.github/workflows/outreach-summary-review.yml','tools/outreach/people-followup-composition.browser.mjs','tools/outreach/people-followup-pagination-integrity.mjs','assets/js/outreach-registration-staff.js','staff-people.html',fs.readdirSync(path.join(temp,'supabase/migrations')).map(p=>'supabase/migrations/'+p)[0]]){
   const f=path.join(temp,p),bytes=fs.readFileSync(f);fs.appendFileSync(f,'\nUNREVIEWED\n');result=run();assert.notEqual(result.status,0,p+' drift denied');fs.writeFileSync(f,bytes);
  }
  fs.writeFileSync(path.join(temp,'unexpected.mjs'),'// unreviewed');result=run();assert.notEqual(result.status,0,'unlisted source denied');fs.unlinkSync(path.join(temp,'unexpected.mjs'));result=run();assert.equal(result.status,0,result.stdout+result.stderr);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('helper derivation rejects unreviewed accepted-current source',()=>{
 const source=fs.readFileSync(path.join(root,'assets/js/outreach-people.js'),'utf8'),helper=source.slice(source.indexOf(' function addTaskActions('),source.indexOf(' async function detail('));
 assert.ok(acceptedTaskActions(helper).includes("root.contains(card)"));assert.throws(()=>acceptedTaskActions(helper+'\n'),/reviewed lifetime helper/);
});
