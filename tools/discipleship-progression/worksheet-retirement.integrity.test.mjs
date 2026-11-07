import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='40f319487164c9314de7bea64d41cf412b184306',guard='tools/discipleship-progression/worksheet-retirement.integrity.mjs';
test('current-source gate rejects exact protected/runtime/history/workflow/unlisted drift',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'worksheet-integrity-negative-'));
 try{
  execFileSync('git',['--no-replace-objects','clone','--quiet','--shared','--no-checkout',root,temp]);
  execFileSync('git',['checkout','--quiet','--detach',base],{cwd:temp});
  const candidates=['assets/js/grip-worksheet.js','.github/workflows/discipleship-source-review.yml',...fs.readdirSync(path.join(root,'tools/discipleship-progression')).filter(p=>p.startsWith('worksheet-retirement')||p==='WORKSHEET-RETIREMENT.md').map(p=>'tools/discipleship-progression/'+p)];
  for(const p of candidates)fs.copyFileSync(path.join(root,p),path.join(temp,p));
  const run=()=>spawnSync(process.execPath,[guard,'--source-only'],{cwd:temp,encoding:'utf8',maxBuffer:5*1024*1024});
  let result=run();assert.equal(result.status,0,result.stdout+result.stderr);
  for(const p of ['baptism-interest.html','.github/workflows/discipleship-source-review.yml','assets/js/grip-worksheet.js','tools/discipleship-progression/notes-session.integrity.mjs','supabase/migrations/20261102210907_lessons_nine_thirteen_owned_worksheets.sql']){
   const full=path.join(temp,p),original=fs.readFileSync(full);fs.appendFileSync(full,'\nUNREVIEWED TAMPER\n');result=run();assert.notEqual(result.status,0,'accepted protected drift '+p);fs.writeFileSync(full,original);
  }
  const added=path.join(temp,'unexpected-source.mjs');fs.writeFileSync(added,'export const unreviewed=true;\n');result=run();assert.notEqual(result.status,0,'accepted untracked source addition');fs.unlinkSync(added);
  result=run();assert.equal(result.status,0,result.stdout+result.stderr);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
