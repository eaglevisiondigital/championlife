import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('provenance.json',import.meta.url)));
for(const [path,hash]of Object.entries(manifest.immutableFiles))assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),hash,path);
const html=readFileSync(new URL('staff-events.html',root),'utf8');assert.ok(html.includes(manifest.acceptedSdkTag));assert.ok(!html.includes('supabase-js@2"'));
const allow=JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root)));assert.ok(!allow.some(x=>x.includes('fixtures')||x.includes('tools/')));
console.log(`${Object.keys(manifest.immutableFiles).length+3} source provenance / privacy-boundary checks passed`);
