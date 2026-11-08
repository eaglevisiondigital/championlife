// Exact Staff126 + Desk132 runtime, pinned real SDK; fictional Auth, disposable native SQL only.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {composeCampaignStaffHost,staffHostSource} from './campaign-staff-host.mjs';
import {createCampaignFoundationTestHost} from './campaign-foundation-test-host.mjs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const project='abcdefghijklmnopqrst',origin='https://decision-host.invalid',backend='https://'+project+'.supabase.co',key='sb-'+project+'-auth-token';
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH);assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const built=composeCampaignStaffHost(project),host=await createCampaignFoundationTestHost({directory:true});
const session=who=>{const u=host.users[who],exp=Math.floor(Date.now()/1000)+3600;return{access_token:Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:u.id,session_id:u.sessionId,exp,role:'authenticated'})).toString('base64url')+'.fictional',refresh_token:'fictional-'+who,expires_at:exp,expires_in:3600,token_type:'bearer',user:{id:u.id,email:who+'@example.invalid',email_confirmed_at:'2026-01-01',aud:'authenticated',role:'authenticated'}}};
let checks=0;const check=(v,label)=>{assert(v,label);checks++;console.log('PASS '+label)};
try{for(const [engine,type]of Object.entries({chromium,webkit})){
 if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
 const browser=await type.launch({headless:true});try{for(const width of [390,1440]){
  await host.reset();const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  const calls=[],errors=[],unexpected=[];let actor='worker',missing=false,denial=false,hold=false,release,heldResponse=false;
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
   if(req.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend){
    let sub;try{sub=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub}catch{}
    const who=Object.keys(host.users).find(k=>host.users[k].id===sub);
    if(u.pathname==='/auth/v1/user')return who===actor?send(session(who).user):send({message:'Fictional session denied'},401);
    if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:'',headers:{'access-control-allow-origin':'*'}});
    const name=u.pathname.split('/').at(-1),p=req.postDataJSON()||{};calls.push({name,p,who});if(!who)return send({code:'42501'},403);
    try{
     let result;
     if(name==='campaign_decision_directory'){if(missing==='directory')return send({code:'PGRST202'},404);if(denial)return send({code:'42501'},403);result=await host.directory(host.users[who].token)}
     else if(name==='campaign_decision_foundation'){if(missing==='foundation')return send({code:'PGRST202'},404);result=await host.rpc(host.users[who].token,p);if(hold&&p.p_action==='list'){hold=false;heldResponse=true;await new Promise(r=>release=r)}}
     else if(['staff_workspace_context','outreach_registration_workspace','forms_workspace','communications_workspace'].includes(name)){
      if(name!=='staff_workspace_context'&&!['context','campaigns'].includes(p.p_action))throw Object.assign(Error('Unexpected mutation'),{code:'42501'});
      result=await host.staffDiscovery(host.users[who].token,name);
     }else{unexpected.push(name);return send({code:'42501'},403)}
     return send(result);
    }catch(e){return send({code:e.code==='42883'?'PGRST202':e.code||'42501',message:'Fictional local contract'},e.code==='42883'?404:403)}
   }
   if(u.origin!==origin){unexpected.push(req.url());return route.abort()}
   const path=u.pathname.slice(1);
   if(path==='seed'||path==='discipleship-login.html')return route.fulfill({body:'<!doctype html><h1>Fictional sign in</h1>',contentType:'text/html'});
   if(path==='assets/js/supabase-config.js')return route.fulfill({body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'}),contentType:'text/javascript'});
   if(path==='staff-home.html')return route.fulfill({body:built.home,contentType:'text/html'});
   if(path==='assets/js/staff-workspace.js')return route.fulfill({body:built.shell,contentType:'text/javascript'});
   if(['tools/outreach/campaign-workspace-mount.mjs','tools/outreach/campaign-decision-view.mjs','tools/outreach/campaign-decision-adapter.mjs'].includes(path)){
    let body=readFileSync(new URL('../../'+path,import.meta.url),'utf8');
    return route.fulfill({body,contentType:'text/javascript'});
   }
   try{return route.fulfill({body:staffHostSource(path),contentType:path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'text/javascript'})}catch{unexpected.push(path);return route.fulfill({status:404,body:''})}
  });
  const label=engine+'/'+width+' ',home=origin+'/staff-home.html?context=outreach&campaign='+host.campaignId,desk=home+'&desk=decisions';
  const seed=async who=>{actor=who;await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(who)})};
  const open=async()=>{await page.goto(desk);await page.getByRole('button',{name:'Person A Fixture',exact:true}).waitFor()};
  const waitHold=async()=>{for(let i=0;i<200&&!heldResponse;i++)await page.waitForTimeout(10);assert(heldResponse,'held list response')};
  try{
  await seed('worker');await page.goto(home);await page.getByRole('link',{name:'Open Decision follow-up',exact:true}).waitFor();
  check(await page.locator('#staff-home-links a').count()===1,label+'decision-only Staff Home exposes one authorized module');
  check(!/People|Registration & Check-In|Financial|Forms|Church Events|Dream Team|Communications/.test(await page.locator('#staff-home-links').textContent()),label+'no inherited People/event/finance/learner rights');
  check(await page.getByLabel('Outreach campaign',{exact:true}).locator('option').count()===1,label+'only assigned campaign discovered');
  await page.getByRole('link',{name:'Open Decision follow-up',exact:true}).click();await page.getByRole('button',{name:'Person A Fixture',exact:true}).waitFor();
  check(new URL(page.url()).searchParams.get('desk')==='decisions',label+'actual host navigation enters existing desk');
  check((await page.locator('#staff-main').textContent()).includes('Event registrations and check-in are separate'),label+'decision vs event distinction');
  check((await page.locator('#staff-main').textContent()).includes('Next review: Not scheduled'),label+'existing next-review value displayed');
  await page.locator('[name=rosterSearch]').fill('person a');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await page.getByText('1 of 2 assigned records on this page.',{exact:true}).waitFor();
  check(!await page.getByRole('button',{name:'Person B Fixture',exact:true}).count(),label+'filtering actual assigned view');
  await page.getByRole('button',{name:'Refresh this page',exact:true}).click();await page.getByText('1 of 2 assigned records on this page.',{exact:true}).waitFor();check(await page.locator('[name=rosterSearch]').inputValue()==='person a',label+'same-scope refresh preserves search');
  if(width===390){await page.getByRole('button',{name:'Menu',exact:true}).click()}
  await page.getByRole('link',{name:'Staff home',exact:true}).click();await page.getByRole('link',{name:'Open Decision follow-up',exact:true}).waitFor();check(!await page.locator('[name=rosterSearch]').count(),label+'safe same-campaign Home return retires desk');
  await page.goBack();await page.getByRole('button',{name:'Person A Fixture',exact:true}).waitFor();check(await page.locator('[name=rosterSearch]').inputValue()==='',label+'history recovery freshly authorizes without old search');
  await page.getByRole('button',{name:'Person A Fixture',exact:true}).click();await page.locator('form').waitFor();await page.evaluate(()=>window.retiredForm=document.querySelector('form'));
  const retiredBefore=calls.filter(c=>c.p.p_action==='followup_save').length;
  await page.evaluate(()=>{const form=retiredForm,parent=form.parentNode;form.remove();parent.append(form);form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});await page.waitForTimeout(100);
  check(calls.filter(c=>c.p.p_action==='followup_save').length===retiredBefore,label+'same-turn removed/reinserted form cannot start mutation');
  for(const target of ['button','parent','root']){
   await open();await page.getByRole('button',{name:'Person A Fixture',exact:true}).click();await page.locator('form').waitFor();const before=calls.filter(c=>c.p.p_action==='followup_save').length;
   await page.evaluate(target=>{const form=document.querySelector('form'),node=target==='button'?form.querySelector('button'):target==='parent'?form.parentNode:document.getElementById('staff-home-links'),parent=node.parentNode;node.remove();parent.append(node);form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))},target);await page.waitForTimeout(50);
   check(calls.filter(c=>c.p.p_action==='followup_save').length===before,label+'permanently retired '+target+' cannot mutate');
  }
  await open();await page.getByRole('button',{name:'Person A Fixture',exact:true}).click();await page.locator('form').waitFor();await page.evaluate(()=>window.retiredForm=document.querySelector('form'));
  await page.evaluate(()=>dispatchEvent(new Event('staff-access-denied')));const before=calls.length;await page.evaluate(()=>retiredForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await page.waitForTimeout(30);check(calls.length===before&&!await page.locator('form').count(),label+'retired form cannot submit after host denial');
  await open();await host.revoke(host.users.worker.id);await page.getByRole('button',{name:'Refresh this page',exact:true}).click();await page.waitForFunction(()=>document.getElementById('staff-main').hidden);check(!await page.locator('[name=rosterSearch]').count(),label+'native revocation clears desk and query');await host.reset();
  for(const query of ['&org='+host.foreignOrgId,'&desk=decisions','&person='+host.records.a]){await page.goto(desk+query);await page.waitForFunction(()=>document.getElementById('staff-access-message').textContent.includes('unavailable'));check(!await page.locator('[name=rosterSearch]').count(),label+'invalid or private route hint denied '+query.split('=')[0])}
  await page.goto(origin+'/staff-home.html?context=outreach&campaign='+host.foreignCampaignId+'&desk=decisions');await page.waitForFunction(()=>document.getElementById('staff-access-message').textContent.includes('unavailable'));check(!await page.locator('[name=rosterSearch]').count(),label+'foreign organization campaign denied');
  await host.expire(host.users.worker.id);await page.goto(desk);await page.waitForFunction(()=>document.getElementById('staff-access-message').textContent.includes('unavailable'));check(!await page.locator('[name=rosterSearch]').count(),label+'native expired assignment denied');await host.reset();
  missing='directory';await page.goto(desk);await page.getByText('Decision follow-up backend is not installed.',{exact:false}).waitFor();check(!await page.locator('[name=rosterSearch]').count(),label+'missing directory explicit unavailable with no fallback');missing=false;
  missing='foundation';await page.goto(desk);await page.waitForFunction(()=>document.getElementById('staff-access-message').textContent.includes('unavailable'));check(!await page.locator('[name=rosterSearch]').count(),label+'missing foundation fails closed, no fallback');missing=false;
  denial=true;await page.goto(desk);await page.getByText('Access is no longer available.',{exact:false}).waitFor();check(!await page.locator('[name=rosterSearch]').count(),label+'denied directory cannot grant discovery');denial=false;
  for(const who of ['peopleOnly','registrationOnly']){await seed(who);await page.goto(desk);await page.waitForFunction(()=>document.getElementById('staff-access-message').textContent.includes('unavailable'));check(!await page.locator('[name=rosterSearch]').count(),label+who+' cannot enter decision route with unrelated authority')}
  await seed('worker');
  await open();await page.locator('[name=rosterSearch]').fill('Private prior account');hold=true;await page.getByRole('button',{name:'Apply filters',exact:true}).click();await waitHold();
  actor='other';await page.evaluate(async value=>{await ChampionLifeAuth.client.auth.setSession({access_token:value.access_token,refresh_token:value.refresh_token})},session('other'));release();release=null;await page.waitForTimeout(100);check(!await page.locator('[name=rosterSearch]').count()&&!String(await page.locator('body').textContent()).includes('Private prior account'),label+'account replacement discards held response and search');
  await seed('other');await page.goto(desk);await page.getByRole('button',{name:'Person C Fixture',exact:true}).waitFor();check(!await page.getByRole('button',{name:'Person A Fixture',exact:true}).count(),label+'replacement account sees only its records');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+'responsive existing shell');check((await page.locator('.staff-propel-credit').getAttribute('href'))==='https://kingdompropel.com/',label+'Powered by Propel unchanged');
  check(!calls.some(c=>['people_workspace','learner_status'].includes(c.name)||c.p.p_action==='followup_save'),label+'journey has no mutations or private learner/People access');check(!unexpected.length,label+'no unexpected endpoints');check(!errors.length,label+'strict browser errors: '+JSON.stringify(errors));
  if(process.env.CAMPAIGN_EVIDENCE_DIR){mkdirSync(process.env.CAMPAIGN_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:process.env.CAMPAIGN_EVIDENCE_DIR+'/'+engine+'-'+width+'.png',fullPage:true});writeFileSync(process.env.CAMPAIGN_EVIDENCE_DIR+'/'+engine+'-'+width+'.json',JSON.stringify({calls,errors,unexpected},null,2))}
  }catch(error){console.error(JSON.stringify({engine,width,errors,unexpected,calls,client:await page.evaluate(()=>({url:ChampionLifeAuth.client.supabaseUrl,auth:ChampionLifeAuth.client.auth.url,rest:ChampionLifeAuth.client.rest?.url,type:typeof ChampionLifeAuth.client.rest?.url,active:StaffWorkspace.active()})),body:await page.locator('body').textContent()}));throw error}finally{await context.close()}
 }}finally{await browser.close()}
}}finally{await host.close()}
console.log(JSON.stringify({passed:checks,failed:0,native:true,fictionalAuth:true,hostedAcceptance:false,release:'NO-GO'}));
