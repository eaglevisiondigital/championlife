// Real pinned SDK and browser; ALL network is intercepted. No provider acceptance claim.
// PDF bytes stay private; PDF.js is controllably stubbed to prove cancellation/late painting.
import {chromium,webkit} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const origin='https://reader-session.local.test',backend='https://synthetic-auth.supabase.co',key='sb-synthetic-auth-auth-token';
const hash='417f9faa7ff3945fdf4ff62931a233739856d03221c8429e21b768b221b94a54';
if(!process.env.TEST_PDF_ZIP)throw Error('Private approved PDF ZIP required');
const pdf=execFileSync('python3',['-c','import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("King_Kind_Approved_Personal_Use.pdf"))',process.env.TEST_PDF_ZIP],{maxBuffer:30000000});
assert.equal(createHash('sha256').update(pdf).digest('hex'),hash);
const users=Object.fromEntries(['A','B','C'].map((n,i)=>[n,{id:`${String(i+1).repeat(8)}-aaaa-4aaa-8aaa-${String(i+1).repeat(12)}`,email:`${n.toLowerCase()}@example.test`,email_confirmed_at:'2026-01-01',aud:'authenticated',role:'authenticated',is_anonymous:false}]));
const session=(who='A')=>{const user=users[who],exp=Math.floor(Date.now()/1000)+3600;return {user,expires_at:exp,expires_in:3600,token_type:'bearer',refresh_token:'fictional-'+who,access_token:[{alg:'HS256',typ:'JWT'},{sub:user.id,exp,aud:'authenticated',role:'authenticated'},'fictional-signature'].map((p,i)=>Buffer.from(i===2?p:JSON.stringify(p)).toString('base64url')).join('.')}};
const actor=req=>{try{return JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub}catch{return null}};
const renderer=`export const GlobalWorkerOptions={};
export function getDocument(){
 const g=window.__pdfProbe||(window.__pdfProbe={cancelled:0,destroyed:0,renders:0,loads:0});g.loads++;
 const doc={numPages:83,destroy:async()=>{g.destroyed++},getPage:async()=>({getViewport:({scale})=>({width:612*scale,height:792*scale}),render:({canvasContext})=>{
  g.renders++;let finish;const promise=new Promise(resolve=>finish=()=>{canvasContext.fillStyle='#9b1234';canvasContext.fillRect(0,0,10,10);resolve()});
  if(window.__holdRender)window.__releaseRender=finish;else finish();
  return {promise,cancel:()=>{g.cancelled++}}; // Deliberately ignore cancellation: late work must still be harmless.
 }})};
 let resolve;const promise=new Promise(r=>resolve=()=>r(doc));
 if(window.__holdDocument)window.__releaseDocument=resolve;else resolve();
 return {promise,destroy:async()=>{g.destroyed++}};
}`;
let checks=0;const results=[];
const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const [engine,launch] of [[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...launch});
 try{for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
  let deny=new Set([users.C.id]),authFail=false,hold=null,release=null,pending=false,signs=[],unexpected=[],downloads=0,consoleErrors=[];
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin===backend){
    if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
    let kind=u.pathname==='/auth/v1/user'?'user':u.pathname.startsWith('/storage/v1/object/sign/')?(req.method()==='POST'?'sign':'bytes'):null;
    if(kind&&hold===kind){hold=null;pending=true;await new Promise(r=>release=r);pending=false}
    try{
     if(kind==='user')return authFail?route.fulfill({status:403,json:{msg:'Synthetic authorization failed',error_code:'bad_jwt'}}):route.fulfill({json:Object.values(users).find(u=>u.id===actor(req))});
     if(kind==='sign'){const id=actor(req);signs.push(id);return deny.has(id)?route.fulfill({status:403,json:{message:'Denied',statusCode:'403',error:'Unauthorized'}}):route.fulfill({json:{signedURL:'/object/sign/king-kind-books/king-kind/king-kind-english.pdf?token=fictional'}})}
     if(kind==='bytes')return route.fulfill({body:pdf,contentType:'application/pdf'});
    }catch(e){if(req.failure())return;throw e}
    unexpected.push(req.method()+u.pathname);return route.abort();
   }
   if(u.href==='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs')return route.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:renderer});
   // No external requests are allowed to leave this synthetic context.
   if(u.origin!==origin)return route.fulfill({status:200,body:''});
   if(u.pathname==='/session-control.html')return route.fulfill({contentType:'text/html',body:'<script src="/assets/vendor/supabase-js-2.118.0.js"></script><script src="/assets/js/supabase-config.js"></script><script src="/assets/js/champion-life-auth.js"></script>'});
   if(u.pathname==='/neutral.html')return route.fulfill({contentType:'text/html',body:'<title>Neutral local test</title>'});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'synthetic-only'})});
   const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root+path.sep))return route.abort();
   try{return await route.fulfill({body:await readFile(f),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[path.extname(f)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}
  });
  const page=await context.newPage();await page.clock.install();page.on('download',()=>downloads++);page.on('pageerror',e=>consoleErrors.push(e.message));
  await page.goto(origin+'/neutral.html');await page.evaluate(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s:session()});
  const ready=async(p=page)=>{await p.waitForFunction(()=>!document.querySelector('#book-license-ack').disabled,{},{timeout:10000});ok(await p.locator('#download-book').isDisabled(),'new authorization requires fresh acknowledgment');ok(await p.locator('#page-wrap').isVisible(),'authorized book is visible')};
  const locked=async(label)=>{
   await page.waitForFunction(()=>document.querySelector('#download-book').disabled&&document.querySelector('#page-wrap').hidden);
   const v=await page.evaluate(()=>({disabled:document.querySelector('#download-book').disabled,ack:document.querySelector('#book-license-ack').checked,ackDisabled:document.querySelector('#book-license-ack').disabled,width:document.querySelector('#page-canvas').width,height:document.querySelector('#page-canvas').height,controls:document.querySelector('#book-controls').classList.contains('hidden'),mobile:document.querySelector('.mobile-page-controls').hidden}));
   ok(v.disabled&&!v.ack&&v.ackDisabled&&v.width===0&&v.height===0&&v.controls&&v.mobile,label+' clears PDF UI, controls and acknowledgment');
   const before=downloads;await page.evaluate(()=>document.querySelector('#download-book').dispatchEvent(new MouseEvent('click',{bubbles:true})));await page.waitForTimeout(30);ok(downloads===before,label+' synthetic click cannot download');
  };
  const set=async(who,p=page)=>p.evaluate(async s=>{const r=await ChampionLifeAuth.client.auth.setSession(s);if(r.error)throw r.error},session(who));
  const open=async()=>{await page.goto(origin+'/king-kind-reader.html');await ready()};
  await open();await page.locator('#book-license-ack').check();
  // Same-tab SDK callback runs under lock. Completion here proves no callback deadlock.
  await page.evaluate(()=>ChampionLifeAuth.client.auth.signOut({scope:'local'}));await locked('same-tab logout');
  await set('B');await ready();ok(signs.includes(users.B.id),'independently eligible B passes its own Storage check');
  await page.locator('#book-license-ack').check();const dl=page.waitForEvent('download');await page.locator('#download-book').click();ok(createHash('sha256').update(await readFile(await(await dl).path())).digest('hex')===hash,'reauthorized B personal-use bytes exact');
  await set('C');await locked('ineligible C switch');await page.waitForTimeout(150);ok(signs.includes(users.C.id),'ineligible C evaluated against its own Storage permission');
  await set('A');await ready();
  // Actual cross-tab SDK sign-out and broadcast/storage notifications.
  const other=await context.newPage();await other.goto(origin+'/session-control.html');await other.waitForFunction(()=>!!window.ChampionLifeAuth);
  await other.evaluate(()=>ChampionLifeAuth.client.auth.signOut({scope:'local'}));await locked('cross-tab logout');
  await set('B',other);await ready();await other.close();
  // A persisted identity change before Auth notification must block an immediate click.
  await page.locator('#book-license-ack').check();const beforeSync=downloads;
  await page.evaluate(({key,s})=>{localStorage.setItem(key,JSON.stringify(s));document.querySelector('#download-book').click()},{key,s:session('C')});await locked('persisted switch before callback');ok(downloads===beforeSync,'no transient download before callback');
  await set('A');await ready();
  // Concurrent download authorization and user switch: late response cannot release A bytes.
  await page.locator('#book-license-ack').check();hold='sign';release=null;const beforePending=downloads;await page.locator('#download-book').click();
  for(let i=0;i<100&&!pending;i++)await page.waitForTimeout(10);ok(pending,'download verification request held');
  await set('C');await locked('switch during download authorization');release();await page.waitForTimeout(150);ok(downloads===beforePending,'late download authorization cannot emit download');
  // Initial PDF fetch in flight then logout; network cancellation or ignored completion.
  await set('A');await ready();hold='bytes';release=null;await page.reload({waitUntil:'domcontentloaded'});
  for(let i=0;i<200&&!pending;i++)await page.waitForTimeout(10);ok(pending,'PDF bytes request held');
  await page.evaluate(()=>ChampionLifeAuth.client.auth.signOut({scope:'local'}));await locked('logout during PDF fetch');release();await page.waitForTimeout(150);await locked('late PDF fetch');
  // Delayed document creation ignores destroy; stale result must remain inaccessible.
  await page.evaluate(()=>window.__holdDocument=true);await set('A');await page.waitForFunction(()=>!!window.__releaseDocument);
  await page.evaluate(()=>ChampionLifeAuth.client.auth.signOut({scope:'local'}));await locked('logout during document load');
  await page.evaluate(()=>{window.__holdDocument=false;window.__releaseDocument()});await page.waitForTimeout(80);await locked('late document resolution');ok(await page.evaluate(()=>__pdfProbe.destroyed>0),'document destruction requested');
  await set('B');await ready();
  // Delayed renderer deliberately paints after cancel; only detached canvas may change.
  await page.evaluate(()=>window.__holdRender=true);await page.locator(width===390?'#mobile-next':'#next-page').click();await page.waitForFunction(()=>!!window.__releaseRender);
  await page.evaluate(()=>ChampionLifeAuth.client.auth.signOut({scope:'local'}));await locked('logout during render');
  await page.evaluate(()=>{window.__holdRender=false;window.__releaseRender()});await page.waitForTimeout(80);await locked('late cancelled render');ok(await page.evaluate(()=>__pdfProbe.cancelled>0),'render cancellation requested');
  // A stale renderer must not repaint or clear an independently authorized B document.
  await set('A');await ready();await page.evaluate(()=>{window.__releaseRender=null;window.__holdRender=true});
  await page.locator(width===390?'#mobile-next':'#next-page').click();await page.waitForFunction(()=>!!window.__releaseRender);
  await page.evaluate(()=>{window.__oldRender=window.__releaseRender;window.__holdRender=false});
  await set('B');await ready();const bPixels=await page.locator('#page-canvas').evaluate(c=>c.toDataURL());
  await page.evaluate(()=>window.__oldRender());await page.waitForTimeout(80);
  ok(await page.locator('#page-canvas').evaluate(c=>c.toDataURL())===bPixels,'late A renderer cannot repaint B');ok(await page.locator('#book-license-ack').isEnabled(),'late A renderer cannot clear B');
  await set('A');await ready();
  // Provider denies current user on download: hide the previously open book.
  authFail=true;await page.locator('#book-license-ack').check();await page.locator('#download-book').click();await locked('provider auth failure');authFail=false;
  await set('A');await ready();deny.add(users.A.id);await page.locator('#book-license-ack').check();await page.locator('#download-book').click();await locked('eligibility revoked');deny.delete(users.A.id);
  await set('B');await ready();
  // Pagehide snapshot is cleared synchronously; persisted pageshow freshly checks Storage.
  const beforeRestore=signs.length;
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await locked('pagehide');
  await set('A');await page.waitForTimeout(80);await locked('hidden history snapshot after Auth event');
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await ready();ok(signs.length>beforeRestore,'history restoration reauthorizes');
  // A timed-out verification must never revive a download when its response arrives.
  await page.locator('#book-license-ack').check();hold='sign';release=null;const beforeTimeout=downloads;await page.locator('#download-book').click();
  for(let i=0;i<100&&!pending;i++)await page.waitForTimeout(10);ok(pending,'download timeout fixture held');
  await page.clock.fastForward(15001);await locked('download verification timeout');release();await page.waitForTimeout(100);ok(downloads===beforeTimeout,'late timeout response cannot download');
  await set('B');await ready();
  // Expiry while the tab is alive, without changing SDK identity or waiting a real hour.
  await page.clock.fastForward(900001);await locked('session/lease expiration');await page.clock.resume();
  ok(unexpected.length===0,'no unexpected provider endpoints: '+JSON.stringify(unexpected));ok(consoleErrors.length===0,'no unhandled browser exceptions');
  results.push({engine:engine.name(),width,status:'PASS',checks,downloads,signRequests:signs.length});await context.close();
 }}finally{await browser.close()}
}
const result={checks,status:'PASS',results,realProvider:false,renderer:'controlled stub; cancellation deliberately ignored',approvedPDFHash:hash};
if(process.env.TEST_RESULT_PATH)await writeFile(process.env.TEST_RESULT_PATH,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
