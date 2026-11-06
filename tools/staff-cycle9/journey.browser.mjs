import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {verifyComposition} from './source.mjs';
import {fixture,peopleIds,ids,session} from './journey-fixture.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'../backend-tests/node_modules/playwright/index.mjs');
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH),sha=data=>createHash('sha256').update(data).digest('hex');
assert.equal(sha(sdk),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
console.log(JSON.stringify({provenance:verifyComposition(),sourceRoot:root}));
const publicFiles=new Set(JSON.parse(readFileSync(root+'tools/site-build/public-files.json')));
const origin='https://staff-cycle9.invalid',backend='https://synthetic-modules.supabase.co',key='sb-synthetic-modules-auth-token';
let checks=0;function eq(a,b,label){assert.deepEqual(a,b,label);checks++;console.log('PASS',label)}
for(const [engine,type,width]of [['chromium',chromium,390],['webkit',webkit,1440]]){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
 const f=fixture(),ctx=await browser.newContext({viewport:{width,height:1000}}),page=await ctx.newPage(),errors=[],unexpected=[],served=new Map();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await ctx.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin==='https://cdn.jsdelivr.net'&&/^\/npm\/@supabase\/supabase-js@2\.118\.0(?:\/dist\/umd\/supabase.js)?$/.test(u.pathname))return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
  if(u.origin===backend)return f.backend(route);
  if(u.origin!==origin||req.method()!=='GET'){unexpected.push(req.method()+' '+req.url());return route.abort()}
  if(u.pathname==='/seed')return route.fulfill({body:'<!doctype html><p>Fictional seed</p>',contentType:'text/html'});
  if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-only'}),contentType:'text/javascript'});
  const file=u.pathname.slice(1);if(!publicFiles.has(file)){unexpected.push(file);return route.fulfill({status:404,body:''})}
  const bytes=readFileSync(path.join(root,file));served.set(file,sha(bytes));return route.fulfill({body:bytes,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'image/png'});
 });
 const b=name=>page.getByRole('button',{name,exact:true}),link=name=>page.getByRole('link',{name,exact:true});
 const home=async()=>{await page.goto(origin+'/staff-home.html?context=church&org='+ids.o);await link('Open Forms').waitFor()};
 await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
 await home();await link('Open Forms').click();await link('Edit').click();await page.getByText('Saved · revision 1',{exact:true}).waitFor();
 await b('Form settings').click();await page.getByLabel('Form name',{exact:true}).fill('Reviewed private draft');await b('Save draft').click();await page.getByText('Saved · revision 2',{exact:true}).waitFor();
 eq(f.writes.length,1,engine+' one private draft revision save');eq(f.form.name,'Reviewed private draft',engine+' actual editor persisted fictional private name');eq(f.version.definition.settings.public_available,false,engine+' draft remains unpublished');eq(await b('Publish version').count(),0,engine+' no publication authority');
 await link('Staff home').click();await link('Open Church Events').click();await b('Private event A').click();await page.getByRole('heading',{name:'Private event A',exact:true}).waitFor();
 eq(await page.getByText(/Nov 10, 2026/).count()>0,true,engine+' existing event occurrence schedule visible');await b('Load dates').click();await page.getByRole('heading',{name:'Private event A',exact:true}).waitFor();eq(f.modules.calls.filter(c=>c.name==='events_workspace'&&c.action==='detail').length,2,engine+' schedule range uses actual detail RPC');
 await b('Close').click();await link('Staff home').click();await link('Open Dream Team & Manual Follow-up').click();await b('Review application').click();await page.getByRole('heading',{name:'Existing manual task A',exact:true}).waitFor();await page.getByText('Task history',{exact:true}).click();eq(await page.getByText(/existing_task_reviewed/).count(),1,engine+' existing manual task history visible');eq(await b('Create manual next-step task').count(),0,engine+' no automatic task issuance');eq(f.modules.calls.filter(c=>c.name==='dream_team_manual_followup'&&c.action==='detail').at(-1).p_data,f.modules.binding,engine+' restricted review binds Person/account/revisions');
 await link('Staff home').click();await link('Open People & Follow-up').click();await b('Review Person & follow-up').click();await b('Older tasks').click();await page.getByText('Task page 2',{exact:true}).waitFor();eq(await page.getByRole('heading',{name:/Care /}).count(),2,engine+' current72 keyset pagination preserves remaining tasks');
 const task=page.locator('article').filter({has:page.getByRole('heading',{name:'Care 002',exact:true})});await task.getByLabel('Task due date',{exact:true}).fill('2026-11-18');await task.getByRole('button',{name:'Save due date',exact:true}).click();await page.getByText('open · 2026-11-18',{exact:true}).waitFor();eq(f.people.writes.filter(w=>w.name==='followup_tasks').at(-1).payload,{due_on:'2026-11-18'},engine+' actual72 editor sends only scoped due-date change');
 await task.getByRole('combobox').selectOption('completed').catch(async error=>{console.log(JSON.stringify({taskEditorFailure:await page.locator('#outreach-people').innerText(),calls:f.people.calls,writes:f.people.writes}));throw error});await task.getByRole('button',{name:'Save task status',exact:true}).click();await page.getByText('completed · 2026-11-18',{exact:true}).waitFor();eq(f.people.writes.filter(w=>w.name==='followup_tasks').at(-1).payload,{status:'completed'},engine+' status save preserves existing due date');eq(f.people.writes.filter(w=>w.name==='followup_tasks').every(w=>w.filters.organization_id==='eq.'+ids.o&&w.filters.person_id==='eq.'+peopleIds.p&&w.filters.revision),true,engine+' direct task edits bind organization Person and revision');
 await page.goto(origin+'/staff-home.html?context=outreach&campaign='+peopleIds.c);await link('Open Registration & Check-In').click();await b('Open household').click();await b('Check in attendee').click();await b('Reverse check-in').waitFor();eq(f.people.writes.filter(w=>w.action==='checkin').length,1,engine+' actual registration attendee check-in accepted in fictional model');
 eq(errors,[],engine+' no browser errors');eq(unexpected,[],engine+' only explicit public candidate assets requested');eq(f.people.unexpected,[],engine+' no unexpected People/registration transport');eq(f.modules.unexpected,[],engine+' no unexpected Events/Dream transport');eq(f.modules.writes,[],engine+' Events/Dream remain read-only');
 console.log(JSON.stringify({engine,width,served:Object.fromEntries(served),writes:[...f.writes,...f.people.writes],fictionalOnly:true}));await ctx.close();
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,source:'actual candidate public files; only config and HTTP transport fictional',hostedAcceptance:false}));
