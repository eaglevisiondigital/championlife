// Real pinned SDK in Chromium/WebKit; every HTTP response is local/synthetic.
import {chromium,webkit} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as fixture from './fixtures/outreach-registration-ui.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sdk=await readFile(process.env.SUPABASE_SDK_PATH);
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
assert.equal(createHash('sha384').update(sdk).digest('base64'),'UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp');
const origin='https://staff.local.test',backend='https://synthetic-auth.supabase.co',key='sb-synthetic-auth-auth-token';
const evidence=process.env.EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});
const identities=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'church@example.test'},{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'outreach@example.test'}];
const makeSession=u=>{const exp=Math.floor(Date.now()/1000)+3600;return{access_token:[{alg:'HS256',typ:'JWT'},{sub:u.id,exp,aud:'authenticated',role:'authenticated'},'synthetic-signature'].map((x,i)=>i===2?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.'),refresh_token:'fictional-refresh-'+u.id,token_type:'bearer',expires_in:3600,expires_at:exp,user:{...u,aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01T00:00:00Z'}}};
let checks=2;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
for(const[engine,options]of[[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});
 try{for(const width of[390,820,1440]){
  const ctx=await browser.newContext({viewport:{width,height:1000}}),page=await ctx.newPage(),unexpected=[],errors=[],requests=[];
  let revoked=false,delay=null,release,failDiscovery=false,unverified=false,manage=false,finance=false,department=false,disabledConfig=false,badSDK=false;
  ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.hostname==='cdn.jsdelivr.net'&&u.pathname==='/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js')return route.fulfill({contentType:'text/javascript',body:badSDK?Buffer.concat([sdk,Buffer.from('/* changed */')]):sdk,headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend){
    const token=req.headers().authorization?.replace('Bearer ',''),sub=(()=>{try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub}catch{return null}})();
    const user=identities.find(x=>x.id===sub);
    if(u.pathname==='/auth/v1/user')return route.fulfill(user?{json:{...makeSession(user).user,...(unverified?{email_confirmed_at:null}:{})}}:{status:401,json:{message:'Synthetic expired session'}});
    if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
    if(u.pathname.startsWith('/rest/v1/rpc/')){
     const payload=req.postDataJSON(),name=u.pathname.split('/').pop();requests.push({name,payload});
     if(!user)return route.fulfill({status:401,json:{code:'PGRST301',message:'Denied'}});
     if(delay===name+':'+payload.p_action){delay=null;await new Promise(r=>release=r)}
     if(revoked)return route.fulfill({status:403,json:{code:'42501',message:'Synthetic access revoked'}});
     if(failDiscovery&&name==='staff_workspace_context')return route.abort();
     if(name==='staff_workspace_context')return route.fulfill({json:user===identities[0]?{organizations:[{id:'org',name:'Champion Life · Synthetic'}],grants:['people.read','followup.read',...(finance?['outreach.view','finance.read']:[])].map(permission=>({organization_id:'org',permission,department_ids:department?['restricted-department']:null}))}:{organizations:[],grants:[]}});
     if(name==='people_workspace')return route.fulfill({json:payload.p_action==='list'?[{id:'11111111-1111-4111-8111-111111111111',first_name:'Church',last_name:'Fixture',email:'private@example.test',relationships:['volunteer']}]:{person:{first_name:'Church',last_name:'Fixture'},relationships:[]}});
     if(name==='outreach_registration_workspace'){
      if(payload.p_action==='context')return route.fulfill({json:{...fixture.response(name,payload),admin:false,can_manage_access:false,capabilities:['view','registration.view',...(manage?['registration.manage','registration.export','checkin.manage']:[])]}});
      return route.fulfill({json:fixture.response(name,payload)});
     }
    }
    unexpected.push(req.method()+' '+u.pathname);return route.abort();
   }
   if(u.origin!==origin||req.method()!=='GET'){unexpected.push(req.method()+' '+u.origin+u.pathname);return route.abort()}
   if(u.pathname==='/start'||u.pathname==='/discipleship-login.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Sign in</h1>'});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify(disabledConfig?null:{url:backend,publishableKey:'synthetic-key-no-authority'})});
   const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root))return route.abort();
   try{return route.fulfill({body:await readFile(f),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(f)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:'Not found'})}
  });
  const seed=async user=>{await page.goto(origin+'/start');await page.evaluate(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:makeSession(user)})};
  const ready=async url=>{await page.goto(origin+url);await page.waitForFunction(()=>window.StaffWorkspace?.active())};
  const clear=async()=>{await page.waitForFunction(()=>window.StaffWorkspace&&!window.StaffWorkspace.active());ok(!await page.locator('#staff-main').isVisible(),'protected main hidden');ok(await page.locator('#staff-navigation a').count()===0,'protected navigation cleared');};
  await seed(identities[0]);await ready('/staff-home.html');
  ok(await page.locator('#staff-session-email').textContent()===identities[0].email,'verified account presented '+engine.name()+' '+width);
  ok(await page.locator('[aria-label="Ministry context"] option').count()===2,'authorized Church and Outreach contexts');
  ok(!await page.getByText('Financial Outreach Review',{exact:true}).count(),'no finance navigation without both permissions');
  if(width<1024){await page.getByRole('button',{name:'Menu',exact:true}).click();ok(await page.locator('#staff-sidebar').isVisible(),'mobile/tablet drawer opens');await page.getByRole('button',{name:'Close menu'}).click();ok(!await page.locator('#staff-sidebar').isVisible(),'drawer closes');}
  await page.locator('[aria-label="Ministry context"]').selectOption('outreach');await page.waitForURL('**/staff-home.html?context=outreach');await page.waitForFunction(()=>window.StaffWorkspace?.active());
  ok(await page.locator('[aria-label="Outreach campaign"] option').count()===1,'only server-authorized campaigns available');
  await page.getByRole('link',{name:'Open Registration & Check-In'}).click();await page.getByText('Household lookup',{exact:true}).waitFor();
  ok(new URL(page.url()).searchParams.get('campaign')===fixture.campaign,'context navigation bound to selected campaign');
  ok(!await page.getByRole('button',{name:'Export CSV',exact:true}).count(),'view-only has no export');
  ok(!await page.getByRole('button',{name:'Add walk-up',exact:true}).count(),'view-only has no editing');
  await page.getByRole('button',{name:'Open household'}).click();await page.getByText('Waiver signatures',{exact:true}).waitFor();
  ok(!await page.getByRole('button',{name:'Check in attendee',exact:true}).count(),'view-only has no check-in management');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal viewport overflow');
  if(evidence)await page.screenshot({path:path.join(evidence,engine.name()+'-'+width+'-workspace.png'),fullPage:true});
  if(width<1024)await page.getByRole('button',{name:'Menu',exact:true}).click();
  const logo=page.locator('.staff-propel-credit img');
  ok(await logo.evaluate(n=>n.complete&&n.naturalWidth>0),'official Propel logo decoded');
  ok(await page.locator('.staff-propel-credit').getAttribute('href')==='https://kingdompropel.com/','official Propel destination');
  ok(await logo.evaluate(n=>{const r=n.getBoundingClientRect();const s=getComputedStyle(n);return r.width>0&&r.height>0&&s.objectFit==='contain'}),'logo retains contain fit');
  if(evidence)await page.screenshot({path:path.join(evidence,engine.name()+'-'+width+'-outreach.png'),fullPage:true});
  if(width<1024)await page.getByRole('button',{name:'Close menu'}).click();
  // Hold a control detached from the DOM; explicit denial must prevent a later request.
  await page.evaluate(()=>window.retained=[...document.querySelectorAll('button')].find(b=>b.textContent==='Registrations'));
  revoked=true;await page.evaluate(()=>ChampionLifeAuth.client.rpc('outreach_registration_workspace',{p_action:'context',p_campaign:new URL(location.href).searchParams.get('campaign'),p_payload:{}}));await clear();
  const before=requests.length;await page.evaluate(()=>window.retained.click());await page.waitForTimeout(70);
  ok(requests.length===before,'detached control submits zero requests after denial');
  ok(!await page.getByText('Morgan Fixture',{exact:true}).count(),'private household removed after denial');
  revoked=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));ok(!await page.evaluate(()=>StaffWorkspace.active()),'focus cannot restore terminal denial');
  await ready('/staff-outreach-registration.html?campaign='+fixture.campaign);await page.getByText('Household lookup',{exact:true}).waitFor();
  delay='outreach_registration_workspace:detail';await page.getByRole('button',{name:'Open household'}).click();await page.waitForFunction(()=>true);while(!release)await new Promise(r=>setTimeout(r,5));
  revoked=true;await page.evaluate(()=>ChampionLifeAuth.client.rpc('outreach_registration_workspace',{p_action:'context',p_campaign:new URL(location.href).searchParams.get('campaign'),p_payload:{}}));await clear();revoked=false;release();release=null;await page.waitForTimeout(80);
  ok(!await page.getByText('Waiver signatures',{exact:true}).count(),'late successful detail cannot restore denied workspace');
  await ready('/staff-people.html?org=org');await page.getByText('Church Fixture',{exact:true}).waitFor();
  if(evidence){if(width<1024)await page.getByRole('button',{name:'Menu',exact:true}).click();await page.screenshot({path:path.join(evidence,engine.name()+'-'+width+'-church.png'),fullPage:true});if(width<1024)await page.getByRole('button',{name:'Close menu'}).click();}
  await page.getByRole('button',{name:'Log Out',exact:true}).click();await page.waitForURL('**/discipleship-login.html?next=%2Fstaff-home.html');
  ok(await page.evaluate(key=>localStorage.getItem(key)===null,key),'same-tab actual SDK logout retires local synthetic session');
  await page.goBack();await page.getByRole('link',{name:'Verify access again'}).waitFor();ok(!await page.getByText('Church Fixture',{exact:true}).count(),'Back cannot restore previous private data');
  await seed(identities[1]);await ready('/staff-home.html');
  ok(await page.locator('[aria-label="Ministry context"] option').count()===1,'campaign-only account does not inherit Church context');
  ok(await page.locator('[aria-label="Ministry context"]').inputValue()==='outreach','campaign-only account lands in Outreach');
  // A complete account change while a response is delayed cannot reuse the old scope.
  await seed(identities[0]);await ready('/staff-people.html?org=org');await page.getByText('Church Fixture',{exact:true}).waitFor();
  delay='people_workspace:list';await page.getByRole('button',{name:'Search',exact:true}).click();while(!release)await new Promise(r=>setTimeout(r,5));
  await page.evaluate(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));window.dispatchEvent(new Event('focus'))},{key,session:makeSession(identities[1])});
  await page.getByRole('link',{name:'Verify access again'}).waitFor();release();release=null;await page.waitForTimeout(80);ok(!await page.getByText('Church Fixture',{exact:true}).count(),'delayed old-account list cannot restore Church data');
  await seed(identities[0]);finance=true;await ready('/staff-home.html');ok(await page.locator('#staff-navigation').getByText('Financial Outreach Review',{exact:true}).count()===1,'finance link requires matching existing organization permissions');finance=false;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await clear();ok(true,'permission projection change invalidates mounted workspace');
  department=true;await ready('/staff-home.html');ok(await page.locator('[aria-label="Ministry context"] option').count()===1,'department-limited People grant is not broadened to organization');department=false;
  manage=true;await ready('/staff-outreach-registration.html?campaign='+fixture.campaign);await page.getByText('Household lookup',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Open household'}).click();await page.getByText('Waiver signatures',{exact:true}).waitFor();await page.getByText('Edit household',{exact:true}).click();
  const writesBefore=requests.filter(x=>x.payload.p_action==='update').length;
  await page.getByRole('button',{name:'Save household',exact:true}).click();await page.getByText('Waiver signatures',{exact:true}).waitFor();
  ok(requests.filter(x=>x.payload.p_action==='update').length===writesBefore+1,'authorized household save still submits once');
  ok(requests.filter(x=>x.payload.p_action==='update').at(-1).payload.p_payload.registration_id===fixture.registration,'save keeps original registration binding');
  await page.evaluate(()=>window.staleSave=[...document.querySelectorAll('button')].find(b=>b.textContent==='Save household'));
  revoked=true;await page.evaluate(()=>ChampionLifeAuth.client.rpc('outreach_registration_workspace',{p_action:'context',p_campaign:new URL(location.href).searchParams.get('campaign'),p_payload:{}}));await clear();
  const afterDeny=requests.length;await page.evaluate(()=>window.staleSave.click());await page.waitForTimeout(70);ok(requests.length===afterDeny,'detached Save emits zero mutations after denial');revoked=false;manage=false;
  await seed(identities[1]);
  const beforeUnknown=requests.length;await page.goto(origin+'/staff-outreach-registration.html?campaign=unauthorized');await page.getByRole('link',{name:'Verify access again'}).waitFor();
  ok(!requests.slice(beforeUnknown).some(x=>x.payload.p_campaign==='unauthorized'),'unauthorized deep link never invokes private module RPC');
  await ready('/staff-home.html');const second=await ctx.newPage();await second.goto(origin+'/staff-home.html');await second.waitForFunction(()=>window.StaffWorkspace?.active());await second.evaluate(()=>ChampionLifeAuth.client.auth.signOut({scope:'local'}));await page.waitForURL('**/discipleship-login.html?next=%2Fstaff-home.html');ok(true,'cross-tab SDK signout clears and leaves shell');await second.close();
  await seed(identities[0]);unverified=true;await page.goto(origin+'/staff-home.html');await page.getByRole('link',{name:'Verify access again'}).waitFor();ok(!await page.evaluate(()=>StaffWorkspace.active()),'unverified identity rejected before module load');unverified=false;
  failDiscovery=true;await page.goto(origin+'/staff-home.html');await page.getByRole('link',{name:'Verify access again'}).waitFor();ok(!await page.locator('#staff-main').isVisible(),'discovery network failure fails closed');failDiscovery=false;
  disabledConfig=true;const beforeDisabled=requests.length;await page.goto(origin+'/staff-home.html');await page.getByRole('link',{name:'Verify access again'}).waitFor();ok(!await page.evaluate(()=>StaffWorkspace.active())&&requests.length===beforeDisabled,'missing preview config never falls back to production');disabledConfig=false;
  badSDK=true;await page.goto(origin+'/staff-home.html');await page.getByRole('link',{name:'Verify access again'}).waitFor();ok(!await page.evaluate(()=>window.ChampionLifeAuth),'browser SRI rejects altered SDK bytes');badSDK=false;
  ok(errors.length===0,'no uncaught browser errors: '+errors.join(';'));ok(unexpected.length===0,'all browser HTTP intercepted; no live provider traffic');
  await ctx.close();
 }}finally{await browser.close()}
}
const result={checks,engines:['Chromium','WebKit'],widths:[390,820,1440],provider:'simulated HTTP, real SDK',hosted_actions:0};
if(evidence)await writeFile(path.join(evidence,'browser-results.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
