// Actual candidate pages and accepted SDK with intercepted fictional transport only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {createHarness,A,B,O,Q,backend,origin,session,key} from '../partner-staff-cycle16/browser-fixture.mjs';
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const pair=['outreach.view','finance.read'],grants=(id,keys,department_ids=null)=>keys.map(permission=>({organization_id:id,permission,department_ids}));
async function setup(browser,width,caps=pair){const h=await createHarness(browser,width);h.state.caps=[...caps];h.state.orgs=[O,Q];
 if(process.env.REVIEW_BASE)await h.context.route(origin+'/assets/js/staff-outreach-partners.js',r=>r.fulfill({body:execFileSync('git',['show',process.env.REVIEW_BASE+':assets/js/staff-outreach-partners.js']),contentType:'text/javascript'}));return h;}
const home=h=>h.page.locator('[data-partner-return="home"]'),people=h=>h.page.locator('[data-partner-return="people"]');
async function ready(h){await h.open('staff-outreach-partners.html?org='+O+'&person=PRIVATE&intake=PRIVATE#PRIVATE');await h.page.getByRole('button',{name:'Review intake',exact:true}).waitFor()}
async function clean(h,label){eq(h.state.writes.length,0,label+' zero mutation');eq(h.state.unexpected,[],label+' no external transport');eq(h.state.errors,[],label+' no browser errors');await h.close()}
async function denied(h){await h.page.getByText('Outreach Partner Access Removed',{exact:true}).waitFor()}
for(const [name,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1440]){const label=name+' '+width;
 for(const detail of [false,true]){
  const h=await setup(browser,width);await h.open('staff-home.html?context=church&org='+O);await h.page.locator('#staff-home-links a').waitFor();await h.page.locator('#staff-home-links a').click();await h.page.getByRole('button',{name:'Review intake',exact:true}).waitFor();
  if(detail){await h.page.getByRole('button',{name:'Review intake',exact:true}).click();await h.page.getByRole('heading',{name:'Partner intake · new'}).waitFor()}
  eq(await home(h).getAttribute('href'),'staff-home.html?context=church&org='+O,label+' financial-only '+(detail?'detail':'list')+' home return');
  eq(await people(h).getAttribute('href'),null,label+' no People authority');
  await home(h).click();await h.page.waitForURL('**/staff-home.html?context=church&org='+O);await h.page.locator('#staff-home-links a').waitFor();eq(await h.page.evaluate(()=>StaffWorkspace.active()),true,label+' complete home roundtrip');eq(h.state.calls.some(c=>c.name==='people_workspace'),false,label+' no People record read');await clean(h,label);
 }
 {
  const h=await setup(browser,width,[...pair,'people.read']);await ready(h);eq(await people(h).getAttribute('href'),'staff-people.html?org='+O,label+' People permission retains separate return');h.state.caps=pair;await home(h).click();await h.page.waitForURL('**/staff-home.html?context=church&org='+O);await h.page.locator('#staff-home-links a').waitFor();eq(await h.page.evaluate(()=>StaffWorkspace.active()),true,label+' removing only People still permits financial home');await clean(h,label);
 }
 {
  const h=await setup(browser,width,[...pair,'people.read']);await ready(h);h.state.caps=pair;await people(h).click();await denied(h);eq(new URL(h.page.url()).pathname,'/staff-outreach-partners.html',label+' People revocation blocks retained People return');eq(await home(h).getAttribute('href'),null,label+' denial retires returns');await clean(h,label);
 }
 for(const [kind,rows]of [['no finance',grants(O,['outreach.view'])],['no outreach',grants(O,['finance.read'])],['split organizations',[...grants(O,['outreach.view']),...grants(Q,['finance.read'])]],['department finance',[...grants(O,['outreach.view']),...grants(O,['finance.read'],[A])]],['empty department finance',[...grants(O,['outreach.view']),...grants(O,['finance.read'],[])]]]){
  const h=await setup(browser,width);await ready(h);await h.context.route(backend+'/rest/v1/rpc/staff_workspace_context',r=>r.fulfill({json:{organizations:[{id:O,name:'Church A'},{id:Q,name:'Church B'}],grants:rows},headers:{'access-control-allow-origin':'*'}}));await home(h).click();await denied(h);eq(new URL(h.page.url()).pathname,'/staff-outreach-partners.html',label+' '+kind+' blocks return');eq(await home(h).getAttribute('href'),null,label+' '+kind+' retires home');await clean(h,label);
 }
 for(const mode of ['account','session','control-before-rpc','control-after-rpc','org','clear']){
  const h=await setup(browser,width);await ready(h);const before=h.state.calls.filter(c=>c.name==='staff_workspace_context').length;
  if(mode==='control-before-rpc'){
   await home(h).evaluate(a=>{const get=ChampionLifeAuth.getSession;let held=false;window.oldReturn=a;window.oldReturnClick=a.onclick;ChampionLifeAuth.getSession=()=>!held?(held=true,new Promise(resolve=>window.releaseSession=async()=>resolve(await get()))):get();window.pendingReturn=a.onclick({preventDefault(){}})});await h.page.waitForFunction(()=>typeof releaseSession==='function');
   await h.page.evaluate(async()=>{const parent=oldReturn.parentNode,next=oldReturn.nextSibling;oldReturn.remove();parent.insertBefore(oldReturn,next);await releaseSession();await pendingReturn});eq(h.state.calls.filter(c=>c.name==='staff_workspace_context').length,before,label+' retired return cannot issue context RPC');
  }else{
   h.state.hold=c=>c.name==='staff_workspace_context';await home(h).evaluate(a=>{window.oldReturn=a;window.oldReturnClick=a.onclick;window.pendingReturn=a.onclick({preventDefault(){}})});await h.held();
   if(mode==='account'){h.state.actor=B;await h.page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(B)})}
   if(mode==='session')await h.page.evaluate(key=>localStorage.removeItem(key),key);
   if(mode==='control-after-rpc')await h.page.evaluate(()=>{const parent=oldReturn.parentNode,next=oldReturn.nextSibling;oldReturn.remove();parent.insertBefore(oldReturn,next)});
   if(mode==='org'){await h.page.getByLabel('Organization',{exact:true}).selectOption(Q);await h.page.getByRole('heading',{name:'Fictional Intake B'}).waitFor()}
   if(mode==='clear')await h.page.evaluate(()=>window.dispatchEvent(new Event('staff-protected-clear')));
   await h.release();await h.page.evaluate(()=>pendingReturn);
  }
  eq(new URL(h.page.url()).pathname,'/staff-outreach-partners.html',label+' '+mode+' cannot navigate stale return');
  const calls=h.state.calls.length;await h.page.evaluate(()=>oldReturnClick({preventDefault(){}}));eq(h.state.calls.length,calls,label+' '+mode+' retained handler remains retired');await clean(h,label);
 }
 {
  const h=await setup(browser,width);h.state.orgs=[O];await h.open('staff-outreach-partners.html?org='+Q+'&person=PRIVATE');await denied(h);const recovery=h.page.getByRole('link',{name:'Return to Staff Home',exact:true});eq(await recovery.getAttribute('href'),'staff-home.html',label+' denial recovery uses scope-neutral actual home');await recovery.click();await h.page.locator('#staff-home-links a').waitFor();eq(await h.page.evaluate(()=>StaffWorkspace.active()),true,label+' financial-only denial recovery reauthorizes');eq(h.state.calls.some(c=>c.name==='people_workspace'),false,label+' recovery reads no People');await clean(h,label);
 }
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,runtimeSHA256:createHash('sha256').update(readFileSync(new URL('../../assets/js/staff-outreach-partners.js',import.meta.url))).digest('hex'),hostedAcceptance:false,releaseAuthorized:false}));
