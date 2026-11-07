import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.REVIEW_ROOT||fileURLToPath(new URL('../../',import.meta.url));
const {chromium,webkit}=await import(pathToFileURL(root+'/tools/backend-tests/node_modules/playwright/index.mjs').href);
const read=p=>readFileSync(root+'/'+p,'utf8');
const runtime=readFileSync(process.env.REVIEW_SOURCE||root+'/assets/js/communications.js','utf8');
const hash=createHash('sha256').update(runtime).digest('hex');
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
console.log(JSON.stringify({reviewedRuntime:hash}));
for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  async function setup(view='activity'){
   const page=await browser.newPage({viewport:{width:name==='chromium'?390:1440,height:900}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async r=>{assert.equal(new URL(r.request().url()).origin,'https://independent-communications.invalid');await r.fulfill({contentType:'text/html',body:'<main id="communications-app" data-view="'+view+'"></main>'})});
   await page.goto('https://independent-communications.invalid/?campaign=dddddddd-dddd-4ddd-8ddd-ddddddddddd1&person=cccccccc-cccc-4ccc-8ccc-ccccccccccc1');
   await page.addScriptTag({content:read('tools/backend-tests/fixtures/communications-browser-fixture.js')});
   await page.evaluate(()=>{window.refreshes=0;window.StaffWorkspace={selectCampaign:()=>{},refresh:()=>refreshes++,state:(root,title,message)=>{root.replaceChildren();const p=document.createElement('p');p.className='staff-state';p.textContent=title+' '+message;root.append(p)},denied:root=>root.replaceChildren()}});
   await page.addScriptTag({content:read('assets/js/outreach-staff-common.js')});await page.addScriptTag({content:runtime});
   await page.getByRole('button',{name:view==='templates'?'Publish version':view==='campaign'?'Preview audience & message':'View message',exact:true}).first().waitFor();return {page,errors};
  }
  const button=(p,n)=>p.getByRole('button',{name:n,exact:true}).first();
  const count=(p,a)=>p.evaluate(a=>commFixture.calls.filter(c=>c.args.p_action===a).length,a);
  // Observed principal invalidation must retire other private content even
  // when the originating control was detached during the identity wait.
  for(const mode of ['replacement','null','anonymous'])for(const boundary of [1,2]){
   const {page}=await setup();
   await button(page,'View message').evaluate((b,n)=>{window.originControl=b;let i=0;const get=ChampionLifeAuth.getUser;ChampionLifeAuth.getUser=()=>++i===n?new Promise(resolve=>window.releaseIdentity=()=>resolve(commFixture.user)):get();window.actionPromise=b.onclick()},boundary);
   await page.waitForFunction(()=>typeof releaseIdentity==='function');await page.evaluate(mode=>{originControl.remove();commFixture.user=mode==='null'?null:mode==='anonymous'?{id:'synthetic-user',is_anonymous:true}:{id:'silent-replacement'};releaseIdentity()},mode);await page.evaluate(()=>actionPromise);
   eq(await count(page,'message'),0,name+' detached '+mode+' await'+boundary+' sends no read');
   eq(await page.locator('.comm-row').count(),0,name+' detached '+mode+' await'+boundary+' observed invalid identity clears other private rows');
   eq(await page.locator('.staff-state').count(),1,name+' detached '+mode+' await'+boundary+' explicitly retires scope');await page.close();
  }
  if(process.env.DETACHED_AUTH_ONLY)continue;
  // Two microtasks remove the origin after request's final pre-publication check,
  // before the await continuation in the action callback. No runtime instrumentation.
  {
   const {page,errors}=await setup();
   await button(page,'View message').evaluate(b=>{
    const get=ChampionLifeAuth.getUser;let i=0;window.originControl=b;
    ChampionLifeAuth.getUser=()=>++i===3?{then(resolve){resolve(commFixture.user);queueMicrotask(()=>queueMicrotask(()=>b.remove()))}}:get();
    window.actionPromise=b.onclick();
   });await page.evaluate(()=>actionPromise);
   eq(await count(page,'message'),1,name+' publication race issued exactly one read');
   eq(await page.evaluate(()=>originControl.isConnected),false,name+' origin detached at publication boundary');
   eq(await page.locator('.comm-body').count(),0,name+' detached origin cannot publish returned private body');
   eq(await page.locator('.comm-feedback').count(),0,name+' stale intent does not publish notice');eq(errors,[],name+' publication race no browser exception');await page.close();
  }
  if(process.env.MICROTASK_ONLY)continue;
  const cases=[['templates','Create draft','template_create'],['templates','Publish version','template_publish'],['templates','Deactivate','template_deactivate'],['templates','Preview template','template_preview'],['campaign','Record consent','consent'],['campaign','Approve route','route_save'],['campaign','Record external/manual email action','external_action']];
  for(const [view,label,rpc] of cases)for(const boundary of [1,2]){
   const {page,errors}=await setup(view);
   if(label==='Record consent'){await button(page,'Preview audience & message').evaluate(b=>b.onclick());await button(page,label).waitFor()}
   if(label==='Approve route')await page.locator('input[name="approved"]').check();
   await button(page,label).evaluate((b,n)=>{window.originControl=b;let i=0;const get=ChampionLifeAuth.getUser;ChampionLifeAuth.getUser=()=>++i===n?new Promise(resolve=>window.releaseIdentity=()=>resolve(commFixture.user)):get();window.actionPromise=b.onclick()},boundary);
   await page.waitForFunction(()=>typeof releaseIdentity==='function');await page.evaluate(()=>{originControl.remove();releaseIdentity()});await page.evaluate(()=>actionPromise);
   eq(await count(page,rpc),0,name+' '+label+' detached identity wait'+boundary+' performs zero operation');
   const freshLabel=view==='templates'?'Preview template':'Preview audience & message';
   const before=await count(page,view==='templates'?'template_preview':'preview');
   await button(page,freshLabel).evaluate(b=>b.onclick());
   eq(await count(page,view==='templates'?'template_preview':'preview'),before+1,name+' '+label+' aborted action releases busy state for existing current control');
   eq(await page.evaluate(()=>localStorage.length+sessionStorage.length),0,name+' '+label+' no private browser storage');eq(errors,[],name+' '+label+' no browser errors');await page.close();
  }
  // A denial still retires the active principal even if its originating control
  // disappeared while the RPC was pending; disappearance is not revocation bypass.
  for(const thrown of [false,true]){
   const {page}=await setup();
   await page.evaluate(thrown=>{const rpc=ChampionLifeAuth.client.rpc;ChampionLifeAuth.client.rpc=(n,args)=>args.p_action==='message'?new Promise((resolve,reject)=>window.releaseRequest=()=>thrown?reject({code:'42501',message:'PRIVATE_DENIAL'}):resolve({error:{code:'42501',message:'PRIVATE_DENIAL'},status:403})):rpc(n,args)},thrown);
   await button(page,'View message').evaluate(b=>{window.originControl=b;window.actionPromise=b.onclick()});await page.waitForFunction(()=>typeof releaseRequest==='function');await page.evaluate(()=>{originControl.remove();releaseRequest()});await page.evaluate(()=>actionPromise);
   eq(await page.locator('.staff-state').count(),1,name+' '+thrown+' removed control does not hide server denial');eq(await page.locator('.comm-row').count(),0,name+' denial clears private rows');eq(await page.evaluate(()=>refreshes),1,name+' denial asks shell to refresh once');eq((await page.locator('body').innerText()).includes('PRIVATE_DENIAL'),false,name+' denial does not print raw detail');await page.close();
  }
  for(const boundary of [1,2]){
   const {page}=await setup();
   await button(page,'View message').evaluate((b,n)=>{let i=0;const get=ChampionLifeAuth.getUser;ChampionLifeAuth.getUser=()=>++i===n?new Promise(resolve=>window.releaseIdentity=()=>resolve(commFixture.user)):get();window.actionPromise=b.onclick()},boundary);
   await page.waitForFunction(()=>typeof releaseIdentity==='function');await page.evaluate(()=>{commFixture.user={id:'replacement-no-callback'};releaseIdentity()});await page.evaluate(()=>actionPromise);
   eq(await count(page,'message'),0,name+' silent replacement before RPC'+boundary+' denies read');eq(await page.locator('.comm-row').count(),0,name+' silent replacement clears old private rows');await page.close();
  }
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,reviewedRuntime:hash,hosted:false,providerRequests:0}));
