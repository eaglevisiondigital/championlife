// Actual source + hash-verified SDK, fictional transport only. No hosted acceptance.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {createHarness,A,B,O,Q,backend,origin} from '../partner-staff-cycle16/browser-fixture.mjs';
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const pair=['outreach.view','finance.read'];
const grants=(id,keys,department_ids=null)=>keys.map(permission=>({organization_id:id,permission,department_ids}));
async function setup(browser,width,rows=grants(O,pair)){
 const h=await createHarness(browser,width);h.state.caps=pair;h.state.orgs=[O,Q];h.rows=rows;
 await h.context.route(backend+'/rest/v1/rpc/staff_workspace_context',route=>{h.state.calls.push({name:'staff_workspace_context'});return route.fulfill({json:{organizations:h.state.orgs.map(id=>({id,name:id===O?'Church A':'Church B'})),grants:h.rows},headers:{'access-control-allow-origin':'*'}})});
 if(process.env.REVIEW_BASE){const body=execFileSync('git',['show',process.env.REVIEW_BASE+':assets/js/staff-workspace.js']);await h.context.route(origin+'/assets/js/staff-workspace.js',r=>r.fulfill({body,contentType:'text/javascript'}))}
 return h;
}
async function settled(h){await h.page.waitForFunction(()=>window.StaffWorkspace?.active()||document.getElementById('staff-access-message')?.textContent.includes('unavailable'))}
async function clean(h,label){eq(h.state.writes.length,0,label+' zero writes');eq(h.state.unexpected,[],label+' no external transport');eq(h.state.errors,[],label+' no runtime errors');await h.close()}
for(const [name,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1440]){
 const label=name+' '+width;
 for(const query of ['', '?context=church&org='+O+'&person=private&campaign=private#private']){
  const h=await setup(browser,width);await h.open('staff-home.html'+query);await settled(h);
  eq(await h.page.evaluate(()=>StaffWorkspace.active()),true,label+' financial-only home admitted');
  eq(await h.page.locator('#staff-home-links a').count(),1,label+' only authorized module card');
  eq(await h.page.locator('#staff-home-links a').getAttribute('href'),'staff-outreach-partners.html?org='+O,label+' card carries organization only');
  eq(await h.page.locator('#financial-outreach-link').getAttribute('href'),'staff-outreach-partners.html?org='+O,label+' existing sidebar id and route retained');
  eq(await h.page.getByLabel('Church organization').locator('option').count(),1,label+' unauthorized organization omitted');
  eq(h.state.calls.some(c=>['people_workspace','outreach_partner_workspace'].includes(c.name)),false,label+' navigation discovery reads no People or financial records');
  await h.page.locator('#staff-home-links a').click();await h.page.getByRole('button',{name:'Review intake',exact:true}).waitFor();
  eq(new URL(h.page.url()).search,'?org='+O,label+' actual Partner navigation');
  eq(await h.page.locator('[data-partner-return="people"]').getAttribute('href'),null,label+' financial authority confers no People return');
  eq(await h.page.getByRole('button',{name:'Create follow-up task',exact:true}).count(),0,label+' financial authority confers no task creation');
  await clean(h,label);
 }
 for(const [kind,rows]of [
  ['outreach only',grants(O,['outreach.view'])],['finance only',grants(O,['finance.read'])],['none',[]],
  ['cross-organization',[...grants(O,['outreach.view']),...grants(Q,['finance.read'])]],
  ['department finance',[...grants(O,['outreach.view']),...grants(O,['finance.read'],[A])]],
  ['empty department finance',[...grants(O,['outreach.view']),...grants(O,['finance.read'],[])]]]){
  const h=await setup(browser,width,rows);await h.open('staff-home.html?context=church&org='+O);await settled(h);
  eq(await h.page.evaluate(()=>StaffWorkspace.active()),false,label+' '+kind+' denied');
  eq(await h.page.locator('a[href*="staff-outreach-partners.html"]').count(),0,label+' '+kind+' no financial route');await clean(h,label);
 }
 {
  const h=await setup(browser,width,[...grants(O,pair),...grants(Q,pair)]);await h.open('staff-home.html?context=church&org='+O);await settled(h);
  if(width<1024)await h.page.getByRole('button',{name:'Menu',exact:true}).click();
  await h.page.getByLabel('Church organization').selectOption(Q);await h.page.waitForURL('**/staff-home.html?context=church&org='+Q);await settled(h);
  eq(await h.page.locator('#staff-home-links a').getAttribute('href'),'staff-outreach-partners.html?org='+Q,label+' authorized organization switch preserves exact scope');await clean(h,label);
 }
 for(const mode of ['revoked','account']){
  const h=await setup(browser,width);await h.open('staff-home.html');await settled(h);
  await h.page.locator('#staff-home-links a').evaluate(a=>{window.oldFinancial=a;window.oldClick=a.onclick});
  if(mode==='revoked')h.rows=grants(O,['outreach.view']);else h.state.actor=B;
  await h.page.locator('#staff-home-links a').click();await h.page.waitForFunction(()=>!StaffWorkspace.active());
  eq(new URL(h.page.url()).pathname,'/staff-home.html',label+' '+mode+' blocks navigation');
  eq(await h.page.locator('a[href*="staff-outreach-partners.html"]').count(),0,label+' '+mode+' clears route');
  await h.page.evaluate(()=>oldClick({button:0,preventDefault(){}}));
  eq(h.state.calls.some(c=>c.name==='outreach_partner_workspace'),false,label+' '+mode+' retained link cannot read intake');await clean(h,label);
 }
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,hostedAcceptance:false,releaseAuthorized:false}));
