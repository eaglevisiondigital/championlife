// Focused enrollment response/account-transition probes; fictional SDK, every request intercepted.
import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url)),origin='https://enrollment.local.test';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const mock=`(()=>{
 const users={A:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test',email_confirmed_at:'2026-01-01'},B:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'b@example.test',email_confirmed_at:'2026-01-01'}};
 let active='A',listeners=[],mode='normal',finish,failAuth=false;const calls=[];
 const receipt={registered:true,enrolled:true,reference:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};
 const auth={initialize:async()=>({}),getUser:async()=>failAuth?{error:{name:'AuthApiError'}}:{data:{user:users[active]||null}},onAuthStateChange:f=>listeners.push(f),signOut:async()=>{window.__enrollment.switch(null);return{}},signInWithOtp:async()=>{throw Error('No real mail')},getSession:async()=>({data:{session:null}})};
 const client={auth,rpc:async(name,args)=>{
  if(args.action==='status')return{data:mode==='legacy'?{...receipt,enrolled:false}:mode==='complete'?receipt:{registered:false,enrolled:false}};
  calls.push({name,args,actor:active});
  if(mode==='pending')await new Promise(r=>{finish=r});
  if(mode==='failure')return{error:{code:'55000'}};
  if(mode==='missing')return{data:{registered:true,reference:receipt.reference}};
  return{data:receipt};
 }};
 window.ChampionLifeAuth={client};
 window.__enrollment={calls,mode:m=>{mode=m},release:()=>finish?.(),expire:()=>{failAuth=true},switch:key=>{active=key;listeners.forEach(f=>f(key?'SIGNED_IN':'SIGNED_OUT',key?{user:users[key]}:null))}};
})();`;
const evidence=process.env.EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});
for(const [engine,options]of[[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});try{for(const width of[390,1440]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin!==origin)return route.fulfill({status:200,body:'',contentType:'text/javascript'});
   if(u.pathname==='/assets/js/champion-life-auth.js')return route.fulfill({body:mock,contentType:'text/javascript'});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE=null;',contentType:'text/javascript'});
   assert.equal(route.request().method(),'GET');const f=path.resolve(root,'.'+(u.pathname==='/king-kind/'?'/king-kind/index.html':u.pathname));assert.ok(f.startsWith(root));
   try{await route.fulfill({body:await readFile(f),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'}[path.extname(f)]||'application/octet-stream'})}catch{await route.fulfill({status:404,body:''})}
  });
  const open=async(mode='normal')=>{await page.goto(origin+'/king-kind/');await page.waitForFunction(()=>!document.querySelector('#resource-submit').disabled);await page.evaluate(m=>window.__enrollment.mode(m),mode)};
  const fill=async(email='a@example.test')=>{await page.locator('#resource-name').fill('Fictional Reader');await page.locator('#resource-email').fill(email);await page.locator('#resource-consent').check()};
  const success=async()=>page.locator('#generalResourceCard.registered').count();
  for(const mode of['failure','missing']){
   await open(mode);await fill();await page.locator('#resource-submit').click();await page.waitForFunction(()=>window.__enrollment.calls.length===1&&!document.querySelector('#resource-submit').disabled);
   ok(await success()===0,mode+' cannot display registration/enrollment success');
   ok(!(await page.locator('#generalResourceAccountNote').innerText()).includes('Reference:'),mode+' leaves no resource receipt');
  }
  await open('legacy');await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.getByText('Complete the form to register for your resources.',{exact:false}).waitFor();
  ok(await success()===0,'registered without enrollment is not complete');ok(await page.evaluate(()=>__enrollment.calls.length)===0,'status is not a browser-side enrollment mutation');
  await page.evaluate(()=>__enrollment.mode('pending'));await fill();await page.locator('#resource-submit').dblclick();await page.waitForFunction(()=>__enrollment.calls.length===1);
  ok(await success()===0,'pending database response never shown as success');ok(await page.locator('#resource-submit').isDisabled(),'double-submit guard holds pending request');
  await page.evaluate(()=>__enrollment.release());await page.locator('#generalResourceCard.registered').waitFor();
  ok((await page.locator('#generalResourceAccountNote').innerText()).includes('enrolled in Getting a Grip'),'complete transaction displays enrolled status');
  ok(await page.evaluate(()=>__enrollment.calls.length===1&&!('user_id' in __enrollment.calls[0].args.payload)),'one RPC with no client-selected actor');
  ok(await page.getByRole('link',{name:'Start Course',exact:true}).getAttribute('href')==='/my-discipleship.html','Start Course remains dashboard navigation');
  if(evidence)await page.screenshot({path:path.join(evidence,engine.name()+'-'+width+'.png'),fullPage:true});
  await page.getByRole('link',{name:'Start Course',exact:true}).click();ok(new URL(page.url()).pathname==='/my-discipleship.html','Start Course navigates without an enrollment RPC');
  for(const transition of['B',null,'expired']){
   await open('pending');await fill();await page.locator('#resource-submit').click();await page.waitForFunction(()=>__enrollment.calls.length===1);
   await page.evaluate(t=>{if(t==='expired')__enrollment.expire();else __enrollment.switch(t);__enrollment.release()},transition);
   await page.waitForFunction(()=>!document.querySelector('#resource-submit').disabled);
   ok(await success()===0,'late A response rejected after '+transition);
   ok(!(await page.locator('#generalResourceAccountNote').innerText()),'no stale receipt after '+transition);
   ok(await page.evaluate(()=>__enrollment.calls.length)===1,'no second mutation after '+transition);
  }
  await open();await page.evaluate(()=>__enrollment.switch('B'));await fill();await page.locator('#resource-submit').click();await page.waitForFunction(()=>!document.querySelector('#resource-submit').disabled);
  ok(await page.evaluate(()=>__enrollment.calls.length)===0,'A email cannot register under B session');
  await fill('b@example.test');await page.locator('#resource-submit').click();await page.locator('#generalResourceCard.registered').waitFor();
  ok(await page.evaluate(()=>__enrollment.calls.length===1&&__enrollment.calls[0].actor==='B'),'B independently registers as B');
  await page.locator('#resource-switch-button').click();await page.getByText('Signed out. Submit the form',{exact:false}).waitFor();ok(await success()===0,'logout removes combined success');
  ok(errors.length===0,'zero uncaught browser errors '+engine.name()+width+': '+errors.join(','));await context.close();
 }}finally{await browser.close()}
}
if(evidence)await writeFile(path.join(evidence,'results.json'),JSON.stringify({checks,genuineAuth:'UNTESTED',transport:'fictional, fully intercepted'},null,2));
console.log(checks+' focused enrollment browser assertions passed.');
