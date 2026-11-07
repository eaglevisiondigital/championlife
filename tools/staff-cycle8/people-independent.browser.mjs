// Independent affected-surface review: new shared host + exact72 modules +97 session.
// The host candidate itself is based on102; this test does not claim a72 release merge.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createPeopleFixture,ids,session} from './people-independent-fixture.mjs';
import {loadSource} from '../staff-cycle7/source.mjs';
import {reviewedHostSession} from '../staff-integration-cycle16/session-source.mjs';
const {chromium,webkit}=await import('../backend-tests/node_modules/playwright/index.mjs');
const root=fileURLToPath(new URL('../../',import.meta.url));
const host=process.env.HOST_SOURCE_ROOT;
assert.ok(host,'HOST_SOURCE_ROOT must explicitly select the reviewed host candidate');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH);
assert.equal(sha(sdk),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const files={'staff-home.html':'homeHtml','staff-people.html':'peopleHtml','staff-outreach-registration.html':'registrationHtml','assets/js/staff-workspace.js':'shell','assets/js/staff-session.js':'sharedSession','assets/js/champion-life-auth.js':'auth','assets/js/outreach-staff-common.js':'common','assets/js/outreach-people.js':'people','assets/js/outreach-registration-staff.js':'registration','assets/js/outreach-registration-form.js':'registrationForm','assets/css/outreach-campaigns.css':'campaignCss','assets/css/staff-portal.css':'portalCss','assets/css/staff-workspace.css':'workspaceCss','assets/css/outreach-registration.css':'registrationCss'};
const sources=Object.fromEntries(Object.entries(files).map(([path,id])=>[path,loadSource(id)]));
// Explicit file selection, no replacement text, shim API, injection or merge.
const hostPaths=['staff-home.html','staff-people.html','staff-outreach-registration.html','assets/js/staff-workspace.js','assets/js/staff-session.js','assets/css/staff-workspace.css','staff-campaign-communications.html','staff-communication-activity.html','assets/js/communications.js','assets/css/communications.css'];
for(const path of hostPaths)sources[path]=readFileSync(new URL(path,pathToFileURL(host+'/')),'utf8');
assert.equal(sources['assets/js/staff-session.js'],reviewedHostSession(host,loadSource('sharedSession')),'host retains exact97 session plus reviewed Partner route only');
const inventory={hostPaths,inputs:Object.fromEntries(Object.entries(sources).map(([p,text])=>[p,sha(text)])),sdk:sha(sdk)};
console.log(JSON.stringify({sourceInventory:inventory}));
const origin='https://people-host-review.invalid',backend='https://synthetic-composition.supabase.co',key='sb-synthetic-composition-auth-token';
let checks=0;const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;console.log('PASS '+label)};
for(const [engine,type] of Object.entries({chromium,webkit})){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  async function setup(options={}){
   const f=createPeopleFixture(options),context=await browser.newContext({viewport:{width:engine==='chromium'?390:1440,height:950}}),page=await context.newPage(),errors=[];
   page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{window.reviewPrints=0;window.print=()=>window.reviewPrints++});
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
    if(url.origin===backend)return f.backend(route);
    if(url.origin!==origin||request.method()!=='GET'){f.unexpected.push(request.method()+' '+url.href);return route.abort()}
    const path=url.pathname.slice(1);
    if(['seed','discipleship-login.html'].includes(path))return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Fictional login destination</h1>'});
    if(path==='assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-key-no-authority'})});
    if(sources[path])return route.fulfill({body:sources[path],contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript'});
    if(['assets/images/logo-gold.png','assets/images/propel-logo-header-transparent.png'].includes(path))return route.fulfill({body:readFileSync(root+path),contentType:'image/png'});
    f.unexpected.push(path);return route.fulfill({status:404,body:''});
   });
   await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
   const button=name=>page.getByRole('button',{name,exact:true});
   const go=async path=>{await page.goto(origin+'/'+path);await page.waitForFunction(()=>window.StaffWorkspace?.active())};
   const person=async()=>{await button('Review Person & follow-up').click();await page.getByRole('heading',{name:'Follow-up tasks',exact:true}).waitFor()};
   const household=async()=>{await button('Open household').click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor()};
   const held=async fn=>{for(let i=0;i<500&&!fn();i++)await page.waitForTimeout(10);assert.ok(fn(),'fictional delayed request reached')};
   const done=async()=>{eq(f.unexpected,[],engine+' no unexpected or external HTTP');eq(errors,[],engine+' no runtime exceptions');await context.close()};
   return{f,page,context,button,go,person,household,held,done};
  }
  {
   const {f,page,button,go,person,household,done}=await setup();
   await go('staff-home.html');
   eq(await page.getByRole('link',{name:'Open People & Follow-up',exact:true}).count(),1,engine+' supported Communications discovery preserves People entry');
   await page.getByRole('link',{name:'Open People & Follow-up',exact:true}).click();await button('Review Person & follow-up').waitFor();await person();
   await button('Older tasks').click();await page.getByText('Task page 2',{exact:true}).waitFor();
   const card=()=>page.locator('article').filter({has:page.getByRole('heading',{name:'Care 002',exact:true})});
   eq(await page.locator('article h4').allTextContents(),['New follow-up task','Care 002','Care 001'],engine+' newhost keeps exact72 keyset page');
   await card().getByRole('button',{name:'Save due date',exact:true}).evaluate(b=>window.reviewOldSave=b.onclick);
   await card().getByLabel('Task due date',{exact:true}).fill('2026-12-20');await card().getByRole('button',{name:'Save due date',exact:true}).click();await card().getByText('open · 2026-12-20',{exact:true}).waitFor();
   eq(f.writes.at(-1).payload,{due_on:'2026-12-20'},engine+' newhost date editor uses existing minimal write');
   eq(f.writes.at(-1).filters.revision,'eq.1',engine+' date editor preserves expected revision');
   let before=f.calls.length;await page.evaluate(()=>reviewOldSave());eq(f.calls.length,before,engine+' detached date control cannot query');
   await card().getByRole('button',{name:'Remove due date',exact:true}).click();await card().getByText('open · No due date',{exact:true}).waitFor();
   await card().getByLabel('Status').selectOption('completed');await card().getByRole('button',{name:'Save task status',exact:true}).click();await card().getByText('completed · No due date',{exact:true}).waitFor();
   eq([f.writes.at(-1).filters.organization_id,f.writes.at(-1).filters.person_id,f.writes.at(-1).filters.revision],['eq.'+ids.o,'eq.'+ids.p,'eq.3'],engine+' remove/status retain scoped current CAS');
   eq(await page.getByText('Task page 2',{exact:true}).count(),1,engine+' page2 remains after due/remove/status');
   await page.getByRole('combobox',{name:'Ministry context',exact:true}).selectOption('outreach');await page.getByRole('link',{name:'Open Registration & Check-In',exact:true}).click();await button('Open household').waitFor();
   await page.getByLabel('Name, phone, email or reference',{exact:true}).fill('Private previous campaign lookup');await button('Search').click();await button('Open household').waitFor();
   await page.getByRole('combobox',{name:'Outreach campaign',exact:true}).selectOption(ids.otherCampaign);await page.waitForURL('**/staff-outreach-registration.html?campaign='+ids.otherCampaign);await button('Open household').waitFor();
   eq(await page.getByLabel('Name, phone, email or reference',{exact:true}).inputValue(),'',engine+' accepted household search clears across host campaign change');
   await household();eq(await button('Check in attendee').isEnabled(),true,engine+' eligible checkin remains useful');
   f.registration.status='closed';await button('Registrations').click();await button('Open household').waitFor();await household();
   eq(await button('Check in attendee').isDisabled(),true,engine+' closed household still denies checkin');before=f.writes.length;
   await button('Check in attendee').evaluate(b=>b.onclick());eq(f.writes.length,before,engine+' retained closed checkin makes no mutation');
   await button('Print backup roster').click();await page.getByRole('heading',{name:'Private campaign backup roster',exact:true}).waitFor();eq(await page.locator('.registration-print tr').count(),1,engine+' closed household omitted from roster');
   f.registration.status='submitted';await button('Registrations').click();await button('Open household').waitFor();await button('Print backup roster').click();await page.getByRole('heading',{name:'Private campaign backup roster',exact:true}).waitFor();eq(await page.locator('.registration-print tr').count(),2,engine+' open household included once');
   before=f.calls.filter(c=>c.action==='csv').length;await button('Print private roster').click();await page.waitForFunction(()=>reviewPrints===1);eq(f.calls.filter(c=>c.action==='csv').length,before+1,engine+' print still reauthorizes export');
   eq(f.calls.some(c=>c.name==='communications_workspace'),true,engine+' affected host actually exercised new discovery');await done();
  }
  {
   const {page,go,button,done}=await setup({unsupported:true});await go('staff-people.html?org='+ids.o);await button('Review Person & follow-up').waitFor();
   eq(await page.locator('#staff-navigation a[href*="communication"]').count(),0,engine+' unavailable optional RPC exposes no Communications navigation');
   eq(await button('Review Person & follow-up').count(),1,engine+' unavailable optional RPC preserves independently authorized People');await done();
  }
  {
   const {f,page,go,done}=await setup({communicationsOnly:true});await go('staff-home.html');
   eq(await page.getByRole('link',{name:'Open People & Follow-up',exact:true}).count(),0,engine+' Communications-only authority creates no People entry');
   eq(await page.getByRole('link',{name:'Open Registration & Check-In',exact:true}).count(),0,engine+' Communications-only authority creates no registration entry');
   eq(await page.locator('a[href*="communication"]').count()>0,true,engine+' separately assigned Communications remains discoverable');
   let before=f.calls.filter(c=>c.name==='people_workspace').length;await page.goto(origin+'/staff-people.html?org='+ids.o);await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();
   eq(f.calls.filter(c=>c.name==='people_workspace').length,before,engine+' Communications-only direct People request denied before module RPC');
   before=f.calls.filter(c=>c.name==='outreach_registration_workspace'&&c.action!=='campaigns').length;await page.goto(origin+'/staff-outreach-registration.html?campaign='+ids.c);await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();
   eq(f.calls.filter(c=>c.name==='outreach_registration_workspace'&&c.action!=='campaigns').length,before,engine+' Communications campaign authority never implies registration access');await done();
  }
  {
   const {f,page,button,go,person,held,done}=await setup();await go('staff-people.html?org='+ids.o);await button('Review Person & follow-up').waitFor();await person();
   await page.getByRole('button',{name:'Save task status',exact:true}).first().evaluate(b=>window.reviewRetiredSave=b.onclick);
   f.holdCommunications();await page.evaluate(()=>dispatchEvent(new Event('focus')));await held(f.communicationsHeld);f.denyCommunications();f.releaseCommunications();
   await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();const before=f.writes.length;await page.evaluate(()=>reviewRetiredSave());
   eq(f.writes.length,before,engine+' delayed current-scope Communications denial retires existing People writer');
   eq(await page.locator('#staff-main').isHidden(),true,engine+' cross-module denial hides private main');eq((await page.locator('body').innerText()).includes('Taylor Person'),false,engine+' cross-module denial removes Person data');await done();
  }
  {
   const {f,page,go,done}=await setup({historyOnly:true});
   await go('staff-campaign-communications.html?campaign='+ids.c+'&person='+ids.p);
   await page.getByRole('heading',{name:'Person communication history',exact:true}).waitFor();
   await page.getByText('No communication activity matches this scope.',{exact:true}).waitFor();
   eq(await page.getByRole('button',{name:'Preview audience & message',exact:true}).count(),0,engine+' Person history route preserves delivery-only access without composition');
   const history=f.calls.filter(c=>c.name==='communications_workspace'&&['external_history','history'].includes(c.action));
   eq(history.map(c=>[c.p_campaign,c.p_payload.organization_id,c.p_payload.person_id]),[[ids.c,ids.o,ids.p],[ids.c,ids.o,ids.p]],engine+' existing history requests bind exact campaign organization Person');
   await page.getByRole('combobox',{name:'Outreach campaign',exact:true}).selectOption(ids.otherCampaign);
   await page.waitForURL('**/staff-communication-activity.html?campaign='+ids.otherCampaign);await page.getByRole('heading',{name:'Delivery Activity',exact:true}).waitFor();
   await page.getByText('No communication activity matches this scope.',{exact:true}).waitFor();
   eq(new URL(page.url()).searchParams.has('person'),false,engine+' scope switch drops prior Person binding');
   eq(f.calls.filter(c=>c.name==='communications_workspace'&&['external_history','history'].includes(c.action)).length,history.length,engine+' scope switch does not infer another-campaign Person history');
   eq(f.calls.filter(c=>c.name==='communications_workspace'&&c.action==='activity').at(-1).p_payload,{organization_id:ids.o},engine+' current activity uses only selected campaign organization');
   eq(f.calls.some(c=>['senders','preview','confirm'].includes(c.action)),false,engine+' delivery-only journey never invokes composition or queue actions');await done();
  }
  for(const denial of [false,true]){
   const {f,page,button,go,held,done}=await setup({activityRead:true});await go('staff-communication-activity.html?campaign='+ids.c);
   await button('View message').waitFor();await button('View message').evaluate(b=>window.reviewMessage=b.onclick);
   f.holdCommunications('message');await button('View message').click();await held(f.communicationsHeld);
   if(denial){f.denyCommunications();await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor()}
   else await button('View message').evaluate(b=>b.remove());
   f.releaseCommunications();await page.waitForTimeout(100);
   eq((await page.locator('body').innerText()).includes('Captured private body'),false,engine+' '+(denial?'denied':'detached')+' current module cannot publish captured private message');
   const before=f.calls.length;await page.evaluate(()=>reviewMessage());await page.waitForTimeout(30);eq(f.calls.length,before,engine+' retired Communications control makes no RPC');
   eq(f.writes.length,0,engine+' retired Communications control never mutates');await done();
  }
  {
   const {f,page,button,go,held,done}=await setup();await go('staff-people.html?org='+ids.o);await button('Review Person & follow-up').waitFor();
   f.hold('people_workspace:detail');await button('Review Person & follow-up').click();await held(f.held);
   f.holdCommunications();await page.evaluate(()=>dispatchEvent(new Event('focus')));await held(f.communicationsHeld);
   // Silent provider-side principal loss: no onAuthStateChange callback is fabricated.
   f.setActor(ids.b);f.releaseCommunications();await page.waitForFunction(()=>!window.StaffWorkspace?.active());f.release();await page.waitForTimeout(100);
   eq((await page.locator('body').innerText()).includes('Taylor Person'),false,engine+' old captured Person response cannot restore account lost during discovery');
   eq(await page.locator('#staff-session-email').textContent().catch(()=>''),'',engine+' observed principal loss removes old account label');eq(f.writes.length,0,engine+' account-loss race makes no mutation');await done();
  }
 }finally{await browser.close()}
}
if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});writeFileSync(process.env.EVIDENCE_DIR+'/people-independent-source.json',JSON.stringify(inventory,null,2)+'\n')}
console.log(JSON.stringify({status:'PASS',checks,scope:'changed host + exact72 People/registration + exact97-derived Partner session',providerRequests:0,genuineAuth:false,sqlAuthorityVerified:false}));
