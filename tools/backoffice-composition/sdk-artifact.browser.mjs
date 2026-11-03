// Actual reviewed SDK bytes and real browser SRI; all HTTP intercepted, no Auth/provider call.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH);
const url='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0';
const sri='sha384-UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
ok(createHash('sha256').update(sdk).digest('hex')==='bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af','accepted artifact SHA256');
ok('sha384-'+createHash('sha384').update(sdk).digest('base64')===sri,'accepted artifact SRI');
// Independently downloaded /dist/umd/supabase.js differs only by this CDN banner.
// Retain its exact hash here so this regression cannot silently substitute any fixture.
const raw=sdk.subarray(292);
ok(createHash('sha256').update(raw).digest('hex')==='ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3','original rejected direct-path artifact');
for(const[type,options]of[[chromium,process.env.CI?{}:{channel:'chrome'}],[webkit,{}]]){
 const browser=await type.launch(options);
 try{for(const file of ['staff-home.html','staff-people.html','staff-outreach-registration.html']){
  const html=readFileSync(new URL('../../'+file,import.meta.url),'utf8');
  const tags=html.match(/<script\b[^>]*src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^>]*><\/script>/g)||[];
  ok(tags.length===1,'one SDK script in '+file);
  const tag=tags[0];ok(tag.includes('src="'+url+'"')&&tag.includes('integrity="'+sri+'"')&&tag.includes('crossorigin="anonymous"'),'exact source URL/SRI '+file);
  for(const[mode,bytes,expected]of[['accepted',sdk,true],['wrong-direct-path-bytes',raw,false],['tampered',Buffer.concat([sdk,Buffer.from('/* altered */')]),false]]){
   const page=await browser.newPage(),requests=[];
   await page.route('**/*',async route=>{
    const requested=route.request().url();requests.push(requested);
    if(requested===url)return route.fulfill({contentType:'text/javascript',body:bytes,headers:{'access-control-allow-origin':'*'}});
    if(requested==='https://sdk-review.invalid/')return route.fulfill({contentType:'text/html',body:'<!doctype html>'+tag+'<script>window.result={loaded:typeof window.supabase?.createClient==="function"}</script>'});
    throw Error('Unexpected network request '+requested);
   });
   await page.goto('https://sdk-review.invalid/');
   ok(await page.evaluate(()=>window.result.loaded)===expected,type.name()+' '+file+' '+mode+' browser SRI');
   ok(requests.length===2&&requests[1]===url,'no alternate URL or provider request');
   await page.close();
  }
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,providerActions:0}));
