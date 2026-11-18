// Focused implicit signup callback rendering/navigation. All Auth/network synthetic.
import {chromium,webkit} from 'playwright';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),origin='https://outreach.local.test',next='/outreach-team.html?campaign=11111111-1111-4111-8111-111111111111',base='#access_token=synthetic-access&refresh_token=synthetic-refresh&type=signup';let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
const synthetic=`let cb,finish;const calls={init:0,restore:0,send:0,verify:0,scrubs:[]},save=()=>sessionStorage.setItem('__syntheticSignupProof',JSON.stringify(calls));window.__calls=calls;window.__authEvent=()=>cb('SIGNED_IN',{user:{id:'synthetic-signup-user'}});const replace=history.replaceState.bind(history);history.replaceState=(a,b,u)=>{calls.scrubs.push(u);save();replace(a,b,u)};window.ChampionLifeAuth={getSession:async()=>{calls.restore++;save();return window.__fixture==='missing'?null:{user:{id:'synthetic-signup-user'}}},client:{auth:{initialize:async()=>{calls.init++;save();await new Promise(r=>finish=r);return{error:window.__fixture==='init-error'?Error('synthetic-private-secret'):null}},onAuthStateChange:fn=>cb=fn,signInWithOtp:async()=>{calls.send++;save();return{}},verifyOtp:async()=>{calls.verify++;save();return{}}}}};window.__finishInit=()=>finish();save();`;
const cases=[['valid','',base],['missing','',base],['init-error','',base],['wrong-type','',base.replace('type=signup','type=recovery')],['duplicate','',base+'&type=signup'],['mixed-fragment','',base+'&type=email'],['mixed-query','&type=signup',base],['provider-error','',base+'&error_code=otp_expired&error_description=synthetic-private-secret']];
for(const[engine,options]of[[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});
 try{for(const width of[390,1440])for(const[mode,query,hash]of cases){
  const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage(),errors=[],unexpected=[];let destinations=0;
  page.on('pageerror',e=>errors.push(e.message));await ctx.addInitScript(value=>{window.__fixture=value},mode);
  await ctx.route('**/*',async route=>{const u=new URL(route.request().url());
   if(u.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'text/javascript',body:''});
   if(u.origin!==origin){unexpected.push(u.href);return route.abort()}
   if(u.pathname==='/assets/js/champion-life-auth.js')return route.fulfill({contentType:'text/javascript',body:synthetic});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'// No backend: controlled synthetic Auth fixture.'});
   if(u.pathname==='/outreach-team.html'){destinations++;return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic return</title><h1>Synthetic event destination — no real account</h1>'})}
   const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream',body:await readFile(file)})}catch{return route.fulfill({status:404,body:'Not found'})}
  });
  const tag=mode+' '+engine.name()+' '+width;await page.goto(origin+'/outreach-login.html?next='+encodeURIComponent(next)+query+hash);
  if(['valid','missing','init-error'].includes(mode)){
   ok(await page.evaluate(()=>window.__calls.init===1&&window.__calls.restore===0),'SDK initialization precedes signup session restore '+tag);
   await page.evaluate(()=>window.__authEvent());ok(new URL(page.url()).pathname==='/outreach-login.html'&&destinations===0,'early signup auth event cannot navigate before verification '+tag);
   await page.evaluate(()=>window.__finishInit());
  }
  if(mode==='valid'){
   await page.waitForURL(origin+next);const proof=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('__syntheticSignupProof')));
   ok(proof.init===1&&proof.restore===1&&proof.send===0&&proof.verify===0,'valid first confirmation uses only existing SDK restore '+tag);
   ok(destinations===1&&proof.scrubs.length===1&&proof.scrubs[0]==='/outreach-login.html?next='+encodeURIComponent(next),'signup credentials scrubbed before single exact event return '+tag);
  }else{
   await page.getByRole('status').filter({hasText:'expired, was already used'}).waitFor();await page.evaluate(()=>window.__authEvent());
   ok(destinations===0&&new URL(page.url()).pathname==='/outreach-login.html','failed/mixed signup never falls through to an older session '+tag);
   ok(!page.url().includes('#')&&!page.url().includes('synthetic-')&&!page.url().includes('&type='),'failed signup URL retains no tokens/provider errors/type ambiguity '+tag);
   ok(!(await page.locator('body').innerText()).includes('synthetic-private-secret'),'signup failure diagnostics stay redacted '+tag);
   ok(await page.evaluate(()=>window.__calls.send===0&&window.__calls.verify===0),'failed signup makes no second email/token verification '+tag);
   if(!['missing','init-error'].includes(mode))ok(await page.evaluate(()=>window.__calls.init===0&&window.__calls.restore===0),'wrong/mixed/provider-error callback rejected before SDK restore '+tag);
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'signup failure remains usable without horizontal overflow '+tag);
  }
  ok(errors.length===0&&unexpected.length===0,'no script errors or external/provider requests '+tag);await ctx.close();
 }}finally{await browser.close()}
}
console.log(n+' focused signup browser checks passed (intercepted synthetic Auth only)');
