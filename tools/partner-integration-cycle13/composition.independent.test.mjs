// Independent Cycle13 review: complete current-source composition and retained coverage.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pins,manifest,root,git,tree,plan,materialize,verifyInventory,verifySuccessor} from './composition.mjs';
const acceptance=JSON.parse(fs.readFileSync(new URL('./acceptance-plan.json',import.meta.url)));
function coverage(p){
 assert.deepEqual(p.sourcePins,{partner:pins.partner,outreach:pins.outreach});
 const entries=[...p.setupCommands,...Object.values(p.groups).flat()];
 for(const entry of manifest.summaryCommands)assert(entries.some(x=>x.command===entry.command&&x.target===entry.target),'original exact summary command '+entry.command);
 const named=[
 'people-followup-history.browser.mjs','people-followup-history-independent.browser.mjs','people-followup-history.native.mjs',
 'people-followup-filter.browser.mjs','people-followup-filter-independent.browser.mjs','people-followup-filter.native.mjs',
 'authority-denials.pglite.mjs','outreach-partner-staff.dom.mjs','site-build.test.mjs','staff-intake-review.browser.mjs','assigned-backend.browser.mjs',
 'assigned-backend.native.mjs','authority-serialization.native.mjs','private-revocation.native.mjs','private-issuance.native.mjs','org-handoff.browser.mjs',
 'canonical-repository.native.mjs','current-schema-composition.native.mjs','restricted-canonical-profile.native.mjs','canonical-host-ingress.native.mjs',
 'canonical-execution-role.native.mjs','provider-database-isolation.native.mjs','canonical-request-binding.test.mjs','canonical-request-binding-independent.test.mjs'];
 for(const name of named)assert(entries.some(e=>e.target==='composition'&&e.command.includes('/'+name)),'retained contract '+name);
 assert(entries.some(e=>e.command==='node --test tools/partner-platform/*.test.mjs tools/outreach/shared-staff-backend.test.mjs'&&e.target==='composition'),'all Partner Node contracts');
 assert(p.setupCommands.some(e=>e.command==='npm ci --ignore-scripts --prefix tools/partner-platform'&&e.target==='composition'),'locked Partner dependencies');
 for(const e of entries)assert(['partner','outreach','composition'].includes(e.target),'no hidden alternative target');
 assert.deepEqual(p.groups['historical-partner'],[{command:'node --test tools/partner-integration-cycle12/composition.test.mjs tools/partner-integration-cycle12/composition.independent.test.mjs',target:'partner'}],'old source-inventory guards remain in original exact Partner checkpoint');
 for(const e of p.groups['partner-native18'])assert(e.command.includes('TEST_POSTGRES_BIN=/usr/lib/postgresql/18/bin'),'PG18 remains explicit');
 assert(p.groups['partner-native18'].some(e=>e.command.includes('TEST_NATIVE_PG=1')),'request-binding really native');
 for(const name of ['people-native','partner-native17'])for(const e of p.groups[name])assert(e.command.includes('TEST_POSTGRES_BIN=/usr/lib/postgresql/17/bin'),'PG17 remains explicit');
}
const parent=fs.mkdtempSync(path.join(os.tmpdir(),'independent-partner13-')),target=path.join(parent,'sources');
const plans=materialize(target),composition=path.join(target,'composition');
test.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
test('complete pinned inputs retain every source, including newer filter and older Partner authority',()=>{
 assert.equal(pins.partner,'c170b0442b8015d9a8de9c7baa311754af95b484');assert.equal(pins.outreach,'4e29de51bbff57e4e3b3ccbdc750bd0edb960443');
 assert.equal(Object.keys(plans.partner).length,656);assert.equal(Object.keys(plans.outreach).length,606);assert.equal(Object.keys(plans.composition).length,693);
 for(const p of Object.keys(plans.partner))assert(plans.composition[p],'Partner source not dropped '+p);
 for(const p of Object.keys(plans.outreach))assert(plans.composition[p],'Outreach source not dropped '+p);
 for(const p of ['assets/js/outreach-people.js','tools/outreach/people-followup-filter-independent.browser.mjs','tools/outreach/people-followup-history.native.mjs'])assert.deepEqual(plans.composition[p],plans.outreach[p]);
 for(const p of ['assets/js/staff-outreach-partners.js','supabase/migrations/20261101154618_partner_assigned_metadata_boundary.sql'])assert.deepEqual(plans.composition[p],plans.partner[p]);
 assert.equal(verifySuccessor().baseline,'999f4a75eeb8e4a05580dc603dda39ba64eb0409');
});
test('all four actual conflicts have explicit exact-blob resolution only in disposable tree',()=>{
 assert.deepEqual(manifest.conflicts.map(x=>[x.path,x.selected]),[['.github/workflows/outreach-summary-review.yml','outreach'],['ARCHITECTURE.md','partner'],['CURRENT_BUILD_STATE.md','partner'],['SECURITY_MODEL.md','partner']]);
 for(const c of manifest.conflicts){assert.deepEqual(plans.composition[c.path],plans[c.selected][c.path]);assert.deepEqual(fs.readFileSync(path.join(target,'partner',c.path)),git('show',pins.partner+':'+c.path));assert.deepEqual(fs.readFileSync(path.join(target,'outreach',c.path)),git('show',pins.outreach+':'+c.path));}
});
test('replacement of latest People by previously accepted predecessor cannot evade exact inventory',()=>{
 const p='assets/js/outreach-people.js',full=path.join(composition,p),saved=fs.readFileSync(full);
 try{fs.writeFileSync(full,git('show','bf4cf916f176ae8c1e86401c64306c56cfca6a35:'+p));assert.throws(()=>verifyInventory(composition,plans.composition),/source bytes/);}finally{fs.writeFileSync(full,saved);}
 assert(verifyInventory(composition,plans.composition));
});
test('minimal source permissions and database sources cannot be replaced by alternate checkpoint or shadowed',()=>{
 const paths=['assets/js/staff-outreach-partners.js','tools/partner-platform/canonical-request-binding.test.mjs','tools/outreach/people-followup-filter.native.mjs'];
 for(const p of paths){const full=path.join(composition,p),saved=fs.readFileSync(full);try{fs.writeFileSync(full,'// independently injected alternate authority');assert.throws(()=>verifyInventory(composition,plans.composition),/source bytes/);}finally{fs.writeFileSync(full,saved);}}
 const p=path.join(composition,'tools/partner-platform/.env');try{fs.writeFileSync(p,'FICTIONAL=1');assert.throws(()=>verifyInventory(composition,plans.composition),/inventory/);}finally{fs.unlinkSync(p);}
});
test('all original summary commands and Partner/current-People native/browser contracts retained; omissions fail',()=>{
 coverage(acceptance);
 for(const edit of[p=>p.groups['people-browser'].pop(),p=>p.groups['partner-native18'].pop(),p=>p.groups['summary-native'].pop(),p=>p.setupCommands=p.setupCommands.filter(e=>!e.command.includes('prefix tools/partner-platform')),p=>p.groups['summary-node'].find(e=>e.target==='outreach').target='composition']){const x=structuredClone(acceptance);edit(x);assert.throws(()=>coverage(x));}
});
test('unmodified historical guard refuses combined tree while exact checkpoint remains valid',()=>{
 const filename='tools/outreach/people-followup-pagination-integrity.mjs';
 assert.deepEqual(fs.readFileSync(path.join(composition,filename)),git('show',pins.outreach+':'+filename));
 assert.throws(()=>execFileSync(process.execPath,[filename],{cwd:composition,stdio:'pipe'}),e=>/unexpected source change/.test(e.stderr.toString()));
 const output=execFileSync(process.execPath,[filename],{cwd:path.join(target,'outreach'),encoding:'utf8'});assert.match(output,/PASS/);
 assert(verifyInventory(composition,plans.composition));
});
