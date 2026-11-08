import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {chromium,webkit}=await import('../backend-tests/node_modules/playwright/index.mjs');
const {session}=await import(root+'tools/staff-cycle7/people-registration-fixture.mjs');
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH);assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const o='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',origin='https://events-cycle23.invalid',backend='https://synthetic-events.supabase.co';
let checks=0;
for(const [engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of[390,1440])for(const scenario of['live','button-reinsert','form-reinsert','ancestor-reinsert','held-form','held-button','held-account','held-logout','held-organization','submitted-then-retired','normal-reopen',...['button','form','root'].flatMap(x=>['late-'+x+'-success','late-'+x+'-denial'])]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[],writes=[];let hold=false,release=null,held=false,holdResponse=false,responseHeld=false,releaseResponse;const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
   if(req.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend){
    if(u.pathname==='/auth/v1/user'){if(hold){hold=false;held=true;await new Promise(r=>release=r)}return send({id:a,email:'fictional@example.test',email_confirmed_at:'2026-01-01',role:'authenticated',aud:'authenticated'})}
    const name=u.pathname.split('/').at(-1),p=req.postDataJSON()||{};
    if(name==='staff_workspace_context')return send({organizations:[{id:o,name:'Fictional Church'},{id:other,name:'Fictional Church B'}],grants:[o,other].map(organization_id=>({organization_id,permission:'events.manage'}))});
    if(name==='events_workspace'){
     if(p.p_action==='context')return send({timezone:'UTC',manage_configuration:true,departments:[],labels:[],locations:[],approval_required:true,settings_revision:1});
     if(p.p_action==='list')return send([]);
     if(p.p_action==='save'){writes.push(p);if(holdResponse){holdResponse=false;responseHeld=true;await new Promise(r=>releaseResponse=r)}return scenario.endsWith('-success')?send({id:'dddddddd-dddd-4ddd-8ddd-dddddddddd01'}):scenario.endsWith('-denial')?send({code:'42501',message:'Fictional revocation'},403):send({code:'40001',message:'stale fictional response'},409)}
    }
    throw Error('Unexpected backend '+req.url())
   }
   assert.equal(u.origin,origin,'No external request');
   if(u.pathname==='/seed')return route.fulfill({body:'<!doctype html>',contentType:'text/html'});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'}),contentType:'text/javascript'});
   const path=root+u.pathname.slice(1);assert(existsSync(path),path);return route.fulfill({body:readFileSync(path),contentType:path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png'});
  });
  await page.goto(origin+'/seed');await page.evaluate(value=>localStorage.setItem('sb-synthetic-events-auth-token',JSON.stringify(value)),session(a));
  await page.goto(origin+'/staff-events.html?org='+o);await page.getByRole('button',{name:'Create event',exact:true}).click();
  await page.locator('input[name=title]').fill('Fictional draft');await page.locator('input[name=local_start]').fill('2026-11-10T12:00');await page.locator('input[name=local_end]').fill('2026-11-10T13:00');await page.locator('[name=internal_notes]').fill('PRIVATE OWNER A');
  await page.evaluate(s=>{const f=document.querySelector('form.event-form'),b=f.querySelector('[type=submit]');window.heldForm=f;if(s==='button-reinsert'){const p=b.parentNode;b.remove();p.append(b)}if(s==='form-reinsert'){const p=f.parentNode;f.remove();p.append(f)}if(s==='ancestor-reinsert'){const d=f.parentNode,p=d.parentNode;d.remove();p.append(d)}},scenario);
  if(scenario.startsWith('held-'))await page.evaluate(()=>{const original=ChampionLifeAuth.getUser;let once=true;ChampionLifeAuth.getUser=async(...args)=>{if(once){once=false;window.__eventsAuthHeld=true;await new Promise(r=>window.__releaseEventsAuth=r)}return original(...args)}});
  if(scenario==='normal-reopen'){await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Create event',exact:true}).click();await page.locator('input[name=title]').fill('Fresh fictional draft');await page.locator('input[name=local_start]').fill('2026-11-10T12:00');await page.locator('input[name=local_end]').fill('2026-11-10T13:00')}
  if(scenario==='submitted-then-retired'||scenario.startsWith('late-'))holdResponse=true;
  await page.getByRole('button',{name:'Save',exact:true}).click();
  if(scenario.startsWith('held-')){await page.waitForFunction(()=>window.__eventsAuthHeld===true);
   if(scenario==='held-organization')await page.locator('select[name=organization]').selectOption(other);
   await page.evaluate(({scenario,otherSession})=>{
    if(scenario==='held-account')localStorage.setItem('sb-synthetic-events-auth-token',JSON.stringify(otherSession));
    if(scenario==='held-logout')localStorage.removeItem('sb-synthetic-events-auth-token');
    if(scenario==='held-form'||scenario==='held-button'){const f=window.heldForm,n=scenario==='held-button'?f.querySelector('[type=submit]'):f,p=n.parentNode;n.remove();p.append(n)}
    window.__releaseEventsAuth();
   },{scenario,otherSession:session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')});
  }
  if(scenario==='submitted-then-retired'){for(let i=0;i<200&&!responseHeld;i++)await page.waitForTimeout(10);assert(responseHeld);await page.evaluate(()=>{const f=window.heldForm,p=f.parentNode;f.remove();p.append(f)});releaseResponse();await page.waitForTimeout(100);await page.getByRole('button',{name:'Save',exact:true}).click()}
  if(scenario.startsWith('late-')){for(let i=0;i<200&&!responseHeld;i++)await page.waitForTimeout(10);assert(responseHeld);await page.evaluate(({scenario,otherSession})=>{const f=window.heldForm,n=scenario.includes('-button-')?f.querySelector('[type=submit]'):scenario.includes('-form-')?f:document.querySelector('#staff-events-app'),p=n.parentNode;n.remove();p.append(n);if(scenario.endsWith('-success'))localStorage.setItem('sb-synthetic-events-auth-token',JSON.stringify(otherSession));},{scenario,otherSession:session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')});releaseResponse();await page.waitForTimeout(180);assert.equal(await page.locator('[name=internal_notes]').count(),0);checks++}
  const expected=['live','normal-reopen','submitted-then-retired'].includes(scenario)||scenario.startsWith('late-')?1:0;
  if(expected)for(let i=0;i<200&&!writes.length;i++)await page.waitForTimeout(10);
  await page.waitForTimeout(180);assert.equal(writes.length,expected);assert.deepEqual(errors,[]);checks+=2;
  if(writes.length){assert.equal(writes[0].p_org,o);assert.equal(writes[0].p_action,'save');checks+=2}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks++;

  console.log(JSON.stringify({engine,width,scenario,newSaveRequests:writes.length,expectedNewSaveRequests:expected,heldAuthIsTestGate:scenario.startsWith('held-'),sourceSHA256:createHash('sha256').update(readFileSync(root+'assets/js/staff-events.js')).digest('hex'),pageErrors:errors}));await context.close();
 }}finally{await browser.close()}
}
for(const [engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of[390,1440])for(const scenario of['normal-switch','history-failure']){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[],writes=[],readScopes=[];let hold=false,release=null,held=false,holdResponse=false,responseHeld=false,releaseResponse;const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
   if(req.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend){
    if(u.pathname==='/auth/v1/user'){if(hold){hold=false;held=true;await new Promise(r=>release=r)}return send({id:a,email:'fictional@example.test',email_confirmed_at:'2026-01-01',role:'authenticated',aud:'authenticated'})}
    const name=u.pathname.split('/').at(-1),p=req.postDataJSON()||{};
    if(name==='staff_workspace_context')return send({organizations:[{id:o,name:'Fictional Church'},{id:other,name:'Fictional Church B'}],grants:[o,other].map(organization_id=>({organization_id,permission:'events.manage'}))});
    if(name==='events_workspace'){readScopes.push(p.p_org);
     if(p.p_action==='context')return send({timezone:'UTC',manage_configuration:true,departments:[],labels:[],locations:[],approval_required:true,settings_revision:1});
     if(p.p_action==='list')return send([{id:'dddddddd-dddd-4ddd-8ddd-dddddddddd01',title:p.p_org===o?'PRIVATE ORIGINAL EVENT':'NEW ORGANIZATION EVENT',status:'draft',visibility:'staff',local_start:'2026-11-10T12:00:00'}]);
     if(p.p_action==='save'){writes.push(p);if(holdResponse){holdResponse=false;responseHeld=true;await new Promise(r=>releaseResponse=r)}return scenario.endsWith('-success')?send({id:'dddddddd-dddd-4ddd-8ddd-dddddddddd01'}):scenario.endsWith('-denial')?send({code:'42501',message:'Fictional revocation'},403):send({code:'40001',message:'stale fictional response'},409)}
    }
    throw Error('Unexpected backend '+req.url())
   }
   assert.equal(u.origin,origin,'No external request');
   if(u.pathname==='/seed')return route.fulfill({body:'<!doctype html>',contentType:'text/html'});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'}),contentType:'text/javascript'});
   const path=root+u.pathname.slice(1);assert(existsSync(path),path);return route.fulfill({body:readFileSync(path),contentType:path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png'});
  });

  await page.goto(origin+'/seed');await page.evaluate(value=>localStorage.setItem('sb-synthetic-events-auth-token',JSON.stringify(value)),session(a));
  await page.goto(origin+'/staff-events.html?org='+o);await page.getByRole('button',{name:'PRIVATE ORIGINAL EVENT',exact:true}).waitFor();
  if(scenario==='history-failure')await page.evaluate(()=>history.replaceState=()=>{throw new DOMException('Injected history failure','SecurityError')});
  await page.locator('select[name=organization]').selectOption(other);
  if(scenario==='normal-switch')await page.getByRole('button',{name:'NEW ORGANIZATION EVENT',exact:true}).waitFor();
  const oldVisible=await page.getByRole('button',{name:'PRIVATE ORIGINAL EVENT',exact:true}).count();
  assert.equal(oldVisible,0);assert.equal(writes.length,0);assert.deepEqual(errors,[]);checks+=3;
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks++;
  if(scenario==='history-failure'){
   await page.getByText('Organization change unavailable. Reload to verify access.',{exact:true}).waitFor();
   assert.equal(await page.locator('select[name=organization] option').count(),0);assert.equal(readScopes.includes(other),false);assert.equal(new URL(page.url()).search,'?org='+o);checks+=3;
  }else{assert.equal(new URL(page.url()).search,'?org='+other);assert.equal(await page.locator('select[name=organization]').inputValue(),other);assert.equal(readScopes.includes(other),true);checks+=3;}
  console.log(JSON.stringify({engine,width,scenario,oldVisible,newMutations:writes.length,pageErrors:errors,route:new URL(page.url()).search,selector:await page.locator('select[name=organization]').inputValue()}));await context.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({checks,syntheticAuth:true,providerAcceptance:false}));
