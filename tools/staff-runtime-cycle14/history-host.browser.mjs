// Actual composed staff navigation and People history. Only the accepted fictional
// HTTP models/config are substituted; no source overlay, Auth client shim or grant.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {fixture,peopleIds,ids,session} from '../staff-cycle9/journey-fixture.mjs';
import {verifyActual,root,hash} from './source.mjs';
console.log(JSON.stringify({source:verifyActual()}));
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH);assert.equal(hash(sdk),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const origin='https://history-host.invalid',backend='https://synthetic-modules.supabase.co',key='sb-synthetic-modules-auth-token';
const allowed=new Set(JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root))));let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const[engine,type,width]of[['chromium',chromium,390],['webkit',webkit,1440]]){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  const f=fixture(),context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[],unexpected=[],historyCalls=[];let held=false,release;
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0','https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js'].includes(req.url()))return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend){
    const headers={'access-control-allow-origin':'*'},filters=Object.fromEntries(u.searchParams);
    if(u.pathname==='/rest/v1/followup_tasks'&&req.method()==='GET'&&filters.id){assert.equal(filters.organization_id,'eq.'+ids.o);assert.equal(filters.person_id,'eq.'+peopleIds.p);return route.fulfill({json:{id:filters.id.slice(3)},headers})}
    if(u.pathname==='/rest/v1/followup_task_events'){
     assert.equal(req.method(),'GET');assert.equal(filters.organization_id,'eq.'+ids.o);assert.equal(filters.limit,'51');assert(!filters.select.includes('actor'));assert(!filters.select.includes('payload'));historyCalls.push(filters);
     let rows=Array.from({length:52},(_,i)=>{const n=52-i;return{id:'eeeeeeee-eeee-4eee-8eee-'+String(n).padStart(12,'0'),organization_id:ids.o,task_id:filters.task_id.slice(3),occurred_at:'2026-11-06T12:00:00.123456+00:00',action:n===1?'created':'updated',before_status:n===1?null:'open',after_status:'open',before_due:null,after_due:null,before_revision:n===1?null:n-1,after_revision:n}});
     if(filters.or){const match=/id.lt.([a-f0-9-]+)/.exec(filters.or);assert(match);rows=rows.filter(r=>r.id<match[1])}rows=rows.slice(0,51);if(held){held=false;await new Promise(r=>release=r)}return route.fulfill({json:rows,headers});
    }
    return f.backend(route);
   }
   if(u.origin!==origin||req.method()!=='GET'){unexpected.push(req.url());return route.abort()}
   if(u.pathname==='/seed')return route.fulfill({body:'<!doctype html>Fictional seed',contentType:'text/html'});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-only'}),contentType:'text/javascript'});
   const path=u.pathname.slice(1);assert(allowed.has(path),'actual published dependency '+path);return route.fulfill({body:readFileSync(new URL(path,root)),contentType:path.endsWith('.html')?'text/html':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'image/png'});
  });
  await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
  await page.goto(origin+'/staff-home.html?context=church&org='+ids.o);await page.getByRole('link',{name:'Open People & Follow-up',exact:true}).click();await page.getByRole('button',{name:'Review Person & follow-up',exact:true}).click();await page.getByRole('heading',{name:'Follow-up tasks',exact:true}).waitFor();
  eq(await page.getByLabel('Filter follow-up tasks',{exact:true}).count(),1,engine+' actual shared-host latest People status filter');
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Care 100',exact:true})});await card.getByRole('button',{name:'View task history',exact:true}).click();await card.getByText('History page 1',{exact:true}).waitFor();eq(await card.locator('li').count(),50,engine+' first history page actual shared host');
  await card.getByRole('button',{name:'Older history',exact:true}).click();await card.getByText('History page 2',{exact:true}).waitFor();eq(await card.locator('li').count(),2,engine+' remaining history exact typed keyset');await card.getByRole('button',{name:'Newer history',exact:true}).click();await card.getByText('History page 1',{exact:true}).waitFor();
  await card.getByRole('button',{name:'Older history',exact:true}).evaluate(b=>window.oldHistory=b.onclick);held=true;await card.getByRole('button',{name:'Older history',exact:true}).click();await page.waitForTimeout(30);assert(release,'history request held before replacement');
  f.people.setActor(ids.b);f.modules.setActor(ids.b);await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.b)});release();await page.waitForTimeout(100);
  eq(await page.getByText('Taylor Person',{exact:true}).count(),0,engine+' silent account replacement clears Person');eq(await page.getByText('History page 2',{exact:true}).count(),0,engine+' delayed history cannot return');const before=historyCalls.length;await page.evaluate(()=>{oldHistory();oldHistory()});await page.waitForTimeout(30);eq(historyCalls.length,before,engine+' retained older control issues zero later requests');
  eq(f.people.writes,[],engine+' composed history does not issue tasks or updates');eq(f.modules.writes,[],engine+' no Events Dream mutations');eq(f.writes,[],engine+' no Forms publication or writes');eq(errors,[],engine+' strict zero page errors');eq(unexpected,[],engine+' no external request');
  await context.close();
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,hostedAcceptance:false,actualSource:true}));
