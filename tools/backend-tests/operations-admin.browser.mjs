// Offline real-browser rendering; authenticated responses are synthetic contract fixtures.
// Database authorization is independently exercised by operations-admin.test.mjs.
import {chromium,webkit} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import assert from 'node:assert/strict';
import * as fixture from './fixtures/outreach-registration-ui.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),origin='https://operations.local.test';
const evidence=process.env.EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const authScript=`const config=${JSON.stringify(fixture.config)},campaign=${JSON.stringify(fixture.campaign)},user=${JSON.stringify(fixture.user)},registration=${JSON.stringify(fixture.registration)},attendees=${JSON.stringify(fixture.attendees)};const response=${fixture.response.toString()};
window.__calls=[];window.__mode='operations';window.__revoked=false;window.__signedOut=false;
const keys=['people.read','people.create','people.update','people.export','households.read','households.manage','followup.read','followup.manage','registrations.view','registrations.manage','outreach.view'];
const staffContext=()=>({organizations:[{id:'org',name:'Synthetic SowGo'}],grants:(window.__revoked?[]:[...keys,...(window.__mode==='finance'?['finance.read']:[])]).map(permission=>({organization_id:'org',permission}))});
window.ChampionLifeAuth={getUser:async()=>window.__signedOut?null:{id:user},getSession:async()=>window.__signedOut?null:{user:{id:user}},client:{auth:{onAuthStateChange:fn=>window.__authChanged=fn},rpc:async(name,p)=>{
window.__calls.push({name,p});if(window.__revoked)return{status:403,error:{code:'42501'}};
if(name==='staff_workspace_context')return{data:staffContext()};
if(name==='outreach_partner_workspace')return window.__mode==='finance'?{data:[]}:{status:403,error:{code:'42501'}};
if(name==='people_workspace')return{data:p.p_action==='list'?[{id:'11111111-1111-4111-8111-111111111111',first_name:'Fictional',last_name:'Volunteer',relationships:['volunteer']}]:{person:{id:p.p_payload.person_id,first_name:'Fictional',last_name:'Volunteer'},relationships:[{relationship:'volunteer',active:true}]}};
let data=response(name,p);if(p.p_action==='context')data={...data,admin:false,can_manage_access:false,settings:null};
if(p.p_action==='detail'&&window.__delay){window.__delay=false;return await new Promise(resolve=>window.__finish=()=>resolve({data}))}return{data};
},from:()=>{const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:async()=>({data:[{id:'task',title:'Nonfinancial volunteer call',status:'open',revision:1}]}),update:()=>chain,maybeSingle:async()=>({data:{id:'task'}})};return chain}}};`;
for(const[engine,options]of[[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});try{
 for(const width of[390,768,1440]){
 const ctx=await browser.newContext({viewport:{width,height:900},acceptDownloads:true}),page=await ctx.newPage(),errors=[],unexpected=[];page.on('pageerror',e=>errors.push(e.message));
 await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/@supabase/supabase-js@2'))return route.fulfill({contentType:'text/javascript',body:''});if(u.origin!==origin||route.request().method()!=='GET'){unexpected.push(u.origin+u.pathname);return route.abort()}
 if(u.pathname==='/assets/js/champion-life-auth.js')return route.fulfill({contentType:'text/javascript',body:authScript});
 if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'/* offline test: no backend configuration */'});
 const filename=path.resolve(root,'.'+u.pathname);if(!filename.startsWith(root))return route.abort();try{const body=await readFile(filename);const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(filename)]||'application/octet-stream';return route.fulfill({contentType:type,body})}catch{return route.fulfill({status:404,body:'Not found'})}});
 await page.goto(origin+'/staff-outreach-registration.html?campaign='+fixture.campaign);await page.getByText('Household lookup',{exact:true}).waitFor();
 ok(await page.getByRole('button',{name:'Add walk-up',exact:true}).isVisible(),'operations registration management '+engine.name()+' '+width);
 ok(await page.getByRole('button',{name:'Access',exact:true}).count()===0&&await page.getByRole('button',{name:'Configuration',exact:true}).count()===0,'permission/intake controls absent');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const file=await download;ok(file.suggestedFilename()==='synthetic-roster.csv','scoped CSV download works');
 await page.getByRole('button',{name:'Open household',exact:true}).click();await page.getByText('Alex Fixture',{exact:true}).waitFor();ok(await page.getByRole('button',{name:'Check in attendee',exact:true}).count()>0,'operational attendee controls rendered');
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
 if(evidence&&engine.name()==='chromium'&&width!==768)await page.screenshot({path:path.join(evidence,'operations-'+width+'.png'),fullPage:true});
 await page.getByRole('button',{name:'Registrations',exact:true}).click();await page.getByText('Household lookup',{exact:true}).waitFor();
 await page.evaluate(()=>window.__delay=true);await page.getByRole('button',{name:'Open household',exact:true}).click();await page.waitForFunction(()=>Boolean(window.__finish));await page.evaluate(()=>{window.__revoked=true;dispatchEvent(new Event('focus'))});await page.getByText('Registration access unavailable',{exact:true}).waitFor();
 await page.evaluate(()=>window.__finish());await page.waitForTimeout(100);ok(!await page.getByText('Alex Fixture',{exact:true}).count(),'late successful response cannot restore revoked records');ok(await page.getByRole('link',{name:'RETURN TO STAFF DASHBOARD',exact:true}).isVisible(),'attached accessible denial return link');
 await page.evaluate(()=>{window.__signedOut=true;window.__authChanged('SIGNED_OUT',null)});await page.getByText('Sign in to continue',{exact:true}).waitFor();ok(!await page.getByRole('button').count(),'sign-out clears protected controls');
 await page.goto(origin+'/staff-outreach-partners.html');await page.getByText('Outreach Partner Access Removed',{exact:true}).waitFor();ok((await page.evaluate(()=>window.__calls)).every(c=>c.name!=='outreach_partner_workspace'),'operations UI never requests donation-intake list');
 ok(!await page.getByText('Intended commitment:',{exact:false}).count(),'no donor commitment visible');
 await page.goto(origin+'/staff-people.html');await page.getByText('Fictional Volunteer',{exact:true}).waitFor();ok(!await page.locator('#financial-outreach-link').isVisible(),'financial navigation hidden from operations');
 await page.getByRole('button',{name:'Review Person & follow-up',exact:true}).click();await page.getByText('Nonfinancial volunteer call',{exact:true}).waitFor();ok(true,'People and ordinary follow-up remain available');
 await page.evaluate(()=>{window.__mode='finance';window.__signedOut=true;window.__authChanged('SIGNED_OUT',null)});await page.getByText('Sign in to your workspace',{exact:true}).waitFor();await page.evaluate(()=>{window.__signedOut=false;window.__authChanged('SIGNED_IN',{user:{id:user}})});await page.getByText('Fictional Volunteer',{exact:true}).waitFor();ok(await page.locator('#financial-outreach-link').isVisible(),'finance navigation requires explicit current finance permission');
 ok(errors.length===0,'no browser script errors');ok(unexpected.length===0,'no real backend or unapproved network traffic');await ctx.close();
 }
 }finally{await browser.close()}
}
if(evidence)await writeFile(path.join(evidence,'browser-results.json'),JSON.stringify({checks,engines:['Chrome','WebKit'],widths:[390,768,1440],mode:'Offline contract fixtures; database authorization tested separately',hosted_requests:false},null,2)+'\n');
console.log(`${checks} Operations Administrator browser checks passed.`);
