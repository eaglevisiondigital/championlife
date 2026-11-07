// Existing Staff115 HTML, SDK, Auth and shared host. Only fictional HTTP and the
// explicitly source-derived Communications test composition differ.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {ids,session,model} from '../staff-host-cycle8/communications-fixture.mjs';
import {root,runtime,compose,original,hash} from './source.mjs';
const reproduce=process.env.REPRODUCE_HOST_REMOUNT==='1',actual=process.env.ACTUAL_RUNTIME==='1';
assert(!(reproduce&&actual),'Original reproduction cannot be actual candidate acceptance');
const bytes=reproduce?original(runtime):actual?readFileSync(new URL(runtime,root)):compose();
if(actual)assert.deepEqual(bytes,compose(),'Exact reviewed composition is the actual runtime');
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH);assert.equal(hash(sdk),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
assert.equal((await import('node:crypto')).createHash('sha384').update(sdk).digest('base64'),'UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp');
const origin='https://comms-composition.invalid',backend='https://fictional-auth.supabase.co',key='sb-fictional-auth-auth-token';
let checks=2;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const[engine,type]of Object.entries({chromium,webkit}))for(const width of[390,1440]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  async function setup(){
   const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),f=model(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
   await context.route('**/*',async route=>{const request=route.request(),u=new URL(request.url());
    if(request.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
    if(u.origin===backend)return f.backend(route);
    assert.equal(u.origin,origin,'No unapproved network destination');assert.equal(request.method(),'GET','No provider submission');
    if(u.pathname==='/seed'||u.pathname==='/discipleship-login.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Fictional sign-in only</h1>'});
    if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-public-key'})});
    const path=u.pathname.slice(1);assert(!path.includes('..'));const body=path===runtime?bytes:readFileSync(new URL(path,root));
    return route.fulfill({body,contentType:path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png'});
   });
   await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
   await page.goto(origin+'/staff-communication-activity.html?organization='+ids.o);await page.getByRole('button',{name:'View message',exact:true}).waitFor();
   return{context,page,f,errors};
  }
  const label=engine+width;
  for(const removal of['button','row','root','ancestor']){
   const{context,page,f,errors}=await setup();const before=f.calls.filter(x=>x.action==='message').length;
   await page.getByRole('button',{name:'View message',exact:true}).evaluate((button,kind)=>{
    const old=button.onclick,root=document.querySelector('#communications-app');let node=kind==='button'?button:kind==='row'?button.closest('.comm-row'):root;
    if(kind==='ancestor'){const wrapper=document.createElement('div');root.before(wrapper);wrapper.append(root);node=wrapper;}
    const parent=node.parentNode,next=node.nextSibling;node.remove();parent.insertBefore(node,next);old();
   },removal);
   if(reproduce)await page.getByText('Private fictional subject\nPrivate fictional body',{exact:true}).waitFor();else await page.waitForTimeout(120);
   eq(f.calls.filter(x=>x.action==='message').length-before,reproduce?1:0,label+' '+removal+' remount '+(reproduce?'reproduces stale read':'blocks stale read'));
   if(!reproduce)eq(await page.locator('.comm-body').count(),0,label+' no protected returned body');
   eq(errors,[],label+' strict zero page errors');eq(f.unexpected,[],label+' no provider/mutation operation');await context.close();
  }
  if(reproduce)continue;
  for(const action of['row-remount','root-remount','account','denial','pagehide']){
   const{context,page,f,errors}=await setup();const button=page.getByRole('button',{name:'View message',exact:true});
   await button.evaluate(b=>window.retained=b.onclick);f.hold='communications_workspace:message';await button.click();while(!f.release)await new Promise(r=>setTimeout(r,5));
   if(action.endsWith('remount'))await button.evaluate((b,kind)=>{const node=kind==='root-remount'?document.querySelector('#communications-app'):b.closest('.comm-row'),parent=node.parentNode,next=node.nextSibling;node.remove();parent.insertBefore(node,next)},action);
   if(action==='account'){f.actor=ids.b;await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.b)});}
   if(action==='denial'){f.denied=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();}
   if(action==='pagehide')await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
   f.release();await page.waitForTimeout(160);eq(await page.locator('.comm-body').count(),0,label+' '+action+' late body suppressed');
   const before=f.calls.length;await page.evaluate(()=>{retained();retained()});await page.waitForTimeout(70);eq(f.calls.length,before,label+' '+action+' retained controls issue zero new requests');
   eq(errors,[],label+' '+action+' strict zero page errors');eq(f.unexpected,[],label+' '+action+' no provider operation');await context.close();
  }
  {
   const{context,page,f,errors}=await setup();await page.getByRole('button',{name:'View message',exact:true}).click();await page.getByText('Private fictional subject\nPrivate fictional body',{exact:true}).waitFor();
   eq(f.calls.filter(x=>x.action==='message').length,1,label+' current authorized read still works');
   eq(await page.locator('#communications-app select[name=scope]').count(),0,label+' no duplicate legacy scope control');
   eq(await page.getByRole('button',{name:'Retry',exact:true}).count(),0,label+' UNKNOWN no retry');
   await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.waitForTimeout(100);eq(await page.locator('.comm-body').count(),1,label+' legitimate same-account refresh retains view');
   await page.getByRole('combobox',{name:'Church organization',exact:true}).selectOption(ids.p);await page.waitForURL('**/staff-communication-activity.html?organization='+ids.p);await page.getByRole('button',{name:'View message',exact:true}).waitFor();
   eq(f.calls.filter(x=>x.action==='activity').at(-1).p.p_payload.organization_id,ids.p,label+' actual shared host binds authorized organization');
   eq(await page.locator('.comm-body').count(),0,label+' navigation clears prior private detail');
   eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,label+' responsive shared host fits viewport');
   if(width===390){await page.getByRole('button',{name:'Menu',exact:true}).click();eq(await page.locator('#staff-menu').getAttribute('aria-expanded'),'true',label+' actual mobile navigation opens');}
   const credit=page.getByRole('link',{name:'Powered by Kingdom Propel (opens in new tab)',exact:true});
   eq(await credit.getAttribute('href'),'https://kingdompropel.com/',label+' approved branding link remains');
   eq(await credit.getByRole('img',{name:'Propel by Eagle Vision',exact:true}).getAttribute('src'),'assets/images/propel-logo-header-transparent.png',label+' approved logo remains');
   eq(errors,[],label+' positive journey strict zero errors');eq(f.unexpected,[],label+' all transports fictional and disabled');await context.close();
  }
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,reproduce,actualRuntime:actual,runtimeSHA256:hash(bytes),sourceOnly:true,hostedAcceptance:false,sending:false}));
