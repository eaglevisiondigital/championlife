// Independent acceptance of the two-checkpoint composition and workflow routing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {manifest,pins,plan,materialize,verifyInventory} from './composition.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{cwd:root,encoding:'utf8'});
const workflow=fs.readFileSync(path.join(root,'.github/workflows/outreach-summary-review.yml'),'utf8');
const summary=workflow.split('  summary:\n')[1]?.split('\n  composed-history:')[0];
function routedCommands(text){
 return [...text.matchAll(/      - working-directory: \$\{\{ runner\.temp \}\}\/partner-cycle12\/(composition|outreach)\n        run: (.+)/g)].map(([,target,command])=>({command,target}));
}
function checkRouting(text){assert.deepEqual(routedCommands(text),manifest.summaryCommands,'every original command runs once, in order, in its declared source tree');}
const parent=fs.mkdtempSync(path.join(os.tmpdir(),'partner-cycle12-independent-')),target=path.join(parent,'trees');
try{
 const plans=materialize(target),dir=path.join(target,'composition');
 test.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
 test('independently computed merge-base and disjoint runtime changes agree with exact manifest',()=>{
  assert.equal(git('merge-base',pins.partner,pins.outreach).trim(),pins.ancestor);
  const changed=ref=>new Set(git('diff','--name-only',pins.ancestor,ref).trim().split('\n').filter(Boolean));
  const pc=changed(pins.partner),oc=changed(pins.outreach);
  assert.deepEqual([...oc].filter(p=>pc.has(p)).sort(),['ARCHITECTURE.md','CURRENT_BUILD_STATE.md','SECURITY_MODEL.md']);
  assert(manifest.outreachOverlay.every(e=>!e.path.startsWith('supabase/')),'no new SQL supplied by Outreach overlay');
  assert.equal(plans.composition['assets/js/staff-outreach-partners.js'].blob,plans.partner['assets/js/staff-outreach-partners.js'].blob);
  assert.equal(plans.composition['assets/js/outreach-people.js'].blob,plans.outreach['assets/js/outreach-people.js'].blob);
  assert.equal(plans.composition['assets/js/outreach-registration-staff.js'].blob,plans.outreach['assets/js/outreach-registration-staff.js'].blob);
 });
 test('each materialized checkpoint has actual pinned HEAD and full composed inventory',()=>{
  for(const name of ['partner','outreach','composition']){
   assert.equal(execFileSync('git',['--no-replace-objects','rev-parse','HEAD'],{cwd:path.join(target,name),encoding:'utf8'}).trim(),pins[name==='outreach'?'outreach':'partner']);
   assert.equal(verifyInventory(path.join(target,name),plans[name]).files,Object.keys(plans[name]).length);
  }
  assert.equal(fs.readFileSync(path.join(dir,'tools/outreach/registration-print-roster.browser.mjs'),'utf8'),git('show',pins.outreach+':tools/outreach/registration-print-roster.browser.mjs'));
 });
 test('workflow routes all26 original commands in order and retains full composed guards',()=>{
  assert.equal(manifest.summaryCommands.length,26);checkRouting(summary);
  assert.equal((summary.match(/run: node tools\/partner-integration-cycle12\/verify\.mjs/g)||[]).length,2);
  assert(workflow.includes('ref: ${{ github.event.pull_request.head.sha }}'));
  assert(!workflow.includes('continue-on-error:'));
  for(const source of ['people-followup-history.browser.mjs','people-followup-history-independent.browser.mjs','people-followup-history.native.mjs','staff-intake-review.browser.mjs','assigned-backend.browser.mjs','org-handoff.browser.mjs'])assert(workflow.includes(source),source);
 });
 test('command omission, reordering, and running old integrity only on composition are rejected',()=>{
  const line='        run: node tools/outreach/registration-print-roster.browser.mjs';
  assert.throws(()=>checkRouting(summary.replace(line,'        run: true')));
  assert.throws(()=>checkRouting(summary.replace('partner-cycle12/outreach','partner-cycle12/composition')));
  const commands=structuredClone(manifest);[commands.summaryCommands[5],commands.summaryCommands[7]]=[commands.summaryCommands[7],commands.summaryCommands[5]];assert.throws(()=>plan(commands));
  const missing=structuredClone(manifest);missing.summaryCommands.splice(16,1);assert.throws(()=>plan(missing));
 });
 test('composed guard rejects missing roster, protected Partner drift, and executable-bit substitution',()=>{
  for(const [name,change]of [['tools/outreach/registration-print-roster.browser.mjs','remove'],['assets/js/staff-outreach-partners.js','bytes'],['assets/js/outreach-people.js','mode']]){
   const file=path.join(dir,name),original=fs.readFileSync(file),mode=fs.statSync(file).mode;
   try{if(change==='remove')fs.unlinkSync(file);else if(change==='bytes')fs.appendFileSync(file,'\n// substituted');else fs.chmodSync(file,0o755);assert.throws(()=>verifyInventory(dir,plans.composition));}
   finally{fs.writeFileSync(file,original);fs.chmodSync(file,mode);}
  }
 });
 test('hidden extras and misleading generated-directory prefixes remain source violations',()=>{
  for(const name of ['.independent-hidden','tools/backend-tests/node_modules-sneak/injected.mjs','dist-extra/injected.html']){
   const file=path.join(dir,name);try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'fictional');assert.throws(()=>verifyInventory(dir,plans.composition));}finally{fs.unlinkSync(file);}
  }
  assert.equal(verifyInventory(dir,plans.composition).files,681);
 });
}catch(error){fs.rmSync(parent,{recursive:true,force:true});throw error;}
