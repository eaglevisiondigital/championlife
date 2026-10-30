// Chrome + WebKit, desktop + mobile. Fictional SDK services, every request intercepted.
import {chromium,webkit} from 'playwright';import assert from 'node:assert/strict';import {readFile,mkdir} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url)),origin='https://corrections.local.test';let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const mock=`(()=>{
 const users={A:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test',email_confirmed_at:'2026-01-01',is_anonymous:false},B:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'b@example.test',email_confirmed_at:'2026-01-01',is_anonymous:false}};
 let key='A',listeners=[],delayed=false,resolve,expired=false;const saves=[];
 const snapshot=()=>({user:users[key],profile:{first_name:'Fictional '+key,email:users[key]?.email},answers:[{question_number:1,answer:key+' CLOUD'}],progress:[]});
 const session=()=>({user:users[key],expires_at:Date.now()/1000+3600,access_token:'fresh'});
 const client={auth:{initialize:async()=>({}),getUser:async()=>({data:{user:users[key]}}),getSession:async()=>({data:{session:session()}}),onAuthStateChange:f=>listeners.push(f),signOut:async()=>{window.__test.switch(null);return{}},signInWithOtp:async()=>{throw Error('Email forbidden')},verifyOtp:async()=>{throw Error('OTP forbidden')}}};
 window.ChampionLifeAuth={client,getVerifiedUser:async()=>{if(expired)throw Error('Expired');return users[key]||null},getSession:async()=>session(),loadLesson:async()=>{const d=snapshot();if(delayed)return new Promise(r=>{resolve=()=>r(d)});return d},saveLesson:async p=>{saves.push(p);return{saved:true}},getDashboard:async()=>snapshot(),getOutreachRegistration:async()=>null,signOut:async()=>client.auth.signOut()};
 client.rpc=async()=>({data:{registered:true,enrolled:true,reference:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}});
 window.__test={switch:k=>{key=k;listeners.forEach(f=>f(k?'SIGNED_IN':'SIGNED_OUT',k?session():null))},slow:()=>{delayed=true},finish:()=>{delayed=false;resolve?.()},expire:()=>{expired=true},saves,clearExpiry:()=>{expired=false}};
})();`;
if(process.env.EVIDENCE_DIR)await mkdir(process.env.EVIDENCE_DIR,{recursive:true});
for(const [engine,options] of [[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});try{for(const width of[390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin!==origin)return r.fulfill({status:200,body:'',contentType:u.pathname.endsWith('.js')?'text/javascript':'text/plain'});if(r.request().method()!=='GET')throw Error('No outbound writes');
 if(u.pathname==='/assets/js/champion-life-auth.js')return r.fulfill({body:mock,contentType:'text/javascript'});
 if(u.pathname==='/assets/js/supabase-config.js')return r.fulfill({body:'window.CHAMPION_LIFE_SUPABASE=null;',contentType:'text/javascript'});
 const f=path.resolve(root,'.'+(u.pathname==='/king-kind/'?'/king-kind/index.html':u.pathname));if(!f.startsWith(root))return r.abort();try{await r.fulfill({body:await readFile(f),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'}[path.extname(f)]||'application/octet-stream'})}catch{await r.fulfill({status:404,body:''})}});
 await page.goto(origin+'/getting-a-grip-1.html');const q=page.locator('[name=q1]');await q.waitFor();await page.waitForFunction(()=>document.querySelector('[name=q1]').value==='A CLOUD');
 await q.fill('A PRIVATE DRAFT');const immediate=await page.evaluate(()=>{window.__test.switch('B');return document.querySelector('[name=q1]').value});ok(immediate==='','synchronous browser clear '+engine.name()+width);await page.waitForFunction(()=>document.querySelector('[name=q1]').value==='B CLOUD');
 ok(await page.locator('[name=email]').inputValue()==='b@example.test','B own contact only');
 await q.fill('B PRIVATE DRAFT');await page.evaluate(()=>window.__test.switch('A'));await page.waitForFunction(()=>document.querySelector('[name=q1]').value==='A PRIVATE DRAFT');ok(true,'A→B→A private draft restored');
 await page.evaluate(()=>window.__test.switch(null));ok(await q.inputValue()===''&&await q.isDisabled(),'logout blocks worksheet immediately');
 await page.evaluate(()=>window.__test.switch('B'));await page.waitForFunction(()=>document.querySelector('[name=q1]').value==='B PRIVATE DRAFT');
 await q.fill('B CLOUD SAVE');await page.waitForFunction(()=>window.__test.saves.length===1);ok(await page.evaluate(()=>window.__test.saves[0].expectedUserId.startsWith('bbbb')&&window.__test.saves[0].answers[1]==='B CLOUD SAVE'),'browser autosave carries correct owner');
 await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});ok(await q.inputValue()==='','Back snapshot clears worksheet');await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.waitForFunction(()=>document.querySelector('[name=q1]').value==='B CLOUD SAVE');ok(true,'Back revalidates before restoration');
 await page.evaluate(()=>{window.__test.expire();dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await page.waitForTimeout(100);ok(await q.inputValue()===''&&await q.isDisabled(),'expired session fails closed');
 await page.goto(origin+'/my-discipleship.html');await page.locator('#readerResources.show').waitFor();ok(await page.locator('#readerResources a').isVisible(),'general book link visible independently');ok(await page.locator('.dash-lesson').count()===13,'all lesson routes retained');ok((await page.locator('.dash-lesson').last().innerText()).includes('video coming soon'),'accurate course availability');
 ok(await page.evaluate(()=>{window.__test.switch('B');return document.querySelector('#dashEmail').textContent==='' }),'dashboard clears on account switch');await page.waitForFunction(()=>document.querySelector('#dashEmail').textContent==='b@example.test');
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));ok(await page.locator('#dashLessons').innerText()==='','dashboard Back snapshot clear');
 await page.goto(origin+'/king-kind/#error=access_denied&error_code=otp_expired');await page.getByText('That verification link is invalid',{exact:false}).waitFor();ok(await page.locator('#generalResourceCard.registered').count()===0,'expired link cannot borrow old session');ok(!page.url().includes('error='),'callback URL scrubbed');
 await page.goto(origin+'/king-kind/');await page.locator('#generalResourceCard.registered').waitFor();ok(await page.locator('#resource-switch-button').isVisible(),'account switch remains visible after success');ok((await page.locator('#resource-account-email').innerText()).includes('a@example.test'),'current email visible');
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'corrected registration fits viewport');
 if(process.env.EVIDENCE_DIR){await page.evaluate(()=>scrollTo(0,document.querySelector('#resource-account').getBoundingClientRect().top+scrollY-100));await page.screenshot({path:path.join(process.env.EVIDENCE_DIR,`account-${engine.name()}-${width}.png`)});}
 await page.locator('#resource-switch-button').click();await page.getByText('Signed out. Submit the form',{exact:false}).waitFor();ok(await page.locator('#generalResourceCard.registered').count()===0,'logout removes registration success');
 ok(errors.length===0,'no browser errors '+errors.join(','));await context.close();
 }}finally{await browser.close()}
}
console.log(checks+' isolated Chrome/WebKit correction assertions passed. Physical devices and real providers UNTESTED.');
