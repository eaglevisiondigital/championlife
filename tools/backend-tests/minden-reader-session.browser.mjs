// Independently authored regression promoted from the preserved PR153 failure.
// All Auth/Storage is fictional; no licensed PDF, credentials or hosted traffic.
import {chromium,webkit} from 'playwright';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..');
const expected=true;
const origin='https://minden-acceptance--championlifechurch.netlify.app';
const backend='https://apovvmvuljfspobribjv.supabase.co';
const key='sb-apovvmvuljfspobribjv-auth-token';
const sdk=Buffer.from(await readFile(path.join(import.meta.dirname,'fixtures/vendor/supabase-js-2.118.0.js.b64'),'utf8'),'base64');
assert.equal(createHash('sha384').update(sdk).digest('base64'),'UagCvVPT5XXA0Hx+nJYUAGBFseHT9zBgpJMSebsAxl9lciTwbT+39j5VfRjdP5Tp');
const A={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated',is_anonymous:false};
const B={...A,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'b@example.test'};
function session(user=A){const exp=Math.floor(Date.now()/1000)+3600;return {user,expires_at:exp,expires_in:3600,token_type:'bearer',refresh_token:'fictional',access_token:[{alg:'HS256',typ:'JWT'},{sub:user.id,exp,aud:'authenticated',role:'authenticated'},'fictional'].map((x,i)=>Buffer.from(i===2?x:JSON.stringify(x)).toString('base64url')).join('.')}}
const records=[];let assertions=0;
for(const [engine,launch]of [[chromium,{}],[webkit,{}]]){
const browser=await engine.launch({headless:true,...launch});
try{for(const width of [390,1280])for(const action of ['logout','replace']){
const context=await browser.newContext({viewport:{width,height:900}});
let signing,release;const held=new Promise(r=>signing=r),unblock=new Promise(r=>release=r);let gets=0,signs=0;const requests=[];
await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());
if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/@supabase/supabase-js@2'))return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
if(u.origin===backend){requests.push({method:req.method(),path:u.pathname});
if(u.pathname==='/auth/v1/user'){const sub=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub;return route.fulfill({json:sub===B.id?B:A})}
if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
if(u.pathname.startsWith('/storage/v1/object/sign/')){
if(req.method()==='POST'){signs++;if(signs===1){signing();await unblock;return route.fulfill({json:{signedURL:'/object/sign/king-kind-books/king-kind/king-kind-english.pdf?token=fictional-A'}})}return route.fulfill({status:403,json:{error:'Unauthorized',message:'fictional B denied',statusCode:'403'}})}
if(req.method()==='GET'){gets++;return route.fulfill({body:Buffer.alloc(100001,7),contentType:'application/pdf'})}}
throw Error('Unexpected fictional provider request '+req.method()+' '+u.pathname)}
if(u.origin!==origin)return route.fulfill({body:''});
if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-public'})});
const f=path.resolve(root,'.'+u.pathname);assert.ok(f.startsWith(root+path.sep));try{return route.fulfill({body:await readFile(f),contentType:{'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'}[path.extname(f)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}});
const page=await context.newPage();await page.goto(origin+'/index.html');await page.evaluate(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s:session()});
await page.goto(origin+'/king-kind-reader.html');await held;
assert.equal(gets,0);assertions++;
if(action==='logout')await page.evaluate(()=>ChampionLifeAuth.client.auth.signOut({scope:'local'}));
else await page.evaluate(async s=>{const r=await ChampionLifeAuth.client.auth.setSession(s);if(r.error)throw r.error},session(B));
const id=await page.evaluate(async()=> (await ChampionLifeAuth.client.auth.getSession()).data.session?.user?.id||null);assert.equal(id,action==='logout'?null:B.id);assertions++;
const returned=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/storage/v1/object/sign/')&&r.status()===200);
release();const response=await returned;await response.finished();
await page.evaluate(()=>new Promise(resolve=>setTimeout(()=>setTimeout(resolve,0),0)));
assert.equal(gets,expected?0:1,'late A signing must not dispatch a NEW private GET after retirement');assertions++;
assert.ok(await page.locator('#download-book').isDisabled());assertions++;
records.push({engine:engine.name(),width,action,verifiedCurrentAccount:id,newPrivateGetsAfterRetirement:gets,signRequests:signs,requests});await context.close();
}}finally{await browser.close()}}
const report={status:expected?'FIXED_PASS':'ORIGINAL_DEFECT_REPRODUCED',root,assertions,actualSdk:'2.118.0',sdkSha256:createHash('sha256').update(sdk).digest('hex'),runtimeSha256:createHash('sha256').update(await readFile(path.join(root,'assets/js/king-kind-reader.js'))).digest('hex'),realProvider:false,licensedPdfRead:false,records};
console.log(JSON.stringify({status:report.status,assertions,contexts:records.length}));
