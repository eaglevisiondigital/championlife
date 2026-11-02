import { createHash } from 'node:crypto';
const url='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js';
const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(25000)});
if(!response.ok)throw Error('Pinned SDK CDN retrieval failed: '+response.status);
const type=response.headers.get('content-type')||'';
if(!/javascript|octet-stream|text\/plain/i.test(type))throw Error('Unexpected SDK content type: '+type);
const bytes=Buffer.from(await response.arrayBuffer());
if(bytes.length<100_000||bytes.length>2_000_000)throw Error('Unexpected SDK byte count: '+bytes.length);
const sha384='sha384-'+createHash('sha384').update(bytes).digest('base64');
const sha256=createHash('sha256').update(bytes).digest('hex');
console.log('Pinned Supabase UMD SDK byte count:',bytes.length);
console.log('Pinned Supabase UMD SDK SRI:',sha384);
console.log('Pinned Supabase UMD SDK SHA256:',sha256);

import { readFileSync } from 'node:fs';
const expectedSha384='sha384-TcHRA3zBbn+Lexh5n+Oil4guNPOS3rjNDpGRAN46u/s/mB2IZ50ceC6TYDU2yvgK';
const expectedSha256='ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3';
if(sha384!==expectedSha384||sha256!==expectedSha256)throw Error('Pinned SDK bytes no longer match reviewed digest');
const page=readFileSync(new URL('../../king-kind-signup.html',import.meta.url),'utf8');
if(!page.includes('src="'+url+'"')||
   !page.includes('integrity="'+expectedSha384+'" crossorigin="anonymous"')) {
  throw Error('Signup page missing verified exact SDK source and SRI');
}
console.log('Pinned Supabase 2.118.0 source, SHA-256, SRI, and page binding: PASS');
