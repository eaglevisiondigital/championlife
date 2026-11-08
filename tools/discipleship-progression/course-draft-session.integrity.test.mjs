import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {verify,root,base,linkHistoricalDependencies} from './course-draft-session.integrity.mjs';
test('actual source inventory passes before and after independent negative probes',()=>{assert.equal(verify(),true)});
for(const p of ['assets/js/grip-course.js','.github/workflows/discipleship-source-review.yml','tools/backend-tests/general-resource-corrections.test.mjs','tools/discipleship-progression/course-retirement.test.mjs','tools/discipleship-progression/course-retirement.browser.mjs','assets/js/grip-notes.js','assets/js/grip-worksheet.js','assets/js/champion-life-auth.js','getting-a-grip-6.html','getting-a-grip-11.html','tools/discipleship-progression/course-retirement.integrity.mjs','tools/discipleship-progression/course-retirement.integrity.test.mjs','supabase/migrations/20261102210907_lessons_nine_thirteen_owned_worksheets.sql','tools/discipleship-progression/course-draft-session.test.mjs','tools/discipleship-progression/course-draft-session.json'])test('guard rejects drift: '+p,()=>{assert.throws(()=>verify(new Map([[p,Buffer.concat([fs.readFileSync(path.join(root,p)),Buffer.from('\nUNREVIEWED')])]])))});
test('guard rejects unlisted source',()=>assert.throws(()=>verify(new Map(),['unexpected.mjs'])));

test('actual frozen PR120 guard rejects root dependency symlink and accepts directory with linked dependency entries',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'course-history-dependencies-'));
 const source=path.join(root,'tools/backend-tests/node_modules'),destination=path.join(temp,'tools/backend-tests/node_modules');
 try{
  execFileSync('git',['--no-replace-objects','clone','--quiet','--shared','--no-checkout',root,temp]);
  execFileSync('git',['--no-replace-objects','checkout','--quiet','--detach',base],{cwd:temp});
  const guard='tools/discipleship-progression/course-retirement.integrity.mjs';
  const original=execFileSync('git',['--no-replace-objects','show',base+':'+guard],{cwd:root});
  assert.deepEqual(fs.readFileSync(path.join(temp,guard)),original);
  const run=()=>spawnSync(process.execPath,[guard,'--source-only'],{cwd:temp,encoding:'utf8',maxBuffer:5*1024*1024});
  fs.symlinkSync(source,destination,'dir');let result=run();
  assert.notEqual(result.status,0);assert.match(result.stderr,/Unexpected source addition: tools\/backend-tests\/node_modules/);
  fs.unlinkSync(destination);linkHistoricalDependencies(source,destination);
  assert.equal(fs.lstatSync(destination).isDirectory(),true);assert.equal(fs.lstatSync(destination).isSymbolicLink(),false);
  assert.deepEqual(fs.readdirSync(destination).sort(),fs.readdirSync(source).sort());
  for(const entry of fs.readdirSync(source))assert.equal(fs.readlinkSync(path.join(destination,entry)),path.join(source,entry));
  result=run();assert.equal(result.status,0,result.stdout+result.stderr);
  assert.deepEqual(fs.readFileSync(path.join(temp,guard)),original);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
