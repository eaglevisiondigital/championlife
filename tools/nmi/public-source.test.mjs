import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const pin=JSON.parse(readFileSync(new URL('./public-source-pin.json',import.meta.url)));
const files=JSON.parse(readFileSync(new URL('../site-build/public-files.json',import.meta.url)));
test('historical browser imports retain exact provenance and remain unmounted',()=>{
 assert.equal(pin.commit,'84b2d9ab398bb8046570019da26a5db67fe77467');assert.equal(pin.files.length,2);
 for(const row of pin.files){const bytes=execFileSync('git',['show',pin.commit+':'+row.path]);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(files.includes(row.path),false);}
 for(const file of files.filter(x=>x.endsWith('.html'))){const source=readFileSync(new URL('../../'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/<script[^>]+src=["'][^"']*nmi-(?:giving-client|public-giving)\.js/);}
});
