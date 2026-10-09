// Disconnected rendering of real page/controllers using established synthetic module fixtures.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {context as pre,packet,opportunities} from './fixtures/pre-event-context.mjs';
import {list as team} from './fixtures/outreach-team-ui.mjs';
import {response as registrationResponse} from './fixtures/outreach-registration-ui.mjs';
import {context as prize} from './fixtures/prize-workspace-ui.mjs';
import {context as eventday} from './fixtures/eventday-workspace-ui.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url))),out=process.env.STAFF_SCREENSHOTS||'/private/tmp/staff-workspace-browser';mkdirSync(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.TEST_PLAYWRIGHT_MODULE||'/Users/davesmacbookpro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const A='11111111-1111-4111-8111-111111111111',row={...pre.campaign,id:A,name:'Synthetic Community Outreach',country:'USA',city:'Fixture City',status:'preparing',event_start:'2028-11-20T16:00:00Z',timezone:'America/Chicago',workflow_percent:45,overdue:2,ready:false,summary:{registrations:150,decisions:20,salvations:12,rededications:8,discipleship_active:4,followup_needed:7}};
const cases=['staff-home','staff-outreach-overview','staff-outreach-pre-event','staff-outreach-campaigns','staff-outreach-team','staff-outreach-registration','staff-outreach-prizes','staff-outreach-event-day','staff-outreach-partners','staff-people'];
const fixtures={pre,packet,opportunities,team,prize,eventday,row,registration:{context:registrationResponse('outreach_registration_workspace',{p_action:'context'}),list:registrationResponse('outreach_registration_workspace',{p_action:'list'})}};
const report=[];
async function checkAttribution(p){
 const mark=p.locator('.staff-sidebar-foot');await mark.scrollIntoViewIfNeeded();
 const size=await mark.evaluate(n=>{const i=n.querySelector('img'),r=i.getBoundingClientRect(),link=n.getBoundingClientRect();return{left:r.left,right:r.right,bottom:r.bottom,width:r.width,height:r.height,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,label:n.getAttribute('aria-label'),target:n.target,rel:n.rel,linkHeight:link.height,viewport:innerWidth,viewportHeight:innerHeight};});
 assert.equal(size.naturalWidth,2172);assert.equal(size.naturalHeight,724);assert(Math.abs(size.width/size.height-3)<.01);assert(size.width<=180&&size.width>=150);assert(size.left>=0&&size.right<=size.viewport&&size.bottom<=size.viewportHeight+1);assert(size.linkHeight<=110);assert.equal(size.target,'_blank');assert.equal(size.rel,'noopener noreferrer');assert(size.label.includes('in a new tab'));
}

