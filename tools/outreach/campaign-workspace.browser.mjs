// Isolated approved staff shell + real source-matched PostgreSQL, fictional Auth only.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const ROOT=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const {createCampaignFoundationTestHost}=await import(process.env.CAMPAIGN_TEST_HOST?pathToFileURL(process.env.CAMPAIGN_TEST_HOST).href:'./campaign-foundation-test-host.mjs');
const host=await createCampaignFoundationTestHost({directory:true}),origin='https://campaign-workspace.invalid',evidence=process.env.CAMPAIGN_EVIDENCE_DIR;
if(evidence)await mkdir(evidence,{recursive:true});
const shell=(await readFile(path.join(ROOT,'staff-home.html'),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
let passed=0;const check=(v,label)=>{assert.ok(v,label);passed++;console.log('PASS '+label)};
const mutations=()=>host.requests.filter(x=>x.action==='followup_save').length;
try{
 for(const [engine,type] of [['chromium',chromium],['webkit',webkit]])for(const [size,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  await host.reset();const browser=await type.launch({headless:true});try{
   const context=await browser.newContext({viewport}),page=await context.newPage();let hold=null,release=null,dropped=false,notInstalled=false;const unexpected=[];
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==origin){unexpected.push(url.origin);return route.abort()}
    if(url.pathname==='/rpc'){
     const {token,name,args}=route.request().postDataJSON();const action=name==='campaign_decision_directory'?'directory':args?.p_action;
     if(hold?.before&&hold.action===action){hold=null;await new Promise(resolve=>release=resolve)}
     let response;try{response={data:name==='campaign_decision_directory'?await host.directory(token):await host.rpc(token,args)}}catch(error){response={error:{code:error.code}}}
     if(hold?.action===action){hold=null;await new Promise(resolve=>release=resolve)}
     if(notInstalled&&action==='directory')response={error:{code:'PGRST202'}};
     if(dropped&&action==='followup_save'){dropped=false;response={error:{code:'NETWORK'}}}
     return route.fulfill({contentType:'application/json',body:JSON.stringify(response)});
    }
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:shell});
    const relative=decodeURIComponent(url.pathname).slice(1);if(relative.includes('..'))return route.abort();
    try{return route.fulfill({contentType:relative.endsWith('.mjs')||relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.svg')?'image/svg+xml':'image/png',body:await readFile(path.join(ROOT,relative))})}catch{return route.abort()}
   });
   await page.goto(origin);await page.evaluate(async({users,org,campaign})=>{
    const {mountCampaignDecisionWorkspace}=await import('/tools/outreach/campaign-workspace-mount.mjs');
    window.fx={users,who:'worker',listeners:new Set(),active:true};const current=()=>fx.users[fx.who];
    const auth={getSession:async()=>({user:{id:current().id},access_token:current().token,expires_at:Date.now()/1000+3600}),client:{supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',rest:{url:'https://abcdefghijklmnopqrst.supabase.co/rest/v1'},auth:{url:'https://abcdefghijklmnopqrst.supabase.co/auth/v1',getUser:async()=>({data:{user:{id:current().id,email_confirmed_at:fx.who==='unverified'?null:'2026-01-01'}}}),onAuthStateChange:fn=>{fx.listeners.add(fn);return{data:{subscription:{unsubscribe(){fx.listeners.delete(fn)}}}}}},rpc:async(name,args)=>{if(!['campaign_decision_directory','campaign_decision_foundation'].includes(name))throw Error('Unexpected RPC');return fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:current().token,name,args})}).then(r=>r.json())}}};
    document.querySelector('#staff-main').hidden=false;document.querySelector('#staff-access-message').textContent='Fictional local acceptance';
    window.mount=mountCampaignDecisionWorkspace({root:document.querySelector('#staff-home-links'),auth,workspace:{active:()=>fx.active},eventTarget:window,projectRef:'abcdefghijklmnopqrst'});window.org=org;window.campaign=campaign;
   },{users:host.users,org:host.orgId,campaign:host.campaignId});
   const label=engine+'/'+size+' ',state=()=>page.evaluate(()=>mount.snapshot());
   const choose=async()=>page.evaluate(async()=>{await mount.refresh();await mount.select(org,campaign)});
   const account=async who=>page.evaluate(w=>{fx.who=w;fx.listeners.forEach(fn=>fn('SIGNED_IN'))},who);
   const open=async record=>{await choose();await page.locator(`[data-registration-id="${record}"]`).click();await page.waitForFunction(()=>mount.snapshot().record?.state==='detail')};
   const retain=async()=>page.evaluate(()=>{window.oldForm=document.querySelector('#staff-home-links form');window.oldSelector=document.querySelector('[aria-label="Assigned decision campaign"]')});
   const stale=async()=>{await page.evaluate(()=>oldForm?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await page.waitForTimeout(20)};
   check((await state()).record===null,label+'initial mount no private data');
   await choose();check((await state()).campaigns.length===1,label+'decision-only worker discovers exact campaign');check((await state()).record.rows.length===2,label+'only assigned decisions listed');check(!(await page.textContent('#staff-home-links')).includes('PRIVATE-'),label+'no contact/prayer data');
   await assert.rejects(page.evaluate(other=>mount.select(org,other),host.otherCampaignId));check((await state()).selected.campaignId===host.campaignId,label+'foreign selector cannot navigate');
   for(const who of ['registrationOnly','peopleOnly']){await account(who);await page.evaluate(()=>mount.refresh());check((await state()).campaigns.length===0,label+who+' cannot discover decision campaigns')}
   await account('emptyWorker');await choose();check((await state()).campaigns.length===1&&(await state()).record.rows.length===0,label+'explicit decision scope with zero assigned records stays empty');
   await account('worker');await open(host.records.a);await retain();const before=mutations();await host.revoke(host.users.worker.id);await page.getByRole('button',{name:'Back to assigned list',exact:true}).click();await page.waitForFunction(()=>mount.snapshot().state==='unavailable');check((await state()).campaigns.length===0&&(await state()).record===null,label+'foundation denial clears directory and details');await stale();check(mutations()===before,label+'denied detached form zero mutations');await host.reset();
   await open(host.records.a);await retain();await account('other');check((await state()).record===null,label+'account switch immediate clear');await stale();check(mutations()===before,label+'old account detached form zero mutations');await open(host.records.c);check((await state()).record.record.registrationId===host.records.c,label+'new account independently authorized');
   await account('worker');await open(host.records.a);await retain();await page.evaluate(()=>window.dispatchEvent(new PopStateEvent('popstate')));await stale();check((await state()).campaigns.length===0,label+'history restoration retires directory and form');
   await open(host.records.a);await retain();await page.evaluate(()=>fx.listeners.forEach(fn=>fn('SIGNED_OUT')));await stale();check((await state()).record===null,label+'logout clears private content');
   await choose();await host.retire(host.users.worker.id);await page.evaluate(()=>mount.refresh().catch(()=>{}));check((await state()).state==='unavailable',label+'actual SQL session retirement denied');await host.reset();
   await choose();await host.expire(host.users.worker.id);await page.evaluate(()=>mount.refresh());check((await state()).campaigns.length===0,label+'expired campaign authority hidden');await host.reset();
   hold={action:'directory'};await page.evaluate(()=>{window.pending=mount.refresh().catch(()=>{})});while(!release)await new Promise(r=>setTimeout(r,10));await account('other');await choose();release();release=null;await page.evaluate(()=>window.pending);check((await state()).record.rows.length===1&&(await state()).record.rows[0].registrationId===host.records.c,label+'old account delayed directory cannot restore records');
   await account('worker');hold={action:'directory',before:true};await page.evaluate(()=>{window.pending=mount.refresh().catch(()=>{})});while(!release)await new Promise(r=>setTimeout(r,10));await choose();await host.retire(host.users.worker.id);release();release=null;await page.evaluate(()=>window.pending);check((await state()).record===null&&(await state()).campaigns.length===0,label+'late same-session directory denial retires newer panel');await host.reset();
   await open(host.records.a);await retain();const unknownBefore=mutations();dropped=true;await page.selectOption('select[name=status]','in_progress');await page.locator('button[type=submit]').click();await page.waitForFunction(()=>mount.snapshot().record?.message?.includes('uncertain'));await stale();check(mutations()===unknownBefore+1,label+'lost save result remains UNKNOWN without resend');await open(host.records.a);check((await state()).record.record.status==='in_progress',label+'fresh authorization observes committed save');
   await retain();await page.evaluate(()=>mount.refresh());const beforeDetached=host.requests.length;await page.evaluate(()=>{oldSelector.value='0';oldSelector.dispatchEvent(new Event('change'))});await page.waitForTimeout(30);check(host.requests.length===beforeDetached&&(await state()).selected===null,label+'detached selector cannot navigate');
   notInstalled=true;await page.evaluate(()=>mount.refresh().catch(()=>{}));check((await state()).message.includes('not installed')&&(await state()).record===null,label+'missing backend unavailable with no fallback');notInstalled=false;
   await account('unverified');await page.evaluate(()=>mount.refresh().catch(()=>{}));check((await state()).campaigns.length===0,label+'unverified identity fail closed');await account('worker');await open(host.records.a);
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+'approved responsive shell no overflow');check(await page.locator('.staff-propel-credit').getAttribute('href')==='https://kingdompropel.com/',label+'Powered by Propel link unchanged');check(unexpected.length===0,label+'no external network');
   if(evidence)await page.screenshot({path:path.join(evidence,engine+'-'+size+'.png'),fullPage:true});await page.evaluate(()=>mount.close());await context.close();
  }finally{await browser.close()}
 }
 console.log(JSON.stringify({passed,failed:0,nativeMutations:mutations(),auditRows:(await host.audit()).length}));
}finally{await host.close()}
