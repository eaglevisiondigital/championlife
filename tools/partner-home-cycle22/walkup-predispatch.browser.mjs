// Actual PR138 Staff host/session/SDK; walk-up submission dispatch regression. Fictional transport only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {createFixture,ids,session} from '../staff-cycle7/people-registration-fixture.mjs';
const root=new URL('../../',import.meta.url),sdk=readFileSync(process.env.SUPABASE_SDK_PATH),origin='https://checkin-host.invalid',backend='https://synthetic-composition.supabase.co',key='sb-synthetic-composition-auth-token';
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const publicFiles=new Set(JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root))));
const results=[];let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
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
      if(p.p_action==='context')return reply({name:'Fictional Outreach',config:{slug:'fictional-walkup',timezone:'UTC',waiver_required:true,waiver:{id:'66666666-6666-4666-8666-666666666666',version:1,text:'Synthetic test waiver',media_text:'Synthetic test media',media_initials_required:true},prize_choices:[],extra_fields:[]},capabilities:['registration.view','registration.manage','checkin.manage']});
      if(p.p_action==='walkup'){
       const token=req.headers().authorization?.split(' ')[1],actor=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;
       if(actor!==ids.a)return reply({code:'42501'},403);
       f.writes.push(structuredClone(p));return reply({accepted:true,reference:f.registration.reference,attendee_count:2});
      }
      if(p.p_action==='reverse'){f.writes.push({name,action:'reverse',...p});f.registration.attendees[0].checked_in_at=null;f.registration.status='confirmed';return reply({saved:true})}
     }
     const wrapped={request:()=>req,abort:(...a)=>route.abort(...a),fulfill:o=>route.fulfill({...o,headers:{...o.headers,'access-control-allow-origin':'*'}})};return f.backend(wrapped);
    }
    assert.equal(u.origin,origin,'No provider/external HTTP');assert.equal(req.method(),'GET');const path=u.pathname.slice(1);
    if(['seed','discipleship-login.html'].includes(path))return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Fictional login</h1>'});
    if(path==='assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'})});
    assert(publicFiles.has(path),'Actual public source only: '+path);
    const body=process.env.REVIEW_BASE&&['assets/js/outreach-registration-staff.js','assets/js/staff-workspace.js','assets/js/champion-life-auth.js'].includes(path)?execFileSync('git',['show',process.env.REVIEW_BASE+':'+path],{cwd:root}):readFileSync(new URL(path,root));
    return route.fulfill({body,contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'image/png'});
   });
   await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.a)});
   const open=async()=>{await page.goto(origin+'/staff-outreach-registration.html?campaign='+ids.c);await page.getByRole('button',{name:'Open household',exact:true}).click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor()};
   const refresh=async()=>{await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor()};
   const capture=async()=>page.getByRole('button',{name:'Check in attendee',exact:true}).evaluate(b=>{window.savedButton=b;window.savedCheck=b.onclick});
   const done=async()=>{eq(errors,[],engine+'/'+width+' no runtime exceptions');eq(f.unexpected,[],engine+'/'+width+' no unexpected authority');await context.close()};
   return{f,page,context,open,refresh,capture,done,allowed,attempts,expire:()=>expired=true};
  }
  for(const action of ['walkup'])for(const phase of ['staff','sdk'])for(const retirement of ['button','form','root','account','campaign','revocation','none']){
   const h=await setup();await h.open();await h.page.getByRole('button',{name:'Add walk-up',exact:true}).click();
   const form=h.page.locator('form').filter({has:h.page.getByRole('button',{name:'Submit household registration',exact:true})});
   for(const [name,value]of [['Primary adult first name','Morgan'],['Primary adult last name','Fixture'],['Email','fixture@example.test'],['Mobile phone','+15555550100']])await form.getByLabel(name,{exact:true}).fill(value);
   const adult=form.locator('.registration-member').first();for(const[name,value]of [['Attendee first name','Morgan'],['Attendee last name','Fixture'],['Age','38']])await adult.getByLabel(name,{exact:true}).fill(value);
   await form.getByRole('button',{name:'Add attendee',exact:true}).click();const child=form.locator('.registration-member').last();for(const[name,value]of [['Attendee first name','Alex'],['Attendee last name','Fixture'],['Age','9'],['Guardian relationship (required for minors)','Parent']])await child.getByLabel(name,{exact:true}).fill(value);await child.getByLabel(/^Relationship to primary/).selectOption('child');
   await form.getByLabel('Typed legal name',{exact:true}).fill('Morgan Fixture');await form.getByLabel(/^Signer relationship/).selectOption('parent');for(const name of ['Morgan Fixture','Alex Fixture','I have read and acknowledge this waiver.','I am an adult with authority to sign for each selected attendee.'])await form.getByLabel(name,{exact:true}).check();
   await form.evaluate(f=>{window.savedButton=f.querySelector('button[type=submit]');const fn=f.onsubmit;window.savedCheck=()=>fn({preventDefault(){}})})
   const n=h.attempts.filter(p=>p.p_action===action).length;
   await h.page.evaluate(phase=>{
    const api=phase==='staff'?ChampionLifeAuth:ChampionLifeAuth.client.auth, get=api.getSession.bind(api);let once=false;
    const hold=()=>{api.getSession=()=>!once?(once=true,new Promise(resolve=>window.releasePreflight=async()=>resolve(await get()))):get()};
    if(phase==='staff')hold();else{const outer=ChampionLifeAuth.getSession;ChampionLifeAuth.getSession=async()=>{const session=await outer();hold();ChampionLifeAuth.getSession=outer;return session}};
    window.pendingCheck=savedCheck();
   },phase);
   await h.page.waitForFunction(()=>typeof releasePreflight==='function');
   eq(h.attempts.filter(p=>p.p_action===action).length,n,'Held '+phase+' issued no HTTP');
   if(retirement==='account'){h.f.setActor(ids.b);await h.page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(ids.b)})}
   await h.page.evaluate(async retirement=>{
    if(['button','form','root'].includes(retirement)){const node=retirement==='button'?savedButton:retirement==='form'?savedButton.closest('form'):document.getElementById('outreach-registration-staff'),parent=node.parentNode,next=node.nextSibling;node.remove();parent.insertBefore(node,next)}
    if(retirement==='campaign'){history.replaceState({},'',location.pathname+'?campaign=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');window.dispatchEvent(new PopStateEvent('popstate'))}
    if(retirement==='revocation')window.dispatchEvent(new Event('staff-access-denied'));
    await releasePreflight();await pendingCheck;
   },retirement);
   const after=h.attempts.filter(p=>p.p_action===action).length;
   results.push({engine,width,action,phase,retirement,newHttp:after-n});console.log(JSON.stringify(results.at(-1)));
   if(!process.env.REPRO)eq(after-n,retirement==='none'?1:0,phase+'/'+retirement+' exact new mutation count');
   if(retirement!=='none'){await h.page.evaluate(async()=>{await savedCheck();await savedCheck()});if(!process.env.REPRO)eq(h.attempts.filter(p=>p.p_action===action).length,after,'Captured retired handler cannot submit')}
   await h.done();
  }
 }}finally{await browser.close()}
}

assert(results.every(r=>r.newHttp===(r.retirement==='none'?1:0)),'Required zero new HTTP after retirement at BOTH async boundaries');
console.log(JSON.stringify({status:'PASS',checks,cases:results.length,hosted:false}));
