// Actual PR139 Staff/shared session/pinned SDK. Fictional export transport only; no real data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {createFixture,ids,session} from '../staff-cycle7/people-registration-fixture.mjs';
const root=new URL('../../',import.meta.url),sdk=readFileSync(process.env.SUPABASE_SDK_PATH),origin='https://checkin-host.invalid',backend='https://synthetic-composition.supabase.co',key='sb-synthetic-composition-auth-token';
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const publicFiles=new Set(JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root))));
const cases=[];let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const [engine,type]of Object.entries({chromium,webkit})){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch({headless:true});
 try{for(const width of [390,1280]){
  async function setup(){
   const f=createFixture(),errors=[],context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
   let expired=false;const allowed=new Set([ids.c]),attempts=[];
   await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(req.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
    if(u.origin===backend){
     const p=req.method()==='POST'?req.postDataJSON():{},name=u.pathname.split('/').at(-1),reply=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
     if(name==='user'&&expired)return reply({message:'Fictional expired Auth'},401);
     if(name==='staff_workspace_context')return reply({organizations:[],grants:[]});
     if(name==='communications_workspace')return reply({external_delivery_enabled:false,organizations:[],campaigns:[]});
     if(name==='forms_workspace')return reply({capabilities:{profile:'private_draft_v1'},organizations:[]});
     if(name==='outreach_registration_workspace'){
      attempts.push(structuredClone(p));
      if(p.p_action==='campaigns')return reply([...allowed].map(id=>({id,name:'Assigned campaign'})));
      if(!allowed.has(p.p_campaign))return reply({code:'42501'},403);
      if(p.p_action==='context')return reply({name:'Fictional Outreach',config:{timezone:'UTC',waiver_required:true,prize_choices:[],extra_fields:[]},capabilities:['registration.view','registration.export','checkin.manage']});
      if(p.p_action==='reverse'){f.writes.push({name,action:'reverse',...p});f.registration.attendees[0].checked_in_at=null;f.registration.status='confirmed';return reply({saved:true})}
     }
     const wrapped={request:()=>req,abort:(...a)=>route.abort(...a),fulfill:o=>route.fulfill({...o,headers:{...o.headers,'access-control-allow-origin':'*'}})};return f.backend(wrapped);
    }
    assert.equal(u.origin,origin,'No provider/external HTTP');assert.equal(req.method(),'GET');const path=u.pathname.slice(1);
    if(['seed','discipleship-login.html'].includes(path))return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Fictional login</h1>'});
    if(path==='assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'})});
    assert(publicFiles.has(path),'Actual public source only: '+path);
    const body=process.env.REVIEW_BASE&&path==='assets/js/outreach-registration-staff.js'?execFileSync('git',['show',process.env.REVIEW_BASE+':'+path],{cwd:root}):readFileSync(new URL(path,root));
    return route.fulfill({body,contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'image/png'});
   });
   await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
   const open=async()=>{await page.goto(origin+'/staff-outreach-registration.html?campaign='+ids.c);await page.getByRole('button',{name:'Open household',exact:true}).click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor()};
   const refresh=async()=>{await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor()};
   const capture=async()=>page.getByRole('button',{name:'Check in attendee',exact:true}).evaluate(b=>{window.savedButton=b;window.savedCheck=b.onclick});
   const done=async()=>{eq(errors,[],engine+'/'+width+' no runtime exceptions');eq(f.unexpected,[],engine+'/'+width+' no unexpected authority');await context.close()};
   return{f,page,context,open,refresh,capture,done,allowed,attempts,expire:()=>expired=true};
  }
  const label=engine+'/'+width;
  for(const retirement of ['button','ancestor','root','replacement','account','campaign','expired','denied','pagehide','none']){
   const h=await setup();await h.open();await h.page.evaluate(()=>{window.downloads=[];const original=OutreachRegistrationForm.download;OutreachRegistrationForm.download=(...args)=>{downloads.push(args);return original(...args)};window.exportButton=[...document.querySelectorAll('button')].find(b=>b.textContent==='Export CSV');window.exportAction=exportButton.onclick});
   h.f.hold('outreach_registration_workspace:csv');await h.page.evaluate(()=>{window.pendingExport=exportAction()});for(let i=0;!h.f.held()&&i<200;i++)await h.page.waitForTimeout(10);assert(h.f.held());
   eq(await h.page.evaluate(()=>downloads.length),0,label+' no download before response');
   if(retirement==='account'){h.f.setActor(ids.b);await h.page.evaluate(({key,value})=>{localStorage.setItem(key,JSON.stringify(value));dispatchEvent(new Event('staff-protected-clear'))},{key,value:session(ids.b)})}
   if(retirement==='expired'){h.expire();await h.page.evaluate(()=>dispatchEvent(new Event('focus')));await h.page.getByRole('link',{name:'Verify access again',exact:true}).waitFor()}
   if(retirement==='denied')h.f.deny('outreach_registration_workspace:csv');
   await h.page.evaluate(retirement=>{
    if(['button','ancestor','root'].includes(retirement)){const node=retirement==='button'?exportButton:retirement==='ancestor'?exportButton.parentNode:document.getElementById('outreach-registration-staff'),p=node.parentNode,next=node.nextSibling;node.remove();p.insertBefore(node,next)}
    if(retirement==='replacement')exportButton.replaceWith(exportButton.cloneNode(true));
    if(retirement==='campaign')history.replaceState({},'',location.pathname+'?campaign=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    if(retirement==='pagehide')dispatchEvent(new Event('pagehide'));
   },retirement);
   h.f.release();await h.page.evaluate(()=>pendingExport);const published=await h.page.evaluate(()=>downloads.length);cases.push({engine,width,retirement,published});console.log(JSON.stringify(cases.at(-1)));
   if(!process.env.REPRO)eq(published,retirement==='none'?1:0,label+' '+retirement+' exact application download count');
   if(retirement!=='none'){const n=h.attempts.length;await h.page.evaluate(()=>exportAction());eq(h.attempts.length,n,label+' retained retired export cannot make a new RPC')}
   if(retirement==='none'){eq(await h.page.evaluate(()=>downloads[0][2]),'fictional.csv',label+' original filename preserved');eq(h.f.calls.filter(c=>c.action==='csv').length,1,label+' one permitted export request')}
   eq(h.f.writes.length,0,label+' export introduces no registration/attendance mutation');await h.done();
  }
 }}finally{await browser.close()}
}
assert(cases.every(x=>x.published===(x.retirement==='none'?1:0)),'Retired export intent must not publish a delayed private CSV');
console.log(JSON.stringify({status:'PASS',checks,cases:cases.length,actualHost:true,fictionalAuth:true,hosted:false}));
