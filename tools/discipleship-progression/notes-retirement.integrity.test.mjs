import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='f6e0f4b0db6751b8912fad904b8be8056546d9ac',guard='tools/discipleship-progression/notes-retirement.integrity.mjs';
test('successor guard binds notes/workflow and rejects protected/historical/unlisted drift',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'notes-integrity-negative-'));
 try{
  execFileSync('git',['--no-replace-objects','clone','--quiet','--shared','--no-checkout',root,temp]);execFileSync('git',['--no-replace-objects','checkout','--quiet','--detach',base],{cwd:temp});
  const candidates=['assets/js/grip-notes.js','.github/workflows/discipleship-source-review.yml',...fs.readdirSync(path.join(root,'tools/discipleship-progression')).filter(p=>p.startsWith('notes-retirement.')||p==='NOTES-RETIREMENT.md').map(p=>'tools/discipleship-progression/'+p)];
  for(const p of candidates)fs.copyFileSync(path.join(root,p),path.join(temp,p));
  const run=()=>spawnSync(process.execPath,[guard,'--source-only'],{cwd:temp,encoding:'utf8',maxBuffer:5*1024*1024});
  let result=run();assert.equal(result.status,0,result.stdout+result.stderr);
  for(const p of ['assets/js/grip-notes.js','.github/workflows/discipleship-source-review.yml','assets/js/grip-worksheet.js','getting-a-grip-11.html','tools/discipleship-progression/worksheet-retirement.integrity.mjs','tools/discipleship-progression/worksheet-retirement.integrity.test.mjs','supabase/migrations/20261102210907_lessons_nine_thirteen_owned_worksheets.sql']){
   const file=path.join(temp,p),bytes=fs.readFileSync(file);fs.appendFileSync(file,'\nUNREVIEWED\n');result=run();assert.notEqual(result.status,0,'Accepted drift '+p);fs.writeFileSync(file,bytes);
  }
  const extra=path.join(temp,'unexpected.mjs');fs.writeFileSync(extra,'// unreviewed');result=run();assert.notEqual(result.status,0,'Accepted unlisted addition');fs.unlinkSync(extra);
  result=run();assert.equal(result.status,0,result.stdout+result.stderr);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
