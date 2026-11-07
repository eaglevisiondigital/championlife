// Real pinned SDK and browser engines; all HTTP/Auth/answers intercepted fictionally.
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const base=new URL('../../',import.meta.url),sdk=readFileSync(new URL('assets/vendor/supabase-js-2.118.0.js',base));
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const origin='https://worksheet.local.test',ref='abcdefghijklmnopqrst',backend=`https://${ref}.supabase.co`;
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const token=id=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.c3ludGhldGlj';
const user=id=>({id,email:id===a?'a@example.test':'b@example.test',email_confirmed_at:'2026-01-01',aud:'authenticated',role:'authenticated'});
const receipt={status:'available',course:'getting-a-grip-on-the-basics',lesson:1,revision:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',requiredQuestions:20,savedNonblankAnswers:1,allRequiredAnswersSaved:false,canComplete:false,canCommit:false};
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
for(const [engine,launch]of [[chromium,process.env.CI?{}:{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...launch});
 try{for(const width of [390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage();const requests=[],unexpected=[],errors=[];let mode='ok',held=false,release,start;
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.origin===backend){
    const bearer=r.headers().authorization?.slice(7);let id;try{id=JSON.parse(Buffer.from(bearer.split('.')[1],'base64url')).sub}catch{}
    if(u.pathname==='/auth/v1/user')return route.fulfill({json:user(id)});
    if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
    if(u.pathname==='/rest/v1/rpc/owned_worksheet_transaction'){
     requests.push({id,payload:r.postDataJSON(),bearer});
     if(held){held=false;start();await new Promise(r=>release=r)}
     if(mode==='lost')return route.abort('failed');
     if(mode==='denied')return route.fulfill({status:403,json:{code:'42501',message:'fictional denied'}});
     if(mode==='conflict')return route.fulfill({status:400,json:{code:'40001',message:'fictional changed'}});
     const lesson=r.postDataJSON().p_lesson,count=({5:10,6:7,7:7,8:6,9:5,10:5,11:4,12:3,13:4})[lesson]??20;
     return route.fulfill({json:{...receipt,lesson,requiredQuestions:count,...(lesson>=5?{worksheet:`lesson-${lesson}-workbook-sections-v1`,answers:[{question:1,answer:'private response'}]}:{})}}).catch(()=>{});
    }
   }
   if(u.origin===origin){
    if(u.pathname==='/sdk.js')return route.fulfill({contentType:'text/javascript',body:sdk});
    if(u.pathname.startsWith('/tools/discipleship-progression/'))return route.fulfill({contentType:u.pathname.endsWith('.json')?'application/json':'text/javascript',body:readFileSync(new URL(u.pathname.slice(1),base))});
    return route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width"><output id="state"></output><script src="/sdk.js"></script><script type="module">
     import {createIsolatedWorksheetTransactions} from '/tools/discipleship-progression/worksheet-transactions.mjs';
     window.client=supabase.createClient('${backend}','fictional-publishable-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
     window.adapter=createIsolatedWorksheetTransactions({client,projectRef:'${ref}',onClear(){document.querySelector('#state').textContent=''}});
     window.show=async p=>{const r=await p;if(r.status==='available')document.querySelector('#state').textContent='Owned worksheet receipt';return r};
     window.input=()=>({lesson:1,revision:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',answers:[{question:1,answer:'private fictional draft'}]});window.ready=true;
    </script>`});
   }
   unexpected.push(r.url());return route.abort();
  });
  await page.goto(origin);await page.waitForFunction(()=>window.ready);
  async function sign(id){await page.evaluate(async access_token=>{const r=await client.auth.setSession({access_token,refresh_token:'fictional-refresh'});if(r.error)throw r.error},token(id))}
  await sign(a);
  for(let lesson=1;lesson<=13;lesson++){const r=await page.evaluate(lesson=>adapter.read({lesson}),lesson);ok(r.status==='available'&&r.lesson===lesson,'canonical lesson '+lesson+' real SDK read');const saved=await page.evaluate(lesson=>adapter.save({...input(),lesson}),lesson);ok(saved.status==='available'&&saved.canComplete===false&&saved.canCommit===false&&!JSON.stringify(saved).includes('private'),'canonical lesson '+lesson+' save no raw answers or credit');}
  let r=await page.evaluate(()=>show(adapter.read({lesson:1})));ok(r.status==='available','real SDK reads owned receipt '+engine.name()+' '+width);
  r=await page.evaluate(()=>show(adapter.save(input())));ok(r.status==='available','real SDK saves via fixed RPC');ok(requests.at(-1).id===a,'save bearer belongs to original account');
  ok((await page.locator('#state').textContent())==='Owned worksheet receipt','authorized receipt displayed');
  const pendingStarted=new Promise(r=>start=r);held=true;
  await page.evaluate(()=>{window.pending=show(adapter.save(input()))});await pendingStarted;await sign(b);
  ok(await page.locator('#state').textContent()==='','account change clears receipt immediately');release();
  ok((await page.evaluate(()=>pending)).status==='unavailable','delayed old account result cannot restore receipt');ok(await page.locator('#state').textContent()==='','old content stays absent');
  ok(requests.at(-1).id===a,'pending old write never rebinds to next account');
  r=await page.evaluate(()=>show(adapter.read({lesson:1})));ok(r.status==='available'&&requests.at(-1).id===b,'new account must obtain new authorized receipt');
  await page.evaluate(()=>dispatchEvent(new PopStateEvent('popstate')));ok(await page.locator('#state').textContent()==='','history transition invalidates protected receipt');
  mode='denied';r=await page.evaluate(()=>show(adapter.save(input())));ok(r.status==='unavailable'&&await page.locator('#state').textContent()==='','server denial clears protected state');
  mode='conflict';r=await page.evaluate(()=>adapter.save(input()));ok(r.status==='conflict','stale version cannot show save success');
  mode='lost';const before=requests.length;r=await page.evaluate(()=>adapter.save(input()));ok(r.status==='uncertain'&&requests.length===before+1,'lost response never retries or claims confirmed success');
  mode='ok';await page.evaluate(()=>client.auth.signOut({scope:'local'}));const n=requests.length;r=await page.evaluate(()=>adapter.save(input()));ok(r.status==='unavailable'&&requests.length===n,'signed-out stale control submits zero writes');
  ok(await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0),'adapter stores no raw drafts or tokens');
  ok(unexpected.length===0&&errors.length===0,'all requests fictional and no browser errors');await ctx.close();
 }}finally{await browser.close()}
}
console.log(`${checks} real-SDK Chromium/WebKit worksheet checks PASS`);
