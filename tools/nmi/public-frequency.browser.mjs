// Actual unmounted NMI source; fictional Auth, HTTP and payment-field boundaries only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'../backend-tests/node_modules/playwright/index.mjs');
const baseline=process.argv.includes('--baseline-reproduction');
const source=path=>baseline?execFileSync('git',['--no-replace-objects','show','972482e2f7437ea26b424f0385a4df0a811454af:'+path],{encoding:'utf8'}):readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const client=source('assets/js/nmi-giving-client.js'),controller=source('assets/js/nmi-public-giving.js');
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
console.log(JSON.stringify({baseline,pageSHA256:createHash('sha256').update(controller).digest('hex'),clientSHA256:createHash('sha256').update(client).digest('hex')}));
for(const [engine,type]of Object.entries({chromium,webkit})){
 const executablePath=process.env['NMI_'+engine.toUpperCase()+'_EXECUTABLE'];
 const browser=await type.launch(executablePath?{executablePath}:{});
 try{
  async function setup({guest=false,enabled=true,width=390}={}){
   const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
   await page.route('**/*',r=>r.fulfill({body:'<div id="nmi-giving-app"></div>',contentType:'text/html'}));
   await page.goto('https://fictional.example.test/nmi-giving.html?organization=fictional-org&form=fictional-form');
   await page.evaluate(({guest,enabled})=>{
    window.calls=[];window.authHeaders=[];window.callbacks=[];window.user=guest?null:'fictional-A';window.releaseCreate=null;window.mounts=0;window.resets=0;
    window.CHAMPION_NMI_GIVING={enabled,project:'https://cccccccccccccccccccc.supabase.co',origin:location.origin,siteKey:'fictional'};
    window.CHAMPION_LIFE_SUPABASE={url:CHAMPION_NMI_GIVING.project,publishableKey:'fictional-no-authority'};
    window.ChampionLifeAuth={client:{auth:{getSession:async()=>({data:{session:window.user?{user:{id:window.user},access_token:'fictional-token'}:null}}),onAuthStateChange:f=>callbacks.push(f)}}};
    window.GivingUtils={money:(v,c)=>v+' '+c,amountToMinor:()=>2500};
    window.turnstile={render:(_,o)=>{o.callback('fictional-challenge');return 1},remove:()=>{},reset:()=>{}};
    const append=document.head.append.bind(document.head);document.head.append=node=>{if(node.tagName==='SCRIPT'){queueMicrotask(()=>node.onload?.());return}append(node)};
    window.NmiSandboxComponent={createNmiToken:async()=>({testMode:true,merchantId:'fictional-merchant',currencies:['USD']}),mountNmiPayments:(_,o)=>{mounts++;window.fields=o;return{destroy(){},resetFields(){resets++}}}};
    window.fetch=async(_,init)=>{
     const q=JSON.parse(init.body);calls.push(q);authHeaders.push(init.headers.Authorization??null);
     if(q.action==='form')return Response.json({available:true,label:'Fictional form',funds:[{id:'fictional-fund',label:'Fictional fund'}],recurring_allowed:true});
     if(q.action==='create')await new Promise(resolve=>releaseCreate=resolve);
     // Existing server view has no checkout-level frequency field. Do not invent one.
     return Response.json({session_id:'fictional-session',sandbox:true,currency:'USD',status:'pending',legs:[{id:'fictional-leg',amount_minor:'2500',component_key:'fictional-key',merchant_reference:'fictional-merchant'}],receipt:null,recurring:[],retry_automatically:false,fallback_path:'/give.html'});
    };
   },{guest,enabled});
   await page.addScriptTag({content:client});await page.addScriptTag({content:controller});return{page,errors};
  }
  async function hold(page,frequency){
   await page.waitForFunction(()=>document.querySelector('form')?.onsubmit&&window.turnstile);
   await page.getByLabel('Frequency',{exact:true}).selectOption(frequency);
   await page.evaluate(()=>{document.querySelector('[name=name]').value='Fictional';document.querySelector('[name=email]').value='fictional@example.test';document.querySelector('[name=amount]').value='25.00';document.querySelector('[name=starts]').value='2030-12-31';document.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}))});
   await page.waitForFunction(()=>typeof releaseCreate==='function');
  }
  for(const width of [390,1440])for(const [submitted,edited]of [['once','monthly'],['monthly','once']]){
   const {page,errors}=await setup({width}),label=engine+' '+width+' '+submitted+'→'+edited;
   await hold(page,submitted);const original=await page.evaluate(()=>calls.find(x=>x.action==='create'));
   eq(original.frequency,submitted,label+' create captures initial frequency');
   eq(await page.getByRole('button',{name:'Continue to secure payment'}).isDisabled(),true,label+' pending create prevents duplicate submit');
   await page.getByLabel('Frequency',{exact:true}).selectOption(edited);await page.evaluate(()=>releaseCreate());await page.waitForFunction(()=>window.fields);
   const expectedName=submitted==='once'?'Give in sandbox':'Start sandbox recurring schedule';
   console.log(JSON.stringify({label,createdFrequency:original.frequency,editedFrequency:edited,renderedButtons:await page.getByRole('button').allTextContents()}));
   eq(await page.getByRole('button',{name:expectedName,exact:true}).count(),1,label+' payment operation reflects captured create intent');
   await page.evaluate(()=>fields.onChange({complete:true,token:'fictional-token'}));
   if(submitted!=='once'){eq(await page.getByRole('button',{name:expectedName,exact:true}).isDisabled(),true,label+' recurring still requires explicit storage consent');await page.getByRole('checkbox').check()}
   await page.getByRole('button',{name:expectedName,exact:true}).evaluate(b=>window.retainedSubmit=b.onclick);await page.getByRole('button',{name:expectedName,exact:true}).click();await page.getByRole('heading',{name:'Giving status',exact:true}).waitFor();
   const execution=await page.evaluate(()=>calls.filter(x=>x.action==='execute'));
   eq(execution.length,1,label+' one fictional operation only');eq(execution[0].operation,submitted==='once'?'sale':'recurring_create',label+' operation bound to captured frequency');eq(execution[0].capability,original.capability,label+' capability preserved');
   await page.evaluate(()=>retainedSubmit());eq(await page.evaluate(()=>calls.filter(x=>x.action==='execute').length),1,label+' retained submit cannot repeat UNKNOWN operation');eq(await page.getByRole('button',{name:'Check current status',exact:true}).count(),1,label+' uncertain result keeps status-only recovery');eq(errors,[],label+' no runtime errors');await page.close();
  }
  for(const frequency of ['once','monthly']){
   const {page,errors}=await setup({guest:true});await hold(page,frequency);await page.evaluate(()=>releaseCreate());await page.waitForFunction(()=>window.fields);
   eq(await page.getByRole('button',{name:frequency==='once'?'Give in sandbox':'Start sandbox recurring schedule',exact:true}).count(),1,engine+' guest '+frequency+' unchanged intent stays usable');eq(await page.evaluate(()=>authHeaders.every(x=>x===null)),true,engine+' guest '+frequency+' invents no bearer');eq(errors,[],engine+' guest no runtime errors');await page.close();
  }
  for(const transition of ['logout','replacement']){
   const {page,errors}=await setup();await hold(page,'monthly');await page.getByLabel('Frequency',{exact:true}).selectOption('once');
   await page.evaluate(transition=>{if(transition==='logout'){window.user=null;callbacks.forEach(cb=>cb('SIGNED_OUT',null))}else ChampionLifeAuth.client={auth:{}};releaseCreate()},transition);
   await page.getByText('Your giving session changed. Reload to begin again.',{exact:true}).waitFor();eq(await page.evaluate(()=>mounts),0,engine+' '+transition+' stale create mounts no payment fields');eq(await page.evaluate(()=>calls.filter(x=>x.action==='execute').length),0,engine+' '+transition+' no payment request');eq(await page.locator('form,button').count(),0,engine+' '+transition+' no old controls');eq(errors,[],engine+' '+transition+' no runtime errors');await page.close();
  }
  {const {page,errors}=await setup({enabled:false});await page.getByRole('heading',{name:'Giving',exact:true}).waitFor();eq(await page.evaluate(()=>calls.length),0,engine+' disabled zero HTTP');eq(await page.locator('form,button').count(),0,engine+' disabled zero checkout controls');eq(errors,[],engine+' disabled no runtime errors');await page.close()}
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,providerRequests:0,checkoutActivated:false,genuineAuth:false}));
