// Real vendored SDK in actual browsers; all provider traffic intercepted, fictional identities only.
import{chromium,webkit}from'playwright';import{readFile,mkdir}from'node:fs/promises';import{fileURLToPath}from'node:url';import path from'node:path';import assert from'node:assert/strict';import{verifySupabaseSDK}from'../site-build/verify-supabase-sdk.mjs';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),origin='https://notes.local.test',backend='https://synthetic-auth.supabase.co',storage='sb-synthetic-auth-auth-token';
await verifySupabaseSDK(root,JSON.parse(await readFile(path.join(root,'tools/site-build/public-files.json'),'utf8')));
const A={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test',email_confirmed_at:'2026-01-01',aud:'authenticated',role:'authenticated',is_anonymous:false},B={...A,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'b@example.test'};
const session=u=>{const exp=Math.floor(Date.now()/1000)+3600;return{user:u,expires_at:exp,expires_in:3600,token_type:'bearer',refresh_token:'fictional-'+u.id,access_token:[{alg:'HS256',typ:'JWT'},{sub:u.id,exp,aud:'authenticated',role:'authenticated'},'fake-no-authority'].map((p,i)=>Buffer.from(i===2?p:JSON.stringify(p)).toString('base64url')).join('.')}};
let count=0;const ok=(v,m)=>{assert.ok(v,m);count++};const evidence=process.env.EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});
for(const[engine,options]of[[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});try{for(const width of[390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900}});let denied=false,tamper=false,mutations=0,unexpected=[];
  await ctx.route('**/*',async r=>{const req=r.request(),u=new URL(req.url());
   if(u.origin===backend){if(u.pathname==='/auth/v1/user'&&req.method()==='GET'){
    let actor;try{actor=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url').toString()).sub}catch{}
    if(denied||![A.id,B.id].includes(actor))return r.fulfill({status:401,json:{message:'Synthetic session denied',error_code:'bad_jwt'}});return r.fulfill({json:actor===A.id?A:B});
   }if(u.pathname==='/auth/v1/logout')return r.fulfill({status:204,body:''});unexpected.push(u.pathname);return r.abort()}
   if(u.origin!==origin){return r.fulfill({status:200,body:''})} // Static external video/font assets never leave test harness.
   if(req.method()!=='GET'){mutations++;return r.abort()}
   if(u.pathname==='/assets/js/supabase-config.js')return r.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'synthetic-only'}),contentType:'text/javascript'});
   if(tamper&&u.pathname.includes('assets/vendor/supabase-js'))return r.fulfill({body:'window.POISON=true;',contentType:'text/javascript'});
   const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root+path.sep))return r.abort();try{await r.fulfill({body:await readFile(f),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'}[path.extname(f)]||'application/octet-stream'})}catch{await r.fulfill({status:404,body:''})}
  });
  const page=await ctx.newPage();await page.goto(origin+'/index.html');await page.evaluate(({storage,s})=>{localStorage.setItem(storage,JSON.stringify(s));localStorage.setItem('old-unowned-lesson-note','DO NOT IMPORT')},{storage,s:session(A)});
  const sign=async(p,u)=>{await p.evaluate(async s=>{const r=await ChampionLifeAuth.client.auth.setSession(s);if(r.error)throw r.error},session(u))};
  for(let n=5;n<=13;n++){
   await page.goto(origin+`/getting-a-grip-${n}.html`);const field=page.locator('.note-box');await page.waitForFunction(()=>!document.querySelector('.note-box').disabled);
   ok(await field.inputValue()==='','legacy unowned note not restored');await field.fill(`A PRIVATE ${n}`);
   await sign(page,B);await page.waitForFunction(()=>!document.querySelector('.note-box').disabled&&document.querySelector('[data-grip-notes-status]').textContent.includes('b@example.test'));ok(await field.inputValue()==='','B never sees A notes');await field.fill(`B PRIVATE ${n}`);
   await sign(page,A);await page.waitForFunction(n=>document.querySelector('.note-box').value===`A PRIVATE ${n}`,n);ok(true,'A→B→A correct note');await page.reload();await page.waitForFunction(n=>document.querySelector('.note-box').value===`A PRIVATE ${n}`,n);ok(true,'reload retains only verified A');
   const cleared=await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));return document.querySelector('.note-box').value===''&&document.querySelector('.note-box').disabled});ok(cleared,'history snapshot clears');await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.waitForFunction(n=>document.querySelector('.note-box').value===`A PRIVATE ${n}`,n);
   await page.evaluate(async()=>ChampionLifeAuth.client.auth.signOut({scope:'local'}));await page.waitForFunction(()=>document.querySelector('.note-box').disabled);ok(await field.inputValue()==='','actual SDK logout clears note');await page.reload();ok(await field.inputValue()===''&&await field.isDisabled(),'anonymous reload blocked');await sign(page,A);await page.waitForFunction(n=>document.querySelector('.note-box').value===`A PRIVATE ${n}`,n);
  }
  // A second SDK client changes the shared-origin identity; first tab must not retain A.
  const other=await ctx.newPage();await other.goto(origin+'/getting-a-grip-13.html');await other.waitForFunction(()=>!document.querySelector('.note-box').disabled);await sign(other,B);
  await page.waitForFunction(()=>document.querySelector('.note-box').value==='B PRIVATE 13');ok(true,'cross-tab SDK broadcast restores B only');await sign(other,A);await page.waitForFunction(()=>document.querySelector('.note-box').value==='A PRIVATE 13');await other.close();
  if(evidence)await page.screenshot({path:path.join(evidence,`private-notes-${engine.name()}-${width}.png`),fullPage:true});
  denied=true;await page.reload();await page.waitForTimeout(150);ok(await page.locator('.note-box').isDisabled()&&await page.locator('.note-box').inputValue()==='','provider rejection fails closed');denied=false;tamper=true;await page.reload();await page.waitForTimeout(150);ok(await page.evaluate(()=>!window.POISON&&!window.supabase)&&await page.locator('.note-box').isDisabled(),'browser SRI rejects tampered SDK and notes stay locked');
  ok(mutations===0&&unexpected.length===0,'no notes cloud writes, sends or unhandled provider calls');await ctx.close();
 }}finally{await browser.close()}
}
console.log(`${count} real-SDK Chrome/WebKit notes/SRI assertions passed with fictional intercepted Auth; genuine provider UNTESTED.`);
