// Actual anonymous GET of the two existing public booklet wrappers, embedded
// inside the local release candidate. Detector/video are fictional fixtures.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(process.env.WATCH_ROOT||'.'),evidence=resolve(process.env.WATCH_EVIDENCE||'/tmp/champion-watch-booklet');
const {chromium,webkit,devices}=await import(pathToFileURL(resolve(process.env.WATCH_PLAYWRIGHT||'tools/backend-tests/node_modules/playwright/index.mjs')));
mkdirSync(evidence,{recursive:true});
const origin='https://championlifefwb.com',host='https://champion-life-sermon-booklets.netlify.app';
const csp=/Content-Security-Policy\s*=\s*"([^"]*)"/.exec(readFileSync(join(root,'netlify.toml'),'utf8'))?.[1];
assert.ok(csp,'release CSP required');
const mime=p=>({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'}[extname(p)]||'application/octet-stream');
const booklets=[{kind:'sunday-worship',path:'/booklets/light-be-part-one/',sha256:'e1bcb47b800a90cb4aa976c7d143db536b87cfce48c409505b7fbda418e0426a'},
{kind:'wednesday-worship',path:'/booklets/wednesday-2026-11-18-service-notes/',sha256:'50f33d612bf86ddfc3de2bd14237d1f3d246e23801e2df635dd1dfcaf8bdbd56'}];
const results=[];let current='setup';
try{for(const[name,engine,width]of [['chromium-desktop',chromium,1440],['webkit-mobile',webkit,390]]){
 const browser=await engine.launch();
 try{
  const context=await browser.newContext({...(width===390?devices['iPhone 13']:{}),viewport:{width,height:900}}),page=await context.newPage();
  page.setDefaultTimeout(20000);const blocked=[],errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(req.method()!=='GET'){blocked.push({method:req.method(),origin:u.origin});return route.abort();}
   if(u.origin===host){assert.ok(booklets.some(b=>b.path===u.pathname),'only two approved public wrappers');network.push(u.pathname);return route.continue();}
   if(u.origin===origin){
    if(u.pathname==='/.netlify/functions/youtube-live')return route.fulfill({contentType:'application/json',body:'{"live":false,"videoId":null}'});
    const path=resolve(root,'.'+u.pathname);if(path.startsWith(root+'/')&&existsSync(path))return route.fulfill({contentType:mime(path),body:readFileSync(path),headers:{'Content-Security-Policy':csp}});
   }
   blocked.push({method:req.method(),origin:u.origin,path:u.pathname});return route.abort();
  });
  await page.clock.install({time:new Date('2026-11-22T16:35:00Z')});
  let responsePromise=page.waitForResponse(r=>r.url()===host+booklets[0].path,{timeout:35000});
  await page.goto(origin+'/watch.html');
  await page.locator('#published-booklet-host iframe').scrollIntoViewIfNeeded();
  for(const b of booklets){
   current=name+'-'+b.kind;
   if(b.kind==='wednesday-worship'){
    responsePromise=page.waitForResponse(r=>r.url()===host+b.path,{timeout:35000});
    await page.locator('#booklet-selection').selectOption(b.kind);
    await page.locator('#published-booklet-host iframe').scrollIntoViewIfNeeded();
   }
   const response=await responsePromise;assert.equal(response.status(),200);
   const hash=createHash('sha256').update(await response.body()).digest('hex');assert.equal(hash,b.sha256);
   const outer=page.frameLocator('#published-booklet-host iframe'),inner=outer.frameLocator('iframe');
   await inner.locator('.page.active').waitFor();assert.equal(await inner.locator('.page').count(),8);
   assert.equal(await page.locator('#published-booklet-host iframe').getAttribute('sandbox'),'allow-scripts');
   assert.equal(await outer.locator('iframe').getAttribute('sandbox'),'allow-scripts');
   const bounds=await inner.locator('#book').boundingBox();assert.ok(bounds.width>200&&bounds.width<=width&&bounds.x>=0&&bounds.x+bounds.width<=width+1,'nested book fits viewport');
   assert.equal(await inner.locator('#prevBtn').isDisabled(),true);
   await inner.locator('#nextBtn').click();await page.waitForTimeout(900);assert.equal(await inner.locator('.page.active').getAttribute('data-page'),'2');
   await inner.locator('#prevBtn').click();await page.waitForTimeout(900);assert.equal(await inner.locator('.page.active').getAttribute('data-page'),'1');
   await page.screenshot({path:join(evidence,current+'.png')});
   assert.equal(blocked.length,0);assert.equal(errors.length,0);
   results.push({case:current,result:'PASS',publicWrapper:host+b.path,sha256:hash,HTTP:response.status(),pages:8,forwardBackward:true,opaqueOuterAndInner:true,bounds,actualPublicGET:true,physicalDevice:false});
  }
  await context.close();
 }finally{await browser.close();}
}
writeFileSync(join(evidence,'RESULT.json'),JSON.stringify({status:'PASS',mode:'ACTUAL_PUBLIC_BOOKLETS_NESTED_IN_LOCAL_CANDIDATE',results,productionWatchUnchanged:true},null,2)+'\n');console.log(JSON.stringify({status:'PASS',cases:results.length}));
}catch(e){writeFileSync(join(evidence,'HOLD.json'),JSON.stringify({status:'HOLD',case:current,message:e.message,completed:results,noAutomaticRetry:true},null,2)+'\n');throw e;}
