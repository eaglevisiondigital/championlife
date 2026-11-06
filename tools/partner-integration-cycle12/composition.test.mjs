import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {manifest,plan,materialize,verifyInventory,verifySuccessor} from './composition.mjs';
const parent=fs.mkdtempSync(path.join(os.tmpdir(),'partner-cycle12-test-')),target=path.join(parent,'checkpoints');
try{
 const plans=materialize(target),dir=path.join(target,'composition');
 test('exact immutable inputs produce complete expected composition and untouched checkpoints',()=>{
  for(const name of Object.keys(plans))assert.ok(verifyInventory(path.join(target,name),plans[name]).files>400);
  assert.equal(manifest.summaryCommands.length,26);assert.equal(manifest.outreachOverlay.length,35);assert.equal(manifest.conflicts.length,3);
  assert.equal(manifest.summaryCommands.filter(c=>c.target==='outreach').length,1);
  assert.equal(verifySuccessor().partner,manifest.partner);
 });
 test('reject wrong source pin, missing overlay, overlay bytes/mode substitution, arbitrary conflict and dropped command',()=>{
  for(const mutate of[m=>m.partner='0'.repeat(40),m=>m.outreachOverlay.pop(),m=>m.outreachOverlay[0].sha256='0'.repeat(64),m=>m.outreachOverlay[0].mode='100755',m=>m.conflicts[0].selected='outreach',m=>m.summaryCommands.pop(),m=>m.summaryCommands[0].target='outreach']){
   const altered=structuredClone(manifest);mutate(altered);assert.throws(()=>plan(altered));
  }
 });
 test('reject missing formerly absent test, changed Outreach, Partner, SQL, original guard, public manifest and dependency lock',()=>{
  for(const p of['tools/outreach/registration-print-roster.browser.mjs','assets/js/outreach-people.js','assets/js/staff-outreach-partners.js','supabase/migrations/20261101154618_partner_assigned_metadata_boundary.sql','tools/outreach/people-followup-pagination-integrity.mjs','tools/site-build/public-files.json','tools/backend-tests/package-lock.json']){
   const full=path.join(dir,p),bytes=fs.readFileSync(full);
   try{if(p.includes('registration-print'))fs.unlinkSync(full);else fs.appendFileSync(full,'\nDRIFT');assert.throws(()=>verifyInventory(dir,plans.composition));}finally{fs.writeFileSync(full,bytes);}
  }
 });
 test('reject additional source including ignored env, executable-bit drift, and symlink substitution',()=>{
  for(const p of['unexpected-runtime.js','.env']){const full=path.join(dir,p);try{fs.writeFileSync(full,'fictional');assert.throws(()=>verifyInventory(dir,plans.composition));}finally{fs.unlinkSync(full);}}
  const full=path.join(dir,'assets/js/outreach-people.js'),bytes=fs.readFileSync(full);
  try{fs.chmodSync(full,0o755);assert.throws(()=>verifyInventory(dir,plans.composition));}finally{fs.chmodSync(full,0o644);}
  try{fs.unlinkSync(full);fs.symlinkSync(path.join(target,'outreach/assets/js/outreach-people.js'),full);assert.throws(()=>verifyInventory(dir,plans.composition));}finally{fs.unlinkSync(full);fs.writeFileSync(full,bytes);}
 });
 test('actual original integrity guard still rejects Partner composition; passing checkpoint cannot bless drift',()=>{
  const result=(()=>{try{execFileSync(process.execPath,['tools/outreach/people-followup-pagination-integrity.mjs'],{cwd:dir,stdio:'pipe'});return null;}catch(e){return e;}})();
  assert.ok(result);assert.match(result.stderr.toString(),/unexpected source change/);
  assert.ok(verifyInventory(path.join(target,'outreach'),plans.outreach));
  const full=path.join(dir,'assets/js/staff-outreach-partners.js'),bytes=fs.readFileSync(full);
  try{fs.appendFileSync(full,'\n// drift');assert.throws(()=>verifyInventory(dir,plans.composition));}finally{fs.writeFileSync(full,bytes);}
  assert.ok(verifyInventory(dir,plans.composition));
 });
 // Tests use synchronous bodies; node:test schedules them after module evaluation.
 test.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
}catch(e){fs.rmSync(parent,{recursive:true,force:true});throw e;}
