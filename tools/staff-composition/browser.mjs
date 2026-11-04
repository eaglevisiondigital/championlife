// Real pinned module/Auth/session source; SDK identity is fictional, RPC authorization is actual disposable SQL.
import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{resolve,extname}from'node:path';import{createServer}from'node:http';
import{chromium,webkit}from'../backend-tests/node_modules/playwright/index.mjs';import{source,manifest}from'./source.mjs';import{browserDatabase}from'./browser-database.mjs';
const root=resolve(import.meta.dirname,'../..'),db=await browserDatabase();let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/__rpc'&&req.method==='POST'){let raw='';for await(const part of req)raw+=part;assert.ok(raw.length<100000);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await db.rpc(JSON.parse(raw))));return}
 const relative=path.slice(1);let body;
 if(relative in manifest.sources.sharedSession.files)body=source('sharedSession',relative);else if(relative in manifest.sources.events.files)body=source('events',relative);else if(relative in manifest.sources.forms.files)body=source('forms',relative);else{const file=resolve(root,relative);assert.ok(file.startsWith(root+'/'));body=readFileSync(file)}
 res.setHeader('Content-Type',extname(relative)==='.js'?'text/javascript':extname(relative)==='.css'?'text/css':extname(relative)==='.png'?'image/png':'text/html');res.end(body)
 }catch(e){res.writeHead(404);res.end('Fixture unavailable')}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));await db.addSecondForms();const origin='http://127.0.0.1:'+server.address().port;
