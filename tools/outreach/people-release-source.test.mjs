// Exact current-main release composition: two public changes, no SQL/config drift.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root)),hash=p=>createHash('sha256').update(read(p)).digest('hex');
const manifest=JSON.parse(read('tools/outreach/people-release-manifest.json'));let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++};
eq(JSON.parse(read('tools/site-build/public-files.json')).sort(),Object.keys(manifest.basePublic).sort(),'exact 408-entry main public allowlist');
const delta=[];for(const [p,h]of Object.entries(manifest.basePublic)){if(hash(p)!==h)delta.push(p)}
eq(delta.sort(),manifest.publicDelta.slice().sort(),'only exact People script and SDK HTML change publicly');
for(const [p,h]of Object.entries(manifest.candidatePublic))eq(hash(p),h,'candidate '+p);
for(const [p,h]of Object.entries(manifest.immutableDependencies))eq(hash(p),h,'unchanged '+p);
for(const [p,v]of Object.entries(manifest.exactImports))eq(hash(p),v.sha256,'accepted import '+p);
const walk=(dir)=>readdirSync(new URL(dir,root),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
eq(walk('supabase').sort(),Object.keys(manifest.immutableDependencies).filter(p=>p.startsWith('supabase/')).sort(),'no SQL/bootstrap/function additions or removals');
const html=read('staff-people.html').toString();
eq(html.match(/<script[^>]*supabase-js[^>]*><\/script>/g),['<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0" integrity="sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp" crossorigin="anonymous"></script>'],'exact accepted SDK URL/SRI');
eq(html.includes('staff-workspace.js'),false,'no dependency on unreleased shell');
eq(html.includes('<script src="assets/js/outreach-people.js"></script>'),true,'main direct People mount retained');
console.log(JSON.stringify({status:'PASS',checks,base:manifest.base,publicFiles:Object.keys(manifest.basePublic).length,publicDelta:delta,sqlChanges:0}));
