import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const pages=['staff-home','staff-outreach-overview','staff-outreach-pre-event','staff-outreach-campaigns','staff-outreach-team','staff-outreach-registration','staff-outreach-prizes','staff-outreach-event-day','staff-outreach-partners','staff-people'];
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const row={id:A,name:'Synthetic Outreach',event_start:'2028-10-10T15:00:00Z',city:'Fixture',country:'USA',timezone:'America/Chicago',status:'preparing',workflow_percent:50,overdue:2,ready:false,summary:{decisions:2,followup_needed:1,discipleship_active:1}};
let checks=0;const ok=(v,label)=>{assert.ok(v,label);checks++;console.log('PASS '+label);};
const tick=()=>new Promise(r=>setTimeout(r,25));
async function harness(page='staff-home',mode='all',query='',clean=false){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(read(page+'.html'),{url:'https://preview.example/'+page+(clean?'':'.html')+query,runScripts:'outside-only',virtualConsole:vc}),w=dom.window;
 let narrow=mode,callbacks=[],delay=null;
 w.matchMedia=()=>({matches:false});w.setInterval=()=>1;
 const user={id:'fixture'};
 function rows(key){if(['all','campaign'].includes(narrow))return key==='campaigns'||narrow==='all'?[row]:[];if(narrow==='host')return key==='preevent'?[row]:[];return [];}
 w.ChampionLifeAuth={getUser:async()=>narrow==='anonymous'?null:user,getSession:async()=>narrow==='anonymous'?null:{user},signOut:async()=>{narrow='anonymous';for(const f of callbacks)f('SIGNED_OUT',null);},client:{auth:{onAuthStateChange:f=>callbacks.push(f)},rpc:async(name,p)=>{
  if(delay)await delay;
  if(name==='staff_workspace_context')return{data:{organizations:narrow==='all'?[{id:'org',name:'Fixture'}]:[],grants:narrow==='all'?['outreach.view','people.read'].map(permission=>({organization_id:'org',permission,department_ids:null})):[]}};
  if(name==='people_workspace')return narrow==='all'?{data:[{id:'protected-person',first_name:'Protected',last_name:'Fixture',email:'protected@example.test'}]}:{error:{code:'42501'},status:403};
  if(name==='outreach_team_access')return{data:narrow==='all'?['team.view']:[]};
  if(p.p_action==='context')return{data:{organizations:[]}};
  const key={'outreach_campaign_workspace':'campaigns','outreach_pre_event_workspace':'preevent','outreach_registration_workspace':'registration','outreach_prize_workspace':'prizes','outreach_event_day_workspace':'eventday'}[name];return{data:rows(key)};
 }}};
 w.eval(read('assets/js/outreach-staff-common.js'));w.eval(read('assets/js/staff-workspace.js'));
 if(page==='staff-home'||page==='staff-outreach-overview')w.eval(read('assets/js/staff-dashboard.js'));
 await tick();return{w,d:w.document,dom,errors,setMode:x=>narrow=x,callbacks,setDelay:x=>delay=x};
}
for(const page of pages){const h=await harness(page);ok(h.d.querySelectorAll('.staff-sidebar').length===1,page+' has exactly one shared sidebar');ok(!h.d.querySelector('.campaign-sidebar'),'no copied sidebar on '+page);ok(h.d.querySelector('a[aria-current=page]')?.getAttribute('href').startsWith(page+'.html'),'active child '+page);ok(h.d.querySelector('.staff-group.is-active button').getAttribute('aria-expanded')==='true','active parent '+page);ok(!read(page+'.html').includes('Outreach workspace'),'page has no independent primary nav '+page);ok(h.errors.length===0,'no DOM errors '+page);
 const mark=h.d.querySelector('.staff-sidebar-foot'),image=mark.querySelector('img');
 ok(mark.tagName==='A'&&mark.getAttribute('href')==='https://kingdompropel.com'&&!mark.onclick,'native platform link '+page);
 ok(mark.target==='_blank'&&mark.rel==='noopener noreferrer','safe new-tab link '+page);
 ok(mark.getAttribute('aria-label').includes('in a new tab')&&image.alt==='Kingdom Propel by EagleVision','accessible attribution '+page);
 ok(image.getAttribute('src')==='assets/images/kingdom-propel-logo.png'&&mark.querySelector('span').textContent==='Powered By','approved logo treatment '+page);h.w.close();}
{
 const h=await harness('staff-home');let g=h.d.querySelector('[data-group=operations]'),b=g.querySelector('button');b.click();ok(g.querySelector('.staff-children').hidden&&b.getAttribute('aria-expanded')==='false','accessible group collapse');b.click();ok(!g.querySelector('.staff-children').hidden,'expand restores children');h.w.localStorage.setItem('staff-nav-groups-v1','{"outreach":false}');ok(h.d.querySelector('[data-group=home] button').getAttribute('aria-expanded')==='true','active category remains expanded');
 h.w.matchMedia=()=>({matches:true});h.w.dispatchEvent(new h.w.Event('resize'));ok(h.d.querySelector('.staff-sidebar').inert,'closed mobile sidebar inert');h.d.querySelector('.staff-menu').click();ok(h.d.querySelector('.staff-shell').classList.contains('is-menu-open')&&!h.d.querySelector('.staff-sidebar').inert,'mobile drawer opens');ok(h.d.querySelector('.staff-menu').getAttribute('aria-expanded')==='true','mobile aria-expanded');const mark=h.d.querySelector('.staff-sidebar-foot');mark.focus();mark.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));ok(h.d.activeElement===h.d.querySelector('.staff-brand'),'drawer focus wraps after attribution link');h.d.querySelector('.staff-brand').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true}));ok(h.d.activeElement===mark,'attribution participates in keyboard focus');h.d.querySelector('.staff-close').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));ok(!h.d.querySelector('.staff-shell').classList.contains('is-menu-open'),'Escape closes drawer');ok(h.d.activeElement===h.d.querySelector('.staff-menu'),'focus returns to menu');
 ok(h.d.querySelector('h1').textContent==='Staff Dashboard','distinct Staff Dashboard');ok(h.d.querySelector('.staff-quick-actions'),'authorized work actions');ok(!h.d.body.textContent.includes('Approvals waiting'),'unsupported metric omitted');h.setMode('participant');await h.w.StaffWorkspace.refresh();ok(!h.d.querySelector('a[data-capability=prizes]'),'same-session revoked nav cleared');ok(h.d.querySelector('.staff-state h2').textContent==='Access unavailable','same-session dashboard content cleared');h.w.close();
}
for(const mode of ['anonymous','participant','campaign','host']){
 const h=await harness('staff-home',mode);const links=[...h.d.querySelectorAll('.staff-children a')].map(a=>a.dataset.capability);
 if(['anonymous','participant'].includes(mode)){ok(links.length===0,mode+' sees no staff navigation');ok(!h.d.querySelector('.staff-quick-actions'),mode+' sees no protected dashboard');}
 if(mode==='campaign'){ok(links.includes('campaigns')&&!links.includes('prizes')&&!links.includes('people')&&!links.includes('team'),'campaign-only scope hides unrelated tools');}
 if(mode==='host'){ok(links.includes('preevent')&&!links.includes('campaigns')&&!links.includes('team')&&!links.includes('people')&&!links.includes('prizes'),'local host cannot see internal administration/travel/People/prizes');}
 h.w.close();
}
{
 const h=await harness('staff-outreach-prizes','all','?campaign='+A);ok(h.d.querySelector('a[data-capability=prizes]').getAttribute('href').endsWith('?campaign='+A),'selected campaign preserved across module links');h.w.close();
 const d=await harness('staff-outreach-prizes','all','?campaign='+B);ok(!d.d.querySelector('a[data-capability=prizes]'),'foreign campaign not inferred from another campaign');d.w.close();
 const clean=await harness('staff-outreach-event-day','all','',true);ok(clean.d.querySelector('a[aria-current=page]').getAttribute('href')==='staff-outreach-event-day.html','clean route active match');clean.w.close();
}
{
 const h=await harness('staff-outreach-overview');ok(h.d.querySelector('h1').textContent==='Outreach Overview','program overview distinct from personal home');ok(h.d.body.textContent.includes('Outreach snapshot')&&h.d.body.textContent.includes('Recorded decisions'),'overview uses existing scoped projections');ok(h.d.querySelector('.staff-dashboard-metric strong').textContent==='1','real projection count');h.w.close();
}
{
 const h=await harness('staff-home');const root=h.d.querySelector('#staff-dashboard');h.w.StaffWorkspace.denied(root);ok(root.querySelector('.staff-state'),'shared denied panel');ok(root.textContent.includes('Your current role does not include access to this section.'),'approved general denied copy');ok(root.querySelector('a').getAttribute('href')==='staff-home.html','return dashboard destination');h.w.close();
}
{
 const h=await harness('staff-people');h.w.eval(read('assets/js/outreach-people.js'));await tick();ok(h.d.querySelector('#outreach-people').textContent.includes('protected@example.test'),'People authorized normal state in shared shell');
 h.setMode('participant');const search=[...h.d.querySelectorAll('#outreach-people button')].find(b=>b.textContent==='Search');search.click();await tick();ok(!h.d.querySelector('#outreach-people').textContent.includes('protected@example.test'),'same-session People revocation clears protected data');ok(h.d.querySelector('#outreach-people .staff-state'),'People revocation uses common denied card');ok(!h.d.querySelector('a[data-capability=people]'),'People revocation refreshes navigation');h.w.close();
}
{
 const h=await harness('staff-home');h.d.querySelector('[data-group=home] button').click();ok(h.d.querySelector('[data-group=home] .staff-children').hidden,'active group can explicitly collapse');await h.w.StaffWorkspace.refresh();ok(!h.d.querySelector('[data-group=home] .staff-children').hidden,'active group reopens on current page refresh');h.w.close();
}
{
 const h=await harness('staff-home');let resolve;h.setDelay(new Promise(r=>resolve=r));const pending=h.w.StaffWorkspace.refresh();await tick();h.setMode('anonymous');for(const cb of h.callbacks)cb('SIGNED_OUT',null);h.setDelay(null);resolve();await pending;await tick();ok(!h.d.querySelector('.staff-quick-actions'),'late dashboard response discarded after sign-out');ok(!h.d.querySelector('.staff-children a'),'late nav response discarded after sign-out');h.w.close();
}
{
 const h=await harness('staff-outreach-overview');const s=h.w.StaffWorkspace.context;delete s.campaigns[0].summary.discipleship_active;h.w.dispatchEvent(new h.w.CustomEvent('staff-workspace-context',{detail:s}));ok(!h.d.querySelector('#staff-dashboard').textContent.includes('Active discipleship'),'unavailable summary metric omitted rather than fabricated zero');h.w.close();
}
{
 const h=await harness('staff-outreach-partners'),status=h.w.OutreachUI.el('p','Loading intakes…',{role:'status'});h.d.querySelector('main').append(status);await tick();ok(status.classList.contains('staff-loading'),'shared loading treatment');status.textContent='';await tick();ok(!status.classList.contains('staff-loading'),'loading treatment removed after status clears');h.w.close();
}
{
 const h=await harness('staff-outreach-prizes'),root=h.d.querySelector('#outreach-prize-app');root.replaceChildren(h.w.OutreachUI.el('h1','Choose a campaign'));await tick();ok(root.querySelector('.staff-campaign-choice')?.textContent.includes('contact your coordinator'),'empty campaign chooser provides clear next step');root.append(h.w.OutreachUI.el('a','Available campaign',{href:'staff-outreach-prizes.html?campaign='+A}));await tick();ok(root.querySelectorAll('.staff-campaign-choice').length===1&&root.querySelector('a').getAttribute('href').endsWith(A),'chooser help preserves real campaign actions without duplication');h.w.close();
}
const css=read('assets/css/staff-workspace.css');ok(css.includes('@media(max-width:1023px)')&&css.includes('@media(max-width:600px)'),'drawer for phone/tablet and desktop sidebar');ok(css.includes('minmax(0,1fr)')&&css.includes('width:272px;max-width:86vw'),'bounded responsive layout');ok(!read('assets/js/outreach-campaigns.js').includes("tabs.append(el('a','Registration & check-in'"),'no primary module links duplicated in campaign tabs');
ok(createHash('sha256').update(readFileSync(new URL('../../assets/images/kingdom-propel-logo.png',import.meta.url))).digest('hex')==='592adfa6d0a95e883ecf22adb27e7f4ba5943d2d8b5c0ef43be65e5ffcb6d5d3','approved logo exact original bytes');
console.log(checks+' Staff Workspace DOM checks passed');
