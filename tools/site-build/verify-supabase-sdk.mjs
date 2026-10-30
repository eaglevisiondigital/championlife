import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export async function verifySupabaseSDK(root, files) {
  const pages=[];
  for(const file of files.filter(f=>f.endsWith('.html'))){
    const html=await readFile(path.join(root,file),'utf8');
    if(/supabase-js|champion-life-auth\.js/.test(html))pages.push({file,html});
  }
  if(!pages.length&&!files.some(f=>f.startsWith('assets/vendor/supabase-js-')))return;
  const pin=JSON.parse(await readFile(path.join(root,'tools/site-build/supabase-sdk.json'),'utf8'));
  if(pin.version!=='2.118.0'||pin.asset!=='assets/vendor/supabase-js-2.118.0.js'||!files.includes(pin.asset))throw Error('Missing reviewed Supabase SDK');
  const bytes=await readFile(path.join(root,pin.asset));
  if(createHash('sha256').update(bytes).digest('hex')!==pin.sha256||'sha384-'+createHash('sha384').update(bytes).digest('base64')!==pin.integrity)throw Error('Supabase SDK integrity mismatch');
  const expected=`<script src="/${pin.asset}" integrity="${pin.integrity}" crossorigin="anonymous"></script>`;
  for(const {file,html}of pages){
    const tags=html.match(/<script\b[^>]*src=["'][^"']*supabase-js[^"']*["'][^>]*><\/script>/g)||[];
    if(tags.length!==1||tags[0]!==expected)throw Error('Unpinned Supabase dependency: '+file);
  }
  return {version:pin.version,sha256:pin.sha256,integrity:pin.integrity,entrypoints:pages.map(p=>p.file)};
}
