// Actual Chrome/WebKit browser mounting against frozen PR61 staff-home.html.
// All network is intercepted: fictional Auth/RPC responses and local source only.
// No Supabase or Netlify project, live user, API key, real email or external fetch.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';

const ROOT=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const ORIGIN='https://champion-staff-review.invalid';
const A='10000000-0000-4000-8000-000000000001';
const B='20000000-0000-4000-8000-000000000002';
const USER='30000000-0000-4000-8000-000000000003';
const COUNTS={households:2,adults:3,minors:2,attendees:5,checked_in:1};
const EVIDENCE=process.env.LANE_A_EVIDENCE_DIR;
if(EVIDENCE)await mkdir(EVIDENCE,{recursive:true});
let passes=0;
const check=(test,description)=>{assert.ok(test,description);passes++;console.log('PASS '+description)};

const authFixture=`
window.fixture={
  userId:'${USER}',verified:true,anonymous:false,revoked:false,
  pending:null,release:null,requestLog:[],listeners:new Set(),activeToken:'fictional-a',
  checkedIn:1,changeSession:false,unexpected:[],allowB:false,denyAfterList:false,
  emit(event){for(const fn of [...this.listeners])fn(event,{user:this.user()})},
  user(){return{id:this.userId,email:'test@fixture.invalid',email_confirmed_at:this.verified?'2026-01-01T00:00:00Z':null,is_anonymous:this.anonymous}},
  async rpc(name,params){
    this.requestLog.push({name,action:params.p_action,campaign:params.p_campaign});
    if(name==='staff_workspace_context')return{data:{organizations:[],grants:[]}};
    if(name!=='outreach_registration_workspace')throw Error('Unexpected RPC');
    if(params.p_action==='campaigns')return{data:[
      {id:'${A}',name:'Synthetic Huntsville'},{id:'${B}',name:'Synthetic Other City'}]};
    if(this.pending===params.p_action){
      this.pending=null;await new Promise(resolve=>this.release=resolve);
    }
    if(this.revoked || (!this.allowB&&params.p_campaign==='${B}'))
      return{error:{code:'42501',message:'Synthetic denied'},status:403};
    if(params.p_action==='context')return{data:{capabilities:['registration.view']}};
    if(params.p_action==='list'){
      if(this.denyAfterList)this.revoked=true;
      return{data:{
      summary:{households:2,adults:3,minors:2,attendees:5,checked_in:params.p_campaign==='${B}'?4:this.checkedIn},
      registrations:[{name:'SECRET PERSON',email:'person@private.invalid'}],
      donor:'SECRET PAYMENT ACCOUNT'
    }};}
    throw Error('Unexpected action');
  }
};
window.ChampionLifeAuth={
 getSession:async()=>fixture.changeSession?{user:{id:'40000000-0000-4000-8000-000000000004'},access_token:'new-fixture'}:{user:fixture.user(),access_token:fixture.activeToken},
 getUser:async()=>fixture.user(),
 client:{
  auth:{
    getUser:async()=>({data:{user:fixture.user()},error:null}),
    onAuthStateChange:fn=>{fixture.listeners.add(fn);return{data:{subscription:{unsubscribe:()=>fixture.listeners.delete(fn)}}}},
    signOut:async()=>{fixture.emit('SIGNED_OUT');return{error:null}}
  },
  rpc:(...args)=>fixture.rpc(...args)
 }
};
`;

