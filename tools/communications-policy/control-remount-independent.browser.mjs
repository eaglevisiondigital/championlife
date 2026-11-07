// Independent reviewer regression: real HTML/runtime, fictional origin-locked RPC only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const read=p=>readFileSync(p,'utf8');let checks=0;
const verify=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;console.log('PASS '+label)};
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1440]){
  const label=engine+' '+width;
  async function setup(view='templates'){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const file=view==='templates'?'staff-communication-templates.html':'staff-communication-activity.html';
   const html=read(file).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
   await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,'https://independent-communications.invalid');return route.fulfill({contentType:route.request().resourceType()==='document'?'text/html':'text/plain',body:route.request().resourceType()==='document'?html:''})});
   await page.goto('https://independent-communications.invalid/'+file);
   await page.addScriptTag({content:read('tools/backend-tests/fixtures/communications-browser-fixture.js')});
   await page.evaluate(()=>{
    const base=ChampionLifeAuth.client.rpc;
    ChampionLifeAuth.client.rpc=async(name,args)=>{
     const result=await base(name,args);
     if(name==='communications_workspace'&&args?.p_action==='context'&&!commFixture.deny)result.data.organizations.push({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',name:'Fictional Second Organization',permissions:[...commFixture.permissions]});
     return result;
    };
    commFixture.activity=[{...commFixture.activity[0],id:'held-unknown',status:'failed',failure_class:'unknown',provider_message_id:null},{...commFixture.activity[1],id:'held-suppressed',status:'suppressed'}];
    window.detachAndRestore=node=>{const parent=node.parentNode,next=node.nextSibling;node.remove();parent.insertBefore(node,next)};
   });
   for(const file of ['assets/js/outreach-staff-common.js','assets/js/staff-workspace.js','assets/js/communications.js'])await page.addScriptTag({content:read(file)});
   await page.getByRole('button',{name:view==='templates'?'Publish version':'View message',exact:true}).first().waitFor();return{page,errors};
  }
  const count=(p,a)=>p.evaluate(a=>commFixture.calls.filter(x=>x.args.p_action===a).length,a);
  // Independent control and ancestor removal across both pre-RPC identity boundaries.
  for(const boundary of [1,2])for(const removal of ['control','ancestor','root']){
   const{page,errors}=await setup();
   await page.getByRole('button',{name:'Publish version',exact:true}).evaluate((button,{boundary,removal})=>{
    window.oldHandler=button.onclick;window.oldButton=button;const original=ChampionLifeAuth.getUser;let seen=0;
    ChampionLifeAuth.getUser=()=>++seen===boundary?new Promise(resolve=>window.release=()=>resolve(commFixture.user)):original();
    window.pending=oldHandler();window.removalKind=removal;
   },{boundary,removal});
   await page.waitForFunction(()=>typeof release==='function');
   await page.evaluate(async()=>{detachAndRestore(removalKind==='root'?document.getElementById('communications-app'):removalKind==='ancestor'?oldButton.closest('.comm-row'):oldButton);release();await pending;await oldHandler()});
   verify(await count(page,'template_publish'),0,label+' '+removal+' removed/reinserted at Auth '+boundary+' has zero writes');
   verify(errors,[],label+' '+removal+' Auth '+boundary+' no browser errors');await page.close();
  }
  // An already issued read may finish; its result cannot display or revive retired controls.
  for(const removal of ['ancestor','root']){
   const{page}=await setup('activity');
   await page.getByRole('button',{name:'View message',exact:true}).first().evaluate((button,removal)=>{
    window.oldHandler=button.onclick;window.oldButton=button;window.removalKind=removal;const original=ChampionLifeAuth.client.rpc;
    ChampionLifeAuth.client.rpc=async(name,args)=>{const result=await original(name,args);if(args?.p_action==='message')await new Promise(resolve=>window.release=resolve);return result};window.pending=oldHandler();
   },removal);
   await page.waitForFunction(()=>typeof release==='function');
   await page.evaluate(async()=>{detachAndRestore(removalKind==='root'?document.getElementById('communications-app'):oldButton.closest('.comm-row'));release();await pending;await oldHandler()});
   verify(await count(page,'message'),1,label+' '+removal+' keeps exactly one pre-retirement read');
   verify(await page.locator('.comm-body').count(),0,label+' '+removal+' delayed private body never restored');await page.close();
  }
  {
   const{page}=await setup();const before=await page.evaluate(()=>commFixture.calls.length);
   await page.locator('select[name="scope"]').evaluate(select=>{const old=select.onchange;detachAndRestore(select);select.value='org:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';old()});
   verify(await page.evaluate(()=>commFixture.calls.length),before,label+' reinserted scope selector cannot launch work');
   await page.getByRole('button',{name:'Publish version',exact:true}).click();
   await page.waitForFunction(()=>commFixture.calls.some(x=>x.args.p_action==='template_publish'));
   verify(await page.evaluate(()=>commFixture.calls.find(x=>x.args.p_action==='template_publish').args.p_payload.organization_id),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',label+' stale selector never changes legitimate current organization');await page.close();
  }
  for(const transition of ['account','logout','scope','denial']){
   const{page}=await setup();await page.getByRole('button',{name:'Publish version',exact:true}).evaluate(b=>window.oldHandler=b.onclick);
   if(transition==='scope')await page.locator('select[name="scope"]').selectOption('org:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2');
   else await page.evaluate(transition=>{
    if(transition==='account'){commFixture.user={id:'different-fictional-user'};commFixture.callbacks.forEach(fn=>fn('SIGNED_IN',{user:commFixture.user}))}
    if(transition==='logout'){commFixture.user=null;commFixture.callbacks.forEach(fn=>fn('SIGNED_OUT',null))}
    if(transition==='denial'){commFixture.deny=true;dispatchEvent(new Event('focus'))}
   },transition);
   if(transition==='denial')await page.getByText('Your communications access is no longer available.',{exact:true}).waitFor();
   await page.evaluate(()=>oldHandler());
   verify(await count(page,'template_publish'),0,label+' '+transition+' retires previous publish intent');await page.close();
  }
  {
   const{page}=await setup('activity');
   verify(await page.getByRole('button',{name:'Retry',exact:true}).count(),0,label+' UNKNOWN and suppressed records have no Retry');
   verify(await page.getByRole('button',{name:'Cancel',exact:true}).count(),0,label+' UNKNOWN and suppressed records have no Cancel');
   verify(await page.getByText('EXTERNAL DELIVERY DISABLED — queued messages remain held.',{exact:true}).count(),1,label+' provider delivery remains disabled');await page.close();
  }
  {
   const{page}=await setup();await page.getByRole('button',{name:'Publish version',exact:true}).evaluate(b=>window.currentHandler=b.onclick);
   const before=await count(page,'context');await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.waitForFunction(n=>commFixture.calls.filter(x=>x.args.p_action==='context').length>n,before);
   await page.evaluate(()=>currentHandler());
   verify(await count(page,'template_publish'),1,label+' attached same-account refresh preserves one legitimate publication request');await page.close();
  }
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,engines:['chromium','webkit'],widths:[390,1440],hostedAcceptance:false,externalSending:false}));
