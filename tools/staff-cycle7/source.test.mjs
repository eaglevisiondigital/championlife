// Exact input verification, not a release composition or hosted acceptance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadSource,loadSources,verifySources,sourceManifest} from './source.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
test('all explicit selected files are exact immutable Git blobs',()=>{
 const verified=verifySources(),loaded=loadSources();assert.equal(verified.length,76);assert.equal(Object.keys(loaded).length,76);
 for(const row of verified){assert.equal(sha(loaded[row.id]),row.sha256);assert.equal(Buffer.byteLength(loaded[row.id]),row.bytes)}
 assert(Object.isFrozen(loaded));assert(Object.isFrozen(verified));assert(Object.isFrozen(sourceManifest.heads));assert(Object.isFrozen(verified[0]));
 assert.throws(()=>verified[0].commit='HEAD',TypeError);assert.throws(()=>sourceManifest.heads.shell102='HEAD',TypeError);
});
for(const id of ['',null,{},'../source.mjs','shell\nHEAD:secret','HEAD:assets/js/staff-workspace.js','shell102','__proto__','toString'])test('unlisted source selection rejected '+JSON.stringify(id),()=>assert.throws(()=>loadSource(id),/SOURCE_ID_NOT_ALLOWLISTED/));
for(const change of [m=>m.sources[0].commit='0'.repeat(40),m=>m.sources[0].path='../../outside',m=>m.sources[0].sha256='0'.repeat(64),m=>m.sources.push(m.sources[0]),m=>m.sources.shift(),m=>m.heads.shell102=m.heads.main])test('tampered manifest rejected before blob access '+change.toString(),()=>{
 const dir=mkdtempSync(join(tmpdir(),'staff-cycle7-manifest-'));
 try{const m=structuredClone(sourceManifest);change(m);writeFileSync(join(dir,'source.mjs'),readFileSync(new URL('./source.mjs',import.meta.url)));writeFileSync(join(dir,'sources.json'),JSON.stringify(m));
 const run=spawnSync(process.execPath,[join(dir,'source.mjs')],{encoding:'utf8'});assert.notEqual(run.status,0);assert.match(run.stderr,/UNREVIEWED_SOURCE_MANIFEST/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('missing local object store fails without network fallback',()=>{
 const dir=mkdtempSync(join(tmpdir(),'staff-cycle7-objects-'));try{
 const run=spawnSync(process.execPath,['--input-type=module','-e',"import {loadSource} from './tools/staff-cycle7/source.mjs';loadSource('shell')"],{cwd:root,env:{...process.env,GIT_OBJECT_DIRECTORY:dir,GIT_ALTERNATE_OBJECT_DIRECTORIES:''},encoding:'utf8'});
 assert.notEqual(run.status,0);assert.match(run.stderr,/not a tree|bad object|not a valid object|invalid object|Command failed/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('shared dependency conflict inventory matches every pinned head',()=>{
 for(const entry of sourceManifest.dependencyInventory)for(const variant of entry.variants){
 const run=spawnSync('git',['--no-replace-objects','show',variant.commit+':'+entry.path],{cwd:root,maxBuffer:8*1024*1024});
 assert.equal(run.status===0?sha(run.stdout):null,variant.sha256,variant.source+':'+entry.path);
 }
 const variants=path=>new Set(sourceManifest.dependencyInventory.find(r=>r.path===path).variants.map(v=>v.sha256).filter(Boolean));
 assert.equal(variants('assets/js/champion-life-auth.js').size,1);assert.equal(variants('assets/js/outreach-staff-common.js').size,1);
 assert.equal(variants('assets/js/staff-session.js').size,3);assert.equal(variants('assets/js/staff-workspace.js').size,3);assert.equal(variants('tools/site-build/build.mjs').size,2);
});
test('HTML dependency order and SDK disagreement are retained without normalization',()=>{
 const scripts=id=>Array.from(loadSource(id).matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g),m=>m[1]);
 const home=scripts('homeHtml');assert(home.indexOf('assets/js/champion-life-auth.js')<home.indexOf('assets/js/staff-session.js'));assert(home.indexOf('assets/js/staff-session.js')<home.indexOf('assets/js/staff-workspace.js'));
 assert.match(loadSource('homeHtml'),/supabase-js@2\.118\.0" integrity="sha384-UagCvVPT/);
 for(const id of ['commCampaignHtml','commActivityHtml']){const list=scripts(id);assert(list.includes('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'));assert(!list.includes('assets/js/staff-session.js'));assert(list.indexOf('assets/js/staff-workspace.js')<list.indexOf('assets/js/communications.js'))}
 assert.notEqual(loadSource('sharedSession'),loadSource('shell102Session'));assert.notEqual(loadSource('shell'),loadSource('legacyCommunicationsShell'));
});
test('loader has no network/installer or candidate runtime override',()=>{
 const source=readFileSync(new URL('./source.mjs',import.meta.url),'utf8');assert(!/\b(?:fetch|writeFileSync|mkdirSync|exec|eval)\s*\(/.test(source));assert(source.includes("'--no-replace-objects'"));assert(!source.includes('candidateOverrides'));
 const current=JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root)));assert(!current.some(p=>p.startsWith('tools/staff-cycle7/')));
});
