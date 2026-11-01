// Actual Chrome/WebKit browser mounting against frozen PR61 staff-home.html.
// All network is intercepted: fictional Auth/RPC responses and local source only.
// No Supabase or Netlify project, live user, API key, real email or external fetch.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';

const ROOT=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const ORIGIN='https://champion-staff-review.invalid';
const A='10000000-0000-4000-8000-000000000001';
const B='20000000-0000-4000-8000-000000000002';
const USER='30000000-0000-4000-8000-000000000003';
const COUNTS={households:2,adults:3,minors:2,attendees:5,checked_in:1};
let passes=0;
const check=(test,description)=>{assert.ok(test,description);passes++;console.log('PASS '+description)};

const authFixture=`
window.fixture={
  userId:'${USER}',verified:true,anonymous:false,revoked:false,
  pending:null,release:null,requestLog:[],listeners:new Set(),activeToken:'fictional-a',
  checkedIn:1,changeSession:false,unexpected:[],
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
    if(this.revoked || params.p_campaign==='${B}')
      return{error:{code:'42501',message:'Synthetic denied'},status:403};
    if(params.p_action==='context')return{data:{capabilities:['registration.view']}};
    if(params.p_action==='list')return{data:{
      summary:{households:2,adults:3,minors:2,attendees:5,checked_in:this.checkedIn},
      registrations:[{name:'SECRET PERSON',email:'person@private.invalid'}],
      donor:'SECRET PAYMENT ACCOUNT'
    }};
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
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),unexpected=[],jsErrors=[];
   page.on('pageerror',e=>jsErrors.push(e.message));
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
