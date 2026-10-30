// Actual pinned SDK and actual PDF.js 4.10.38 renderer; intercepted synthetic Auth/Storage only.
// Exact licensed PDF supplied privately, never committed or served by a listening server.
import{chromium,webkit}from'playwright';import{readFile,mkdir}from'node:fs/promises';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';import path from'node:path';import assert from'node:assert/strict';
const rendererHashes={'pdf.mjs':'a209a2124baa35cbb9015b809926f1bcec9dd1c247296290e205dd9d76cb9128','pdf.worker.mjs':'7c237f83fa56bce645d8af51d183c9c56ba7b2d2928ff42754dc7020bea36323'};if(!process.env.TEST_PDFJS_DIR)throw Error('Exact local PDF.js 4.10.38 cache required');
if(!process.env.TEST_PDF_ZIP)throw Error('Private approved PDF ZIP required');
const pdf=execFileSync('python3',['-c','import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("King_Kind_Approved_Personal_Use.pdf"))',process.env.TEST_PDF_ZIP],{maxBuffer:30000000}),hash='417f9faa7ff3945fdf4ff62931a233739856d03221c8429e21b768b221b94a54';assert.equal(createHash('sha256').update(pdf).digest('hex'),hash);
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),origin='https://sdk-reader.local.test',backend='https://synthetic-auth.supabase.co',key='sb-synthetic-auth-auth-token',user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'a@example.test',email_confirmed_at:'2026-01-01',aud:'authenticated',role:'authenticated',is_anonymous:false};
const session=()=>{const exp=Math.floor(Date.now()/1000)+3600;return{user,expires_at:exp,expires_in:3600,token_type:'bearer',refresh_token:'fictional-refresh',access_token:[{alg:'HS256',typ:'JWT'},{sub:user.id,exp,aud:'authenticated',role:'authenticated'},'fictional-signature'].map((p,i)=>Buffer.from(i===2?p:JSON.stringify(p)).toString('base64url')).join('.')}};
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const[engine,launch]of[[chromium,{channel:'chrome'}],[webkit,{}]]){
 const b=await engine.launch({headless:true,...launch});try{for(const width of[390,1440]){
  const c=await b.newContext({viewport:{width,height:900},acceptDownloads:true});let mode='eligible',signs=[],sends=0,unexpected=[];
  await c.route('**/*',async r=>{const u=new URL(r.request().url()),req=r.request();
   if(u.origin===backend){
    if(u.pathname==='/auth/v1/logout')return r.fulfill({status:204,body:''});
    if(u.pathname==='/auth/v1/otp'){sends++;return r.fulfill({json:{}})}
    if(u.pathname==='/auth/v1/verify'){if(req.postDataJSON().token!=='12345678')return r.fulfill({status:403,json:{error_code:'otp_expired',msg:'Synthetic expired code'}});return r.fulfill({json:session()})}
    if(u.pathname==='/auth/v1/user')return r.fulfill({json:mode==='unverified'?{...user,email_confirmed_at:null}:user});
    if(u.pathname==='/storage/v1/object/sign/king-kind-books/king-kind/king-kind-english.pdf'){
     if(req.method()==='POST'){signs.push(req.postDataJSON());return mode==='eligible'?r.fulfill({json:{signedURL:'/object/sign/king-kind-books/king-kind/king-kind-english.pdf?token=fictional'}}):r.fulfill({status:403,json:{message:'Denied',statusCode:'403',error:'Unauthorized'}})}
     if(req.method()==='GET')return r.fulfill({body:pdf,contentType:'application/pdf'});
    }
    unexpected.push(u.pathname);return r.abort();
   }
   if(u.origin==='https://cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/pdfjs-dist@4.10.38/build/')){
    const name=path.basename(u.pathname);if(!['pdf.mjs','pdf.worker.mjs'].includes(name))throw Error('Unexpected renderer dependency');
    const body=await readFile(path.join(process.env.TEST_PDFJS_DIR,name));
    assert.equal(createHash('sha256').update(body).digest('hex'),rendererHashes[name]);
    return r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body});
   }
   if(u.href==='https://championlifefwb.com/assets/images/king-kind-cover.svg')return r.fulfill({contentType:'image/svg+xml',body:await readFile(path.join(root,'assets/images/king-kind-cover.svg'))});
   if(u.origin!==origin)return r.fulfill({body:'',status:200});
   if(req.method()!=='GET'){unexpected.push(req.method()+u.pathname);return r.abort()}
   if(u.pathname==='/assets/js/supabase-config.js')return r.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'synthetic-only'})});
   const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root+path.sep))return r.abort();try{await r.fulfill({body:await readFile(f),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[path.extname(f)]||'application/octet-stream'})}catch{await r.fulfill({status:404,body:''})}
  });
  const p=await c.newPage();await p.goto(origin+'/discipleship-login.html?next=%2Fking-kind-reader.html');await p.locator('#loginEmail').fill(user.email);await p.locator('#sendCodeBtn').click();await p.locator('#loginCode').fill('00000000');await p.locator('#verifyCodeBtn').click();await p.locator('#authMessage.error').waitFor();ok(!p.url().includes('king-kind-reader.html?')&&sends===1,'invalid OTP stays on login');await p.locator('#loginCode').fill('12345678');await p.locator('#verifyCodeBtn').click();await p.waitForURL(origin+'/king-kind-reader.html');await p.locator('#book-license-ack').waitFor({state:'visible'});await p.waitForFunction(()=>!document.querySelector('#book-license-ack').disabled);ok(signs.length===1&&signs[0].expiresIn===900,'SDK exact private object sign TTL');ok(await p.locator('#download-book').isDisabled(),'download requires acknowledgment');await p.locator('#book-license-ack').check();const event=p.waitForEvent('download');await p.locator('#download-book').click();const download=await event;ok(createHash('sha256').update(await readFile(await download.path())).digest('hex')===hash,'licensed download bytes match approved hash');
  await p.waitForFunction(()=>document.querySelector('.book-cover').naturalWidth>0);ok(true,'approved local cover image loaded');
  ok(await p.evaluate(()=>document.querySelector('#page-canvas').width>100&&!document.querySelector('#page-wrap').hidden),'real PDF cover canvas painted');
  const first=await p.locator('#page-canvas').evaluate(c=>c.toDataURL());
  await p.locator(width===390?'#mobile-next':'#next-page').click();await p.waitForFunction(()=>document.querySelector('#reader-status').textContent.startsWith('Page 2 of 83'));
  const second=await p.locator('#page-canvas').evaluate(c=>c.toDataURL());ok(first!==second,'actual page turning changes rendered pixels');
  await p.locator('#zoom-in').click();await p.waitForFunction(()=>document.querySelector('#reader-status').textContent.includes('120%'));ok(true,'real rendering zoom completes');
  await p.locator(width===390?'#mobile-fit-width':'#fit-width').click();await p.waitForFunction(()=>document.querySelector('#reader-status').textContent.includes('100%'));ok(true,'fit width restored');
  await p.evaluate(()=>{window.scrollTo(0,0);window.dispatchEvent(new Event('resize'))});await p.waitForTimeout(400);
  if(process.env.TEST_SCREENSHOT_DIR){await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.TEST_SCREENSHOT_DIR,engine.name()+'-'+width+'.png'),fullPage:false})}
  await p.evaluate(()=>ChampionLifeAuth.client.auth.signOut({scope:'local'}));
  ok(await p.evaluate(()=>document.querySelector('#page-wrap').hidden&&document.querySelector('#page-canvas').width===0&&document.querySelector('#download-book').disabled),'real worker/book cleared after logout');
  await p.evaluate(async s=>{await ChampionLifeAuth.client.auth.setSession(s)},session());await p.waitForFunction(()=>!document.querySelector('#book-license-ack').disabled);ok(await p.locator('#download-book').isDisabled(),'actual renderer reauthorized with acknowledgment reset');
  await p.goto(origin+'/discipleship-login.html?next=%2Fking-kind-reader.html#error=access_denied&error_code=otp_expired');await p.locator('#authMessage.error').waitFor();ok(p.url().includes('discipleship-login.html')&&!p.url().includes('otp_expired'),'expired callback cannot borrow old session');
  for(const denial of['unregistered','unverified']){mode=denial;await p.goto(origin+'/king-kind-reader.html');await p.locator('#access-error').waitFor({state:'visible'});ok(await p.locator('#download-book').isDisabled()&&await p.locator('#book-license-ack').isDisabled(),denial+' Storage denial stays locked')}
  const before=signs.length;await p.evaluate(k=>localStorage.removeItem(k),key);await p.reload();await p.locator('#access-error').waitFor({state:'visible'});ok(signs.length===before&&await p.locator('#download-book').isDisabled(),'anonymous never requests signed URL');ok(unexpected.length===0,'no unhandled provider calls');await c.close();
 }}finally{await b.close()}
}
console.log(`${checks} real PDF.js 4.10.38 rendering/session/transport checks passed; synthetic Auth/Storage only, not physical-device or genuine-provider acceptance.`);
