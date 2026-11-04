import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import{manifest,source}from'./source.mjs';
const root=new URL('../..',import.meta.url),files=JSON.parse(readFileSync(new URL('../site-build/public-files.json',import.meta.url),'utf8'));
const base=manifest.sources.forms.commit,entries=new Map(execFileSync('git',['ls-tree','-r',base],{cwd:root,encoding:'utf8'}).trim().split('\n').map(line=>{const[meta,path]=line.split('\t');return[path,meta.split(' ')[2]]}));
const current=execFileSync('git',['hash-object','--',...files],{cwd:root,encoding:'utf8'}).trim().split('\n');assert.equal(current.length,files.length);
const changed=files.filter((path,i)=>entries.get(path)!==current[i]);assert.deepEqual(changed,['assets/js/forms-admin.js']);
const tag='<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0" integrity="sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp" crossorigin="anonymous"></script>';
for(const[lane,path]of[['forms','staff-forms.html'],['forms','staff-form-builder.html'],['events','staff-events.html']]){const html=source(lane,path).toString();assert.ok(html.includes(tag));assert.equal((html.match(/supabase-js@/g)||[]).length,1)}
// The shared-session successor is exercised only as an explicitly pinned fixture overlay.
const localSession=readFileSync(new URL('../../assets/js/staff-session.js',import.meta.url));assert.equal(createHash('sha256').update(localSession).digest('hex'),manifest.sources.forms.files['assets/js/staff-session.js']);assert.notEqual(manifest.sources.sharedSession.files['assets/js/staff-session.js'],manifest.sources.forms.files['assets/js/staff-session.js']);
assert.deepEqual(Object.keys(manifest.candidateOverrides.forms),['assets/js/forms-admin.js']);
console.log(JSON.stringify({sourceBindingsVerified:true,publicFiles:files.length,unchanged:files.length-1,changed,pinnedSdkPages:3,sharedSessionRuntimeImported:false,eventsRuntimeOrMigrationImported:false}));
