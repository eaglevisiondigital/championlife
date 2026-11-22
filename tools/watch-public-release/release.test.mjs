// Focused release isolation: unchanged production payload and bounded new assets.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../site-build/build.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline='9b8641e53c3d0ab2ae5fe20582f9acc36ac4b150';
const original=p=>execFileSync('git',['show',baseline+':'+p],{cwd:root,maxBuffer:32*1024*1024});
const manifest=JSON.parse(readFileSync(join(root,'tools/site-build/public-files.json')));
const previous=JSON.parse(original('tools/site-build/public-files.json'));
for(const p of previous){assert(manifest.includes(p),'Preserve '+p);if(p!=='watch.html')assert.deepEqual(readFileSync(join(root,p)),original(p),p);}
// This separate Sunday reliability correction is intentionally restricted to the
// YouTube detector; DreamTrack, edge protection, and redirects stay byte-identical.
for(const p of ['netlify/functions/dream-track-auth.mjs','netlify/edge-functions/dream-track-protect.js','_redirects'])assert.deepEqual(readFileSync(join(root,p)),original(p),p);
const youtubeDetector=readFileSync(join(root,'netlify/functions/youtube-live.js'),'utf8');
assert.match(youtubeDetector,/candidateVideoId/);
assert.match(youtubeDetector,/youtube-live-route-verified/);
assert.match(youtubeDetector,/provider-not-verified/);
assert.match(youtubeDetector,/UCG7j8eiL-qW8nzr2Sg7o2oA/);
const added=manifest.filter(p=>!previous.includes(p));assert.equal(added.length,75);assert(added.every(p=>p.startsWith('worship/')));
const html=readFileSync(join(root,'watch.html'),'utf8');
assert(!/LOCAL DESIGN PREVIEW|account-notes|publisher\/live-panel|installation\.js|champion-life-auth\.js/.test(html));
for(const p of ['index.html','about.html','watch.html','ministries.html','outreach.html','events.html','next-steps.html','give.html'])assert(html.includes('href="/'+p+'"'),p);
assert(html.includes('href="/giving-portal"'));
const headers=readFileSync(join(root,'netlify.toml'),'utf8');
assert(headers.includes(original('netlify.toml').toString()));
assert.equal((headers.match(/Content-Security-Policy =/g)||[]).length,2);
for(const route of ['/watch.html','/watch'])assert(headers.includes('for = "'+route+'"'));
assert(!headers.includes('unsafe-eval'));assert(headers.includes('frame-ancestors'));
const fixture=mkdtempSync(join(tmpdir(),'watch-public-build-'));
try{
 mkdirSync(join(fixture,'tools/site-build'),{recursive:true});mkdirSync(join(fixture,'assets/js'),{recursive:true});
 writeFileSync(join(fixture,'assets/js/supabase-config.js'),'window.CHAMPION_LIFE_SUPABASE = {};');
 for(const p of ['worship/private.json','worship/secret.mjs','worship/scripture/owner.json','worship/scripture/../secret.json','tools/debug.mjs','worship/staff.mjs']){
  writeFileSync(join(fixture,'tools/site-build/public-files.json'),JSON.stringify(['assets/js/supabase-config.js',p]));
  await assert.rejects(buildSite({root:fixture,env:{CONTEXT:'production'}}),/Non-public/);
 }
}finally{rmSync(fixture,{recursive:true,force:true});}
await buildSite({root,env:{CONTEXT:'production'}});
let count=0;function walk(dir,prefix=''){for(const f of readdirSync(dir,{withFileTypes:true})){const p=prefix+f.name;if(f.isDirectory())walk(join(dir,f.name),p+'/');else{assert(manifest.includes(p));assert.deepEqual(readFileSync(join(dir,f.name)),readFileSync(join(root,p)),p);count++;}}}walk(join(root,'dist'));assert.equal(count,manifest.length);
console.log(JSON.stringify({result:'PASS',baseline,baselinePublicFiles:previous.length,unchangedBaselinePublicFiles:previous.length-1,changedBaselinePublicFiles:['watch.html'],addedPublicFiles:added.length,totalPublicFiles:count,functionsAndEdge:'UNCHANGED',newManifestNegativeCases:6,artifact:'exact source bytes; no private files'}));