try{
 for(const width of [390,768,1440]){
  const p=await browser.newPage({viewport:{width,height:1050}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.context().route('**/*',async route=>{
   const u=new URL(route.request().url()),path=u.pathname.slice(1);
   if(u.hostname!=='preview.example.test'||['assets/js/champion-life-auth.js','assets/js/supabase-config.js'].includes(path)){await route.fulfill({contentType:'text/javascript',body:'/* disconnected synthetic rendering */'});return;}
   const file=resolve(root,path);assert(file.startsWith(root+'/'));
   try{await route.fulfill({body:readFileSync(file),contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'text/html'});}catch{await route.fulfill({status:404,body:'Not found'});}
  });
  await p.addInitScript(({f})=>{
   const callbacks=[],user={id:'fixture-staff'},org='fixture-org';
   window.ChampionLifeAuth={getUser:async()=>user,getSession:async()=>({user}),signOut:async()=>callbacks.forEach(fn=>fn('SIGNED_OUT',null)),client:{auth:{onAuthStateChange:fn=>callbacks.push(fn)},rpc:async(name,p)=>{
    if(name==='staff_workspace_context')return{data:{organizations:[{id:org,name:'Champion Life · Synthetic'}],grants:(location.pathname.includes('staff-people')?['outreach.view']:['outreach.view','people.read','followup.read']).map(permission=>({organization_id:org,permission,department_ids:null}))}};
    if(name==='outreach_team_access')return{data:['team.view','travel.view']};
    if(name==='outreach_partner_workspace')return{data:[{id:'intake',first_name:'Morgan',last_name:'Fixture',email:'synthetic@example.test',phone:'+15555550100',submitted_at:'2026-10-08T12:00:00Z',source_site:'champion-life',status:'new',commitment_amount:25,commitment_frequency:'Monthly'}]};
    if(name==='people_workspace')return{error:{code:'42501'},status:403};
    if(p.p_action==='campaigns')return{data:[f.row]};
    if(name==='outreach_campaign_workspace')return{data:p.p_action==='context'?{organizations:[{id:org,name:'Champion Life',manage:true}]}:p.p_action==='list'?[f.row]:p.p_action==='detail'?{campaign:f.row,capabilities:['view','workflow','documents'],summary:f.row.summary,registrants:[],manage:false}:[]};
    if(name==='outreach_pre_event_workspace')return{data:p.p_action==='context'?{...f.pre,campaign:{...f.pre.campaign,...f.row}}:p.p_action==='packet_preview'?{snapshot:f.packet,blockers:f.pre.blockers}:p.p_action==='organizations'?{organizations:[{id:org,name:'Champion Life',manage:true}]}:p.p_action==='opportunities'?f.opportunities:[]};
    if(name==='outreach_team_workspace')return{data:f.team};
    if(name==='outreach_registration_workspace')return{data:f.registration[p.p_action]||[]};
    if(name==='outreach_prize_workspace')return{data:f.prize};
    if(name==='outreach_event_day_workspace')return{data:f.eventday};
    return{data:[]};
   }}};
  },{f:fixtures});
  for(const page of cases){
   errors.length=0;
   const query=['staff-outreach-pre-event','staff-outreach-team','staff-outreach-registration','staff-outreach-prizes','staff-outreach-event-day'].includes(page)?'?campaign='+A:'';
   await p.goto('https://preview.example.test/'+page+'.html'+query);
   await p.locator('.staff-children a[aria-current=page]').waitFor({state:'attached',timeout:4000}).catch(e=>{if(page!=='staff-people')throw e;});
   if(page==='staff-people')await p.getByRole('heading',{name:'Access unavailable',exact:true}).waitFor();
   await p.waitForTimeout(100);
   const sizes=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,sidebars:document.querySelectorAll('.staff-sidebar').length,headings:[...document.querySelectorAll('main h1')].map(n=>n.textContent)}));
   assert.equal(sizes.width,width);assert(sizes.scroll<=width,`${page} ${width} overflow ${sizes.scroll}`);assert.equal(sizes.sidebars,1);assert.equal(errors.length,0,errors.join('; '));
   if(width===390&&['staff-outreach-prizes','staff-outreach-registration'].includes(page)){const actionWidths=await p.locator(page==='staff-outreach-prizes'?'.prize-current-actions button':'.campaign-heading>.registration-actions button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));assert(actionWidths.length>0);assert(actionWidths.every(w=>w>=140),'phone module actions are readable');}
   if(width===1440)await checkAttribution(p);
   await p.screenshot({path:join(out,width+'-'+page+'.png'),fullPage:true});
   if(width<1024){await p.getByRole('button',{name:'Menu',exact:true}).click();await p.getByRole('button',{name:'Close menu',exact:true}).waitFor({state:'visible'});assert.equal(await p.locator('.staff-menu').getAttribute('aria-expanded'),'true');await p.waitForFunction(()=>Math.abs(document.querySelector('.staff-sidebar').getBoundingClientRect().left)<1);assert(await p.locator('.staff-column').evaluate(n=>n.inert));await checkAttribution(p);await p.screenshot({path:join(out,width+'-'+page+'-menu.png'),fullPage:true});await p.keyboard.press('Escape');assert.equal(await p.locator('.staff-menu').getAttribute('aria-expanded'),'false');}
   if(width===390&&page==='staff-home'){
    await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'Menu',exact:true}).click();await p.waitForFunction(()=>Math.abs(document.querySelector('.staff-sidebar').getBoundingClientRect().left)<1);await checkAttribution(p);await p.screenshot({path:join(out,'390x844-attribution-drawer.png')});await p.keyboard.press('Escape');await p.setViewportSize({width:390,height:1050});
   }
   if(width===1440&&page==='staff-home'){
    const mark=p.locator('.staff-sidebar-foot');await p.keyboard.press('Tab');await mark.focus();assert(await mark.evaluate(n=>getComputedStyle(n).outlineStyle==='solid'&&getComputedStyle(n).outlineWidth==='3px'));
    const box=await mark.boundingBox(),session=await p.context().newCDPSession(p);await session.send('Emulation.setScriptExecutionDisabled',{value:true});
    try{const pending=p.waitForEvent('popup',{timeout:4000});await session.send('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x+box.width/2,y:box.y+box.height/2,button:'left',clickCount:1});await session.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x+box.width/2,y:box.y+box.height/2,button:'left',clickCount:1});const popup=await pending;await popup.waitForLoadState('domcontentloaded');assert.equal(popup.url(),'https://kingdompropel.com/');assert.equal(await popup.evaluate(()=>window.opener),null);await popup.close();}finally{await session.send('Emulation.setScriptExecutionDisabled',{value:false});await session.detach();}
   }
   report.push({page,width,overflow:false,consoleErrors:0,sidebarCount:1,approvedAttribution:true});
  }
  await p.close();
 }
 writeFileSync(join(out,'report.json'),JSON.stringify({checks:report.length,results:report},null,2));console.log(report.length+' real-page synthetic Chrome renders PASS at 390 / 768 / 1440; '+out);
}finally{await browser.close();}
