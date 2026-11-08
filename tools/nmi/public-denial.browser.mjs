// Actual disabled client/page source with fictional Auth/HTTP/hosted-fields fixtures only.
// No provider request, credential, real merchant evidence or checkout activation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const baseline=process.argv.includes('--baseline-reproduction');
const source=path=>baseline?execFileSync('git',['show','82af1d85391c3192eb9ca2b43f9f8f6221e9498f:'+path],{encoding:'utf8'}):readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const client=source('assets/js/nmi-giving-client.js'),pageSource=source('assets/js/nmi-public-giving.js');
let checks=0;const check=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS '+label)};
console.log(JSON.stringify({baseline,clientSha256:createHash('sha256').update(client).digest('hex'),pageSha256:createHash('sha256').update(pageSource).digest('hex')}));
for(const [name,engine] of Object.entries({chromium,webkit})){
 const executablePath=process.env['NMI_'+name.toUpperCase()+'_EXECUTABLE'];const browser=await engine.launch(executablePath?{executablePath}:{});
 try{
  async function setup(enabled=true,initialDelay=null,loadPage=true){
   const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({body:'<div id="nmi-giving-app"></div>',contentType:'text/html'}));
   await page.goto('https://fictional.example.test/nmi-giving.html?organization=synthetic-org&form=synthetic-form');
   await page.evaluate(({enabled,initialDelay})=>{
    window.calls=[];window.authHeaders=[];window.pending={};window.delay=initialDelay;window.failExecute=false;window.authCallbacks=[];
    window.user='fictional-A';window.CHAMPION_NMI_GIVING={enabled,project:'https://cccccccccccccccccccc.supabase.co',origin:location.origin,siteKey:'fictional'};
    window.CHAMPION_LIFE_SUPABASE={url:CHAMPION_NMI_GIVING.project,publishableKey:'fictional-public'};
    window.ChampionLifeAuth={client:{auth:{getSession:async()=>{const user=window.user;if(window.authThrow)throw Error('fictional auth failure');if(window.authError)return{error:{message:'fictional auth denied'}};if(delay==='auth')await new Promise(r=>pending.auth=r);return{data:{session:user?{user:{id:user},access_token:'fictional-token'}:null}};},onAuthStateChange:cb=>authCallbacks.push(cb)}}};
    window.event=(event,user)=>{window.user=user;authCallbacks.forEach(cb=>cb(event,user?{user:{id:user}}:null));};
    window.GivingUtils={money:(v,c)=>v+' '+c,amountToMinor:()=>2500};
    window.turnstile={render:(_,options)=>{options.callback('fictional-challenge');return 1;},remove:()=>{},reset:()=>{}};
    window.NmiSandboxComponent={createNmiToken:async()=>{if(window.sdkFailure==='initialize')throw Error('fictional initialization failure');if(window.sdkFailure==='merchant')return{testMode:true,merchantId:'wrong-merchant',currencies:['USD']};if(window.sdkFailure==='currency')return{testMode:true,merchantId:'fictional-merchant',currencies:['EUR']};if(window.sdkFailure==='mode')return{testMode:false,merchantId:'fictional-merchant',currencies:['USD']};if(delay==='token')await new Promise(r=>pending.token=r);if(window.sdkRejectAfterDelay)throw Error('fictional late initialization failure');return{testMode:true,merchantId:'fictional-merchant',currencies:['USD']};},mountNmiPayments:(_,options)=>{if(window.sdkFailure==='mount')throw Error('fictional mount failure');window.widgetCallbacks=options;options.onFieldsAvailable();return{destroy:()=>{},resetFields:()=>{}};}};
    const append=document.head.append.bind(document.head);document.head.append=(node)=>{if(node.tagName==='SCRIPT'){queueMicrotask(()=>window.sdkFailure==='load'&&node.src.includes('nmi-component')?node.onerror?.(Error('fictional script failure')):node.onload?.());return;}append(node);};
    window.response={status:'success',session_id:'fictional-session',currency:'USD',legs:[{id:'fictional-leg',component_key:'fictional-key',merchant_reference:'fictional-merchant',amount_minor:2500}],receipt:{total_minor:2500,currency:'USD',funds:[{fund:'Private-A-receipt',amount_minor:2500}]},recurring:[],fallback_path:'/give.html'};
    window.fetch=async(_,init)=>{const payload=JSON.parse(init.body);calls.push(payload);authHeaders.push(init.headers.Authorization??null);if(window.denyStatus&&payload.action==='status')return Response.json({error:'denied'},{status:403});if(delay===payload.action)await new Promise(r=>pending[payload.action]=r);if(payload.action==='execute'&&failExecute)throw Error('fictional unknown');return Response.json(payload.action==='form'?{available:true,label:'Fictional Giving',funds:[{id:'fund',label:'Fictional'}],recurring_allowed:false}:response);};
   },{enabled,initialDelay});
   await page.addScriptTag({content:client});if(loadPage)await page.addScriptTag({content:pageSource});return page;
  }
  async function ready(page){await page.waitForFunction(()=>document.querySelector('form')?.onsubmit);await page.evaluate(()=>{document.querySelector('[name=name]').value='Fictional';document.querySelector('[name=email]').value='fictional@example.test';document.querySelector('[name=amount]').value='25.00';});}
  async function create(page){await ready(page);await page.evaluate(()=>document.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true})));}
  async function payment(page){await create(page);await page.waitForFunction(()=>window.widgetCallbacks);await page.evaluate(()=>widgetCallbacks.onChange({complete:true,token:'fictional-token'}));}
  async function execute(page){await payment(page);await page.getByRole('button',{name:'Give in sandbox',exact:true}).click();}
  async function cleared(page,label){await page.waitForFunction(()=>document.body.textContent.includes('Your giving session changed'));check(!await page.locator('body').textContent().then(x=>x.includes('Private-A-receipt')),name+' '+label+' no private receipt');check(await page.locator('button,form').count()===0,name+' '+label+' no retained controls');}

  for(const width of [390,1440])for(const status of [401,403])for(const body of ['malformed','pending','valid']){
   const p=await setup();await p.setViewportSize({width,height:900});await execute(p);await p.getByText('Private-A-receipt',{exact:false}).waitFor();
   await p.evaluate(({status,body})=>{
    window.retained=document.querySelector('button').onclick;window.bodyReads=0;const originalFetch=window.fetch;
    window.fetch=async(...args)=>{const payload=JSON.parse(args[1].body);if(payload.action!=='status')return originalFetch(...args);calls.push(payload);
     return {status,ok:false,json:async()=>{bodyReads++;if(body==='malformed')throw SyntaxError('fictional unreadable denial');if(body==='pending')await new Promise(resolve=>window.releaseBody=resolve);return {status:'held'};}};
    };
   },{status,body});
   await p.getByRole('button',{name:'Check current status'}).click();
   const label=name+' '+width+' HTTP'+status+' '+body;
   if(baseline&&body==='malformed'){await p.getByRole('alert').waitFor();console.log(JSON.stringify({originalReceiptRemains:await p.getByText('Private-A-receipt',{exact:false}).count(),originalStatusControlRemains:await p.getByRole('button',{name:'Check current status'}).count()}));check(await p.getByText('Private-A-receipt',{exact:false}).count()===0,label+' denial must retire prior receipt');}
   await cleared(p,label);
   check(await p.evaluate(()=>bodyReads)===0,label+' deny before any response body read');
   const before=await p.evaluate(()=>calls.length);await p.evaluate(()=>retained());await p.waitForTimeout(15);
   check(await p.evaluate(()=>calls.length)===before,label+' detached control issues zero request');
   check(await p.evaluate(()=>calls.filter(x=>x.action==='execute').length)===1,label+' no repeated payment');
   await p.close();
  }
  // Uncertain transport/body failures are not proof of access revocation or payment failure.
  for(const status of [200,503]){
   const p=await setup();await execute(p);await p.getByText('Private-A-receipt',{exact:false}).waitFor();
   await p.evaluate(status=>{const original=window.fetch;window.fetch=async(...args)=>{const q=JSON.parse(args[1].body);if(q.action!=='status')return original(...args);calls.push(q);return {status,ok:status===200,json:async()=>{throw SyntaxError('fictional unreadable status')}};};},status);
   await p.getByRole('button',{name:'Check current status'}).click();await p.getByRole('alert').waitFor();
   check(await p.getByText('Private-A-receipt',{exact:false}).count()===1,name+' '+status+' uncertain status is not access revocation');
   check(await p.getByRole('button',{name:'Check current status'}).isEnabled(),name+' '+status+' permits status-only review');
   check(await p.getByRole('button',{name:'Give in sandbox',exact:true}).count()===0,name+' '+status+' no recharge control');
   check(await p.evaluate(()=>calls.filter(x=>x.action==='execute').length)===1,name+' '+status+' no automatic payment retry');await p.close();
  }
  {const p=await setup();await execute(p);await p.getByText('Private-A-receipt',{exact:false}).waitFor();await p.getByRole('button',{name:'Check current status'}).click();await p.waitForFunction(()=>calls.filter(x=>x.action==='status').length===1&&[...document.querySelectorAll('button')].some(b=>b.textContent==='Check current status'&&!b.disabled));await p.getByText('Private-A-receipt',{exact:false}).waitFor();check(await p.getByRole('button',{name:'Check current status'}).isEnabled(),name+' normal same-principal status remains useful');await p.close();}
  {const p=await setup(false);await p.getByRole('heading',{name:'Giving',exact:true}).waitFor();check(await p.evaluate(()=>calls.length)===0,name+' disabled configuration makes zero calls');check(await p.locator('button,form').count()===0,name+' disabled configuration exposes no checkout');await p.close();}
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,providerCalls:0,hosted:false,checkoutActivation:false}));
