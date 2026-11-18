// Browser/UI evidence uses intercepted local files and synthetic Auth only.
// Every request is intercepted; no SDK/provider/account/email operation occurs.
import {chromium,webkit} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),origin='https://outreach.local.test',evidence=process.env.EVIDENCE_DIR;let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
if(evidence)await mkdir(evidence,{recursive:true});
const synthetic=`window.__calls={send:[],verify:[]};window.ChampionLifeAuth={getSession:async()=>null,client:{auth:{initialize:async()=>({error:null}),onAuthStateChange:()=>{},signInWithOtp:async a=>{window.__calls.send.push(a);return{}},verifyOtp:async a=>{window.__calls.verify.push(a);return{data:{session:{user:{id:'synthetic-local-user'}}}}}}}};document.addEventListener('DOMContentLoaded',()=>{const label=document.createElement('div');label.textContent='SYNTHETIC LOCAL AUTH PREVIEW · NO EMAIL SENT';label.style.cssText='background:#fff2cc;color:#332600;text-align:center;padding:8px;font:700 12px/1.5 system-ui';document.body.prepend(label)});`;
for(const[engine,options]of[[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});
 try{for(const width of[320,390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:1000}}),page=await ctx.newPage(),errors=[],unexpected=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'text/javascript',body:''});
   if(u.origin!==origin){unexpected.push(u.href);return route.abort()}
   if(u.pathname==='/assets/js/champion-life-auth.js')return route.fulfill({contentType:'text/javascript',body:synthetic});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'// Synthetic browser test: no backend configuration.'});
   if(u.pathname==='/outreach.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic destination</title><h1>Synthetic return destination</h1>'});
   const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream',body:await readFile(file)})}catch{return route.fulfill({status:404,body:'Not found'})}
  });
  const tag=engine.name()+' '+width,shot=async state=>{if(evidence&&width!==320)await page.screenshot({path:path.join(evidence,'outreach-login-'+state+'-'+engine.name()+'-'+width+'.png'),fullPage:true})};
  await page.goto(origin+'/outreach-login.html');await page.locator('#sendCodeBtn:enabled').waitFor();
  ok(await page.getByRole('heading',{name:'Sign in to Outreach.',exact:true}).isVisible(),'branded Outreach heading '+tag);
  ok(await page.locator('.outreach-brand img').evaluate(i=>i.complete&&i.naturalWidth===1240),'original SOWGO logo loads '+tag);
  ok(!/discipleship|getting a grip/i.test(await page.locator('body').innerText()),'no unrelated course branding '+tag);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no initial horizontal overflow '+tag);
  await page.getByRole('link',{name:'Skip to sign in',exact:true}).focus();ok(await page.locator('.auth-skip').evaluate(e=>e.getBoundingClientRect().top>=0),'visible focused skip link '+tag);
  await page.getByRole('textbox',{name:'Email Address',exact:true}).focus();ok(await page.locator('#loginEmail').evaluate(e=>getComputedStyle(e).outlineStyle==='solid'),'keyboard input focus is visible '+tag);
  ok(await page.locator('#sendCodeBtn').evaluate(e=>e.getBoundingClientRect().height>=44),'sign-in touch target is at least44px '+tag);
  await page.locator('#loginEmail').blur();await shot('email');
  await page.getByRole('textbox',{name:'Email Address',exact:true}).fill('synthetic@example.test');await page.locator('#loginEmail').press('Enter');await page.locator('#codeStep.active').waitFor();
  ok(await page.locator('#loginCode').evaluate(e=>document.activeElement===e),'email Enter opens and focuses code entry '+tag);
  ok(await page.evaluate(()=>window.__calls.send.length===1&&window.__calls.send[0].options.emailRedirectTo===location.origin+'/outreach-login.html?next=%2Foutreach.html'),'synthetic request retains branded callback and Outreach fallback '+tag);
  await page.getByRole('textbox',{name:'Sign-In Code',exact:true}).fill('12345');await page.getByRole('button',{name:'Sign In',exact:true}).click();
  ok(await page.evaluate(()=>window.__calls.verify.length===0),'invalid code never reaches synthetic verifier '+tag);
  ok(await page.getByRole('status').textContent()==='Enter the 6- or 8-digit code from your email.','accessible code validation '+tag);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no OTP horizontal overflow '+tag);await shot('code');
  await page.getByRole('button',{name:'Use a Different Email',exact:true}).click();ok(await page.locator('#emailStep.active').isVisible()&&await page.locator('#loginCode').inputValue()==='','change-email clears previous code '+tag);
  await page.goto(origin+'/outreach-login.html?next=%2Foutreach.html#access_token=synthetic-access&refresh_token=synthetic-refresh&type=magiclink&error_code=otp_expired&error_description=synthetic-secret');
  await page.getByRole('status').filter({hasText:'expired, was already used'}).waitFor();
  ok(!page.url().includes('#')&&!page.url().includes('synthetic-'),'failed callback scrubs all synthetic URL credentials '+tag);
  ok(!(await page.locator('body').innerText()).includes('synthetic-secret'),'callback diagnostics never expose provider secret text '+tag);
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'expired-link state fits viewport '+tag);await shot('expired');
  await page.getByRole('textbox',{name:'Email Address',exact:true}).fill('synthetic@example.test');await page.getByRole('button',{name:'Send My Sign-In Code',exact:true}).click();await page.getByRole('textbox',{name:'Sign-In Code',exact:true}).fill('12345678');await page.locator('#loginCode').press('Enter');await page.waitForURL(origin+'/outreach.html');
  ok(await page.getByRole('heading',{name:'Synthetic return destination',exact:true}).isVisible(),'valid8-digit synthetic OTP preserves callback-failure recovery '+tag);
  ok(errors.length===0&&unexpected.length===0,'no browser script errors or external/provider traffic '+tag);
  await ctx.close();
 }}finally{await browser.close()}
}
console.log(n+' Outreach login browser checks passed (synthetic intercepted Auth only)');
