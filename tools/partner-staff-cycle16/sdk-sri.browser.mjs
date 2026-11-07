// Reproduce the preserved Nov3 CDN-byte mismatch without contacting the CDN.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {original,expected,partner,paths,sdkURL,sdkSHA,hash} from './source.mjs';
const accepted=readFileSync(process.env.SUPABASE_SDK_PATH);assert.equal(hash(accepted),sdkSHA);
const prefix='/**\n * Skipped minification because the original files appears to be already minified.\n * Original file: /npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js\n *\n * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files\n */\n';
assert.equal(Buffer.byteLength(prefix),292);assert.equal(accepted.subarray(0,292).toString(),prefix);
const direct=accepted.subarray(292);assert.equal(hash(direct),'ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3');
let checks=0;
for(const[name,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const mode of ['original','derived']){
  const page=await browser.newPage(),html=(mode==='original'?original(paths[0],partner):expected(paths[0])).toString();
  const tag=html.match(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.118\.0[^>]*><\/script>/)[0];
  await page.route('**/*',route=>{
   const url=route.request().url();if(url==='https://sdk-partner.invalid/')return route.fulfill({body:'<!doctype html>'+tag,contentType:'text/html'});
   assert([sdkURL,sdkURL+'/dist/umd/supabase.js'].includes(url));
   return route.fulfill({body:url===sdkURL?accepted:direct,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
  });
  await page.goto('https://sdk-partner.invalid/');
  assert.equal(await page.evaluate(()=>typeof window.supabase?.createClient==='function'),mode==='derived');checks++;
  console.log('PASS '+name+' '+mode+' exact URL-delivered bytes '+(mode==='derived'?'satisfy accepted SRI':'reproduce blocked SDK'));
  const sri=tag.match(/integrity="([^"]+)"/)[1];assert.equal('sha384-'+createHash('sha384').update(accepted).digest('base64'),sri);checks++;await page.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,acceptedSHA256:hash(accepted),originalDirectSHA256:hash(direct),source:'Preserved November3 artifacts; no network CDN request',hostedAcceptance:false}));
