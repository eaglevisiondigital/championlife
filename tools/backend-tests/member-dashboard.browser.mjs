// Actual dashboard, synthetic identity boundary, intercepted local files only.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
const root=fileURLToPath(new URL('../../',import.meta.url)),origin='https://member-dashboard.invalid';
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++};
const mock=`(()=>{
 const users={A:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test'},B:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'b@example.test'}};
 let key='A',listeners=[],expired=false,deny=false,foreign=false,slow=false,pending=[];
 let progress=[{lesson_number:1,status:'completed'},{lesson_number:2,status:'in_progress'}];
 const session=()=>({user:users[key],expires_at:Date.now()/1000+(expired?-60:3600)});
 window.__test={calls:[],switch:k=>{key=k;listeners.forEach(f=>f(k?'SIGNED_IN':'SIGNED_OUT',session()))},reload:()=>dispatchEvent(new PageTransitionEvent('pageshow')),set:p=>{progress=p},expire:()=>{expired=true},deny:()=>{deny=true},foreign:()=>{foreign=true},slow:()=>{slow=true},finish:()=>{slow=false;pending.splice(0).forEach(f=>f())},recover:()=>{expired=false;deny=false;foreign=false;slow=false}};
 window.ChampionLifeAuth={client:{auth:{onAuthStateChange:f=>listeners.push(f)}},getVerifiedUser:async()=>users[key]||null,getSession:async()=>session(),getOutreachRegistration:async()=>null,getDashboard:async id=>{window.__test.calls.push(id);if(deny)throw Error('denied');const data={user:users[foreign?'B':key],profile:{first_name:'Fictional '+key},progress,answers:'PRIVATE ANSWERS MUST NOT RENDER',notes:'PRIVATE NOTES MUST NOT RENDER',prayer_request:'PRIVATE PRAYER MUST NOT RENDER'};if(slow)await new Promise(r=>pending.push(r));return data},signOut:async()=>window.__test.switch(null)};
})();`;
for(const [name,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of[390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());if(route.request().method()!=='GET'){writes.push(u.href);return route.abort()}
   if(u.origin!==origin)return route.abort();
   if(u.pathname==='/assets/js/champion-life-auth.js')return route.fulfill({body:mock,contentType:'text/javascript'});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({body:'',contentType:'text/javascript'});
   const file=process.env.DASHBOARD_SOURCE&&u.pathname==='/my-discipleship.html'?process.env.DASHBOARD_SOURCE:path.join(root,u.pathname);
   try{return route.fulfill({body:await readFile(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}
  });
  await page.goto(origin+'/my-discipleship.html');
  const loaded=()=>page.waitForFunction(()=>!document.querySelector('#dashLessons').hidden);
  const empty=async()=>{ok(await page.locator('#dashLessons').innerText()==='','private activity cleared');ok(await page.locator('#dashEmail').innerText()==='','identity cleared');ok(await page.locator('#readerResources.show').count()===0,'reader mount cleared')};
  await loaded();
  ok(await page.locator('#dashProgressText').innerText()==='2 of 13 with activity records','legacy completed is activity, never certified completion');
  ok(await page.locator('.dash-status.complete').count()===0,'no completed badge derived from writable projection');
  ok((await page.locator('.dash-course-head').innerText()).includes('does not verify video watching or lesson completion'),'completion boundary explicit');
  ok((await page.locator('.dash-course-head').innerText()).includes('may not appear in this activity summary'),'worksheet saves not falsely represented by legacy progress');
  const rows=page.locator('.dash-lesson');ok(await rows.count()===13,'all13 routes preserved');
  for(let n=1;n<=13;n++){
   ok(await rows.nth(n-1).getAttribute('href')===`getting-a-grip-${n}.html`,'existing lesson route '+n);
   const text=await rows.nth(n-1).innerText();ok(text.includes(n<=4?'Autosave':'Save responses'),'actual save mode '+n);
   ok(text.includes(n<=10?'Video available':'video coming soon'),'actual media availability '+n);
  }
  ok((await page.locator('main').innerText()).includes('No activity record'),'absence describes record only');
  ok(!/PRIVATE (ANSWERS|NOTES|PRAYER)/.test(await page.locator('body').innerText()),'no raw private fields rendered');
  ok(await page.locator('#readerResources a').getAttribute('href')==='king-kind-reader.html','reader eligibility stays at private reader');
  ok(await page.locator('#stLuciaResources.show').count()===0,'no fabricated campaign association');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no viewport overflow');
  if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.EVIDENCE_DIR,`member-${name}-${width}.png`),fullPage:true})}
  await page.evaluate(()=>{window.__test.set([null,{lesson_number:1,status:'completed'},{lesson_number:1,status:'completed'},{lesson_number:13,status:'in_progress'},{lesson_number:0,status:'completed'},{lesson_number:14,status:'completed'},{lesson_number:2.5,status:'completed'},{lesson_number:'3',status:'completed'},{lesson_number:4,status:'<img onerror=alert(1)>'}]);window.__test.reload()});await loaded();
  ok(await page.locator('#dashProgressText').innerText()==='2 of 13 with activity records','duplicates malformed and out-of-range rows cannot inflate activity');
  ok(await page.locator('.dash-status.progress').count()===2,'only valid numbered records affect badges');
  await page.evaluate(()=>{window.__test.set({lesson_number:1,status:'completed'});window.__test.reload()});await loaded();
  ok(await page.locator('#dashProgressText').innerText()==='0 of 13 with activity records','malformed list creates no activity claim');
  await page.evaluate(()=>{window.__test.slow();window.__test.reload()});await page.waitForFunction(()=>window.__test.calls.length>=4);
  await page.evaluate(()=>window.__test.switch('B'));await empty();
  await page.evaluate(()=>window.__test.finish());await loaded();
  ok(await page.locator('#dashEmail').innerText()==='b@example.test','late A response cannot replace B identity');
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await empty();
  await page.evaluate(()=>window.__test.switch('A'));await page.waitForTimeout(20);await empty();
  await page.evaluate(()=>window.__test.reload());await loaded();
  await page.evaluate(()=>{window.__test.foreign();window.__test.reload()});await page.waitForTimeout(30);await empty();
  await page.evaluate(()=>{window.__test.recover();window.__test.expire();window.__test.reload()});await page.waitForTimeout(30);await empty();
  await page.evaluate(()=>{window.__test.recover();window.__test.deny();window.__test.reload()});await page.getByText('We could not load your saved lesson activity',{exact:false}).waitFor();await empty();
  await page.evaluate(()=>{window.__test.recover();window.__test.reload()});await loaded();
  await page.evaluate(()=>window.__test.switch(null));await page.waitForURL('**/discipleship-login.html?next=my-discipleship.html');ok(true,'anonymous current session returns to login');
  ok(errors.length===0,'no browser exceptions '+errors.join(','));ok(writes.length===0,'dashboard issues no mutations');
  console.log(JSON.stringify({name,width,checks}));await context.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,evidence:'Synthetic identity boundaries only; real Auth, native DB and production release not exercised'}));
