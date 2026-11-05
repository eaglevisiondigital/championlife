// Real Chromium/WebKit + actual new RPC in disposable PostgreSQL. Fictional Auth only.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const ROOT=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const fixtureUrl=process.env.CAMPAIGN_TASK_FIXTURE?pathToFileURL(process.env.CAMPAIGN_TASK_FIXTURE):new URL('./campaign-task-fixture.mjs',import.meta.url);
const {createCampaignTaskFixture,TASK_MIGRATION}=await import(fixtureUrl.href);
const migrationUrl=new URL('../../'+TASK_MIGRATION,fixtureUrl);
const digest=async url=>createHash('sha256').update(await readFile(url)).digest('hex');
const sourceBinding={fixture:await digest(fixtureUrl),migration:await digest(migrationUrl),reader:await digest(new URL('./campaign-person-task-reader.mjs',import.meta.url))};
console.log(JSON.stringify({sourceBinding}));
const host=await createCampaignTaskFixture(),origin='https://campaign-task.invalid';
const evidence=process.env.CAMPAIGN_TASK_EVIDENCE;if(evidence)await mkdir(evidence,{recursive:true});
let passed=0;const check=(value,label)=>{assert.ok(value,label);passed++;console.log('PASS '+label)};
const shell=(await readFile(path.join(ROOT,'staff-home.html'),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
const originalCounts=await host.counts();
try{
 for(const [engine,type]of[['chromium',chromium],['webkit',webkit]])for(const [size,viewport]of[['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  await host.reset();const browser=await type.launch({headless:true});
  try{
   const context=await browser.newContext({viewport}),page=await context.newPage();let hold=null,release=null,network=false;const unexpected=[];
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==origin){unexpected.push(url.origin);return route.abort()}
    if(url.pathname==='/rpc'){
     const {name,token,args}=route.request().postDataJSON();assert.equal(name,'campaign_person_task_context');
     if(hold==='before'){hold=null;await new Promise(resolve=>release=resolve)}
     let response;try{response={data:await host.rpc(token,args)}}catch(error){response={error:{code:error.code}}}
     if(hold==='after'){hold=null;await new Promise(resolve=>release=resolve)}
     if(network){network=false;return route.fulfill({contentType:'application/json',body:JSON.stringify({error:{code:'NETWORK'}})})}
     return route.fulfill({contentType:'application/json',body:JSON.stringify(response)});
    }
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:shell});
    const relative=decodeURIComponent(url.pathname).slice(1);if(relative.includes('..'))return route.abort();
    try{const body=await readFile(path.join(ROOT,relative));return route.fulfill({contentType:relative.endsWith('.mjs')||relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.svg')?'image/svg+xml':'image/png',body})}catch{return route.abort()}
   });
   await page.goto(origin);await page.evaluate(async({users,selection})=>{
    const {createCampaignPersonTaskReader}=await import('/tools/outreach/campaign-person-task-reader.mjs');
    window.fx={users,who:'worker',active:true,listeners:[],selection,expiry:Math.floor(Date.now()/1000)+3600,throwErrors:false,events:[]};
    const current=()=>fx.users[fx.who];
    const auth={getSession:async()=>({user:{id:current().id},access_token:current().token,expires_at:fx.expiry}),client:{supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',rest:{url:'https://abcdefghijklmnopqrst.supabase.co/rest/v1'},auth:{url:'https://abcdefghijklmnopqrst.supabase.co/auth/v1',getUser:async()=>({data:{user:{id:current().id,email_confirmed_at:fx.who==='unverified'?null:'2026-01-01'}}}),onAuthStateChange:fn=>{fx.listeners.push(fn);return{data:{subscription:{unsubscribe(){fx.listeners=fx.listeners.filter(x=>x!==fn)}}}}}},rpc:async(name,args)=>{const response=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args,token:current().token})}).then(r=>r.json());if(fx.throwErrors&&response.error)throw Object.assign(Error('Fixture rejection'),response.error);return response}}};
    document.querySelector('#staff-main').hidden=false;document.querySelector('#staff-access-message').textContent='Fictional local acceptance';
    window.panel=document.querySelector('#staff-home-links');
    window.reader=createCampaignPersonTaskReader({auth,workspace:{active:()=>fx.active},eventTarget:window,projectRef:'abcdefghijklmnopqrst',onSnapshot:value=>{
     fx.events.push(value?.state||'closed');panel.replaceChildren();
     const status=document.createElement('p');status.textContent=value?.state==='ready'?value.task.title+' · '+value.task.status+' · '+(value.task.dueOn||'No due date'):value?.message||value?.state||'Closed';panel.append(status);
     if(value?.state==='ready'){const button=document.createElement('button'),ticket=window.ticket;button.textContent='Refresh authorized task';button.onclick=()=>reader.load(ticket).catch(()=>{});panel.append(button)}
     if(fx.reenter&&value?.state===fx.reenter){fx.reenter=null;reader.revoke()}
    }});
    window.openTask=async(selection=fx.selection)=>{window.ticket=reader.select(selection);return reader.load(ticket)};
   },{users:host.users,selection:host.selection});
   const label=engine+'/'+size+' ',state=()=>page.evaluate(()=>reader.snapshot()),open=()=>page.evaluate(()=>openTask()),retain=()=>page.evaluate(()=>window.oldButton=panel.querySelector('button'));
   const settle=async()=>{await page.waitForTimeout(25)};
   const waitHold=async()=>{for(let i=0;i<500&&!release;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(release,'request reached local delay')};
   await open();check((await state()).task.id===host.taskId,label+'actual SQL neutral task read');check((await state()).task.personId===host.personId,label+'actual canonical Person binding');check(!JSON.stringify(await state()).includes('PRIVATE-')&&!JSON.stringify(await state()).includes('fictional-worker'),label+'no source/private/token projection');
   check(await page.locator('button',{hasText:'Refresh authorized task'}).count()===1,label+'read-only refresh available');check(await page.evaluate(()=>!reader.save&&!reader.create&&!reader.update&&!reader.retry),label+'no mutation ports');
   await retain();await host.revoke('worker');await page.evaluate(()=>reader.load(ticket).catch(()=>{}));check((await state()).state==='unavailable'&&await page.locator('#staff-home-links button').count()===0,label+'native campaign denial removes task/control');const deniedCount=host.requests.length;await page.evaluate(()=>oldButton.click());await settle();check(host.requests.length===deniedCount,label+'retained denied control issues zero requests');
   await host.reset();await open();check((await state()).state==='ready',label+'fresh authorized session succeeds');
   for(const who of ['campaignOnly','peopleOnly','other','unverified']){await page.evaluate(who=>{fx.who=who;fx.listeners.forEach(fn=>fn('SIGNED_IN'))},who);await open().catch(()=>{});check((await state()).state==='unavailable',label+who+' cannot view task');}
   await page.evaluate(()=>{fx.who='worker';fx.listeners.forEach(fn=>fn('SIGNED_IN'))});await open();
   const beforeSilent=host.requests.length;await page.evaluate(()=>fx.who='other');await page.evaluate(()=>reader.load(ticket).catch(()=>{}));check((await state()).state==='unavailable'&&host.requests.length===beforeSilent,label+'silent account change clears before RPC');await page.evaluate(()=>{fx.who='worker';fx.listeners.forEach(fn=>fn('SIGNED_IN'))});await open();
   await retain();hold='before';await page.evaluate(()=>{window.pending=reader.load(ticket).catch(e=>e.code)});await waitHold();await host.revoke('worker');release();release=null;await page.evaluate(()=>pending);check((await state()).state==='unavailable',label+'revocation during pending SQL read');await host.reset();await open();
   hold='after';await page.evaluate(()=>{window.pending=reader.load(ticket).catch(e=>e.code)});await waitHold();await page.evaluate(()=>{fx.who='other';fx.listeners.forEach(fn=>fn('SIGNED_IN'))});release();release=null;await page.evaluate(()=>pending);check((await state()).state==='unavailable',label+'late prior-account response cannot restore');await page.evaluate(()=>{fx.who='worker';fx.listeners.forEach(fn=>fn('SIGNED_IN'))});await open();
   hold='after';await page.evaluate(()=>{window.pending=reader.load(ticket).catch(e=>e.code)});await waitHold();await page.evaluate(()=>reader.revoke());await open();const rendered=await page.evaluate(()=>fx.events.length);release();release=null;await page.evaluate(()=>pending);check((await state()).state==='ready'&&(await page.evaluate(()=>fx.events.length))===rendered,label+'A retire A late response does not republish');
   for(const [field,value]of[['organizationId',host.foreignOrgId],['campaignId',host.otherCampaignId],['taskId',host.ordinaryTaskId],['bindingRevision',2]]){await page.evaluate(async([field,value])=>{await openTask({...fx.selection,[field]:value}).catch(()=>{})},[field,value]);check((await state()).state==='unavailable',label+field+' server mismatch/conflict fails closed');}
   await open();await host.withdraw();await page.evaluate(()=>reader.load(ticket).catch(()=>{}));check((await state()).state==='unavailable',label+'consent withdrawal denies');await host.reset();await open();await host.retire('worker');await page.evaluate(()=>reader.load(ticket).catch(()=>{}));check((await state()).state==='unavailable',label+'native session retirement denies');await host.reset();await open();
   for(const name of ['popstate','pagehide','pageshow','storage','staff-protected-clear','staff-access-denied']){await retain();await page.evaluate(name=>dispatchEvent(new Event(name)),name);const before=host.requests.length;await page.evaluate(()=>oldButton.click());await settle();check((await state()).state==='unavailable'&&host.requests.length===before,label+name+' retires retained control');await open();}
   await page.evaluate(()=>fx.listeners.forEach(fn=>fn('SIGNED_OUT')));check((await state()).state==='unavailable',label+'logout immediate cleanup');await open();
   network=true;const beforeNetwork=host.requests.length;await page.evaluate(()=>reader.load(ticket).catch(()=>{}));check((await state()).state==='unavailable'&&host.requests.length===beforeNetwork+1,label+'ordinary network failure clears and does not retry');await open();
   await page.evaluate(()=>fx.throwErrors=true);await host.revoke('worker');await page.evaluate(()=>reader.load(ticket).catch(()=>{}));check((await state()).state==='unavailable',label+'rejecting RPC denial clears');await host.reset();await page.evaluate(()=>fx.throwErrors=false);await open();
   for(const phase of ['loading','ready']){await page.evaluate(async phase=>{fx.reenter=phase;await reader.load(ticket).catch(()=>{})},phase);check((await state()).state==='unavailable',label+phase+' synchronous retirement wins');await open();}
   await page.evaluate(async()=>{fx.expiry=(Date.now()+1000)/1000;await reader.load(ticket)});await page.waitForTimeout(1100);check((await state()).state==='unavailable',label+'expiry timer clears displayed task');await page.evaluate(()=>fx.expiry=Math.floor(Date.now()/1000)+3600);await open();
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+'no mobile overflow');check(await page.locator('.staff-propel-credit').getAttribute('href')==='https://kingdompropel.com/',label+'unchanged branding link');check(unexpected.length===0,label+'zero external network');
   assert.deepEqual(await host.counts(),originalCounts);check(true,label+'zero task/audit mutations');
   if(evidence)await page.screenshot({path:path.join(evidence,engine+'-'+size+'.png'),fullPage:true});await page.evaluate(()=>reader.close());await context.close();
  }finally{await browser.close()}
 }
 assert.equal(await digest(fixtureUrl),sourceBinding.fixture,'fixture unchanged during run');
 assert.equal(await digest(migrationUrl),sourceBinding.migration,'migration unchanged during run');
 assert.equal(await digest(new URL('./campaign-person-task-reader.mjs',import.meta.url)),sourceBinding.reader,'reader unchanged during run');
 console.log(JSON.stringify({passed,failed:0,nativeContextReads:host.requests.length,taskMutations:0,auditMutations:0,providerAuthentication:false,sourceBinding}));
}finally{await host.close()}
