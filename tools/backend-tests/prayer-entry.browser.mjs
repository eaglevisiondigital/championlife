// Paired local sites only. Every request is intercepted; no provider, email or hosted writes.
import {chromium,webkit} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sowgo=process.env.SOWGO_SOURCE;
assert.ok(sowgo,'Exact local SowGo checkout required');
const evidence=process.env.EVIDENCE_DIR;
if(evidence)await mkdir(evidence,{recursive:true});
let count=0;const ok=(v,m)=>{assert.ok(v,m);count++;console.log('PASS '+m)};
const redirect=await readFile(path.join(root,'_redirects'),'utf8');
ok(redirect.includes('/king-kind-signup.html /king-kind/index.html 200'),'stable PR54 alias uses accepted resource form');
const source=await readFile(path.join(root,'assets/js/general-resource-registration.js'),'utf8');
ok(source.includes("rpc('general_resource_registration'")&&!source.includes('outreach_registrations'),'resource RPC separate from decisions');
for(const [engine,options]of [[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});
 try{for(const width of [390,768,1440]){
  const ctx=await browser.newContext({viewport:{width,height:950}}),page=await ctx.newPage();let mutations=0;
  await ctx.route('**/*',async r=>{
   const req=r.request(),url=new URL(req.url());
   if(req.method()!=='GET'){mutations++;return r.abort()}
   if(url.hostname==='synthetic-prayer.supabase.co')return r.fulfill({status:401,json:{message:'No synthetic session'}});
   let base=url.hostname==='sowgo.org'?path.join(sowgo,'public'):url.hostname==='championlifefwb.com'?root:null;
   if(!base)return r.fulfill({status:200,body:''});
   if(url.pathname==='/assets/js/supabase-config.js')return r.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE={url:"https://synthetic-prayer.supabase.co",publishableKey:"synthetic-only"}'});
   const pathname=url.pathname==='/king-kind'||url.pathname==='/king-kind/'?'/king-kind/index.html':url.pathname;
   const file=path.resolve(base,'.'+pathname);
   if(!file.startsWith(path.resolve(base)+path.sep))return r.abort();
   try{return r.fulfill({body:await readFile(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'}[path.extname(file)]||'application/octet-stream'})}catch{return r.fulfill({status:404,body:''})}
  });
  await page.goto('https://sowgo.org/king-kind/');
  ok(await page.locator('a[href="https://championlifefwb.com/king-kind-signup.html"]').count()>0,'SowGo CTA targets general signup');
  ok((await page.locator('body').innerText()).includes('Cloud worksheets are available for lessons 1–4'),'course availability explicit');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'SowGo no horizontal overflow '+engine.name()+' '+width);
  if(evidence)await page.screenshot({path:path.join(evidence,`sowgo-${engine.name()}-${width}.png`),fullPage:true});
  await page.locator('a[href="https://championlifefwb.com/king-kind-signup.html"]').first().click();
  await page.waitForURL('https://championlifefwb.com/king-kind/');
  await page.locator('#resource-submit').waitFor();
  ok(await page.locator('#resource-name').getAttribute('autocomplete')==='name','accepted name field');
  ok(await page.locator('#resource-email').getAttribute('autocomplete')==='email','accepted email field');
  ok((await page.locator('#resource-consent').getAttribute('required'))!==null,'resource delivery consent required');
  ok(!await page.locator('#resource-consent').isChecked()&&!await page.locator('#resource-updates').isChecked(),'no consent inferred');
  ok((await page.locator('#resource-updates').getAttribute('required'))===null,'ministry updates optional');
  ok(/6 a\.m\. prayer/i.test(await page.locator('body').innerText()),'prayer audience retained');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Champion page no horizontal overflow '+engine.name()+' '+width);
  ok(mutations===0,'paired entry sends zero signup/email mutations');
  if(evidence)await page.screenshot({path:path.join(evidence,`prayer-${engine.name()}-${width}.png`),fullPage:true});
  await ctx.close();
 }}finally{await browser.close()}
}
console.log(`${count} paired-site local browser checks passed; genuine provider acceptance UNTESTED.`);
