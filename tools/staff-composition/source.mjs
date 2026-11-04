import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const manifest=JSON.parse(readFileSync(new URL('./sources.json',import.meta.url),'utf8'));
const cache=new Map();
export function source(lane,path){
 const key=lane+':'+path;if(cache.has(key))return cache.get(key);
 const entry=manifest.sources[lane];assert.ok(entry?.files[path],'Unbound composition source '+key);
 const bytes=execFileSync('git',['show',entry.commit+':'+path],{cwd:new URL('../..',import.meta.url),maxBuffer:10*1024*1024});
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.files[path],'Pinned source mismatch '+key);
 const override=manifest.candidateOverrides?.[lane]?.[path];
 if(override){assert.equal(lane+':'+path,'forms:assets/js/forms-admin.js','Only explicit Forms route candidate override allowed');const candidate=readFileSync(new URL('../../'+path,import.meta.url));assert.equal(createHash('sha256').update(candidate).digest('hex'),override,'Candidate source hash mismatch');cache.set(key,candidate);return candidate;}
 cache.set(key,bytes);return bytes;
}
for(const path of Object.keys(manifest.sources.forms.files).filter(p=>p in manifest.sources.events.files))assert.equal(manifest.sources.forms.files[path],manifest.sources.events.files[path],'Shared runtime must be byte-identical: '+path);

// The imported baseline fixture must match the frozen Forms source as well.
for(const path of Object.keys(manifest.sources.forms.files)){const pinned=source('forms',path);assert.deepEqual(readFileSync(new URL('../../'+path,import.meta.url)),pinned,'Local Forms/baseline drift: '+path);}
