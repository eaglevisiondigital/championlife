import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const origin='https://public-navigation.example.invalid';
const routes=['/contact.html','/bessemer/','/stlucia/index.html','/outreach-give/index.html'];
const aliases={'/bessemer/':'bessemer/index.html'};
const broken=process.env.EXPECT_BROKEN==='1', evidence=process.env.EVIDENCE_DIR;
if(evidence)await mkdir(evidence,{recursive:true});
const results=[];let checks=0,wrong=0;
const check=(value,label)=>{assert.ok(value,label);checks++};
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(!process.env.CI&&engine===chromium?{channel:'chrome'}:{})});
 try{for(const width of [390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900}});
  // Fix the local clock inside the existing service-time window without modifying runtime source.
  await ctx.addInitScript(()=>{const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-11-01T18:00:00Z']))}static now(){return +new RealDate('2026-11-01T18:00:00Z')}}});
  const mutations=[];await ctx.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()!=='GET')mutations.push(req.url());
   if(url.origin!==origin||req.method()!=='GET')return route.abort();
   const relative=aliases[url.pathname]||url.pathname.replace(/^\//,'');
   const target=path.resolve(root,relative);
   if(!target.startsWith(root+path.sep))return route.abort();
   // Only the actual shared public script is required. No Auth, payment or form integration is invoked.
   if(req.resourceType()==='script'&&!url.pathname.endsWith('/assets/js/site.js'))return route.fulfill({contentType:'text/javascript',body:''});
   try{const body=await readFile(target);const ext=path.extname(target);return route.fulfill({status:200,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'})[ext]||'application/octet-stream',body})}
   catch{return route.fulfill({status:404,contentType:'text/plain',body:'Local source not found'})}
  });
  const page=await ctx.newPage();
  for(const route of routes){
   await page.goto(origin+route,{waitUntil:'domcontentloaded'});
   await page.waitForSelector('.sermon-service-float');
   const links=await page.locator('a[href*="daily-supplements"],a.sermon-service-float').evaluateAll(nodes=>nodes.map(n=>({label:n.textContent.trim(),href:n.href,raw:n.getAttribute('href')})));
   check(links.some(x=>x.label==='Supplements'),'existing Supplements navigation remains');
   check(links.some(x=>x.label==='Sermon Notes'),'service shortcut remains');
   for(const link of links){
    const expected=link.label==='Sermon Notes'?'/sermon-notes.html':'/daily-supplements.html';
    const valid=link.href===origin+expected;
    if(!valid)wrong++;
    if(!broken)check(valid,`${engine.name()}/${width}${route}: ${link.label} resolves to root resource`);
   }
   if(evidence&&route==='/outreach-give/index.html')await page.screenshot({path:path.join(evidence,`${broken?'before':'after'}-${engine.name()}-${width}.png`),fullPage:false});
   const destinations=[];
   for(const target of [...new Set(links.map(x=>x.href))]){
    const response=await page.goto(target,{waitUntil:'domcontentloaded'});
    const status=response.status();destinations.push({target,status});
    const expectedPath=/^\/(?:sermon-notes|daily-supplements)\.html$/.test(new URL(target).pathname);
    check(status===(expectedPath?200:404),`${engine.name()}/${width}: actual local destination status ${status}`);
   }
   results.push({engine:engine.name(),width,route,links,destinations});
  }
  check(mutations.length===0,'zero mutation requests');await ctx.close();
 }}finally{await browser.close()}
}
if(broken)check(wrong>0,'original nested-route defect reproduced');else check(wrong===0,'zero incorrect generated destinations');
if(evidence){await mkdir(evidence,{recursive:true});await writeFile(path.join(evidence,broken?'BEFORE.json':'AFTER.json'),JSON.stringify({checks,wrong,results},null,2))}
console.log(`PASS ${checks} assertions; ${wrong} incorrect destinations; mode=${broken?'reproduction':'corrected'}`);
