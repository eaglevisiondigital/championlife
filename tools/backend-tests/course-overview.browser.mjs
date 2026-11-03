// Actual public overview; local/intercepted resources only. No Auth or backend action.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from './node_modules/playwright/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),origin='https://course-overview.invalid';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
for(const [name,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of[390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());requests.push(url.href);
   if(url.origin!==origin)return route.fulfill({body:'',contentType:'text/html'});
   try{return route.fulfill({body:await readFile(path.join(root,url.pathname)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(url.pathname)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}
  });
  await page.goto(origin+'/getting-a-grip.html');
  const rows=page.locator('.grip-course-list .course-row');ok(await rows.count()===13,'all13 lesson routes remain discoverable');
  for(let lesson=1;lesson<=13;lesson++){
   const row=rows.nth(lesson-1),text=await row.innerText();
   ok(await row.getAttribute('href')===`getting-a-grip-${lesson}.html`,'unchanged destination '+lesson);
   ok(text.includes(lesson<=4?'Autosave':'Private cloud worksheet · Save responses'),'accurate save mode '+lesson);
   ok(text.includes(lesson<=10?'Video available':'Video coming soon'),'truthful media status '+lesson);
  }
  const summary=page.locator('.coming');ok((await summary.innerText()).includes('Private worksheets for all 13 lessons'),'overview reflects implemented worksheet catalog');
  ok((await summary.innerText()).includes('Saving or submitting answers does not certify video watching or lesson completion.'),'saving does not promise watching/completion');
  ok((await summary.innerText()).includes('Device notes remain separate and do not sync'),'local notes not described as cloud synced');
  ok(!/completion tools|Additional lessons can be converted|Interactive coursework is live/.test(await page.locator('main').innerText()),'obsolete availability and completion claims removed');
  ok(await page.getByRole('link',{name:'Start Course',exact:true}).getAttribute('href')==='getting-a-grip-1.html','Start Course remains navigation only');
  ok(await page.getByRole('link',{name:'My Discipleship',exact:true}).getAttribute('href')==='my-discipleship.html','existing dashboard route preserved');
  ok(await page.locator('iframe').getAttribute('src')==='https://www.youtube.com/embed/aIqJHWLol4w','intro video unchanged');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  ok(errors.length===0&&!requests.some(u=>/supabase|\/rpc|\/auth\//.test(u)),'no runtime errors or Auth/backend requests');
  if(process.env.EVIDENCE_DIR&&((name==='chromium'&&width===390)||(name==='webkit'&&width===1440))){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await summary.scrollIntoViewIfNeeded();await page.waitForTimeout(750);await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>scrollY===0);await page.screenshot({path:path.join(process.env.EVIDENCE_DIR,`course-overview-${name}-${width}.png`),fullPage:true})}
  console.log(JSON.stringify({name,width,checks}));await page.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({checks,status:'PASS',evidence:'local public-page rendering only; no genuine provider or release acceptance'}));
