// Actual Staff126 host/session/SDK and exact PR134 runtime. Fictional transport only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {createFixture,ids,session} from '../staff-cycle7/people-registration-fixture.mjs';
const root=new URL('../../',import.meta.url),sdk=readFileSync(process.env.SUPABASE_SDK_PATH),origin='https://checkin-host.invalid',backend='https://synthetic-composition.supabase.co',key='sb-synthetic-composition-auth-token';
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const publicFiles=new Set(JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root))));
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
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
      if(p.p_action==='context')return reply({name:'Fictional Outreach',config:{timezone:'UTC',waiver_required:true,prize_choices:[],extra_fields:[]},capabilities:['registration.view','checkin.manage']});
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
  {
   const h=await setup();await h.page.goto(origin+'/staff-home.html');await h.page.getByRole('link',{name:'Open Registration & Check-In',exact:true}).waitFor();
   eq(await h.page.locator('#staff-home-links a').allTextContents(),['Open Registration & Check-In'],label+' registration authority exposes no People/finance/learning modules');
   await h.page.getByRole('link',{name:'Open Registration & Check-In',exact:true}).click();await h.page.getByRole('button',{name:'Open household',exact:true}).click();await h.page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor();
   eq(await h.page.locator('.staff-propel-credit img').getAttribute('alt'),'Propel by Eagle Vision',label+' approved branding retained');
   eq(await h.page.getByRole('button',{name:'Save household',exact:true}).count(),0,label+' check-in does not grant household editing');
   for(const target of ['button','card','root','main']){
    await h.refresh();await h.capture();const n=h.f.writes.length;
    await h.page.evaluate(async target=>{const node=target==='button'?savedButton:target==='card'?savedButton.closest('.registration-member'):document.getElementById(target==='root'?'outreach-registration-staff':'staff-main'),parent=node.parentNode,next=node.nextSibling;node.remove();parent.insertBefore(node,next);await savedCheck()},target);
    if(process.env.REPRO){eq(h.f.writes.length,n+1,label+' original '+target+' reinsertion issues new mutation');h.f.registration.attendees[0].checked_in_at=null;continue}
    eq(h.f.writes.length,n,label+' retired '+target+' initiates zero new mutations');await h.page.evaluate(()=>savedCheck());eq(h.f.writes.length,n,label+' captured '+target+' remains retired');
   }
   if(!process.env.REPRO){
    await h.refresh();await h.page.getByRole('button',{name:'Check in attendee',exact:true}).click();await h.page.getByRole('button',{name:'Reverse check-in',exact:true}).waitFor();eq(h.f.writes.at(-1).action,'checkin',label+' fresh current control remains useful');
    await h.page.getByLabel('Reason for check-in correction').fill('Fictional reversal');await h.page.getByRole('button',{name:'Reverse check-in',exact:true}).click();await h.page.getByRole('button',{name:'Check in attendee',exact:true}).waitFor();eq(h.f.writes.at(-1).action,'reverse',label+' current reversal works');
    await h.page.getByRole('button',{name:'Registrations',exact:true}).click();await h.page.getByRole('button',{name:'Open household',exact:true}).waitFor();eq((await h.page.locator('.registration-row').innerText()).includes('confirmed'),true,label+' roster shows reconciled status');
    if(width===390){await h.page.getByRole('button',{name:'Menu',exact:true}).click();eq(await h.page.locator('#staff-menu').getAttribute('aria-expanded'),'true',label+' mobile navigation retained');await h.page.getByRole('button',{name:'Close menu',exact:true}).click()}
   }
   await h.done();
  }
  if(process.env.REPRO)continue;
  for(const mode of ['account','expired','campaign','denied','pagehide','pending']){
   const h=await setup();await h.open();await h.capture();const n=h.f.writes.length;
   if(mode==='pending'){
    h.f.hold('outreach_registration_workspace:checkin');await h.page.evaluate(()=>{window.pending=savedCheck()});for(let i=0;!h.f.held()&&i<200;i++)await h.page.waitForTimeout(10);assert(h.f.held());
    await h.page.evaluate(async()=>{const p=savedButton.parentNode;savedButton.remove();p.append(savedButton);await savedCheck()});h.f.release();await h.page.evaluate(()=>pending);eq(h.f.writes.length,n+1,label+' already submitted request may complete');await h.page.evaluate(()=>savedCheck());eq(h.f.writes.length,n+1,label+' no second request after retirement');
   }else{
    if(mode==='account'){h.f.setActor(ids.b);await h.page.evaluate(async({key,value})=>{localStorage.setItem(key,JSON.stringify(value));await savedCheck()},{key,value:session(ids.b)})}
    if(mode==='expired'){h.expire();await h.page.evaluate(()=>dispatchEvent(new Event('focus')))}
    if(mode==='campaign'){await h.page.evaluate(id=>history.replaceState(null,'','?campaign='+id),ids.otherCampaign);await h.page.evaluate(()=>savedCheck());eq(h.f.writes.length,n,label+' stale cross-campaign handler denied');await h.page.goto(origin+'/staff-outreach-registration.html?campaign='+ids.otherCampaign)}
    if(mode==='denied'){h.allowed.clear();await h.page.evaluate(()=>dispatchEvent(new Event('focus')))}
    if(mode==='pagehide')await h.page.evaluate(()=>dispatchEvent(new Event('pagehide')));
    await h.page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();
    if(mode!=='campaign')await h.page.evaluate(()=>savedCheck());
    eq(h.f.writes.length,n,label+' '+mode+' cannot initiate mutation');eq(await h.page.locator('#staff-main').isHidden(),true,label+' '+mode+' clears protected workspace');
   }
   await h.done();
  }
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,actualHost:true,fictionalAuth:true,hosted:false,reproduction:!!process.env.REPRO}));
