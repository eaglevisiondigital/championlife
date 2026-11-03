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
  let mode='denied',denyAuth=false,hold=false,denyProgress=false,courseSlug='getting-a-grip-on-the-basics';
  let progress=[{lesson_number:1,status:'completed',updated_at:'2026-01-01T10:00:00+00:00'},{lesson_number:4,status:'in_progress',updated_at:'2026-02-01T10:00:00.123456+00:00'}];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({session})=>{if(!localStorage.getItem('sb-synthetic-member-auth-token'))localStorage.setItem('sb-synthetic-member-auth-token',JSON.stringify(session))},{session:session('A')});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===backend){
    const token=req.headers().authorization?.replace(/^Bearer /,'')||'';
    let actor;try{const sub=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub;actor=Object.keys(users).find(k=>users[k].id===sub)}catch{}
    requests.push({path:url.pathname,method:req.method(),actor,query:url.search});
    if(url.pathname==='/auth/v1/logout'&&req.method()==='POST')return route.fulfill({status:204,body:''});
    if(url.pathname==='/auth/v1/user')return denyAuth?route.fulfill({status:401,json:{code:'bad_jwt',message:'Fictional expired identity'}}):route.fulfill({json:users[actor]});
    if(url.pathname==='/rest/v1/rpc/claim_st_lucia_registration'&&req.method()==='POST')return route.fulfill({json:false});
    if(req.method()==='GET'&&url.pathname.startsWith('/rest/v1/')){
     const table=url.pathname.slice('/rest/v1/'.length);
     if(table==='courses'){ok(url.searchParams.get('slug')==='eq.getting-a-grip-on-the-basics','existing exact course query');return route.fulfill({json:{id:1,slug:courseSlug,total_lessons:13}})}
     if(['outreach_registrations','lesson_progress','profiles'].includes(table)){
      ok(Boolean(actor)&&url.searchParams.get('user_id')==='eq.'+users[actor].id,'request uses bearer owner '+table);
      if(table==='outreach_registrations'){
       ok(url.searchParams.get('source')==='eq.st_lucia_2026','existing outreach source filter');
       const captured=mode;
       
       if(captured==='denied')return route.fulfill({status:403,json:{code:'42501',message:'PRIVATE backend diagnostic must not render'}});
       if(captured==='unavailable')return route.fulfill({status:503,json:{message:'PRIVATE backend diagnostic must not render'}});
       return route.fulfill({json:captured==='linked'?{id:1,source:'st_lucia_2026',decision:'PRIVATE decision',prayer_request:'PRIVATE prayer'}:null});
      }
      if(table==='lesson_progress'){ok(url.searchParams.get('course_id')==='eq.1','existing exact progress course filter');const captured=structuredClone(progress);if(hold)await new Promise(resolve=>pending.push(resolve));return denyProgress?route.fulfill({status:403,json:{code:'42501',message:'private denial'}}):route.fulfill({json:captured})}
      return route.fulfill({json:{first_name:'Fictional '+actor,last_name:'Learner'}});
     }
    }
    unexpected.push(req.method()+' '+url.pathname);return route.abort();
   }
   if(url.origin!==origin){unexpected.push(url.href);return route.abort()}
   if(url.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'synthetic-only'})});
   if(url.pathname==='/discipleship-login.html')return route.fulfill({body:'<h1>Signed out navigation target</h1>',contentType:'text/html'});
   if(url.pathname.match(/^\/getting-a-grip-\d+\.html$/))return route.fulfill({body:'<h1>Navigation target reached. Existing worksheet acceptance is separate.</h1>',contentType:'text/html'});
   const file=process.env.DASHBOARD_SOURCE&&url.pathname==='/my-discipleship.html'?process.env.DASHBOARD_SOURCE:path.join(root,url.pathname);
   try{return route.fulfill({body:await readFile(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}
  });
  const loaded=()=>page.waitForFunction(()=>!document.querySelector('#dashLessons').hidden);
  const reload=()=>page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow')));
  const link=page.locator('#dashResumeLink');
  const hidden=async()=>{ok(await link.isHidden(),'return action hidden');ok(await link.getAttribute('href')===null,'old href removed');ok(await page.locator('#dashResumeStatus').textContent()==='','private hint cleared');ok(await page.locator('#dashEmail').textContent()==='','old identity cleared')};
  const absent=async()=>{ok(await link.isHidden(),'no unverifiable return target');ok(await link.getAttribute('href')===null,'no unverifiable URL');ok((await page.locator('#dashResumeStatus').textContent()).includes('does not mean you have not studied'),'absence does not imply no study')};
  await page.goto(origin+'/my-discipleship.html');await loaded();
  ok(await link.getAttribute('href')==='getting-a-grip-4.html','latest current-user saved activity supplies fixed route');
  ok((await page.locator('#dashResumeStatus').innerText()).includes('not verified viewing or completion'),'no fabricated completion');
  ok(await page.locator('.dash-lesson').count()===13,'all13 existing routes preserved');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'responsive no overflow');
  if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.EVIDENCE_DIR,`return-to-study-${name}-${width}.png`),fullPage:true})}
  await link.click();await page.waitForURL('**/getting-a-grip-4.html');ok(true,'return follows exact lesson4 route');
  await page.goto(origin+'/my-discipleship.html');await loaded();
  progress=[{lesson_number:13,status:'completed',updated_at:'2026-02-03T01:00:00Z'},{lesson_number:4,status:'in_progress',updated_at:'2026-02-01T10:00:00Z'}];await reload();await loaded();
  ok(await link.getAttribute('href')==='getting-a-grip-13.html','existing activity13 may be revisited without fabricated video or next credit');
  ok((await page.locator('.dash-lesson').last().innerText()).includes('video coming soon'),'missing13 media remains explicit');
  progress=[{lesson_number:4,status:'completed',updated_at:'2026-02-01T10:00:00Z'},{lesson_number:2,status:'in_progress',updated_at:'2026-02-01T10:00:00Z'}];await reload();await loaded();
  ok(await link.getAttribute('href')==='getting-a-grip-2.html','ties select deterministic lower lesson, not invented progression');
  for(const value of [null,13,'garbage','9999-01-01T00:00:00Z','2026-02-30T00:00:00Z','2026-13-01T00:00:00Z','2026-01-01','2026-01-01T99:00:00Z']){
   progress=[{lesson_number:1,status:'in_progress',updated_at:value}];await reload();await loaded();await absent();
  }
  progress=[{lesson_number:0,status:'in_progress',updated_at:'2026-01-01T00:00:00Z'},{lesson_number:14,status:'completed',updated_at:'2026-01-01T00:00:00Z'},{lesson_number:'3',status:'completed',updated_at:'2026-01-01T00:00:00Z'},{lesson_number:2,status:'<img>',updated_at:'2026-01-01T00:00:00Z'}];await reload();await loaded();await absent();
  progress=[];await reload();await loaded();await absent();
  progress=[{lesson_number:2,status:'in_progress',updated_at:'2026-01-01T00:00:00Z'}];courseSlug='unrelated-course';await page.reload();await loaded();await absent();courseSlug='getting-a-grip-on-the-basics';await page.reload();await loaded();
  progress=[{lesson_number:4,status:'in_progress',updated_at:'2026-01-01T00:00:00Z'}];await reload();await loaded();
  await page.evaluate(()=>{window.__oldReturn=document.querySelector('#dashResumeLink');window.__oldHandler=window.__oldReturn.onclick;dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))});await hidden();
  ok(await page.evaluate(()=>window.__oldReturn.getAttribute('href')===null),'retained control loses previous route');
  ok(await page.evaluate(()=>{let prevented=false;window.__oldHandler({preventDefault(){prevented=true}});return prevented}),'retained old handler rejects invalidated navigation generation');
  await reload();await loaded();
  hold=true;await reload();while(!pending.length)await page.waitForTimeout(10);
  progress=[{lesson_number:9,status:'in_progress',updated_at:'2026-01-03T00:00:00Z'}];
  await page.evaluate(async next=>{await window.ChampionLifeAuth.client.auth.setSession(next)},session('B'));
  await hidden();hold=false;pending.splice(0).forEach(resolve=>resolve());await loaded();
  ok(await page.locator('#dashEmail').textContent()==='b@example.test','fresh ownerB verified');
  ok(await link.getAttribute('href')==='getting-a-grip-9.html','delayed A cannot restore A return target');
  await page.evaluate(()=>{const original=Date.now;Date.now=()=>original()+7200000;window.__restoreClock=()=>{Date.now=original};document.querySelector('#dashResumeLink').click()});await hidden();
  ok(page.url().endsWith('/my-discipleship.html'),'expired return handler does not navigate');
  await page.evaluate(()=>window.__restoreClock());await reload();await loaded();
  hold=true;await page.evaluate(()=>dispatchEvent(new StorageEvent('storage',{key:'sb-synthetic-member-auth-token'})));await hidden();while(!pending.length)await page.waitForTimeout(10);hold=false;pending.splice(0).forEach(resolve=>resolve());await loaded();
  ok(await link.getAttribute('href')==='getting-a-grip-9.html','cross-tab invalidation requires new current data');
  denyProgress=true;await reload();await page.getByText('We could not load your saved lesson activity',{exact:false}).waitFor();await hidden();
  denyProgress=false;denyAuth=true;await reload();await page.getByText('We could not load your saved lesson activity',{exact:false}).waitFor();await hidden();ok(true,'provider identity denial keeps saved activity hidden');
  denyAuth=false;await reload();await loaded();await page.locator('#signOutBtn').click();await page.waitForURL('**/discipleship-login.html');ok(true,'actual SDK logout reaches fixed signed-out destination');
  ok(errors.length===0,'no browser exceptions '+errors.join(','));
  ok(unexpected.length===0,'no unexpected network requests '+unexpected.join(','));
  ok(requests.filter(r=>r.method!=='GET'&&!['/rest/v1/rpc/claim_st_lucia_registration','/auth/v1/logout'].includes(r.path)).length===0,'no enrollment completion task grant or answer mutations');
  console.log(JSON.stringify({name,width,checks}));await context.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,evidence:'Actual page/pinned SDK; fictional intercepted identity and data. No genuine provider acceptance. Lesson destination stub verifies navigation only; prior worksheet suite remains separate.'}));
