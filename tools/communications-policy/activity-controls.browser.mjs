// Actual Communications + shared shell sources, fictional origin-locked transport.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
let checks=0;const equal=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;console.log('PASS '+label)};
for(const [engine,type] of Object.entries({chromium,webkit})){
 const executable=process.env['COMM_'+engine.toUpperCase()+'_EXECUTABLE'];
 const browser=await type.launch(executable?{executablePath:executable}:engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1440]){
  const label=engine+' '+width;
  async function setup(name='staff-communication-activity'){
   const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const html=read(name+'.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
   await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,'https://communications-controls.invalid');return route.fulfill({contentType:route.request().resourceType()==='document'?'text/html':'text/plain',body:route.request().resourceType()==='document'?html:''})});
   await page.goto('https://communications-controls.invalid/'+name+'.html');
   await page.addScriptTag({content:read('tools/backend-tests/fixtures/communications-browser-fixture.js')});
   await page.evaluate(()=>{
    commFixture.activity=[{...commFixture.activity[0],id:'fictional-queued',status:'queued',provider_message_id:null},
     {...commFixture.activity[0],id:'fictional-transient',status:'failed',failure_class:'transient',provider_message_id:null},
     {...commFixture.activity[0],id:'fictional-unknown',status:'failed',failure_class:'unknown',provider_message_id:null}];
    window.fixtureErrors=[];window.fixtureMutations=[];const rpc=ChampionLifeAuth.client.rpc;
    ChampionLifeAuth.client.rpc=async(name,args)=>{if(['cancel','retry','confirm','template_edit'].includes(args?.p_action))fixtureMutations.push(structuredClone(args));return rpc(name,args)};
   });
   for(const file of ['assets/js/outreach-staff-common.js','assets/js/staff-workspace.js','assets/js/communications.js'])await page.addScriptTag({content:read(file)});
   await page.getByRole('heading',{name:name==='staff-communication-activity'?'Delivery records':name==='staff-communication-templates'?'Template versions':'Compose & preview',exact:true}).waitFor();
   if(name==='staff-communication-activity')await page.locator('.comm-row').first().waitFor();
   return {page,errors};
  }
  const action=(p,name)=>p.getByRole('button',{name,exact:true}).first();
  const count=(p,name)=>p.evaluate(a=>commFixture.calls.filter(c=>c.args.p_action===a).length,name);
  {
   const {page,errors}=await setup();
   equal(await page.getByRole('button',{name:'Retry',exact:true}).count(),1,label+' only definite transient row offers explicit retry; UNKNOWN stays held');
   await page.evaluate(()=>{window.retiredHandlers=['View message','Cancel','Retry'].map(name=>[...document.querySelectorAll('#communications-app button')].find(b=>b.textContent===name).onclick);commFixture.activity=[]});
   await action(page,'Apply filters').click();await page.getByText('No communication activity matches this scope.',{exact:true}).waitFor();
   const before=await page.evaluate(()=>commFixture.calls.length);
   await page.evaluate(async()=>{for(const handler of retiredHandlers)await handler()});
   equal(await page.evaluate(()=>commFixture.calls.length),before,label+' removed View Cancel Retry controls perform zero RPC');
   equal(await page.evaluate(()=>fixtureMutations.length),0,label+' filtered records cannot be cancelled or retried by retained handler');
   equal(await page.locator('.comm-body').count(),0,label+' removed message body remains absent');equal(errors,[],label+' no browser errors');await page.close();
  }
  // Hold every pre-operation identity await independently: act() then request().
  for(const name of ['View message','Cancel','Retry'])for(const boundary of [1,2]){
   const {page}=await setup();const rpcAction={'View message':'message',Cancel:'cancel',Retry:'retry'}[name];
   await action(page,name).evaluate((button,boundary)=>{
    window.heldControl=button;let calls=0;const get=ChampionLifeAuth.getUser;
    ChampionLifeAuth.getUser=()=>{if(++calls===boundary)return new Promise(resolve=>window.releaseIdentity=()=>resolve(commFixture.user));return get()};
    window.operation=button.onclick();
   },boundary);
   await page.waitForFunction(()=>typeof releaseIdentity==='function');await page.evaluate(()=>heldControl.closest('.comm-row').remove());
   await page.evaluate(async()=>{releaseIdentity();await operation});
   equal(await count(page,rpcAction),0,label+' '+name+' detached during identity await'+boundary+' performs zero operation RPC');
   equal(await page.evaluate(()=>fixtureMutations.length),0,label+' '+name+' identity await'+boundary+' creates no mutation');
   await action(page,'Apply filters').click();await page.locator('.comm-row').first().waitFor();
   equal(await page.locator('.comm-row').count(),3,label+' detached await'+boundary+' releases busy state for valid refresh');await page.close();
  }
  {
   const {page}=await setup();await action(page,'View message').evaluate(button=>window.currentView=button.onclick);
   await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.waitForFunction(()=>commFixture.calls.filter(c=>c.args.p_action==='context').length>=3);
   await page.evaluate(()=>currentView());await page.locator('.comm-body').waitFor();
   equal(await count(page,'message'),1,label+' same-scope periodic identity refresh preserves current View');
   await action(page,'Cancel').click();await page.waitForFunction(()=>fixtureMutations.some(c=>c.p_action==='cancel'));await page.locator('.comm-row').first().waitFor();
   await action(page,'Retry').click();await page.waitForFunction(()=>fixtureMutations.some(c=>c.p_action==='retry'));
   equal(await page.evaluate(()=>fixtureMutations.map(x=>({action:x.p_action,id:x.p_payload.id,campaign:x.p_campaign,organization:x.p_payload.organization_id}))),[
    {action:'cancel',id:'fictional-queued',campaign:'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',organization:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'},
    {action:'retry',id:'fictional-transient',campaign:'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',organization:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'}
   ],label+' attached actions retain exact message organization campaign and one request each');await page.close();
  }
  {
   const {page}=await setup();await action(page,'View message').evaluate(button=>{
    window.heldControl=button;const get=ChampionLifeAuth.getUser;let calls=0;
    ChampionLifeAuth.getUser=()=>++calls===3?new Promise(resolve=>window.releaseIdentity=()=>resolve(commFixture.user)):get();window.operation=button.onclick();
   });await page.waitForFunction(()=>typeof releaseIdentity==='function');await page.evaluate(()=>heldControl.closest('.comm-row').remove());await page.evaluate(async()=>{releaseIdentity();await operation});
   equal(await count(page,'message'),1,label+' body request already issued before final identity wait');equal(await page.locator('.comm-body').count(),0,label+' removed row never displays returned private body');await page.close();
  }
  {
   const {page}=await setup('staff-campaign-communications');await action(page,'Preview audience & message').click();await page.locator('.comm-preview').waitFor();await page.locator('.comm-preview>label input').check();
   await action(page,'Confirm & queue').evaluate(button=>window.oldConfirm=button.onclick);await action(page,'Preview audience & message').click();await page.locator('.comm-preview').waitFor();
   await page.evaluate(()=>oldConfirm());equal(await count(page,'confirm'),0,label+' replacement preview retires old explicit confirmation');
   await page.locator('.comm-preview>label input').check();await action(page,'Confirm & queue').click();await page.waitForFunction(()=>fixtureMutations.some(x=>x.p_action==='confirm'));
   equal(await count(page,'confirm'),1,label+' current reviewed confirmation remains available once');await page.close();
  }
  {
   const {page}=await setup('staff-communication-templates');await action(page,'Save draft').evaluate(button=>window.oldSave=button.onclick);await action(page,'Save draft').click();await page.getByRole('heading',{name:'Template versions',exact:true}).waitFor();
   await page.evaluate(()=>oldSave());equal(await count(page,'template_edit'),1,label+' template rerender retires previous draft action');await page.close();
  }
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,engines:['chromium','webkit'],providerCalls:0,hostedAcceptance:false}));
