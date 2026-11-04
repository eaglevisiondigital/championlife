import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {verifyOverrides} from '../staff-module-navigation/source-overrides.mjs';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root));
const manifest=JSON.parse(read('tools/backoffice-composition/source-manifest.json'));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
const overrides=JSON.parse(read('tools/staff-module-navigation/source-overrides.json'));
const changed=verifyOverrides(overrides,read('tools/backoffice-composition/source-manifest.json'),(base,path)=>execFileSync('git',['show',base+':'+path],{cwd:root,maxBuffer:16*1024*1024}),read);
for(const file of [...manifest.selectedFiles,...manifest.preservedFiles])ok(createHash('sha256').update(read(file.path)).digest('hex')===(changed.has(file.path)?(overrides.files[file.path]||overrides.testFiles[file.path]).reviewedSHA256:file.sha256),'exact reviewed source: '+file.path);
for(const p of ['staff-home.html','staff-people.html','staff-outreach-registration.html']){
 const html=read(p).toString();
 ok(html.includes('src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0" integrity="sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp" crossorigin="anonymous"'),'SDK source URL binds accepted artifact SRI: '+p);
 ok(!html.includes('@supabase/supabase-js@2.118.0/dist/umd/supabase.js'),'reject mismatched direct-path SDK: '+p);
}
const publicFiles=JSON.parse(read('tools/site-build/public-files.json'));
for(const p of ['staff-home.html','assets/js/staff-workspace.js','assets/css/staff-workspace.css'])ok(publicFiles.includes(p),'shell public asset '+p);
ok(!publicFiles.some(p=>p.startsWith('tools/')||p.startsWith('docs/')||p.startsWith('supabase/')),'tests, SQL and documentation excluded from website');
const sql=readdirSync(new URL('supabase/migrations/',root)).filter(p=>p.endsWith('.sql')).sort();
ok(JSON.stringify(sql)===JSON.stringify(manifest.preservedFiles.filter(f=>f.path.startsWith('supabase/migrations/')&&f.path.endsWith('.sql')).map(f=>f.path.split('/').pop()).sort()),'no migration addition or removal');
for(const p of manifest.selectedFiles.filter(f=>f.path.startsWith('assets/')||f.path.endsWith('.html')).map(f=>f.path))ok(!read(p).toString().includes('campaign_decision_foundation'),'held campaign foundation not mounted: '+p);
console.log(JSON.stringify({status:'PASS',checks,productionBase:manifest.productionBase,frozenStaff:manifest.frozenStaff,outreach:manifest.outreach}));
