// Actual accepted SDK and application pages; ALL HTTP intercepted. No real Auth,
// email, Storage object, book contents, account, grant or provider operation.
import {chromium,webkit} from 'playwright';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sdk=Buffer.from(await readFile(new URL('fixtures/vendor/supabase-js-2.118.0.js.b64',import.meta.url),'utf8'),'base64');
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const origin='https://minden-acceptance--championlifechurch.netlify.app',backend='https://apovvmvuljfspobribjv.supabase.co';
const key='sb-apovvmvuljfspobribjv-auth-token',sdkURL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0';
const user={id:'11111111-1111-4111-8111-111111111111',email:'minden@example.invalid',email_confirmed_at:'2026-11-13T00:00:00Z',aud:'authenticated',role:'authenticated',is_anonymous:false};
const session=()=>{const exp=Math.floor(Date.now()/1000)+3600;return{user,expires_at:exp,expires_in:3600,token_type:'bearer',refresh_token:'FICTIONAL_REFRESH',access_token:[{alg:'HS256',typ:'JWT'},{sub:user.id,exp,aud:'authenticated',role:'authenticated'},'FICTIONAL_SIGNATURE'].map((v,i)=>Buffer.from(i===2?v:JSON.stringify(v)).toString('base64url')).join('.')}};
let checks=0;
const ok=(v,label)=>{assert.ok(v,label);console.log('PASS '+(++checks)+' '+label)};
for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}});
  let requests=[],unexpected=[],signed=0,downloads=0,tamper=false,allowBook=false;
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.href===sdkURL)return route.fulfill({contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:tamper?Buffer.concat([sdk,Buffer.from('\n/* altered */')]):sdk});
   if(u.origin===backend){
    requests.push({method:req.method(),path:u.pathname,body:req.postData(),url:u.href});
    const json=(status,body)=>route.fulfill({status,json:body,headers:{'access-control-allow-origin':origin}});
    if(u.pathname==='/auth/v1/otp')return json(200,{});
    if(u.pathname==='/auth/v1/verify')return req.postDataJSON().token==='12345678'||req.postDataJSON().token_hash==='a'.repeat(64)?json(200,session()):json(403,{error_code:'otp_expired',msg:'Synthetic expired code'});
    if(u.pathname==='/auth/v1/user')return json(200,user);
    if(u.pathname==='/storage/v1/object/sign/king-kind-books/king-kind/king-kind-english.pdf'){
     if(req.method()==='POST'){signed++;assert.deepEqual(req.postDataJSON(),{expiresIn:900});return allowBook?json(200,{signedURL:'/object/sign/king-kind-books/king-kind/king-kind-english.pdf?token=FICTIONAL'}):json(403,{message:'Denied',statusCode:'403',error:'Unauthorized'});}
     if(req.method()==='GET'){downloads++;return route.fulfill({contentType:'application/pdf',body:'INVALID_SYNTHETIC_PDF'});}
    }
    unexpected.push(req.method()+' '+u.href);return route.abort();
   }
   // Existing approved decorative public cover; serve exact local bytes, never
   // contact production. This is not an Auth, private-book or callback exception.
   if(u.href==='https://championlifefwb.com/assets/images/king-kind-cover.svg')return route.fulfill({contentType:'image/svg+xml',body:await readFile(path.join(root,'assets/images/king-kind-cover.svg'))});
   if(u.origin!==origin){unexpected.push(u.href);return route.abort();}
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'application/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'sb_publishable_FICTIONAL'})});
   if(u.pathname==='/neutral.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Fictional local fixture</title>'});
   const file=path.resolve(root,'.'+u.pathname);assert.ok(file.startsWith(root));
   try{return route.fulfill({body:await readFile(file),contentType:{'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}
  });
  try{
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/discipleship-login.html?next=%2Fking-kind-reader.html');
   await page.locator('#loginEmail').fill(user.email);await page.locator('#sendCodeBtn').click();await page.locator('#codeStep.active').waitFor();
   const otp=requests.find(r=>r.path==='/auth/v1/otp');
   ok(new URL(otp.url).searchParams.get('redirect_to')===origin+'/discipleship-login.html?next=%2Fking-kind-reader.html',`${name}/${width} actual SDK keeps OTP callback on exact preview`);
   ok(JSON.parse(otp.body).email===user.email&&requests.every(r=>!r.path.includes('/rest/')),`${name}/${width} login creates no registration or staff request`);
   await page.locator('#loginCode').fill('00000000');await page.locator('#verifyCodeBtn').click();await page.locator('#authMessage.error').waitFor();
   ok(new URL(page.url()).pathname==='/discipleship-login.html'&&signed===0,`${name}/${width} denied OTP cannot open private book`);
   await page.locator('#loginCode').fill('12345678');await page.locator('#verifyCodeBtn').click();await page.waitForURL(origin+'/king-kind-reader.html');
   await page.waitForFunction(()=>document.querySelector('#reader-status').classList.contains('error'));
   ok(signed>0&&downloads===0&&await page.locator('#download-book').isDisabled(),`${name}/${width} genuine SDK requests exact private object; fictional RLS denial stays locked`);
   await page.goto(origin+'/discipleship-login.html?next=%2Fking-kind-reader.html#error=access_denied&error_code=otp_expired');await page.locator('#authMessage.error').waitFor();
   ok(new URL(page.url()).pathname==='/discipleship-login.html'&&!page.url().includes('otp_expired'),`${name}/${width} failed callback cannot borrow stored session; URL scrubbed`);
   await page.goto(origin+'/neutral.html');await page.evaluate(k=>localStorage.removeItem(k),key);const previous=signed;
   await page.goto(origin+'/king-kind-reader.html');await page.waitForFunction(()=>document.querySelector('#reader-status').classList.contains('error'));
   ok(signed===previous&&downloads===0,`${name}/${width} anonymous reader never requests book URL`);
   allowBook=true;
   await page.goto(origin+'/discipleship-login.html?next=%2Fking-kind-reader.html&token_hash='+'a'.repeat(64)+'&type=magiclink');await page.waitForURL(origin+'/king-kind-reader.html');await page.waitForFunction(()=>document.querySelector('#reader-status').classList.contains('error'));
   ok(downloads>0&&await page.locator('#download-book').isDisabled()&&await page.locator('#book-license-ack').isDisabled(),`${name}/${width} verified callback reaches private transport; invalid book bytes never render/download`);
   if(errors.length||unexpected.length)console.error(JSON.stringify({errors,unexpected}));
   ok(errors.length===0&&unexpected.length===0,`${name}/${width} all app/provider transport stays intercepted and expected`);
   // Browser-enforced SRI: new context avoids the prior valid SDK cache/session.
   const sri=await browser.newContext();await sri.route('**/*',async route=>{const u=new URL(route.request().url());if(u.href===sdkURL)return route.fulfill({contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:Buffer.concat([sdk,Buffer.from('\n/* changed */')])});if(u.origin===origin&&u.pathname==='/discipleship-login.html')return route.fulfill({contentType:'text/html',body:await readFile(path.join(root,'discipleship-login.html'))});return route.fulfill({body:'',contentType:'application/javascript'});});
   const sp=await sri.newPage();await sp.goto(origin+'/discipleship-login.html');ok(await sp.evaluate(()=>typeof window.supabase)==='undefined',`${name}/${width} altered accepted SDK blocked by actual browser SRI`);await sri.close();
  }finally{await context.close()}
 }}finally{await browser.close()}
}
console.log(`${checks} actual-SDK Minden login/private-storage checks PASS; fictional provider; no hosted acceptance`);
