// Actual Chromium/WebKit + pinned SDK; all Auth/RPC traffic fictional/intercepted.
import{chromium,webkit}from'../backend-tests/node_modules/playwright/index.mjs';import{readFile,mkdir}from'node:fs/promises';import{fileURLToPath}from'node:url';import path from'node:path';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),origin='https://worksheet.local.test',backend='https://abcdefghijklmnopqrst.supabase.co';
const lesson=Number(process.env.WORKSHEET_LESSON||5),required=({5:10,6:7,7:7,8:6,9:5,10:5,11:4,12:3,13:4})[lesson];if(!required)throw Error('unsupported test lesson');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const token=id=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.ZmljdGlvbmFs';
const user=id=>({id,email:id===A?'a@example.test':'b@example.test',email_confirmed_at:'2026-01-01',aud:'authenticated',role:'authenticated'});
let checks=0;const ok=(x,m)=>{assert.ok(x,m);checks++;console.log('PASS '+m)};
for(const[engine,options]of[[chromium,process.env.CI?{}:{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});try{for(const width of[390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage(),calls=[],errors=[],records=new Map();let mode='',hold=false,release,started;
  const row=id=>{if(!records.has(id))records.set(id,{revision:randomUUID(),answers:[]});return records.get(id)};
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
   if(url.origin===backend){let id;try{id=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub}catch{}
    if(url.pathname==='/auth/v1/user')return route.fulfill({json:user(id)});
    if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
    if(url.pathname==='/rest/v1/rpc/owned_worksheet_transaction'){
     const p=req.postDataJSON();calls.push({id,p});
     if(hold){hold=false;started();await new Promise(r=>release=r)}
     if(mode==='denied')return route.fulfill({status:403,json:{code:'42501',message:'Fictional denial'}}).catch(()=>{});
     if(mode==='lost')return route.abort();
     if(mode==='wrong-lesson')return route.fulfill({json:{status:'available',course:'getting-a-grip-on-the-basics',lesson:lesson===8?6:lesson+1,worksheet:`lesson-${lesson===8?6:lesson+1}-workbook-sections-v1`,revision:randomUUID(),requiredQuestions:required,savedNonblankAnswers:1,allRequiredAnswersSaved:false,answers:[{question:1,answer:'WRONG LESSON PRIVATE'}],canComplete:false,canCommit:false}});
     if(p.p_lesson!==lesson||![A,B].includes(id))throw Error('unexpected target');
     const r=row(id);
     if(p.p_answers){if(mode==='conflict'||p.p_expected_revision!==r.revision)return route.fulfill({status:400,json:{code:'40001',message:'Fictional conflict'}});r.answers=p.p_answers;r.revision=randomUUID()}
     const n=r.answers.filter(a=>a.answer.trim()).length;
     return route.fulfill({json:{status:'available',course:'getting-a-grip-on-the-basics',lesson,worksheet:`lesson-${lesson}-workbook-sections-v1`,revision:r.revision,requiredQuestions:required,savedNonblankAnswers:n,allRequiredAnswersSaved:n===required,answers:r.answers,canComplete:false,canCommit:false}}).catch(()=>{});
    }
    throw Error('unexpected backend '+url.pathname);
   }
   if(url.origin!==origin)return route.fulfill({body:'',status:200});
   if(url.pathname==='/assets/js/supabase-config.js')return route.fulfill({body:`window.CHAMPION_LIFE_SUPABASE=${JSON.stringify({url:backend,publishableKey:'fictional-publishable'})}`,contentType:'text/javascript'});
   try{return route.fulfill({body:await readFile(path.join(root,url.pathname)),contentType:({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.pdf':'application/pdf'})[path.extname(url.pathname)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}
  });
  await page.goto(origin+`/getting-a-grip-${lesson}.html`);
  const sign=async id=>page.evaluate(async access_token=>{await ChampionLifeAuth.client.auth.setSession({access_token,refresh_token:'fictional'})},token(id));
  const load=async()=>{await page.locator('[data-worksheet-load]').click();await page.waitForFunction(()=>!document.querySelector('[data-worksheet-fields]').disabled)};
  const field=page.locator('[data-worksheet-answer="1"]'),status=page.locator('[data-worksheet-status]'),save=page.locator('[data-worksheet-form] [type=submit]');
  ok(await field.isDisabled(),'signed-out worksheet locked');await sign(A);await load();ok(await field.inputValue()==='','fresh A has no imported device notes');
  await field.fill('A private response');await save.click();await page.waitForFunction(()=>document.querySelector('[data-worksheet-status]').textContent.startsWith('Saved'));
  ok(calls.at(-1).id===A&&calls.at(-1).p.p_answers[0].answer==='A private response','actual SDK save bound to A');
  await page.reload();await load();ok(await field.inputValue()==='A private response','durable response reload');
  await sign(B);ok(await field.inputValue()===''&&await field.isDisabled(),'account event clears immediately');await load();ok(await field.inputValue()==='','B cannot see A');await sign(A);await load();ok(await field.inputValue()==='A private response','A returns to only own response');
  await field.fill('pending A');hold=true;const waiting=new Promise(r=>started=r);await save.click();await waiting;const sent=calls.filter(c=>c.p.p_answers).length;
  await sign(B);release();await page.waitForTimeout(100);ok(await field.inputValue()===''&&await field.isDisabled(),'delayed A save cannot display under B');
  await page.evaluate(()=>document.querySelector('[data-worksheet-form]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await page.waitForTimeout(20);ok(calls.filter(c=>c.p.p_answers).length===sent,'detached stale save submits zero additional writes');
  await load();ok(await field.inputValue()==='','B fresh authorization required');
  await field.fill('B changes');mode='conflict';await save.click();await page.waitForFunction(()=>document.querySelector('[data-worksheet-status]').textContent.includes('changed'));ok(await field.isDisabled()&&await field.inputValue()==='','conflict clears protected review state');
  mode='';await load();await field.fill('B response');mode='lost';const before=calls.length;await save.click();await page.waitForFunction(()=>document.querySelector('[data-worksheet-status]').textContent.includes('unknown'));ok(calls.length===before+1&&await field.isDisabled(),'uncertain save never duplicates');
  mode='';await load();mode='denied';await field.fill('denied');await save.click();await page.waitForFunction(()=>document.querySelector('[data-worksheet-status]').textContent.includes('unavailable'));ok(await field.inputValue()===''&&await field.isDisabled(),'server denial removes private contents');
  mode='';await load();await field.fill('unsaved B');await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));ok(await field.inputValue()===''&&await field.isDisabled(),'Back cache clears live/default values');await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));ok(await field.isDisabled(),'history requires fresh explicit authorization');await load();
  await page.evaluate(()=>ChampionLifeAuth.client.auth.signOut({scope:'local'}));ok(await field.inputValue()===''&&await field.isDisabled(),'logout clears field and controls');
  const count=calls.length;await page.evaluate(()=>document.querySelector('[data-worksheet-form]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await page.waitForTimeout(40);ok(calls.length===count,'logout old handler issues no RPC');
  await sign(A);await load();await page.evaluate(()=>dispatchEvent(new StorageEvent('storage',{key:'sb-fictional-auth-token'})));ok(await field.isDisabled()&&await field.inputValue()==='','cross-tab storage invalidates');await load();
  await page.evaluate(()=>dispatchEvent(new Event('champion-auth-invalid')));ok(await field.isDisabled(),'auth failure invalidates');await load();
  await page.evaluate(()=>{for(const a of document.querySelectorAll('[data-worksheet-answer]'))a.value='Fictional saved group'});await save.click();await page.waitForFunction(()=>document.querySelector('[data-worksheet-status]').textContent.startsWith('Saved'));ok((await status.textContent()).includes(`${required} of ${required}`)&&(await status.textContent()).includes('does not certify'),'all responses saved without invented completion');
  ok(await page.locator('[data-worksheet-answer]').count()===required,'all approved workbook groups rendered');
  ok(!await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('worksheet'))),'no persistent worksheet answer cache');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'responsive worksheet fits viewport');ok(errors.length===0,'no browser runtime errors');
  // Synthetic near-deadline session response exercises real UI deadline clearing.
  await page.clock.install({time:new Date()});await page.evaluate(()=>{window.savedGetSession=ChampionLifeAuth.client.auth.getSession;const deadline=Date.now()/1000+30;ChampionLifeAuth.client.auth.getSession=async function(){const r=await savedGetSession.call(this);return r.data.session?{...r,data:{...r.data,session:{...r.data.session,expires_at:deadline}}}:r}});await load();await page.clock.fastForward(31000);ok(await field.isDisabled()&&await field.inputValue()==='','session deadline clears private answers without SDK event');await page.evaluate(()=>{ChampionLifeAuth.client.auth.getSession=window.savedGetSession});await load();

  mode='wrong-lesson';await page.locator('[data-worksheet-load]').click();await page.waitForFunction(()=>document.querySelector('[data-worksheet-status]').textContent.includes('unavailable'));ok(await field.isDisabled()&&await field.inputValue()==='','wrong lesson response never renders');mode='';await load();
  hold=true;const doubleWait=new Promise(r=>started=r),beforeDouble=calls.filter(c=>c.p.p_answers).length;await field.fill('one intentional submit');await save.click();await doubleWait;await page.evaluate(()=>document.querySelector('[data-worksheet-form]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await page.waitForTimeout(30);ok(calls.filter(c=>c.p.p_answers).length===beforeDouble+1,'pending double submit issues exactly one mutation');release();await page.waitForFunction(()=>document.querySelector('[data-worksheet-status]').textContent.startsWith('Saved'));

  if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await page.locator('[data-grip-worksheet]').scrollIntoViewIfNeeded();await page.evaluate(()=>scrollBy(0,-100));await page.screenshot({path:path.join(process.env.EVIDENCE_DIR,`lesson${lesson}-${engine.name()}-${width}.png`)})}
  await ctx.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({checks,status:'PASS',providerEvidence:'fictional HTTP only'}));
