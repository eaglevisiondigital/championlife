// Actual candidate HTML/SDK/Auth/host/module; all HTTP remains fictional/intercepted.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,extname} from 'node:path';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {ids,session,model} from './communications-fixture.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),sdk=readFileSync(process.env.SUPABASE_SDK_PATH);
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
assert.equal(createHash('sha384').update(sdk).digest('base64'),'UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp');
const origin='https://staff-host.invalid',backend='https://fictional-auth.supabase.co',key='sb-fictional-auth-auth-token';
let checks=2;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const [engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  const setup=async()=>{
   const context=await browser.newContext({viewport:{width:engine==='chromium'?390:1440,height:960}}),page=await context.newPage(),f=model(),errors=[],served=new Set();
   page.on('pageerror',e=>errors.push(e.message));

   await context.route('**/*',async route=>{const u=new URL(route.request().url());
    if(u.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({contentType:'text/javascript',body:sdk,headers:{'access-control-allow-origin':'*'}});
    if(u.origin===backend)return f.backend(route);
    if(u.origin!==origin){f.unexpected.push(u.href);return route.abort()}
    if(u.pathname==='/seed'||u.pathname==='/discipleship-login.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Fictional sign in</h1>'});
    if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-public-key'})});
    const path=u.pathname.slice(1);if(path.includes('..'))return route.abort();
    try{const body=readFileSync(join(root,path));served.add(path);return route.fulfill({body,contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[extname(path)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:'Not found'})}
   });
   await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
   const go=async path=>{await page.goto(origin+'/'+path);await page.waitForFunction(()=>StaffWorkspace?.active())};
   return{context,page,f,errors,served,go};
  };
  {
   const {context,page,f,errors,served,go}=await setup();
   await go('staff-home.html');eq(await page.locator('#staff-session-email').textContent(),'first@example.invalid',engine+' exact97 single account header');
   eq(await page.getByRole('link',{name:'Open People & Follow-up',exact:true}).count(),0,engine+' communications-only organization grants no People route');
   await page.getByRole('link',{name:'Open Campaign Communications',exact:true}).click();await page.getByRole('button',{name:'Preview audience & message',exact:true}).waitFor({timeout:10000}).catch(async error=>{console.log(JSON.stringify({errors,calls:f.calls,body:await page.locator('body').innerText()}));throw error});
   eq(new URL(page.url()).searchParams.get('organization'),ids.o,engine+' home opens exact authorized organization');
   eq(await page.locator('.comm-banner').textContent(),'EXTERNAL DELIVERY DISABLED — queued messages remain held.',engine+' delivery remains disabled');
   eq(await page.locator('#communications-app select[name=scope]').count(),0,engine+' single shared host scope control replaces legacy selector');
   await page.getByRole('combobox',{name:'Church organization',exact:true}).selectOption(ids.p);await page.waitForURL('**/staff-campaign-communications.html?organization='+ids.p);await page.getByRole('button',{name:'Preview audience & message',exact:true}).waitFor();
   eq(f.calls.filter(x=>x.action==='senders').at(-1).p.p_payload.organization_id,ids.p,engine+' organization switch binds fresh module RPC');
   await page.getByRole('combobox',{name:'Ministry context',exact:true}).selectOption('outreach');await page.waitForURL('**/staff-home.html?context=outreach');await page.getByRole('link',{name:'Open Campaign Communications',exact:true}).waitFor();
   eq(await page.getByRole('link',{name:'Open Registration & Check-In',exact:true}).count(),0,engine+' communications campaign projection never implies registration authority');
   await page.getByRole('link',{name:'Open Campaign Communications',exact:true}).click();await page.getByRole('button',{name:'Preview audience & message',exact:true}).waitFor();
   eq(new URL(page.url()).searchParams.get('campaign'),ids.c,engine+' exact campaign route selected');
   await page.getByRole('combobox',{name:'Outreach campaign',exact:true}).selectOption(ids.d);await page.waitForURL('**/staff-campaign-communications.html?campaign='+ids.d);await page.getByRole('button',{name:'Preview audience & message',exact:true}).waitFor();
   eq(f.calls.filter(x=>x.action==='senders').at(-1).p.p_payload.organization_id,ids.p,engine+' campaign binds its own organization, not last org authority');
   for(const [file,heading]of [['staff-communications.html','Communications Overview'],['staff-communication-templates.html','Communication Templates'],['staff-communication-activity.html','Delivery Activity']]){await go(file+'?organization='+ids.o);await page.getByRole('heading',{name:heading,exact:true}).waitFor();eq(await page.locator('#communications-app').isVisible(),true,engine+' adapted existing page mounts '+file)}
   await page.getByRole('button',{name:'View message',exact:true}).click();await page.getByText('Private fictional subject\nPrivate fictional body',{exact:true}).waitFor();eq(await page.getByRole('button',{name:'Retry',exact:true}).count(),0,engine+' UNKNOWN activity has no retry');
   eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,engine+' adapted host remains within viewport');
   const contrast=await page.evaluate(()=>{
    const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
    return ['.comm-panel h2','.comm-panel label','.comm-panel .comm-note','.comm-tag'].map(selector=>{const n=document.querySelector(selector),style=getComputedStyle(n);let parent=n,background=style.backgroundColor;while(background==='rgba(0, 0, 0, 0)'&&parent.parentElement){parent=parent.parentElement;background=getComputedStyle(parent).backgroundColor}const a=luminance(style.color),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
   });
   for(const [index,name]of ['heading','label','note','status tag'].entries())eq(contrast[index]>=4.5,true,engine+' actual shared-host '+name+' contrast meets4.5');

   eq([...served].includes('assets/js/staff-session.js')&&[...served].includes('assets/js/communications.js'),true,engine+' actual session and dynamic module served');
   eq(errors,[],engine+' complete primary journey has no runtime errors');eq(f.unexpected,[],engine+' no unexpected sending or provider request');
   if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:process.env.EVIDENCE_DIR+'/'+engine+'-host.png',fullPage:true})}
   await context.close();
  }
  for(const scenario of ['detached-control','denial','delayed-account','module-removal']){
   const{context,page,f,errors,go}=await setup();await go('staff-communication-activity.html?organization='+ids.o);const button=page.getByRole('button',{name:'View message',exact:true});await button.waitFor();await button.evaluate(b=>window.retained=b.onclick);
   f.hold='communications_workspace:message';await button.click();while(!f.release)await new Promise(r=>setTimeout(r,5));
   if(scenario==='detached-control')await button.evaluate(b=>b.closest('.comm-row').remove());
   if(scenario==='module-removal')await page.locator('#communications-app').evaluate(n=>n.remove());
   if(scenario==='denial'){f.denied=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor()}
   if(scenario==='delayed-account')f.actor=ids.b;
   f.release();await page.waitForTimeout(100);
   eq(await page.locator('body').innerText().then(t=>t.includes('Private fictional body')),false,engine+' '+scenario+' late read cannot publish private body');
   const before=f.calls.length;await page.evaluate(()=>retained());await page.waitForTimeout(30);eq(f.calls.length,before,engine+' '+scenario+' retained handler makes no additional RPC');
   if(['denial','delayed-account'].includes(scenario)){eq(await page.locator('#staff-main').isHidden(),true,engine+' '+scenario+' protected host is terminally hidden');eq(await page.locator('#staff-session-email').innerText(),'',engine+' '+scenario+' old identity cleared')}
   eq(errors,[],engine+' '+scenario+' no missing legacy host API');eq(f.unexpected,[],engine+' '+scenario+' no mutation or external operation');await context.close();
  }
  for(const scenario of ['unknown-org','duplicate-scope','mixed-scope','wrong-permission','malformed-permissions','duplicate-context','missing-module']){
   const{context,page,f,errors}=await setup();let url='staff-campaign-communications.html?organization='+ids.o;
   if(scenario==='unknown-org')url='staff-campaign-communications.html?organization=ffffffff-ffff-4fff-8fff-ffffffffffff';
   if(scenario==='duplicate-scope')url+='&organization='+ids.p;
   if(scenario==='mixed-scope')url+='&campaign='+ids.c;
   if(scenario==='wrong-permission')f.context.organizations.forEach(o=>o.permissions=['communications.delivery.view']);
   if(scenario==='malformed-permissions')f.context.organizations[0].permissions='communications.send';
   if(scenario==='duplicate-context')f.context.organizations.push(f.context.organizations[0]);
   if(scenario==='missing-module')f.missing=true;
   await page.goto(origin+'/'+url);await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();
   eq(await page.locator('#staff-main').isHidden(),true,engine+' '+scenario+' unavailable before module mount');
   eq(f.calls.filter(x=>x.name==='communications_workspace'&&x.action!=='context').length,0,engine+' '+scenario+' no scoped Communications RPC');
   eq(errors,[],engine+' '+scenario+' no runtime exception');await context.close();
  }
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,sourceOnly:true,providerRequests:0,hostedAcceptance:false,releaseAuthorized:false}));
