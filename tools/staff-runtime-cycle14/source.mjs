// Actual source composition first. Only then may historical guards read their
import {additions as cycle19Additions} from '../staff-lifetime-cycle19/source.mjs';
// immutable reviewed checkpoint. No environment-selected replacement source.
import assert from 'node:assert/strict';
import {additions as cycle21Additions} from '../staff-financial-navigation-cycle21/source.mjs';
import {additions as cycle20Additions} from '../staff-create-lifetime-cycle20/source.mjs';
import {readFileSync,lstatSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {checkpointReader as cycle16CheckpointReader,verifyActual as verifyCycle16,additions as cycle16Additions} from '../staff-integration-cycle16/source.mjs';
export const root=new URL('../../',import.meta.url);
export const base='b41d8002b3d1a452b91fe086e376f694825a06b4';
export const people='91ebfeea001babf5851690076e9ef6d71e91b19a';
export const runtime='assets/js/outreach-people.js';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let cycle16Read;export const current=path=>(cycle16Read ||= cycle16CheckpointReader())(path);
const cache=new Map();
export function original(path,commit=base){const key=commit+':'+path;if(!cache.has(key))cache.set(key,execFileSync('git',['--no-replace-objects','show',key],{cwd:root,maxBuffer:64*1024*1024}));return Buffer.from(cache.get(key))}
export function requestBlock(bytes){const text=bytes.toString(),start=' async function request(run){',end=' const people=';assert.equal(text.split(start).length,2);assert.equal(text.split(end).length,2);return text.slice(text.indexOf(start),text.indexOf(end))}
export function expectedRuntime(){const latest=original(runtime,people),prior=original(runtime);assert.equal(hash(latest),'78903b3f58900aac030ae3dfd8d5947004fe6c6c0a0a0e54326c244accb95d43');assert.equal(hash(prior),'7c95613bcd7e08d213162f9844cc33d50d16bb97adb3b6295bc3e86eb4d98f3f');return Buffer.from(latest.toString().replace(requestBlock(latest),requestBlock(prior)))}
const routers={
 'tools/staff-cycle9-integrity/integrity.mjs':[
 ["import assert from 'node:assert/strict';","import assert from 'node:assert/strict';\nimport {current as actualCurrent} from '../staff-runtime-cycle14/source.mjs';"],
 ["sha(current(path))","sha(actualCurrent(path))"]],
 'tools/staff-cycle9/source.mjs':[
 ["import path from 'node:path';","import path from 'node:path';\nimport {checkpointReader} from '../staff-runtime-cycle14/source.mjs';"],
 ['export function verifyComposition() {','export function verifyComposition() {\n  const readCheckpoint = checkpointReader();'],
 ["current = readFileSync(path.join(root, entry.path))","current = readCheckpoint(entry.path)"]],
 'tools/staff-cycle9-integrity/overrides.mjs':[
 ["import * as cycle8 from '../staff-host-cycle8/overrides.mjs';","import * as cycle8 from '../staff-host-cycle8/overrides.mjs';\nimport {checkpointReader as successorCheckpointReader,verifyActual} from '../staff-runtime-cycle14/source.mjs';"],
 ["export const current = path => readFileSync(new URL(path, root));","export const current = successorCheckpointReader();"],
 ["export function verifyComposition(bytes = current('tools/staff-cycle9-integrity/overrides.json'), read = current) {","export function verifyComposition(bytes = current('tools/staff-cycle9-integrity/overrides.json'), read = current) {\n  verifyActual();"]]
};
export function expectedRouter(path){let text=original(path).toString();for(const[before,after]of routers[path]){assert.equal(text.split(before).length,2);text=text.replace(before,after)}return Buffer.from(text)}
const imported=[
 'people-followup-history-pagination.browser.mjs','people-followup-history-pagination-independent.browser.mjs','people-followup-history-pagination.native.mjs',
 'people-followup-history.browser.mjs','people-followup-history-independent.browser.mjs','people-followup-history.native.mjs',
 'people-followup-filter.browser.mjs','people-followup-filter-independent.browser.mjs','people-followup-filter.native.mjs',
 'people-followup-composition.browser.mjs','people-followup-composition-independent.browser.mjs'
].map(name=>'tools/outreach/'+name);
export function expectedImport(path){let text=original(path,people).toString();if(/(history|filter).*\.browser\.mjs$/.test(path)){
 const sdk="req.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js'";
 assert.equal(text.split(sdk).length,2);text=text.replace(sdk,"['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0','https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js'].includes(req.url())");
 const marker="    if(name==='outreach_registration_workspace')return send([]);";assert.equal(text.split(marker).length,2);
 text=text.replace(marker,marker+"\n    if(name==='forms_workspace'&&p?.p_action==='context')return send({capabilities:{profile:'private_draft_v1'},organizations:[]});\n    if(name==='communications_workspace'&&p?.p_action==='context')return send({organizations:[],campaigns:[],external_delivery_enabled:false});");
 }return Buffer.from(text)}
export const added=[
 ...imported,'tools/staff-runtime-cycle14/source.mjs','tools/staff-runtime-cycle14/source.test.mjs','tools/staff-runtime-cycle14/independent.test.mjs',
 'tools/staff-runtime-cycle14/independent.browser.mjs','tools/staff-runtime-cycle14/build.mjs','tools/staff-runtime-cycle14/README.md','tools/staff-runtime-cycle14/history-host.browser.mjs',
 'tools/staff-runtime-cycle14/provenance.json','.github/workflows/staff-runtime-cycle14.yml'
];
export function verifyActual(read=current){
 verifyCycle16();
 assert.equal(hash(read('.github/workflows/staff-runtime-cycle14.yml')),'6242fc1d757ba5759d7bdd304530dc52a3cac06fc953f2064793daea709c7977','Exact independently reviewed Cycle14 workflow');
 assert.deepEqual(read(runtime),expectedRuntime(),'Reviewed Cycle9 successor: Exact latest People plus retained current-actor response fence');
 for(const path of Object.keys(routers))assert.deepEqual(read(path),expectedRouter(path),'Exact successor router '+path);
 for(const path of imported)assert.deepEqual(read(path),expectedImport(path),'Exact imported contract '+path);
 const tracked=execFileSync('git',['--no-replace-objects','ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n');
 for(const path of [...tracked,...added.filter(p=>existsSync(new URL(p,root)))]){const stat=lstatSync(new URL(path,root));assert(!stat.isSymbolicLink()&&stat.isFile(),'No public symlink or protected backend/config symlink '+path)}
 for(const path of tracked){if(path===runtime||Object.hasOwn(routers,path)||imported.includes(path))continue;assert(!lstatSync(new URL(path,root)).isSymbolicLink(),'No public symlink or protected backend/config symlink '+path);assert.deepEqual(read(path),original(path),'Historical guard/build/dependency unchanged; Unchanged staff110 dependency '+path)}
 const allowed=new Set([...tracked,...added]);
 const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean).filter(path=>!cycle16Additions.includes(path)&&!cycle19Additions.includes(path)&&!cycle20Additions.includes(path)&&!cycle21Additions.includes(path));
 for(const path of files)assert(allowed.has(path),'Unlisted composition file '+path);
 for(const prefix of['supabase','netlify','assets']){function walk(path){if(!existsSync(new URL(path,root)))return;assert(!lstatSync(new URL(path,root)).isSymbolicLink());if(lstatSync(new URL(path,root)).isDirectory())for(const n of readdirSync(new URL(path,root)))walk(path+'/'+n);else assert(tracked.includes(path),'No backend/config addition or removal; Unlisted protected file '+path)}walk(prefix)}
 for(const name of readdirSync(root)){if(/\.html$/.test(name))assert(tracked.includes(name),'Unlisted public HTML '+name)}
 for(const name of readdirSync(new URL('tools/staff-runtime-cycle14/',root)))assert(added.includes('tools/staff-runtime-cycle14/'+name),'Unlisted composition file tools/staff-runtime-cycle14/'+name);
 const manifest=JSON.parse(read('tools/staff-runtime-cycle14/provenance.json'));
 assert.deepEqual(manifest,{base,people,runtimeSHA256:hash(expectedRuntime()),requestSHA256:hash(requestBlock(original(runtime))),imports:Object.fromEntries(imported.map(path=>[path,{sourceSHA256:hash(original(path,people)),composedSHA256:hash(expectedImport(path))}]))},'Exact source-derived provenance, no invented hash approval');
 return{base,people,tracked:tracked.length,imports:imported.length,runtimeSHA256:hash(read(runtime)),hostedAcceptance:false,releaseAuthorized:false};
}
export function checkpointReader(){verifyActual();return path=>path===runtime||Object.hasOwn(routers,path)?original(path):current(path)}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyActual()));
