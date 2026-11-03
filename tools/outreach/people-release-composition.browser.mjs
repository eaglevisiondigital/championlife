// Actual main-based HTML, Auth/session/common/People scripts and accepted SDK.
// Only configuration and HTTP are synthetic. No runtime script is injected/replaced.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const sdk=readFileSync(process.env.SUPABASE_SDK_PATH),sdkUrl='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0';
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const origin='https://people-release.invalid',backend='https://synthetic-auth.supabase.co',key='sb-synthetic-auth-auth-token';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',P='11111111-1111-4111-8111-111111111111',T='22222222-2222-4222-8222-222222222222';
const session=id=>{const exp=Math.floor(Date.now()/1000)+3600;return{access_token:[{alg:'HS256',typ:'JWT'},{sub:id,exp,aud:'authenticated',role:'authenticated'},'synthetic-signature'].map((v,i)=>i===2?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.'),refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user:{id,email:id+'@example.test',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01'}}};
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const [engine,options]of[[chromium,process.env.CI?{}:{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch(options);
 try{for(const width of[390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);
  let tasks=[],writes=[],reads=[],logout=[],denied=false,outcome='normal',hold=false,release,logoutFailure=false;
  const unexpected=[],errors=[],loginRequests=[],served=new Set();page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),respond=(json,status=200)=>route.fulfill({json,status});
   // The untouched login page still references @2; fixture bytes are pinned here too.
   if([sdkUrl,'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'].includes(req.url())&&req.method()==='GET')return route.fulfill({contentType:'text/javascript',body:sdk,headers:{'access-control-allow-origin':'*'}});
   if(u.origin===backend){
    if(u.pathname==='/auth/v1/logout'&&req.method()==='POST'){logout.push(u.searchParams.get('scope'));return logoutFailure?respond({message:'Synthetic unavailable'},500):route.fulfill({status:204,body:''})}
    const token=req.headers().authorization?.replace('Bearer ','');let actor;try{actor=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub}catch{}
    if(![A,B].includes(actor))return respond({message:'Synthetic identity required'},401);
    if(u.pathname==='/auth/v1/user'&&req.method()==='GET')return respond(session(actor).user);
    if(u.pathname==='/rest/v1/rpc/staff_workspace_context'&&req.method()==='POST')return respond({organizations:[{id:'org-a',name:'Synthetic Church'},{id:'org-b',name:'Synthetic Other'}],grants:(denied||actor===B?[]:['people.read','followup.read','followup.manage']).flatMap(permission=>['org-a','org-b'].map(organization_id=>({permission,organization_id,department_ids:null})))});
    if(u.pathname==='/rest/v1/rpc/people_workspace'&&req.method()==='POST'){
     const p=req.postDataJSON();reads.push({...p,actor});const person={id:P,first_name:actor===A?'Morgan':'Other',last_name:'Fixture',email:'person@example.test',relationships:[]};return respond(p.p_action==='list'?[person]:{person,relationships:[]});
    }
    if(u.pathname==='/rest/v1/followup_tasks'){
     if(req.method()==='GET'){reads.push({table:'followup_tasks'});return respond(tasks)}
     if(['POST','PATCH'].includes(req.method())){
      const payload=req.postDataJSON();writes.push({method:req.method(),payload,query:Object.fromEntries(u.searchParams),actor});
      if(hold)await new Promise(r=>release=r);
      if(outcome==='conflict'){outcome='normal';return respond([])}
      let task;if(req.method()==='POST'){task={...payload,id:T,status:'open',revision:1};tasks.push(task)}else{task=tasks.find(t=>u.searchParams.get('id')==='eq.'+t.id&&u.searchParams.get('revision')==='eq.'+t.revision);if(task)Object.assign(task,payload,{revision:task.revision+1})}
      if(outcome==='lost'){outcome='normal';return route.abort()}
      return respond(req.method()==='POST'?{id:task.id}:task?[{id:task.id}]:[]);
     }
    }
    unexpected.push(req.method()+' '+u.pathname);return route.abort();
   }
   if(u.origin!==origin||req.method()!=='GET'){unexpected.push(req.method()+' '+u.origin+u.pathname);return route.abort()}
   if(u.pathname==='/start')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic session setup</title>'});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'synthetic-key-no-authority'})});
   if(!/^\/(?:assets\/|staff-people\.html|discipleship-login\.html)/.test(u.pathname)){unexpected.push(u.pathname);return route.abort()}
   if(u.pathname==='/discipleship-login.html')loginRequests.push(u.searchParams.get('next'));
   try{const body=readFileSync(new URL('../..'+u.pathname,import.meta.url));served.add(u.pathname);return route.fulfill({body,contentType:u.pathname.endsWith('.html')?'text/html':u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}
  });
  const load=async()=>{await page.goto(origin+'/start');await page.evaluate(({key,value})=>{localStorage.setItem(key,JSON.stringify(value));localStorage.setItem('unrelated','preserve')},{key,value:session(A)});await page.goto(origin+'/staff-people.html');await page.getByRole('button',{name:'Review Person & follow-up'}).waitFor()};
  const open=async()=>{await page.getByRole('button',{name:'Review Person & follow-up'}).click();await page.getByRole('button',{name:'Add follow-up task',exact:true}).waitFor()};
  const date=()=>page.getByLabel('Task due date',{exact:true}),save=()=>page.getByRole('button',{name:'Save due date',exact:true});
  await load();ok(await page.locator('#staff-session-email').textContent()===session(A).user.email,'actual session header');ok(await page.evaluate(()=>typeof supabase.createClient==='function'&&!window.StaffWorkspace),'actual SDK and standalone main mount');await open();
  await page.getByLabel('Task title',{exact:true}).fill('Requested welcome');await page.getByLabel('Due date (optional)',{exact:true}).fill('2026-11-10');await page.getByRole('button',{name:'Add follow-up task',exact:true}).click();await date().waitFor();
  ok(writes.length===1&&tasks.length===1,'actual SDK creates one task');ok(JSON.stringify(writes[0].payload)===JSON.stringify({organization_id:'org-a',person_id:P,title:'Requested welcome',due_on:'2026-11-10'}),'minimal create transport');
  await date().fill('2026-11-17');await save().click();await page.getByText('open · 2026-11-17',{exact:true}).waitFor();ok(writes[1].query.organization_id==='eq.org-a'&&writes[1].query.person_id==='eq.'+P&&writes[1].query.id==='eq.'+T&&writes[1].query.revision==='eq.1'&&writes[1].query.select==='id','actual SDK exact revision filters');
  await page.getByRole('button',{name:'Remove due date',exact:true}).click();await page.getByText('open · No due date',{exact:true}).waitFor();ok(tasks[0].due_on===null,'clear uses SQL null');await page.getByLabel('Status').selectOption('completed');await page.getByRole('button',{name:'Save task status',exact:true}).click();await page.getByText('completed · No due date',{exact:true}).waitFor();ok(tasks[0].revision===4&&writes.length===4,'complete journey four writes');
  if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:process.env.EVIDENCE_DIR+'/'+engine.name()+'-'+width+'-complete.png',fullPage:true})}
  outcome='lost';await date().fill('2026-12-01');await save().click();await page.getByRole('button',{name:'Refresh follow-up tasks',exact:true}).waitFor();const count=writes.length;ok(await save().count()===0,'uncertain result retires actual-page controls');await page.getByRole('button',{name:'Refresh follow-up tasks',exact:true}).click();await date().waitFor();ok(writes.length===count&&await date().inputValue()==='2026-12-01','uncertain reconciliation read-only');
  outcome='conflict';await date().fill('2026-12-02');await save().click();await page.getByRole('button',{name:'Refresh follow-up tasks',exact:true}).waitFor();ok(tasks[0].due_on==='2026-12-01','stale revision leaves task');await page.getByRole('button',{name:'Refresh follow-up tasks',exact:true}).click();await date().waitFor();
  denied=true;const before=writes.length;await date().fill('2026-12-03');await save().click();await page.getByRole('alert').waitFor();ok(writes.length===before&&await save().count()===0,'revocation denies before actual SDK mutation');denied=false;
  await load();await open();hold=true;await date().fill('2026-12-04');await save().click();const deadline=Date.now()+10000;while(!release&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.ok(release,'held mutation arrived');const pending=writes.length;
  await page.evaluate(()=>document.querySelectorAll('button').forEach(b=>{if(b.textContent==='Save due date')b.click()}));ok(writes.length===pending,'duplicate pending submit blocked');
  await page.evaluate(value=>ChampionLifeAuth.client.auth.setSession({access_token:value.access_token,refresh_token:value.refresh_token}),session(B));await page.getByRole('alert').waitFor();hold=false;release();release=null;ok(!await page.getByText('Requested welcome',{exact:true}).count(),'account replacement clears pending protected DOM');ok(loginRequests.includes('/staff-people.html'),'main session login return preserved');ok(await page.locator('#staff-session-email').textContent()===session(B).user.email,'actual login restores only replacement account');ok(!reads.some(r=>r.actor===B),'unauthorized replacement account cannot query People');ok(writes.length===pending,'late prior-account mutation cannot start another write');ok(await page.getByRole('button',{name:'Add follow-up task',exact:true}).count()===0,'replacement account has no retained mutation form');
  await load();await open();logoutFailure=true;await page.getByRole('button',{name:'Log Out',exact:true}).click();await page.getByText(/Log out could not be completed/).waitFor();ok(await page.locator('#staff-main').innerHTML()==='','logout failure clears protected DOM');logoutFailure=false;await page.getByRole('button',{name:'Log Out',exact:true}).click();await page.waitForURL('**/discipleship-login.html?next=%2Fstaff-people.html');ok(logout.length===1&&logout.every(s=>s==='local'),'failed SDK logout removes local session; retry does not resend');ok(await page.evaluate(key=>localStorage.getItem(key)===null,key),'actual SDK session removed');ok(await page.evaluate(()=>localStorage.getItem('unrelated')==='preserve'),'unrelated storage retained');await load();await page.getByRole('button',{name:'Log Out',exact:true}).click();await page.waitForURL('**/discipleship-login.html?next=%2Fstaff-people.html');ok(logout.length===2&&logout.every(s=>s==='local'),'fresh-session successful logout uses only local scope');
  await page.goto(origin+'/staff-people.html');await page.getByRole('link',{name:'Sign in to your workspace',exact:true}).waitFor();ok(!await page.getByText('Requested welcome',{exact:true}).count(),'no-session reload has no private task');
  for(const p of['/staff-people.html','/assets/js/champion-life-auth.js','/assets/js/staff-session.js','/assets/js/outreach-staff-common.js','/assets/js/outreach-people.js','/discipleship-login.html'])ok(served.has(p),'actual source served '+p);
  ok(errors.length===0,'no page script errors: '+errors.join(';'));ok(unexpected.length===0,'no unexpected request: '+unexpected.join(';'));await context.close();
 }}finally{await browser.close()}
}
// Fail closed when CDN bytes do not match the exact page SRI.
for(const engine of[chromium,webkit]){const browser=await engine.launch(engine===chromium&&!process.env.CI?{channel:'chrome'}:{});try{const page=await browser.newPage();await page.route('**/*',async route=>{if(route.request().url()===sdkUrl)return route.fulfill({body:Buffer.concat([sdk,Buffer.from('/*tampered*/')]),contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();try{return route.fulfill({body:readFileSync(new URL('../..'+u.pathname,import.meta.url)),contentType:u.pathname.endsWith('.html')?'text/html':'text/javascript'})}catch{return route.fulfill({status:404,body:''})}});await page.goto(origin+'/staff-people.html');ok(!await page.evaluate(()=>window.supabase||window.ChampionLifeAuth),'tampered SDK cannot initialize page');await page.close()}finally{await browser.close()}}
console.log(JSON.stringify({status:'PASS',checks,engines:['chromium','webkit'],widths:[390,1440],providerRequests:0,auth:'actual SDK with synthetic sessions and intercepted HTTP; not managed Auth acceptance'}));
