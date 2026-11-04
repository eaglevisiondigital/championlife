import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {source as accepted,manifest as old} from '../staff-composition/source.mjs';
export const manifest=JSON.parse(readFileSync(new URL('./sources.json',import.meta.url),'utf8'));
const root=new URL('../..',import.meta.url),cache=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
export function source(lane,path){const key=lane+':'+path;if(cache.has(key))return cache.get(key);const entry=manifest.sources[lane];assert.ok(entry?.files[path],'Unbound exact source '+key);const bytes=execFileSync('git',['show',entry.commit+':'+path],{cwd:root,maxBuffer:20*1024*1024});assert.equal(sha(bytes),entry.files[path],'Exact source changed '+key);cache.set(key,bytes);return bytes;}
assert.deepEqual(readFileSync(new URL('../staff-composition/source.mjs',import.meta.url)),source('composition','tools/staff-composition/source.mjs'),'Imported source loader matches exact98');
assert.deepEqual(JSON.parse(source('composition',manifest.upstreamManifest)),old,'All original52 source bindings retained');
for(const[lane,entry]of Object.entries(old.sources))for(const path of Object.keys(entry.files))accepted(lane,path);
assert.equal(manifest.sources.forms.commit,old.sources.forms.commit);assert.equal(manifest.sources.events.commit,old.sources.events.commit);assert.equal(manifest.sources.session.commit,old.sources.sharedSession.commit);
for(const path of['assets/js/champion-life-auth.js','assets/js/outreach-staff-common.js','assets/css/staff-portal.css','assets/css/outreach-campaigns.css'])for(const lane of['shell','dream'])assert.deepEqual(source(lane,path),source('composition',path),'Shared source collision '+path);
const publicPaths=JSON.parse(source('composition','tools/site-build/public-files.json'));const tree=new Map(execFileSync('git',['ls-tree','-r',manifest.sources.composition.commit],{cwd:root,encoding:'utf8'}).trim().split('\n').map(l=>{const[m,p]=l.split('\t');return[p,m.split(' ')[2]]}));
export function pageSource(path){
 for(const lane of ['session','shell','dream'])if(path in manifest.sources[lane].files&&!path.startsWith('supabase/'))return source(lane,path);
 if(path in old.sources.events.files&&!path.startsWith('tools/'))return accepted('events',path);
 if(path in manifest.sources.composition.files)return source('composition',path);
 assert.ok(publicPaths.includes(path),'Not a pinned public page or asset: '+path);
 const key='public:'+path;if(cache.has(key))return cache.get(key);
 const b=execFileSync('git',['show',manifest.sources.composition.commit+':'+path],{cwd:root,maxBuffer:40*1024*1024});assert.equal(execFileSync('git',['hash-object','--stdin'],{input:b,encoding:'utf8'}).trim(),tree.get(path),'Public git-object mismatch');cache.set(key,b);return b;
}
export function verifyNoPublicDelta(){for(const p of publicPaths)assert.equal(execFileSync('git',['hash-object','--',p],{cwd:root,encoding:'utf8'}).trim(),tree.get(p),'Unexpected candidate public delta '+p);return publicPaths.length;}
export const original=accepted;
