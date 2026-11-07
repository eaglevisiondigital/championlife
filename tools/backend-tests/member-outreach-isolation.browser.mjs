// Real pinned SDK/shared Auth/page; all transport is intercepted and fictional.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
const root=fileURLToPath(new URL('../../',import.meta.url));
const origin='https://member-outreach.invalid',backend='https://synthetic-member.supabase.co';
const users={A:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test'},B:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'b@example.test'}};
for(const user of Object.values(users))Object.assign(user,{aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false});
const session=key=>{const user=users[key],exp=Math.floor(Date.now()/1000)+3600;return{user,expires_at:exp,expires_in:3600,token_type:'bearer',refresh_token:'fictional-'+key,access_token:[{alg:'HS256',typ:'JWT'},{sub:user.id,exp,aud:'authenticated',role:'authenticated'},'fictional-signature'].map((v,i)=>Buffer.from(i===2?v:JSON.stringify(v)).toString('base64url')).join('.')}};
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++};
for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of[390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  const requests=[],unexpected=[],errors=[],pending=[];
  let mode='denied',denyAuth=false,hold=false;
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({session})=>{if(!localStorage.getItem('sb-synthetic-member-auth-token'))localStorage.setItem('sb-synthetic-member-auth-token',JSON.stringify(session))},{session:session('A')});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===backend){
    const token=req.headers().authorization?.replace(/^Bearer /,'')||'';
    let actor;try{const sub=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub;actor=Object.keys(users).find(k=>users[k].id===sub)}catch{}
    requests.push({path:url.pathname,method:req.method(),actor,query:url.search});
    if(url.pathname==='/auth/v1/user')return denyAuth?route.fulfill({status:401,json:{code:'bad_jwt',message:'Fictional expired identity'}}):route.fulfill({json:users[actor]});
    if(url.pathname==='/rest/v1/rpc/claim_st_lucia_registration'&&req.method()==='POST')return route.fulfill({json:false});
    if(req.method()==='GET'&&url.pathname.startsWith('/rest/v1/')){
     const table=url.pathname.slice('/rest/v1/'.length);
     if(table==='courses'){ok(url.searchParams.get('slug')==='eq.getting-a-grip-on-the-basics','existing exact course query');return route.fulfill({json:{id:1,slug:'getting-a-grip-on-the-basics',total_lessons:13}})}
     if(['outreach_registrations','lesson_progress','profiles'].includes(table)){
      ok(Boolean(actor)&&url.searchParams.get('user_id')==='eq.'+users[actor].id,'request uses bearer owner '+table);
      if(table==='outreach_registrations'){
       ok(url.searchParams.get('source')==='eq.st_lucia_2026','existing outreach source filter');
       const captured=mode;
       if(hold)await new Promise(resolve=>pending.push(resolve));
       if(captured==='denied')return route.fulfill({status:403,json:{code:'42501',message:'PRIVATE backend diagnostic must not render'}});
       if(captured==='unavailable')return route.fulfill({status:503,json:{message:'PRIVATE backend diagnostic must not render'}});
       return route.fulfill({json:captured==='linked'?{id:1,source:'st_lucia_2026',decision:'PRIVATE decision',prayer_request:'PRIVATE prayer'}:null});
      }
      if(table==='lesson_progress'){ok(url.searchParams.get('course_id')==='eq.1','existing exact progress course filter');return route.fulfill({json:[{lesson_number:1,status:'in_progress'}]})}
      return route.fulfill({json:{first_name:'Fictional '+actor,last_name:'Learner'}});
     }
    }
    unexpected.push(req.method()+' '+url.pathname);return route.abort();
   }
   if(url.origin!==origin){unexpected.push(url.href);return route.abort()}
   if(url.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'synthetic-only'})});
   const file=process.env.DASHBOARD_SOURCE&&url.pathname==='/my-discipleship.html'?process.env.DASHBOARD_SOURCE:path.join(root,url.pathname);
   try{return route.fulfill({body:await readFile(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}
  });
  const loaded=()=>page.waitForFunction(()=>!document.querySelector('#dashLessons').hidden);
  const reload=()=>page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));
  const hidden=async()=>{ok(await page.locator('#dashEmail').innerText()==='','identity cleared');ok(await page.locator('#dashLessons').innerText()==='','activity cleared');ok(await page.locator('#stLuciaResources.show').count()===0,'outreach card cleared');ok(await page.locator('#readerResources.show').count()===0,'reader link cleared')};
  await page.goto(origin+'/my-discipleship.html');
  await page.waitForFunction(()=>!document.querySelector('#dashLessons').hidden||document.querySelector('#dashLoading').textContent.includes('could not load'));
  if(process.env.EXPECT_ORIGINAL_FAILURE==='1'){
   ok(await page.locator('#dashLessons').evaluate(el=>el.hidden),'original optional outreach denial blocks member course');
   ok(requests.filter(r=>r.path==='/rest/v1/lesson_progress').length===0,'original never requests independent learner activity');
   console.log(JSON.stringify({name,width,originalDefectReproduced:true}));await context.close();continue;
  }
  ok(await page.locator('#dashLessons').evaluate(el=>!el.hidden),'optional outreach denial must not block member course');
  ok(await page.locator('#dashProgressText').innerText()==='1 of 13 with activity records','existing authoritative activity loads');
  ok(await page.locator('.dash-lesson').count()===13,'all13 lesson routes preserved');
  ok(await page.locator('#outreachResourceStatus').isVisible(),'optional denial has truthful retry notice');
  ok(await page.locator('#stLuciaResources.show').count()===0,'denied outreach does not imply linked registration');
  ok(await page.locator('#readerResources.show').count()===1,'private reader entry independent, eligibility stays in reader');
  ok(!/PRIVATE/.test(await page.locator('main').innerText()),'backend details and private outreach fields absent');
  const stable=requests.length;await page.waitForTimeout(100);ok(requests.length===stable,'no automatic retry introduced');
  mode='unavailable';await reload();await loaded();ok(await page.locator('#outreachResourceStatus').isVisible(),'unavailable outreach also leaves truthful notice');
  if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.EVIDENCE_DIR,`outreach-unavailable-${name}-${width}.png`),fullPage:true})}
  mode='linked';await reload();await loaded();ok(await page.locator('#stLuciaResources.show').count()===1,'manual retry restores genuinely linked outreach card');ok(await page.locator('#outreachResourceStatus').isHidden(),'successful retry clears unavailable notice');
  mode='denied';await reload();await loaded();ok(await page.locator('#stLuciaResources.show').count()===0,'old linked card removed on later denial');
  mode='linked';hold=true;await reload();await page.waitForFunction(()=>document.querySelector('#dashLessons').hidden);while(!pending.length)await page.waitForTimeout(10);
  const beforeSwitch=requests.length;mode='denied';hold=false;
  await page.evaluate(async next=>{await window.ChampionLifeAuth.client.auth.setSession(next)},session('B'));
  await page.waitForFunction(()=>document.querySelector('#dashEmail').textContent==='b@example.test');
  pending.splice(0).forEach(resolve=>resolve());await page.waitForTimeout(100);
  ok(await page.locator('#dashEmail').innerText()==='b@example.test','late A lookup cannot replace B identity');
  ok(await page.locator('#stLuciaResources.show').count()===0,'late A linked lookup cannot expose card under B');
  ok(requests.slice(beforeSwitch).filter(r=>r.path==='/rest/v1/lesson_progress').every(r=>r.actor==='B'),'stale outreach continuation cannot query old owner activity');
  // The optional module can fail, but actual shared Auth revalidation must still deny.
  hold=true;await reload();while(!pending.length)await page.waitForTimeout(10);denyAuth=true;hold=false;pending.splice(0).forEach(resolve=>resolve());
  await page.getByText('We could not load your saved lesson activity',{exact:false}).waitFor();await hidden();
  ok(await page.locator('#outreachResourceStatus').isHidden(),'Auth failure never masquerades as partial resource success');
  denyAuth=false;mode='absent';await reload();await loaded();ok(await page.locator('#outreachResourceStatus').isHidden(),'confirmed absence is distinct from unavailable');
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await hidden();
  ok(await page.locator('#outreachResourceStatus').isHidden(),'history clearing removes optional status');
  await reload();await loaded();
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'notice fits viewport');
  ok(requests.filter(r=>r.method!=='GET'&&r.path!=='/rest/v1/rpc/claim_st_lucia_registration').length===0,'no new mutation/enrollment/answer/progress requests');
  ok(unexpected.length===0,'every request handled locally '+unexpected.join(','));ok(errors.length===0,'no browser errors '+errors.join(','));
  console.log(JSON.stringify({name,width,checks,requests:requests.length}));await context.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,provider:'fictional intercepted transport; actual pinned SDK/shared Auth; no hosted acceptance'}));