const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
for(const [engine,settings] of [[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...settings});
 try{
  for(const width of [390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),unexpected=[],jsErrors=[];
   page.on('pageerror',e=>jsErrors.push(e.message));
   const browserLog=[];page.on('console',msg=>browserLog.push(msg.text()));
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='cdn.jsdelivr.net')
     return route.fulfill({body:'window.supabase={createClient:()=>({})};',contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
    if(url.origin!==ORIGIN||route.request().method()!=='GET'){
     unexpected.push(route.request().method()+' '+url.origin+url.pathname);return route.abort();
    }
    if(url.pathname==='/assets/js/champion-life-auth.js')
     return route.fulfill({body:authFixture,contentType:'text/javascript'});
    if(url.pathname==='/assets/js/supabase-config.js')
     return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE={url:"https://synthetic.invalid",publishableKey:"fixture-only"};',contentType:'text/javascript'});
    if(url.pathname==='/favicon.ico')return route.fulfill({status:404,body:''});
    const file=path.resolve(ROOT,'.'+url.pathname);
    if(!file.startsWith(ROOT+path.sep))return route.abort();
    try{return route.fulfill({body:await readFile(file),contentType:types[path.extname(file)]||'application/octet-stream'})}
    catch{return route.fulfill({status:404,body:'Missing fixture'})}
   });

   const login=async(query='?context=outreach')=>{
    await page.goto(ORIGIN+'/staff-home.html'+query);
    await page.waitForFunction(()=>window.StaffWorkspace?.active());
   };
   const mount=async()=>{
    return page.evaluate(async()=>{
     const root=document.createElement('section');
     root.id='outreach-summary-preview';
     document.querySelector('#staff-main').append(root);
     const {mountSummaryInVerifiedStaffWorkspace}=await import('/tools/outreach/church-outreach-summary-staff-mount.mjs');
     window.preview=await mountSummaryInVerifiedStaffWorkspace({window,root});
     return [...root.querySelectorAll('[data-summary-metric]')].map(x=>x.textContent);
    });
   };

   await login();
   check((await mount()).join(',')==='2,3,2,5,1',engine.name()+' '+width+' genuine browser mounts summary on verified PR61 shell');
   check(await page.locator('[data-summary-metric]').count()===5,engine.name()+' '+width+' renders exactly five aggregate counts');
   check(!/SECRET PERSON|person@private.invalid|SECRET PAYMENT ACCOUNT/.test(await page.locator('body').textContent()),engine.name()+' '+width+' private rows/finances never enter DOM');
   check((await page.evaluate(()=>fixture.requestLog.filter(x=>x.action==='context'||x.action==='list').map(x=>x.action))).join(',')==='context,list,context',engine.name()+' '+width+' original caller-scoped RPC reauthorization sequence');
   check(await page.locator('#outreach-summary-preview button').isEnabled(),engine.name()+' '+width+' authorized refresh enabled');
   const a11y=await page.evaluate(()=>{
     const section=document.querySelector('#outreach-summary-preview section');
     const status=section?.querySelector('[role="status"]');
     const dl=section?.querySelector('dl');
     const credit=document.querySelector('#staff-sidebar .staff-propel-credit');
     const img=credit?.querySelector('img');
     return {label:section?.getAttribute('aria-label'),role:status?.getAttribute('aria-live'),
       status:status?.textContent,totalsVisible:!dl?.hidden,
       propelHref:credit?.getAttribute('href'),propelLogoLoaded:!!(img?.complete&&img?.naturalWidth),
       propelAlt:img?.getAttribute('alt')};
   });
   check(a11y.label==='Campaign registration summary'&&a11y.role==='polite'&&
     a11y.status==='Authorized campaign totals'&&a11y.totalsVisible,
     engine.name()+' '+width+' accessible named summary, live status and visible totals');
   check(a11y.propelHref==='https://kingdompropel.com/'&&a11y.propelLogoLoaded&&
     a11y.propelAlt==='Propel by Eagle Vision',
     engine.name()+' '+width+' original Powered by Propel brand/link/logo preserved');
   if(width<1024){
     await page.locator('#staff-menu').focus();
     await page.keyboard.press('Enter');
     check(await page.locator('#staff-menu').getAttribute('aria-expanded')==='true',
       engine.name()+' '+width+' keyboard opens staff drawer');
   }
   const geometry=await page.locator('#staff-sidebar .staff-propel-credit img').evaluate(img=>{
     const r=img.getBoundingClientRect(),parent=img.closest('aside').getBoundingClientRect();
     return {within:r.left>=parent.left&&r.right<=parent.right&&r.top>=parent.top&&r.bottom<=parent.bottom,
       positive:r.width>0&&r.height>0,ratio:r.width/r.height,natural:img.naturalWidth/img.naturalHeight,
       overflow:document.documentElement.scrollWidth>window.innerWidth};
   });
   check(geometry.within&&geometry.positive&&Math.abs(geometry.ratio/geometry.natural-1)<.03,
     engine.name()+' '+width+' official logo fits sidebar without distortion or clipping');
   check(!geometry.overflow,engine.name()+' '+width+' document has no horizontal overflow');
   if(EVIDENCE)await page.screenshot({path:path.join(EVIDENCE,engine.name()+'-'+width+'-authorized.png'),fullPage:true});
   if(width<1024){
     await page.keyboard.press('Escape');
     check(await page.locator('#staff-menu').getAttribute('aria-expanded')==='false'&&
       await page.locator('#staff-menu').evaluate(el=>document.activeElement===el),
       engine.name()+' '+width+' Escape closes drawer and returns keyboard focus');
   }
   if(EVIDENCE)await page.screenshot({path:path.join(EVIDENCE,engine.name()+'-'+width+'-summary.png'),fullPage:true});
   const refreshButton=page.locator('#outreach-summary-preview button');
   await refreshButton.focus();
   check(await refreshButton.evaluate(e=>document.activeElement===e),
     engine.name()+' '+width+' keyboard focus reaches Refresh');
   const beforeKeyboard=await page.evaluate(()=>fixture.requestLog.filter(x=>x.action==='list').length);
   await refreshButton.press('Enter');
   await page.waitForFunction(n=>fixture.requestLog.filter(x=>x.action==='list').length>n,beforeKeyboard);
   await page.waitForFunction(()=>document.querySelectorAll('#outreach-summary-preview [data-summary-metric]').length===5);
   check(await page.locator('[data-summary-metric]').count()===5,
     engine.name()+' '+width+' Enter refresh preserves only authorized counts');
   await page.evaluate(()=>{fixture.revoked=true});
   await page.locator('#outreach-summary-preview button').click();
   await page.waitForFunction(()=>document.querySelectorAll('[data-summary-metric]').length===0);
   check(await page.locator('[data-summary-metric]').count()===0,engine.name()+' '+width+' server revocation removes visible totals');

   await login();
   await mount();
   check(await page.locator('[data-summary-metric]').count()===5,engine.name()+' '+width+' fresh navigation revalidates a new synthetic session');
   await page.evaluate(()=>fixture.emit('SIGNED_OUT'));
   await page.waitForFunction(()=>!window.StaffWorkspace?.active());
   // The original staff-session script also redirects asynchronously on signout.
   await page.waitForURL('**/discipleship-login.html*');
   check(await page.locator('[data-summary-metric]').count()===0,engine.name()+' '+width+' signout clears protected DOM');
   check(await page.locator('#outreach-summary-preview').count()===0,engine.name()+' '+width+' protected-clear removes mounted view');

   await login('?context=outreach&campaign='+B);
   let denied=false;try{await mount()}catch{denied=true}
   check(denied && await page.locator('[data-summary-metric]').count()===0,engine.name()+' '+width+' other city denied despite campaign listed in UI');

   await login();
   await mount();
   await page.evaluate(()=>fixture.emit('TOKEN_REFRESHED'));
   check(await page.locator('[data-summary-metric]').count()===0,engine.name()+' '+width+' token refresh synchronously invalidates displayed counts');
   check(await page.locator('#outreach-summary-preview button').isDisabled(),engine.name()+' '+width+' refresh disabled after Auth invalidation');

   for(const invalidity of ['unconfirmed','anonymous','wrong-session']){
     await login();
     await mount();
     const prior=await page.evaluate(()=>fixture.requestLog.length);
     await page.evaluate(mode=>{
       if(mode==='unconfirmed')fixture.verified=false;
       if(mode==='anonymous')fixture.anonymous=true;
       if(mode==='wrong-session')fixture.changeSession=true;
     },invalidity);
     await page.locator('#outreach-summary-preview button').click();
     await page.waitForFunction(()=>document.querySelectorAll('[data-summary-metric]').length===0);
     check(await page.locator('#outreach-summary-preview button').isDisabled(),
       engine.name()+' '+width+' '+invalidity+' auth failure clears and disables summary');
     check((await page.evaluate(()=>fixture.requestLog.length))===prior,
       engine.name()+' '+width+' '+invalidity+' is rejected before campaign RPC');
   }

   // A pending provider response is not authorization after token invalidation.
   // The old request is released deliberately AFTER the synchronous clear.
   await login();
   await mount();
   await page.evaluate(()=>{fixture.pending='list'});
   await page.locator('#outreach-summary-preview button').click();
   await page.waitForFunction(()=>typeof fixture.release==='function');
   await page.evaluate(()=>{fixture.emit('TOKEN_REFRESHED');fixture.release()});
   check(await page.locator('[data-summary-metric]').count()===0,
     engine.name()+' '+width+' pending list cannot repaint after token refresh');
   check(await page.locator('#outreach-summary-preview button').isDisabled(),
     engine.name()+' '+width+' pending request remains disabled after scope invalidation');

   // The same renderer's in-page selection API is exercised independently of
   // the shell's full-document navigation: overlap A and B on one real DOM.
   await login();
   await page.evaluate(async campaign=>{
     fixture.allowB=true;
     const root=document.createElement('section');root.id='outreach-summary-preview';
     document.querySelector('#staff-main').append(root);
     const {mountChurchOutreachSummaryView}=await import('/tools/outreach/church-outreach-summary-view.mjs');
     window.raceView=mountChurchOutreachSummaryView({root,auth:ChampionLifeAuth,
       workspace:StaffWorkspace,eventTarget:window,getAllowedCampaigns:()=>[campaign,
       '20000000-0000-4000-8000-000000000002']});
     raceView.select(campaign);await raceView.refresh();
     fixture.pending='list';window.oldRefresh=raceView.refresh().then(()=>false,()=>true);
   },A);
   await page.waitForFunction(()=>typeof fixture.release==='function');
   await page.evaluate(async campaign=>{raceView.select(campaign);await raceView.refresh()},B);
   check((await page.locator('[data-summary-metric]').allTextContents()).join(',')==='2,3,2,5,4',
     engine.name()+' '+width+' B renders independently while A list is held');
   const staleRejected=await page.evaluate(async()=>{fixture.release();return await oldRefresh});
   check(staleRejected&&(await page.locator('[data-summary-metric]').allTextContents()).join(',')==='2,3,2,5,4',
     engine.name()+' '+width+' late A rejects and cannot replace B totals');
   await page.evaluate(async campaign=>{raceView.select(campaign);await raceView.refresh()},A);
   check((await page.locator('[data-summary-metric]').allTextContents()).join(',')==='2,3,2,5,1',
     engine.name()+' '+width+' A to B to A requires and passes fresh authorization');

   for(const mode of ['account-change','token-change','server-denial']){
     await login();await mount();
     await page.evaluate(()=>{
       fixture.pending='list';window.detachedButton=document.querySelector('#outreach-summary-preview button');
       window.detachedRefresh=preview.refresh;
       window.heldRefresh=preview.refresh().then(()=>false,()=>true);
     });
     await page.waitForFunction(()=>typeof fixture.release==='function');
     // Capture synchronous clear and all already-queued microtasks in one
     // evaluation, before staff-session's correct zero-delay login navigation.
     const result=await page.evaluate(async mode=>{
       if(mode==='server-denial'){
         fixture.revoked=true;
         await ChampionLifeAuth.client.rpc('outreach_registration_workspace',{p_action:'context',
           p_campaign:'10000000-0000-4000-8000-000000000001',p_payload:{}});
       }else{
         if(mode==='account-change')fixture.userId='40000000-0000-4000-8000-000000000004';
         else fixture.activeToken='fictional-b';
         fixture.emit(mode==='account-change'?'SIGNED_IN':'TOKEN_REFRESHED');
       }
       const cleared=document.querySelectorAll('[data-summary-metric]').length===0;
       const before=fixture.requestLog.length;
       fixture.release();const rejected=await heldRefresh;
       detachedButton.dispatchEvent(new Event('click'));
       try{await detachedRefresh()}catch{}
       await Promise.resolve();
       return {cleared,rejected,requests:fixture.requestLog.length-before,
         remainedClear:document.querySelectorAll('[data-summary-metric]').length===0};
     },mode);
     check(result.cleared,engine.name()+' '+width+' '+mode+' immediately clears held-request totals');
     check(result.rejected&&result.requests===0&&result.remainedClear,
       engine.name()+' '+width+' '+mode+' late response and detached controls issue zero new RPCs');
     // The frozen staff-session correctly schedules location.replace(login) at
     // the next macrotask for a changed account. Complete that navigation
     // before loading the next fictional staff session, or the old document's
     // zero-delay redirect can win the race against login().
     if(mode==='account-change') {
       await page.waitForURL('**/discipleship-login.html*');
       check(page.url().includes('/discipleship-login.html'),
         engine.name()+' '+width+' changed-account redirect completes before new login');
     }
   }

   await login();await mount();
   await page.evaluate(()=>{fixture.denyAfterList=true});
   await page.locator('#outreach-summary-preview button').click();
   await page.waitForFunction(()=>!StaffWorkspace.active());
   check(await page.locator('[data-summary-metric]').count()===0,
     engine.name()+' '+width+' denial at post-list context blocks rendering');
   if(EVIDENCE)await page.screenshot({path:path.join(EVIDENCE,engine.name()+'-'+width+'-denied.png'),fullPage:true});
   check(!/SECRET PERSON|person@private.invalid|SECRET PAYMENT ACCOUNT|fictional-[ab]/.test(browserLog.join('\n')),
     engine.name()+' '+width+' browser logs contain no synthetic sensitive rows or tokens');

   await login();
   await mount();
   await page.evaluate(()=>window.dispatchEvent(new Event('staff-protected-clear')));
   check(await page.locator('#outreach-summary-preview').count()===1 &&
     await page.locator('#outreach-summary-preview').evaluate(el=>el.childElementCount===0),
     engine.name()+' '+width+' explicit staff-protected-clear empties mounted summary root');

   await login();
   await mount();
   await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
   check(await page.locator('#outreach-summary-preview').count()===0,engine.name()+' '+width+' pagehide destroys view and subscriptions');
   check(unexpected.length===0,engine.name()+' '+width+' blocks all external/unauthorized network activity');
   check(jsErrors.length===0,engine.name()+' '+width+' no browser exceptions: '+jsErrors.join('; '));
   await context.close();
  }
 }finally{await browser.close()}
}
console.log('PR61+69 synthetic browser mounting:',passes,'checks PASS');
