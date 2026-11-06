// Actual shared-client module; isolated fictional provider responses only.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const source=await readFile(new URL('../outreach/shared-staff-backend.mjs',import.meta.url),'utf8');
const ORIGIN='https://assigned-partner.invalid';let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
for(const [engine,options] of [[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});
 try{for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();let external=0;
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==ORIGIN){external++;return route.abort();}return route.fulfill({body:u.pathname==='/backend.mjs'?source:'<main id="view"></main>',contentType:u.pathname.endsWith('.mjs')?'text/javascript':'text/html'});});
  const setup=async()=>{
   await page.goto(ORIGIN);
   await page.evaluate(async()=>{
    const {createSharedStaffBackend}=await import('/backend.mjs');const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
    window.f={user:id(1),token:'fictional',handlers:new Set(),calls:[],release:null,hold:false,deny:false,active:true,clear:0};
    const ref='abcdefghijklmnopqrst';
    const auth={getSession:async()=>({user:{id:f.user},access_token:f.token}),client:{supabaseUrl:`https://${ref}.supabase.co`,rest:{url:`https://${ref}.supabase.co/rest/v1`},auth:{url:`https://${ref}.supabase.co/auth/v1`,getUser:async()=>({data:{user:{id:f.user,email_confirmed_at:'2026-01-01'}}}),onAuthStateChange:fn=>{f.handlers.add(fn);return{data:{subscription:{unsubscribe:()=>f.handlers.delete(fn)}}}}},rpc:async(name,args)=>{f.calls.push({name,args});if(f.hold)await new Promise(r=>f.release=r);return f.deny?{error:{code:'42501'},status:403}:{data:[{id:id(8),campaignId:id(5),organizationId:id(2),partnerChurchId:id(7),personId:null,status:'active',revision:1,identityStatus:'unverified',secret:'PRIVATE'}]}}}};
    window.backend=createSharedStaffBackend({auth,workspace:{active:()=>f.active},eventTarget:window,projectRef:ref,onClear:()=>{f.clear++;document.querySelector('#view').replaceChildren()}});
    window.load=async()=>{const data=await backend.readAssignedPartnerMetadata({campaignId:id(5),assignmentId:id(8)});document.querySelector('#view').textContent=JSON.stringify(data);return data.length;};
   });
  };
  await setup();ok(await page.evaluate(()=>load())===1,engine.name()+width+' authorized same-client read');ok(!(await page.locator('#view').innerText()).includes('PRIVATE'),'extra sensitive fields excluded');
  for(const mode of ['denial','logout','account','token','campaign','pagehide','concurrent-denial']){
   await setup();await page.evaluate(()=>load());await page.evaluate(()=>{f.hold=true;window.detached=load;window.pending=load().then(()=>true,()=>false)});await page.waitForFunction(()=>!!f.release);
   await page.evaluate(async mode=>{
    if(mode==='denial')f.deny=true;
    if(mode==='logout')for(const fn of [...f.handlers])fn('SIGNED_OUT');
    if(mode==='account'){f.user='10000000-0000-4000-8000-000000000099';for(const fn of [...f.handlers])fn('SIGNED_IN');}
    if(mode==='token'){f.token='changed';for(const fn of [...f.handlers])fn('TOKEN_REFRESHED');}
    if(mode==='campaign'){f.active=false;dispatchEvent(new Event('staff-protected-clear'));}
    if(mode==='pagehide')dispatchEvent(new Event('pagehide'));
    if(mode==='concurrent-denial'){f.hold=false;f.deny=true;await load().catch(()=>{});f.deny=false;}
    f.release();
   },mode);
   ok(await page.evaluate(()=>pending)===false,mode+' stale read discarded');ok((await page.locator('#view').innerText())==='',mode+' protected view cleared');const count=await page.evaluate(()=>f.calls.length);await page.evaluate(()=>detached().catch(()=>{}));ok(await page.evaluate(()=>f.calls.length)===count,mode+' retained callback makes zero additional requests');
  }
  await setup();ok(await page.evaluate(()=>load())===1,'fresh independent authorized binding restores metadata');ok(await page.evaluate(()=>f.calls.every(c=>c.name==='partner_assigned_metadata'&&Object.keys(c.args).sort().join(',')==='p_assignment,p_campaign')),'only fixed backend read, no mutation');ok(external===0,'zero external HTTP');await context.close();
 }}finally{await browser.close();}
}
console.log(checks+' assigned Partner browser assertions PASS');
