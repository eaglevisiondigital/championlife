// Novel exact-source shell102 + People/registration72 + session97 composition.
// All HTTP/Auth data is fictional; no runtime source is rewritten or injected.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {ids,session,createFixture} from './people-registration-fixture.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {loadSource}=await import(process.env.STAFF_SOURCE_LOADER?pathToFileURL(process.env.STAFF_SOURCE_LOADER).href:new URL('./source.mjs',import.meta.url));
const {chromium,webkit}=await import(new URL('../backend-tests/node_modules/playwright/index.mjs',import.meta.url));
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH),sdkUrl='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0';
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const files={'staff-home.html':'homeHtml','staff-people.html':'peopleHtml','staff-outreach-registration.html':'registrationHtml','assets/js/staff-workspace.js':'shell','assets/js/staff-session.js':'sharedSession','assets/js/champion-life-auth.js':'auth','assets/js/outreach-staff-common.js':'common','assets/js/outreach-people.js':'people','assets/js/outreach-registration-staff.js':'registration','assets/js/outreach-registration-form.js':'registrationForm','assets/css/outreach-campaigns.css':'campaignCss','assets/css/staff-portal.css':'portalCss','assets/css/staff-workspace.css':'workspaceCss','assets/css/outreach-registration.css':'registrationCss'};
const source=Object.fromEntries(Object.entries(files).map(([p,id])=>[p,loadSource(id)]));
const origin='https://staff-composition.invalid',backend='https://synthetic-composition.supabase.co',key='sb-synthetic-composition-auth-token';
let checks=0;const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;console.log('PASS '+label)};
for(const [engine,type] of Object.entries({chromium,webkit})){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1440]){
  const f=createFixture(),context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.fixturePrints=0;window.print=()=>window.fixturePrints++});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(req.url()===sdkUrl)return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend)return f.backend(route);
   if(u.origin!==origin||req.method()!=='GET'){f.unexpected.push(req.method()+' '+u.origin+u.pathname);return route.abort()}
   if(u.pathname==='/seed'||u.pathname==='/discipleship-login.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Fictional sign-in destination</h1>'});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-key-no-authority'})});
   const path=u.pathname.slice(1);if(source[path]){f.served.add(path);return route.fulfill({body:source[path],contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript'})}
   if(['assets/images/logo-gold.png','assets/images/propel-logo-header-transparent.png'].includes(path))return route.fulfill({body:readFileSync(root+path),contentType:'image/png'});
   f.unexpected.push(path);return route.fulfill({status:404,body:''});
  });
  const b=name=>page.getByRole('button',{name,exact:true}),ready=async()=>{await page.waitForFunction(()=>window.StaffWorkspace?.active())};
  const seed=async actor=>{f.setActor(actor);await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(actor)})};
  const goto=async path=>{await page.goto(origin+'/'+path);await ready()};
  const openPerson=async()=>{await b('Review Person & follow-up').click();await page.getByRole('heading',{name:'Follow-up tasks',exact:true}).waitFor()};
  const openHousehold=async()=>{await b('Open household').click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor()};
  const waitHold=async()=>{for(let i=0;i<500&&!f.held();i++)await page.waitForTimeout(10);assert.ok(f.held(),'held fictional response reached')};
  const label=engine+' '+width;
  await seed(ids.a);await goto('staff-home.html');
  eq(await page.getByRole('link',{name:'Open People & Follow-up',exact:true}).count(),1,label+' shell102 discovers current Church authority');
  if(width===390){await b('Menu').click();eq(await page.locator('#staff-menu').getAttribute('aria-expanded'),'true',label+' actual shell mobile menu opens');await page.keyboard.press('Escape');eq(await page.locator('#staff-menu').getAttribute('aria-expanded'),'false',label+' Escape closes current menu')}
  eq(await page.locator('.staff-propel-credit').getAttribute('href'),'https://kingdompropel.com/',label+' original Powered by Propel destination retained');
  await page.getByRole('link',{name:'Open People & Follow-up',exact:true}).click();await b('Review Person & follow-up').waitFor();await openPerson();
  await b('Older tasks').click();await page.getByText('Task page 2',{exact:true}).waitFor();
  const card=()=>page.locator('article').filter({has:page.getByRole('heading',{name:'Care 002',exact:true})});
  eq(await page.locator('article h4').allTextContents(),['New follow-up task','Care 002','Care 001'],label+' People72 older task page mounted by shell102');
  await card().getByRole('button',{name:'Save due date',exact:true}).evaluate(e=>window.previousSave=e.onclick);
  await card().getByLabel('Task due date',{exact:true}).fill('2026-12-15');await card().getByRole('button',{name:'Save due date',exact:true}).click();await card().getByText('open · 2026-12-15',{exact:true}).waitFor();
  const saved=f.writes.at(-1);eq(saved.payload,{due_on:'2026-12-15'},label+' existing date action retains minimal payload');eq([saved.filters.organization_id,saved.filters.person_id,saved.filters.id,saved.filters.revision],['eq.'+ids.o,'eq.'+ids.p,'eq.11111111-1111-4111-8111-000000000002','eq.1'],label+' actual SDK scoped CAS filters preserved');
  let before=f.calls.length;await page.evaluate(()=>previousSave());eq(f.calls.length,before,label+' detached older date handler performs no query');
  await card().getByRole('button',{name:'Remove due date',exact:true}).click();await card().getByText('open · No due date',{exact:true}).waitFor();await card().getByLabel('Status').selectOption('completed');await card().getByRole('button',{name:'Save task status',exact:true}).click();await card().getByText('completed · No due date',{exact:true}).waitFor();eq(await page.getByText('Task page 2',{exact:true}).count(),1,label+' date/remove/status compose without losing older page');
  await b('Back to People').click();await page.getByLabel('Search contacts').fill('Private Church A lookup');await b('Search').click();await b('Review Person & follow-up').waitFor();
  await page.getByRole('combobox',{name:'Church organization',exact:true}).selectOption(ids.otherOrg);await page.getByRole('heading',{name:'Other Person',exact:true}).waitFor();eq(await page.getByLabel('Search contacts').inputValue(),'',label+' shell organization navigation clears prior People lookup');await openPerson();eq(await page.getByRole('heading',{name:'Care 002',exact:true}).count(),0,label+' other organization cannot display first task page');
  await page.getByRole('combobox',{name:'Ministry context',exact:true}).selectOption('outreach');await page.getByRole('link',{name:'Open Registration & Check-In',exact:true}).waitFor();await page.getByRole('link',{name:'Open Registration & Check-In',exact:true}).click();await b('Open household').waitFor();await openHousehold();
  eq(await b('Check in attendee').isEnabled(),true,label+' current open-household check-in remains available through shell');
  f.registration.status='closed';await b('Registrations').click();await b('Open household').waitFor();await openHousehold();eq(await b('Check in attendee').isDisabled(),true,label+' accepted closed-household denial preserved in new composition');
  before=f.writes.length;await b('Check in attendee').evaluate(e=>e.onclick());eq(f.writes.length,before,label+' closed check-in retained handler performs no mutation');
  await b('Print backup roster').click();await page.getByRole('heading',{name:'Private campaign backup roster',exact:true}).waitFor();eq(await page.locator('.registration-print tr').count(),1,label+' closed household excluded from authorized roster');
  f.registration.status='submitted';await b('Registrations').click();await b('Open household').waitFor();await b('Print backup roster').click();await page.getByRole('heading',{name:'Private campaign backup roster',exact:true}).waitFor();eq(await page.locator('.registration-print tr').count(),2,label+' authorized reopened household included once');
  const exports=f.calls.filter(c=>c.action==='csv').length;await b('Print private roster').click();await page.waitForFunction(()=>fixturePrints===1);eq(f.calls.filter(c=>c.action==='csv').length,exports+1,label+' printing rechecks existing export RPC');
  await b('Registrations').click();await b('Open household').waitFor();await page.getByLabel('Name, phone, email or reference',{exact:true}).fill('Private campaign A lookup');await b('Search').click();await b('Open household').waitFor();await page.getByRole('combobox',{name:'Outreach campaign',exact:true}).selectOption(ids.otherCampaign);await page.waitForURL('**/staff-outreach-registration.html?campaign='+ids.otherCampaign);await b('Open household').waitFor();eq(await page.getByLabel('Name, phone, email or reference',{exact:true}).inputValue(),'',label+' shell campaign handoff resets accepted registration search');
  if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:process.env.EVIDENCE_DIR+'/'+engine+'-'+width+'-registration.png',fullPage:true})}
  // Session97 invalidates protected content and returns to the unified shell route.
  await page.getByLabel('Name, phone, email or reference',{exact:true}).fill('Private prior-account lookup');await b('Search').click();await b('Open household').waitFor();
  f.setActor(ids.b);await page.evaluate(value=>ChampionLifeAuth.client.auth.setSession({access_token:value.access_token,refresh_token:value.refresh_token}),session(ids.b));await page.waitForURL('**/discipleship-login.html?next=%2Fstaff-home.html');eq(await page.locator('#outreach-registration-staff').count(),0,label+' session97 account transition leaves no prior registration DOM');
  await goto('staff-home.html');eq(await page.getByRole('link',{name:'Open People & Follow-up',exact:true}).count(),0,label+' campaign-only account is not forced into People');eq(await page.getByRole('link',{name:'Open Registration & Check-In',exact:true}).count(),1,label+' campaign-only account retains independently assigned registration entry');
  before=f.calls.filter(c=>c.name==='people_workspace').length;await page.goto(origin+'/staff-people.html?org='+ids.o);await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();eq(f.calls.filter(c=>c.name==='people_workspace').length,before,label+' campaign-only direct People link issues no People RPC');eq(await page.locator('#staff-main').isHidden(),true,label+' denied direct People hides module');
  await goto('staff-outreach-registration.html?campaign='+ids.c);await b('Open household').waitFor();eq(await page.getByLabel('Name, phone, email or reference',{exact:true}).inputValue(),'',label+' new-account registration never inherits old identifying query');
  // Delay an actual module request, then revoke via a fresh shell check before it returns.
  f.hold('outreach_registration_workspace:detail');await b('Open household').click();await waitHold();f.revokeCampaign();await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();f.release();await page.waitForTimeout(80);eq(await page.locator('#staff-main').isHidden(),true,label+' revocation wins over late registration response');eq(await page.locator('#staff-session-email').innerText(),'',label+' shell removes revoked account label');eq((await page.locator('body').innerText()).includes('Jordan Household'),false,label+' late household data never restores private content');
  await seed(ids.a);await goto('staff-people.html?org='+ids.o);await b('Review Person & follow-up').waitFor();
  f.hold('people_workspace:detail');await b('Review Person & follow-up').click();await waitHold();f.revokePeople();await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();f.release();await page.waitForTimeout(80);
  eq(await page.locator('#staff-main').isHidden(),true,label+' People revocation wins over delayed authorized detail');eq((await page.locator('body').innerText()).includes('Taylor Person'),false,label+' delayed Person data cannot restore retired workspace');
  for(const p of ['staff-home.html','staff-people.html','staff-outreach-registration.html','assets/js/staff-workspace.js','assets/js/staff-session.js','assets/js/outreach-people.js','assets/js/outreach-registration-staff.js'])eq(f.served.has(p),true,label+' actual pinned source served '+p);
  eq(f.unexpected,[],label+' no unrecognized or external requests');eq(errors,[],label+' no runtime page errors');await context.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,composition:'shell102 + People/registration72 + session97',providerRequests:0,genuineAuth:false}));
