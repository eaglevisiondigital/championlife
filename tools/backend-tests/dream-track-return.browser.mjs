import assert from 'node:assert/strict';
import https from 'node:https';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { webcrypto, randomUUID } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
let origin='https://127.0.0.1';const evidence=process.env.EVIDENCE_DIR;
const broken=process.env.EXPECT_BROKEN==='1';
const fictionalCode=randomUUID();
process.env.DREAM_TRACK_ACCESS_CODE=fictionalCode;
globalThis.Netlify={env:{get:name=>name==='DREAM_TRACK_ACCESS_CODE'?fictionalCode:undefined}};
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const {default:handler}=await import(pathToFileURL(path.join(root,'netlify/functions/dream-track-auth.mjs')));
const edgeSource=await readFile(path.join(root,'netlify/edge-functions/dream-track-protect.js'),'utf8');
const {default:edge}=await import('data:text/javascript;base64,'+Buffer.from(edgeSource).toString('base64'));
let checks=0,wrong=0;const results=[];
const check=(ok,label)=>{assert.ok(ok,label);checks++};
async function invoke(destination,correct=true){return handler(new Request(origin+'/.netlify/functions/dream-track-auth',{method:'POST',body:new URLSearchParams({access_code:correct?fictionalCode:'fictional-invalid',return_to:destination})}))}
const valid=['/dream-track','/dream-track/','/dream-track.html',...Array.from({length:7},(_,i)=>[`/dream-track-${i+1}`,`/dream-track-${i+1}/`,`/dream-track-${i+1}.html`]).flat()];
const canonical=p=>p.replace(/\/$/,'').replace(/\.html$/,'')+'.html';
const invalid=['https://other.invalid/dream-track-2.html','//other.invalid/dream-track-2.html','/\\other.invalid','/dream-track-0.html','/dream-track-8.html','/dream-track-99.html','/dream-track-01.html','/dream-track-2.html/','/dream-track-2?x=1','/dream-track-2.html#x','/dream-track-2%2f','%2fdream-track-2.html','%252fdream-track-2.html','/dream-track-2\r\nLocation: https://other.invalid','/dream-track-2.html\n','/dream-track-2/../give.html',' /dream-track-2.html','/Dream-track-2.html','/dream-track-access.html','/dream-track-２.html'];
for(const target of [...valid,...invalid]){
 const desired=valid.includes(target)?canonical(target):'/dream-track.html';
 const response=await invoke(target);const actual=response.headers.get('location');
 if(actual!==desired)wrong++;
 if(!broken)check(actual===desired,'server canonical bounded return '+JSON.stringify(target));
 check(response.status===303,'successful local handler redirect');
 check(response.headers.get('set-cookie')?.includes('HttpOnly; Secure; SameSite=Lax'),'existing cookie protections preserved');
 const failed=await invoke(target,false);check(failed.status===303&&!failed.headers.has('set-cookie'),'failed code sets no cookie');
 if(!broken)check(new URL(failed.headers.get('location'),origin).searchParams.get('return')===desired,'retry keeps canonical bounded target');
}
check((await handler(new Request(origin+'/.netlify/functions/dream-track-auth'))).status===405,'GET cannot authenticate');
let posts=0;
const tls=await mkdtemp(path.join(os.tmpdir(),'dream-track-fixture-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(tls,'key.pem'),'-out',path.join(tls,'cert.pem'),'-days','1','-subj','/CN=127.0.0.1'],{stdio:'ignore'});
const server=https.createServer({key:await readFile(path.join(tls,'key.pem')),cert:await readFile(path.join(tls,'cert.pem'))},async(req,res)=>{
 try{
  const url=new URL(req.url,origin);let response;
  if(url.pathname==='/.netlify/functions/dream-track-auth'){
   posts++;const chunks=[];for await(const chunk of req)chunks.push(chunk);
   response=await handler(new Request(url,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)}));
  }else if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  else if(url.pathname.startsWith('/dream-track'))response=await edge(new Request(url,{headers:req.headers}),{next:()=>null});
  if(response){res.writeHead(response.status,Object.fromEntries(response.headers));res.end();return;}
  const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
  try{const body=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}
 }catch{res.writeHead(500);res.end('Local fixture error');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='https://127.0.0.1:'+server.address().port;
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(!process.env.CI&&engine===chromium?{channel:'chrome'}:{})});
 try{for(const width of [390,1440]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900}});const beforePosts=posts;
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  for(const target of ['/dream-track-2','/dream-track-6/','/dream-track-7.html']){
   await context.clearCookies();await page.goto(origin+target);check(new URL(page.url()).pathname==='/dream-track-access.html','actual edge sends unauthenticated route to access');
   const retained=await page.locator('#dream-return-to').inputValue();if(retained!==canonical(target))wrong++;
   if(!broken)check(retained===canonical(target),'browser retains exact canonical original step');
   await page.locator('#dream-access-code').fill('fictional-invalid');await Promise.all([page.waitForURL('**/dream-track-access.html?error=1&return=*'),page.locator('button[type=submit]').click()]);
   check(await page.locator('#dream-access-error').isVisible(),'wrong code displays safe retry');
   if(!broken)check(await page.locator('#dream-return-to').inputValue()===canonical(target),'retry preserves original step');
   await page.locator('#dream-access-code').fill(fictionalCode);await Promise.all([page.waitForURL(u=>u.pathname!=='/dream-track-access.html'),page.locator('button[type=submit]').click()]);
   if(!broken)check(new URL(page.url()).pathname===canonical(target),'successful local gate reaches intended source step');
   check(await page.locator('h1').count()>0,'source course page rendered after local gate');
   check(!page.url().includes(fictionalCode),'code never reaches URL');
   results.push({engine:engine.name(),width,requested:target,final:new URL(page.url()).pathname});
  }
  await context.clearCookies();
  for(const target of invalid){
   await page.goto(origin+'/dream-track-access.html?return='+encodeURIComponent(target));
   if(!broken)check(await page.locator('#dream-return-to').inputValue()==='/dream-track.html','browser rejects noncanonical unavailable or external target');
  }
  check(posts-beforePosts===6,'each browser journey makes only two explicit local authentication POSTs');
  check(await page.locator('.brand img').getAttribute('src')==='assets/images/logo-gold.png','approved logo preserved');
  check(await page.locator('.nav-links a[href="give.html"]').count()===1,'existing navigation preserved');
  if(evidence){await mkdir(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,`${broken?'before':'after'}-${engine.name()}-${width}.png`),fullPage:true});}
  await context.close();
 }}finally{await browser.close();}
}
}finally{await new Promise(resolve=>server.close(resolve));await rm(tls,{recursive:true,force:true});}
if(broken)check(wrong>0,'original route-loss defect reproduced');else check(wrong===0,'zero incorrect destinations');
if(evidence)await writeFile(path.join(evidence,broken?'BEFORE.json':'AFTER.json'),JSON.stringify({checks,wrong,results,provider:'local handlers; fictional code; all external network blocked'},null,2));
console.log(`PASS ${checks} assertions; ${wrong} incorrect destinations; ${broken?'original reproduction':'corrected'}`);
