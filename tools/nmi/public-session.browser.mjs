// Actual imported browser source; every request is intercepted. No provider or backend.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const baseline=process.argv.includes('--baseline-reproduction');
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const source=path=>baseline?execFileSync('git',['show','84b2d9ab398bb8046570019da26a5db67fe77467:'+path],{encoding:'utf8'}):readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const client=source('assets/js/nmi-giving-client.js');
const pageSource=source('assets/js/nmi-public-giving.js');
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS '+label);};
for(const [name,engine] of Object.entries({chromium,webkit})){
 const executablePath=process.env['NMI_'+name.toUpperCase()+'_EXECUTABLE'];const browser=await engine.launch(executablePath?{executablePath}:{});console.log(name+' version '+browser.version());
 try{
  async function setup(enabled=true,initialDelay=null,loadPage=true){
   const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({body:'<div id="nmi-giving-app"></div>',contentType:'text/html'}));
   await page.goto('https://fictional.example.test/nmi-giving.html?organization=synthetic-org&form=synthetic-form');
   await page.evaluate(({enabled,initialDelay})=>{
    window.calls=[];window.pending={};window.delay=initialDelay;window.failExecute=false;window.authCallbacks=[];
    window.user='fictional-A';window.CHAMPION_NMI_GIVING={enabled,project:'https://cccccccccccccccccccc.supabase.co',origin:location.origin,siteKey:'fictional'};
    window.CHAMPION_LIFE_SUPABASE={url:CHAMPION_NMI_GIVING.project,publishableKey:'fictional-public'};
    window.ChampionLifeAuth={client:{auth:{getSession:async()=>{const user=window.user;if(window.authThrow)throw Error('fictional auth failure');if(window.authError)return{error:{message:'fictional auth denied'}};if(delay==='auth')await new Promise(r=>pending.auth=r);return{data:{session:user?{user:{id:user},access_token:'fictional-token'}:null}};},onAuthStateChange:cb=>authCallbacks.push(cb)}}};
    window.event=(event,user)=>{window.user=user;authCallbacks.forEach(cb=>cb(event,user?{user:{id:user}}:null));};
    window.GivingUtils={money:(v,c)=>v+' '+c,amountToMinor:()=>2500};
    window.turnstile={render:(_,options)=>{options.callback('fictional-challenge');return 1;},remove:()=>{},reset:()=>{}};
    window.NmiSandboxComponent={createNmiToken:async()=>{if(delay==='token')await new Promise(r=>pending.token=r);return{testMode:true,merchantId:'fictional-merchant',currencies:['USD']};},mountNmiPayments:(_,options)=>{window.widgetCallbacks=options;options.onFieldsAvailable();return{destroy:()=>{},resetFields:()=>{}};}};
    const append=document.head.append.bind(document.head);document.head.append=(node)=>{if(node.tagName==='SCRIPT'){queueMicrotask(()=>node.onload?.());return;}append(node);};
    window.response={status:'success',session_id:'fictional-session',currency:'USD',legs:[{id:'fictional-leg',component_key:'fictional-key',merchant_reference:'fictional-merchant',amount_minor:2500}],receipt:{total_minor:2500,currency:'USD',funds:[{fund:'Private-A-receipt',amount_minor:2500}]},recurring:[],fallback_path:'/give.html'};
    window.fetch=async(_,init)=>{const payload=JSON.parse(init.body);calls.push(payload);if(window.denyStatus&&payload.action==='status')return Response.json({error:'denied'},{status:403});if(delay===payload.action)await new Promise(r=>pending[payload.action]=r);if(payload.action==='execute'&&failExecute)throw Error('fictional unknown');return Response.json(payload.action==='form'?{available:true,label:'Fictional Giving',funds:[{id:'fund',label:'Fictional'}],recurring_allowed:false}:response);};
   },{enabled,initialDelay});
   await page.addScriptTag({content:client});if(loadPage)await page.addScriptTag({content:pageSource});return page;
  }
  async function ready(page){await page.waitForFunction(()=>document.querySelector('form')?.onsubmit);await page.evaluate(()=>{document.querySelector('[name=name]').value='Fictional';document.querySelector('[name=email]').value='fictional@example.test';document.querySelector('[name=amount]').value='25.00';});}
  async function create(page){await ready(page);await page.evaluate(()=>document.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true})));}
  async function payment(page){await create(page);await page.waitForFunction(()=>window.widgetCallbacks);await page.evaluate(()=>widgetCallbacks.onChange({complete:true,token:'fictional-token'}));}
  async function execute(page){await payment(page);await page.getByRole('button',{name:'Give in sandbox',exact:true}).click();}
  async function cleared(page,label){await page.waitForFunction(()=>document.body.textContent.includes('Your giving session changed'));check(!await page.locator('body').textContent().then(x=>x.includes('Private-A-receipt')),name+' '+label+' no private receipt');check(await page.locator('button,form').count()===0,name+' '+label+' no retained controls');}
  if(baseline){const p=await setup();await execute(p);await p.getByText('Private-A-receipt',{exact:false}).waitFor();await p.evaluate(()=>{window.retained=document.querySelector('button').onclick;event('SIGNED_OUT',null);});check((await p.locator('body').textContent()).includes('Private-A-receipt'),name+' ORIGINAL receipt remains after logout');const n=await p.evaluate(()=>calls.length);await p.evaluate(()=>retained());await p.waitForTimeout(20);check(await p.evaluate(()=>calls.length)===n+1,name+' ORIGINAL detached status request after logout');await p.close();continue;}
  for(const eventName of ['INITIAL_SESSION','TOKEN_REFRESHED']){const p=await setup(true,'auth',false);await p.evaluate(()=>{window.result=NmiGivingClient.call({action:'execute',operation:'sale'}).then(()=> 'unexpected',()=> 'rejected');});await p.waitForFunction(()=>Boolean(pending.auth));await p.evaluate(eventName=>{event(eventName,'fictional-B');delay=null;pending.auth();},eventName);check(await p.evaluate(()=>result)==='rejected',name+' first '+eventName+' conflicting principal rejected');check(await p.evaluate(()=>calls.length)===0,name+' first '+eventName+' conflict submits zero mutation');await p.close();}
  for(const stage of ['form','auth']){const p=await setup(true,stage);await p.waitForFunction(stage=>Boolean(pending[stage]),stage);const n=await p.evaluate(()=>calls.length);await p.evaluate(()=>event('SIGNED_OUT',null));await p.evaluate(stage=>pending[stage](),stage);await p.waitForTimeout(20);await cleared(p,stage+' pending startup');check(await p.evaluate(()=>calls.length)===n,name+' '+stage+' no new request after logout');await p.close();}
  for(const enabled of [false,'true','false',1,null]){const p=await setup(enabled);check((await p.evaluate(()=>calls.length))===0,name+' malformed/disabled configuration performs zero calls');await p.close();}
  for(const stage of ['create','token','execute','status']){
   const p=await setup();
   if(stage==='create'){await ready(p);await p.evaluate(()=>delay='create');await create(p);}
   if(stage==='token'){await p.evaluate(()=>delay='token');await create(p);}
   if(stage==='execute'){await payment(p);await p.evaluate(()=>delay='execute');await p.getByRole('button',{name:'Give in sandbox',exact:true}).click();}
   if(stage==='status'){await execute(p);await p.getByText('Private-A-receipt',{exact:false}).waitFor();await p.evaluate(()=>{delay='status';window.retained=[...document.querySelectorAll('button')].map(b=>b.onclick);});await p.getByRole('button',{name:'Check current status'}).click();}
   await p.waitForFunction(stage=>Boolean(pending[stage]),stage);
   const submitted=await p.evaluate(()=>calls.length);await p.evaluate(()=>event('SIGNED_OUT',null));await cleared(p,stage+' logout');
   await p.evaluate(stage=>{pending[stage]();window.retained?.forEach(fn=>fn());},stage);await p.waitForTimeout(20);
   check(await p.evaluate(()=>calls.length)===submitted,name+' '+stage+' stale callback/handler zero new calls');await cleared(p,stage+' delayed response');await p.close();
  }
  {
   const p=await setup();await execute(p);await p.getByText('Private-A-receipt',{exact:false}).waitFor();await p.evaluate(()=>{window.retained=document.querySelector('button').onclick;event('SIGNED_IN','fictional-B');});await cleared(p,'account change');const n=await p.evaluate(()=>calls.length);await p.evaluate(()=>retained());check(await p.evaluate(()=>calls.length)===n,name+' detached status handler denied after switch');await p.close();
  }
  {const p=await setup();await payment(p);await p.evaluate(()=>delay='auth');await p.getByRole('button',{name:'Give in sandbox',exact:true}).click();await p.waitForFunction(()=>Boolean(pending.auth));const n=await p.evaluate(()=>calls.length);await p.evaluate(()=>{event('SIGNED_OUT',null);pending.auth();});await p.waitForTimeout(20);await cleared(p,'execute waiting for Auth');check(await p.evaluate(()=>calls.length)===n,name+' execute pre-fetch Auth race submits zero mutation');await p.close();}
  for(const mode of ['error','throw','denial','identity-refresh','expiry']){const p=await setup();await execute(p);await p.getByText('Private-A-receipt',{exact:false}).waitFor();await p.evaluate(mode=>{if(mode==='error')window.authError=true;else if(mode==='throw')window.authThrow=true;else if(mode==='denial')window.denyStatus=true;else if(mode==='identity-refresh'){event('INITIAL_SESSION','fictional-A');event('TOKEN_REFRESHED','fictional-B');}else authCallbacks.forEach(cb=>cb('TOKEN_REFRESHED',{user:{id:'fictional-A'},expires_at:1}));},mode);if(['error','throw','denial'].includes(mode))await p.getByRole('button',{name:'Check current status'}).click();await cleared(p,mode);await p.close();}
  for(const lifecycle of ['pagehide','pageshow']){const p=await setup();await execute(p);await p.getByText('Private-A-receipt',{exact:false}).waitFor();await p.evaluate(lifecycle=>dispatchEvent(new PageTransitionEvent(lifecycle,{persisted:true})),lifecycle);await cleared(p,lifecycle);await p.close();}
  {
   const p=await setup();await ready(p);await p.evaluate(()=>{event('INITIAL_SESSION','fictional-A');event('TOKEN_REFRESHED','fictional-A');});check(await p.locator('form').count()===1,name+' initialization/refresh preserves same account form');await p.evaluate(()=>failExecute=true);await execute(p);await p.getByRole('heading',{name:'Payment confirmation pending'}).waitFor();check(await p.getByRole('button',{name:'Give in sandbox',exact:true}).count()===0,name+' UNKNOWN has no new-charge control');await p.getByRole('button',{name:'Check status',exact:true}).click();await p.getByText('Private-A-receipt',{exact:false}).waitFor();check(await p.evaluate(()=>calls.filter(x=>x.action==='execute').length)===1,name+' UNKNOWN status lookup never resubmits sale');await p.close();
  }
  {
   const p=await setup();await payment(p);await p.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(x=>x.textContent==='Give in sandbox');button.onclick();button.onclick();});await p.getByText('Private-A-receipt',{exact:false}).waitFor();check(await p.evaluate(()=>calls.filter(x=>x.action==='execute').length)===1,name+' double click one execution');await p.close();
  }
 }finally{await browser.close();}
}
console.log(JSON.stringify({browserAssertions:checks,engines:['Chromium','WebKit'],providerCalls:0,hosted:false}));