try{for(const[engine,type,path]of[['chromium',chromium,process.env.CHROMIUM_EXECUTABLE],['webkit',webkit,process.env.WEBKIT_EXECUTABLE]])for(const width of[1440,390]){
 await db.restore();const browser=await type.launch(path?{executablePath:path}:{});const context=await browser.newContext({viewport:{width,height:900}});const label=engine+'/'+width,errors=[],caseStart=db.calls.length;
 await context.addInitScript(({users})=>{
 if(location.origin==='null')return;
 const key='composition-fictional-account';if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(users[2]));const current=()=>JSON.parse(localStorage.getItem(key));const listeners=[];
 const emit=()=>{const user=current();listeners.forEach(cb=>cb(user?'SIGNED_IN':'SIGNED_OUT',user?{user}:null))};
 window.addEventListener('storage',e=>{if(e.key===key)emit()});
 const client={auth:{getSession:async()=>({data:{session:current()?{user:current()}:null},error:null}),getUser:async()=>({data:{user:current()},error:null}),onAuthStateChange:cb=>{listeners.push(cb);return{data:{subscription:{unsubscribe(){}}}}},signOut:async()=>{localStorage.setItem(key,'null');emit();return{error:null}}},rpc:async(name,args)=>fetch('/__rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args,user:current()?.id})}).then(r=>r.json())};
 window.supabase={createClient:()=>client};window.composition={setUser:(index,notify=false)=>{localStorage.setItem(key,JSON.stringify(index===null?null:users[index]));if(notify)emit()},current,client};
 },{users:db.users});
 await context.route('**/*',async route=>{const u=route.request().url();if(new URL(u).origin!==origin){await route.abort('blockedbyclient');return}if(u.endsWith('/assets/js/supabase-config.js')){await route.fulfill({body:"window.CHAMPION_LIFE_SUPABASE={url:location.origin,publishableKey:'fictional-only'}",contentType:'text/javascript'});return}await route.continue()});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const forms=()=>origin+'/staff-forms.html?organization='+db.org,events=()=>origin+'/staff-events.html?org='+db.other;
 try{
 await page.goto(forms()+'&view=private#panel');await page.getByText('Integration private form · registration',{exact:true}).waitFor();
 await page.getByLabel('Organization',{exact:true}).selectOption(db.other);await page.getByText('Integration alternate form · registration',{exact:true}).waitFor();
 ok(new URL(page.url()).searchParams.get('organization')===db.other,label+' selected Forms organization synchronizes exact route');
 ok(new URL(page.url()).pathname==='/staff-forms.html'&&new URL(page.url()).searchParams.get('view')==='private'&&new URL(page.url()).hash==='#panel',label+' route sync preserves existing path query and hash');
 await page.reload();await page.getByText('Integration alternate form · registration',{exact:true}).waitFor();ok(await page.getByLabel('Organization',{exact:true}).inputValue()===db.other,label+' same-account reload preserves selected authorized Forms organization');
 await page.getByLabel('Organization',{exact:true}).selectOption(db.org);await page.getByText('Integration private form · registration',{exact:true}).waitFor();
 const beforeHistoryFailure=db.calls.length;
 await page.evaluate(()=>{window.history.replaceState=()=>{throw Error('Fictional history failure')}});await page.getByLabel('Organization',{exact:true}).selectOption(db.other);
 ok(await page.locator('.forms-list').count()===0,label+' failed history synchronization clears protected old organization');
 ok(db.calls.slice(beforeHistoryFailure).every(x=>!['save','create'].includes(x.args?.p_action)),label+' failed history synchronization issues no mutation');
 await page.reload();await page.getByText('Integration private form · registration',{exact:true}).waitFor();
 await page.goto(origin+'/staff-forms.html?organization=unavailable');await page.waitForFunction(()=>document.querySelector('#forms-app')?.textContent.includes('no longer available'));
 ok(await page.locator('.forms-list').count()===0,label+' unavailable Forms route never falls back to authorized default');
 await page.goto(forms());await page.getByText('Integration private form · registration',{exact:true}).waitFor();
 ok(await page.locator('#staff-session-email').innerText()===db.users[2].email,label+' actual shared session displays Forms current account');
 await page.goto(events());await page.getByRole('button',{name:'Integration private event',exact:true}).waitFor();
 ok(await page.locator('#staff-session-email').innerText()===db.users[2].email,label+' same account persists across actual module navigation');
 ok(await page.locator('[name=organization]').inputValue()===db.other,label+' Events route selects independently authorized organization');
 await page.getByRole('button',{name:'Integration private event',exact:true}).click();await page.getByRole('button',{name:'Edit entire series',exact:true}).waitFor();
 ok(await page.locator('dialog').innerText().then(t=>t.includes('Integration private event')),label+' actual Events detail SQL integration');
 await page.goto(forms());await page.getByRole('link',{name:'Edit',exact:true}).click();await page.getByRole('button',{name:'Save draft',exact:true}).waitFor();
 ok(await page.evaluate(()=>!!FormsAdmin.draft),label+' actual Forms draft SQL integration after Events navigation');
 await page.getByRole('button',{name:'Form settings',exact:true}).click();await page.getByLabel('Description',{exact:true}).fill('Fictional composition save');await page.getByLabel('Description',{exact:true}).dispatchEvent('change');await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.forms-status')?.textContent.includes('Saved'));
 ok(db.calls.slice(caseStart).some(x=>x.name==='forms_workspace'&&x.args.p_action==='save'&&x.user===db.users[2].id&&x.args.p_org===db.org),label+' exact account/org private save reaches original SQL');
 await page.evaluate(()=>composition.setUser(0));await page.goto(events());await page.waitForFunction(()=>document.querySelector('#staff-events-app')?.textContent.includes('unavailable'));
 ok(await page.getByRole('button',{name:'Integration private event',exact:true}).count()===0,label+' Forms-only account cannot inherit Events capability');
 await page.evaluate(()=>composition.setUser(1));await page.goto(forms());await page.waitForFunction(()=>document.querySelector('#forms-app')?.textContent.includes('no longer available'));
 ok(await page.getByText('Integration private form · registration',{exact:true}).count()===0,label+' Events-only account cannot inherit Forms capability');
 await page.goto(events());await page.getByRole('button',{name:'Integration private event',exact:true}).waitFor();ok(await page.locator('#staff-session-email').innerText()===db.users[1].email,label+' replacement account identity consistent across both modules');
 await page.evaluate(()=>composition.setUser(2));await page.goto(events());await page.getByRole('button',{name:'Integration private event',exact:true}).waitFor();await db.revoke();await page.reload();await page.waitForFunction(()=>document.querySelector('#staff-events-app')?.textContent.includes('unavailable'));
 ok(await page.getByRole('button',{name:'Integration private event',exact:true}).count()===0,label+' current SQL Events revocation clears actual page');
 await page.goto(forms());await page.getByText('Integration private form · registration',{exact:true}).waitFor();ok(await page.locator('.forms-list').count()===1,label+' Events revocation preserves separate Forms authorization');await db.restore();
 const second=await context.newPage();second.on('pageerror',e=>errors.push(e.message));await second.goto(events());await second.getByRole('button',{name:'Integration private event',exact:true}).waitFor();
 const mutations=()=>db.calls.filter(x=>['save','create','exception','publish','submit'].includes(x.args?.p_action)).length;const before=mutations();
 await page.getByRole('button',{name:'Log Out',exact:true}).click();await page.waitForURL('**/discipleship-login.html?**');await second.waitForURL('**/discipleship-login.html?**');
 ok(new URL(page.url()).searchParams.get('next')==='/staff-forms.html?organization='+db.org&&new URL(second.url()).searchParams.get('next')==='/staff-events.html?org='+db.other,label+' reviewed shared return helper preserves each module exact organization');
 ok(!await page.locator('.forms-list').count()&&!await second.locator('.event-admin-list').count(),label+' shared logout removes both module workspaces');
 ok(mutations()===before,label+' zero new mutations after cross-page logout');
 await second.goBack();await second.waitForTimeout(100);ok(await second.getByRole('button',{name:'Integration private event',exact:true}).count()===0,label+' browser history cannot restore previous Events content');
 ok(errors.length===0,label+' actual shared Auth/session integration has no page errors: '+errors.join(';'));
 }catch(e){console.error('FIXTURE DEBUG',await page.locator('body').innerText(),errors,JSON.stringify(db.calls.slice(-5)));throw e}finally{await context.close();await browser.close()}
}console.log('Forms+Events actual-source SQL-backed browser PASS '+checks)}finally{await new Promise(r=>server.close(r));await db.close()}
