import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const origin='https://public-menu.example.invalid',before=process.env.EXPECT_BROKEN==='1',evidence=process.env.EVIDENCE_DIR;
if(evidence)await mkdir(evidence,{recursive:true});let assertions=0;const results=[];
function check(value,message){assert.ok(value,message);assertions++}
for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true,...(!process.env.CI&&engine===chromium?{channel:'chrome'}:{})});try{
 for(const route of ['/contact.html','/outreach.html','/huntsville/es/index.html']){for(const width of [390,768]){
  const context=await browser.newContext({viewport:{width,height:900}}),mutations=[];
  await context.route('**/*',async intercepted=>{const request=intercepted.request(),url=new URL(request.url());if(request.method()!=='GET')mutations.push(request.url());if(url.origin!==origin||request.method()!=='GET')return intercepted.abort();if(request.resourceType()==='script'&&!url.pathname.endsWith('/site.js'))return intercepted.fulfill({contentType:'text/javascript',body:''});const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))return intercepted.abort();try{const body=await readFile(file),ext=path.extname(file);return intercepted.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[ext]||'application/octet-stream',body})}catch{return intercepted.fulfill({status:404,body:'missing'})}});
  const page=await context.newPage();await page.goto(origin+route,{waitUntil:'domcontentloaded'});const button=page.locator('.menu-btn'),nav=page.locator('.nav-links');
  check(await button.isVisible()&&await nav.isHidden(),'mobile navigation starts collapsed');
  if(!before){check(await button.getAttribute('aria-expanded')==='false','collapsed state announced');const id=await button.getAttribute('aria-controls');check(!!id&&await nav.getAttribute('id')===id,'button identifies actual navigation');}
  await button.press('Enter');check(await nav.isVisible(),'keyboard opens existing menu');
  const label=await button.getAttribute('aria-label'),expanded=await button.getAttribute('aria-expanded');
  await nav.locator('a').first().focus();await page.keyboard.press('Escape');const escapeClosed=await nav.isHidden();
  if(before){check(['Open menu','Abrir menú'].includes(label)&&expanded===null&&!escapeClosed,'original incorrect announcement and Escape failure reproduced');}
  else{check(label===(route.includes('/es/')?'Cerrar menú':'Close menu')&&expanded==='true','open state announced accurately');check(escapeClosed,'Escape closes navigation');check(await button.evaluate(e=>e===document.activeElement),'Escape restores menu-button focus');
   await button.press('Space');check(await nav.isVisible(),'Space reopens navigation');
   // Prevent this click from navigating so its same-document disclosure state can be inspected.
   await nav.locator('a[href*="daily-supplements"]').evaluate(a=>{a.addEventListener('click',e=>e.preventDefault());a.click()});check(await nav.isHidden()&&await button.getAttribute('aria-expanded')==='false','injected navigation item closes menu and updates state');
   await button.click();await button.click();check(await nav.isHidden(),'pointer toggle unchanged');
   await page.setViewportSize({width:1440,height:900});check(await nav.isVisible()&&await button.isHidden(),'desktop navigation remains visible');
   await page.setViewportSize({width,height:900});check(await nav.isHidden(),'return to mobile remains collapsed');
   await page.evaluate(()=>{const target=document.createElement('button');target.id='isolated-modal-focus';target.textContent='Synthetic dialog';document.body.append(target);window.OutreachPartner={open(){target.focus()}};const link=document.createElement('a');link.href='/outreach-partner?brand=champion-life';link.textContent='Become an Outreach Partner';document.querySelector('.nav-links').append(link)});
   await button.click();await nav.locator('a[href*="outreach-partner?"]').click();check(await nav.isHidden(),'partner modal entry closes public menu');check(await page.locator('#isolated-modal-focus').evaluate(e=>e===document.activeElement),'menu closure does not steal partner modal focus');
   await button.click();await page.locator('#isolated-modal-focus').focus();await page.keyboard.press('Escape');check(await nav.isVisible(),'Escape outside navigation does not steal unrelated focus');
   await button.click();await button.click();const destination=await nav.locator('a').first().getAttribute('href');await nav.locator('a').first().click();await page.waitForURL(new URL(destination,origin+route).href);check(await page.locator('.nav-links').isHidden(),'ordinary link navigation remains functional');

  }
  if(evidence)await page.screenshot({path:path.join(evidence,`${before?'before':'after'}-${engine.name()}-${width}-${route.includes('/es/')?'spanish':route.includes('contact')?'church':'outreach'}.png`)});
  check(mutations.length===0,'zero form or backend mutations');results.push({engine:engine.name(),route,width,label,expanded,escapeClosed});await context.close();
 }}
}finally{await browser.close()}}
if(evidence)await writeFile(path.join(evidence,before?'MENU-BEFORE.json':'MENU-AFTER.json'),JSON.stringify({assertions,results},null,2));console.log(`PASS ${assertions} assertions (${before?'original defect reproduced':'corrected'})`);
