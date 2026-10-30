// Actual browsers + pinned Supabase SDK. All Auth/database responses are intercepted synthetic fixtures.
// No external messages, accounts, provider requests or real personal information.
import {chromium,webkit} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migrationOrder} from './migration-order.mjs';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),sdk=await readFile(path.join(root,'assets/vendor/supabase-js-2.118.0.js'));
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const origin='https://general.local.test',backend='https://synthetic-auth.supabase.co';
const reader={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'reader@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false,aud:'authenticated',role:'authenticated'};
const other={...reader,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'other@example.test'};
function session(user){const exp=Math.floor(Date.now()/1000)+3600;return{access_token:[{alg:'HS256',typ:'JWT'},{sub:user.id,exp,aud:'authenticated',role:'authenticated'},'synthetic-signature'].map((x,i)=>i===2?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.'),refresh_token:'synthetic-no-authority',token_type:'bearer',expires_in:3600,expires_at:exp,user}}
let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
if(process.env.EVIDENCE_DIR)await mkdir(process.env.EVIDENCE_DIR,{recursive:true});
for(const[engine,launch]of[[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...launch});
 try{for(const width of[390,1440]){
  const db=new PGlite(),read=p=>readFile(path.join(root,p),'utf8');
  await db.exec(await read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(await read('supabase/bootstrap/automatic-rls.sql'));
  for(const f of migrationOrder)await db.exec(await read('supabase/migrations/'+f));
  await db.exec('create schema app_private;grant usage on schema app_private to authenticated;');
  await db.exec(await read('supabase/release/general-king-kind-resources-candidate.sql'));
  for(const u of[reader,other])await db.query('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[u.id,u.email]);
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();
  let active=null,registered=false,otpCount=0,registrationCalls=[],mode='normal';const unexpected=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin===backend){
    if(u.pathname==='/auth/v1/otp'){otpCount++;return route.fulfill({json:{}})}
    if(u.pathname==='/auth/v1/verify'){
     if(req.postDataJSON().token!=='12345678')return route.fulfill({status:403,json:{error_code:'otp_expired',msg:'Synthetic rejected code'}});
     active=reader;return route.fulfill({json:session(reader)});
    }
    if(u.pathname==='/auth/v1/user')return active?route.fulfill({json:active}):route.fulfill({status:401,json:{message:'Synthetic expired session'}});
    if(u.pathname==='/auth/v1/logout'){active=null;return route.fulfill({status:204,body:''})}
    if(u.pathname==='/rest/v1/rpc/general_resource_registration'){
     const data=req.postDataJSON();
     if(!active)return route.fulfill({status:403,json:{code:'42501',message:'Denied'}});
     if(data.action==='register')registrationCalls.push(data);
     if(mode==='reject'&&data.action==='register')return route.fulfill({status:400,json:{code:'22023',message:'Synthetic validation'}});
     await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[active.id]);await db.exec('set role authenticated');
     let result;try{result=(await db.query('select public.general_resource_registration($1,$2) v',[data.action,data.payload])).rows[0].v}catch(e){return route.fulfill({status:400,json:{code:e.code,message:'Synthetic database rejection'}})}
     registered=result.registered;
     if(mode==='lost'){mode='normal';return route.abort('connectionfailed')}
     if(mode==='switch'){active=other;mode='normal';}
     return route.fulfill({json:result});
    }
    unexpected.push(req.method()+' '+u.pathname);return route.abort();
   }
   if(u.origin!==origin||req.method()!=='GET'){unexpected.push(req.method()+' '+u.origin+u.pathname);return route.abort()}
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'synthetic-no-authority'})});
   const pathname=u.pathname==='/king-kind/'?'/king-kind/index.html':u.pathname;
   const f=path.resolve(root,'.'+pathname);if(!f.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({body:await readFile(f),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(f)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:'Not found'})}
  });
  await page.goto(origin+'/king-kind/');await page.locator('#resource-submit').waitFor();
  ok(otpCount===0&&registrationCalls.length===0,'page load sends no emails or registration '+engine.name()+' '+width);
  ok(!await page.locator('#resource-consent').isChecked()&&!await page.locator('#resource-updates').isChecked(),'both consents start unchecked');
  ok(await page.locator('#resource-name').getAttribute('autocomplete')==='name'&&await page.locator('#resource-email').getAttribute('autocomplete')==='email','stable native autofill fields');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page fits viewport');
  if(process.env.EVIDENCE_DIR&&engine===chromium){await page.screenshot({path:path.join(process.env.EVIDENCE_DIR,`general-${width}.png`),fullPage:true});await page.screenshot({path:path.join(process.env.EVIDENCE_DIR,`hero-${width}.png`)});}
  await page.locator('#resource-name').fill('Fictional Reader');await page.locator('#resource-email').fill(reader.email);
  await page.locator('#resource-submit').click();ok(otpCount===0,'required resource consent prevents submission');
  await page.locator('#resource-consent').check();await page.locator('#resource-phone').fill('invalid');await page.locator('#resource-submit').click();ok(otpCount===0,'native optional telephone validation prevents malformed value');await page.locator('#resource-phone').fill('+1 (555) 555-0100');ok(await page.locator('#resource-phone').evaluate(e=>e.checkValidity()),'native telephone accepts common punctuation');await page.locator('#resource-phone').fill('');
  await page.evaluate(email=>{document.querySelector('#resource-name').value='Fictional Reader';document.querySelector('#resource-email').value=email},reader.email);
  await page.locator('#resource-submit').click();await page.locator('#resource-verification').waitFor({state:'visible'});
  ok(otpCount===1&&registrationCalls.length===0,'OTP requested before any registration write');
  ok(!await page.locator('#generalResourceCard').evaluate(e=>e.classList.contains('registered')),'email sent is not registration success');
  await page.locator('#resource-resend').click();ok(otpCount===1,'resend throttled');
  await page.locator('#resource-code').fill('00000000');await page.locator('#resource-code-form button').click();await page.getByText('That code is invalid or expired.',{exact:false}).waitFor();
  ok(registrationCalls.length===0,'invalid OTP cannot register');
  await page.locator('#resource-code').fill('12345678');mode='reject';await page.locator('#resource-code-form button').click();await page.getByText('Check your name, email, optional phone',{exact:false}).waitFor();
  ok(!await page.locator('#generalResourceCard').evaluate(e=>e.classList.contains('registered')),'backend validation not represented as success');
  mode='lost';await page.locator('#resource-submit').click();await page.getByText('Registration could not be confirmed.',{exact:false}).waitFor();
  ok(!await page.locator('#generalResourceCard').evaluate(e=>e.classList.contains('registered')),'ambiguous backend response not represented as success');
  await page.locator('#resource-submit').click();await page.locator('#generalResourceCard.registered').waitFor();
  ok(new Set(registrationCalls.map(r=>r.payload.request_id)).size===1,'uncertain retry retains idempotency key');
  ok(registrationCalls.every(r=>r.payload.resource_consent===true&&r.payload.ministry_updates===false),'marketing never implied');
  ok(registrationCalls.every(r=>!('campaign_id'in r.payload)&&!('decision'in r.payload)),'no campaign or ministry decision payload');
  ok(await page.locator('.bes-registration-success a[href="/king-kind-reader.html"]').isVisible(),'private reader next step');
  ok(await page.locator('.bes-registration-success a[href="/my-discipleship.html"]').count()===2,'existing course dashboard links');
  if(process.env.EVIDENCE_DIR&&engine===chromium)await page.locator('#generalResourceCard').screenshot({path:path.join(process.env.EVIDENCE_DIR,`registered-${width}.png`)});
  await page.reload();await page.locator('#generalResourceCard.registered').waitFor();ok(true,'verified saved registration resumes after reload');
  await page.evaluate(()=>window.ChampionLifeAuth.client.auth.signOut({scope:'local'}));await page.locator('#generalResourceCard.registered').waitFor({state:'hidden'});
  ok(!await page.locator('.bes-registration-success').isVisible(),'logout removes success/account information');
  registered=false;active=other;await page.evaluate(s=>localStorage.setItem('sb-synthetic-auth-auth-token',JSON.stringify(s)),session(other));await page.reload();
  await page.locator('#resource-name').fill('Fictional Reader');await page.locator('#resource-email').fill(reader.email);await page.locator('#resource-consent').check();
  const before=registrationCalls.length;await page.locator('#resource-submit').click();await page.locator('#resource-switch').waitFor({state:'visible'});
  ok(registrationCalls.length===before,'different account blocks identity confusion');
  await page.locator('#resource-switch-button').click();await page.getByText('Signed out. Submit the form',{exact:false}).waitFor();
  ok(active===null,'explicit account switching uses supported local signout');
  ok(unexpected.length===0,'no unexpected/external network paths: '+unexpected.join(','));
  ok(errors.length===0,'no browser script errors: '+errors.join(','));
  await db.exec('reset role');ok((await db.query('select count(*)::int n from app_private.general_resource_registrations')).rows[0].n===1,'complete browser journey persisted exactly one real isolated database registration');
  ok((await db.query('select count(*)::int n from app_private.general_resource_audit')).rows[0].n===1,'complete browser journey persisted exactly one immutable audit');
  ok((await db.query('select count(*)::int n from outreach_registrations')).rows[0].n===0,'browser journey never writes outreach decisions');
  await context.close();await db.close();
 }}finally{await browser.close()}
}
console.log(`${checks} isolated browser assertions passed; real inbox delivery and physical-device autofill NOT tested.`);
