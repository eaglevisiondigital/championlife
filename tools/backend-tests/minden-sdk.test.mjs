// Exact accepted dependency; no network or provider behavior is simulated here.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url));
const sri='sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp';
const sdk=Buffer.from(read('tools/backend-tests/fixtures/vendor/supabase-js-2.118.0.js.b64').toString(),'base64');
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
assert.equal('sha384-'+createHash('sha384').update(sdk).digest('base64'),sri);
for(const p of ['king-kind-reader.html','discipleship-login.html','minden/index.html','minden/es/index.html','minden/register/index.html','staff-minden-decisions.html']){
 const html=read(p).toString(),tags=html.match(/<script\b[^>]*supabase-js[^>]*>/g)||[];
 assert.equal(tags.length,1,p);assert.ok(tags[0].includes('src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0"'),p);
 assert.ok(tags[0].includes('integrity="'+sri+'" crossorigin="anonymous"'),p);
}
const manifest=JSON.parse(read('tools/site-build/public-files.json'));
assert.equal(manifest.some(p=>p.startsWith('tools/')),false,'test-only SDK and licensed test data are never public');
assert.equal(manifest.some(p=>/king.kind.*\.pdf$/i.test(p)),false);
assert.match(read('king-kind-reader.html').toString(),/href="\/discipleship-login.html\?next=%2Fking-kind-reader.html"/);
assert.match(read('king-kind-reader.html').toString(),/Bessemer, Huntsville or Minden decision form/);
console.log('PASS accepted SDK bytes/SRI, six entry contracts, same-origin login and private build exclusions');
