import {chromium,webkit} from 'playwright';import assert from 'node:assert/strict';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const base=process.env.THEME_SONG_PREVIEW||'http://127.0.0.1:4179';if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Local review only');
const evidence=process.env.EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});let checks=0;const ok=(v,l)=>{assert.ok(v,l);checks++;console.log('PASS '+l)};
const output=[];
for(const [engine,options] of [[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});try{
  for(const width of [1440,847,768,390]){
   const ctx=await browser.newContext({viewport:{width,height:width===390?844:1000},acceptDownloads:true});const p=await ctx.newPage();let errors=[];p.on('pageerror',e=>errors.push(e.message));const blocked=[];
   await ctx.route('**/*',route=>{if(new URL(route.request().url()).origin!==base){blocked.push(new URL(route.request().url()).origin);return route.abort();}return route.continue();});
   await p.goto(base+'/outreach/theme-song');await p.waitForSelector('.theme-song.is-ready');await p.waitForFunction(()=>Number.isFinite(document.querySelector('audio').duration));
   ok(await p.locator('audio').evaluate(a=>a.paused&&Math.abs(a.duration-288.1)<1),'original AAC metadata/no autoplay '+engine.name()+'/'+width);
   ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow '+width);
   if(evidence)await p.screenshot({path:`${evidence}/${engine.name()}-${width}.png`,fullPage:true});
   await p.locator('[data-play]').click();await p.waitForFunction(()=>document.querySelector('audio').currentTime>0.5);await p.locator('[data-play]').click();
   ok(await p.locator('audio').evaluate(a=>a.paused),'play/pause real audio '+width);
   await p.locator('[data-seek]').evaluate(el=>{el.value=80;el.dispatchEvent(new Event('input',{bubbles:true}))});await p.waitForFunction(()=>Math.abs(document.querySelector('audio').currentTime-80)<1);ok(true,'seek '+width);
   await p.locator('[data-volume]').evaluate(el=>{el.value=.4;el.dispatchEvent(new Event('input',{bubbles:true}))});ok(await p.locator('audio').evaluate(a=>Math.abs(a.volume-.4)<.01),'volume '+width);
   const downloadPromise=p.waitForEvent('download');await p.locator('[data-download]').click();const download=await downloadPromise;const file=await download.path();ok(download.suggestedFilename().endsWith('.m4a')&&createHash('sha256').update(await readFile(file)).digest('hex')==='b844032d80a66f41743df01b22c2a7ab4f07d5dcd571467e34c4bbf2e2249c60','byte-identical download '+width);
   ok((await p.locator('[data-give]').first().getAttribute('href'))==='/outreach-giving.html','existing giving destination');
   await p.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedLink=text}},configurable:true});});await p.locator('[data-share]').click();ok(await p.evaluate(()=>window.copiedLink==='https://championlifefwb.com/outreach/theme-song'),'copy-link fallback');
   if(width<=900){
    // Pointer clicks target the controls actually pictured in the approved artwork.
    await p.locator('[data-art-play]').click();await p.waitForFunction(()=>!document.querySelector('audio').paused);await p.locator('[data-art-play]').click();
    ok(await p.locator('audio').evaluate(a=>a.paused),'artwork play/pause '+engine.name()+'/'+width);
    const artSeek=p.locator('[data-art-seek]'),seekBox=await artSeek.boundingBox();await artSeek.click({position:{x:seekBox.width*.6,y:seekBox.height/2}});
    await p.waitForFunction(()=>{const a=document.querySelector('audio');return a.currentTime/a.duration>.5&&a.currentTime/a.duration<.7});
    ok(true,'artwork pointer seeking '+width);
    const artVolume=p.locator('[data-art-volume]'),volumeBox=await artVolume.boundingBox();await artVolume.click({position:{x:volumeBox.width*.3,y:volumeBox.height/2}});
    ok(await p.locator('audio').evaluate(a=>a.volume>.1&&a.volume<.5),'artwork pointer volume '+width);
    await p.locator('[data-art-mute]').click();ok(await p.locator('audio').evaluate(a=>a.muted),'artwork mute '+width);await p.locator('[data-art-mute]').click();ok(await p.locator('audio').evaluate(a=>!a.muted),'artwork unmute '+width);
    const artDownloadPromise=p.waitForEvent('download');await p.locator('[data-art-download]').click();const artDownload=await artDownloadPromise;
    ok(createHash('sha256').update(await readFile(await artDownload.path())).digest('hex')==='b844032d80a66f41743df01b22c2a7ab4f07d5dcd571467e34c4bbf2e2249c60','artwork original audio download '+width);
    await p.evaluate(()=>{window.copiedLink=null});await p.locator('[data-art-share]').click();ok(await p.evaluate(()=>window.copiedLink==='https://championlifefwb.com/outreach/theme-song'),'artwork share '+width);
    ok(await p.locator('[data-art-give]').getAttribute('href')==='/outreach-giving.html','artwork existing Outreach giving '+width);
    ok(await p.locator('[data-art-time]').textContent()===await p.locator('[data-time]').textContent(),'artwork time stays synchronized '+width);
    await p.locator('[data-play]').focus();await p.locator('[data-play]').press('Space');await p.waitForFunction(()=>!document.querySelector('audio').paused);await p.locator('[data-play]').press('Space');ok(await p.locator('[data-play]').evaluate(el=>el===document.activeElement&&getComputedStyle(el).outlineStyle!=='none'),'full-size keyboard controls retain visible focus '+width);
    if(evidence)await p.screenshot({path:`${evidence}/${engine.name()}-${width}-artwork-active.png`,fullPage:true});
   }
   ok(errors.length===0&&blocked.length===0,'no JS errors or external API requests');output.push({engine:engine.name(),width,errors,blocked});await ctx.close();
  }
  // Production Outreach markup and registration links preserved; no remote calls allowed.
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());await p.goto(base+'/outreach.html');await p.waitForSelector('.theme-song.is-ready');ok(await p.locator('.outreach-hero + .theme-song').count()===1,'existing Outreach placement');ok(await p.locator('#upcoming').count()===1,'upcoming outreach section retained');if(evidence)await p.locator('[data-theme-song]').screenshot({path:`${evidence}/${engine.name()}-outreach-feature.png`});await ctx.close();
 }finally{await browser.close();}
}
// Browser clock uses actual media playback. Counter transport is a labeled local fixture.
const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const ctx=await browser.newContext();const p=await ctx.newPage();let plays=0,starts=0,requests=[];
 await ctx.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==base)return route.abort();if(u.pathname==='/.netlify/functions/theme-song'){const kind=r.method()==='POST'?r.postDataJSON().kind:null;requests.push(kind);if(kind==='play')plays++;if(kind==='start')starts++;return route.fulfill({json:{plays:String(plays)}});}return route.continue();});
 await p.goto(base+'/outreach/theme-song');await p.waitForFunction(()=>Number.isFinite(document.querySelector('audio').duration));ok(plays===0&&starts===0,'page view never qualifies');
 await p.locator('[data-play]').click();await p.waitForTimeout(1100);await p.locator('[data-play]').click();ok(plays===0,'one-second click/listen does not qualify');
 await p.locator('[data-seek]').evaluate(el=>{el.value=100;el.dispatchEvent(new Event('input'))});await p.waitForTimeout(500);ok(plays===0,'seeking does not qualify');
 await p.locator('[data-play]').click();await p.waitForFunction(()=>document.querySelector('[data-total]').textContent==='1 qualified plays',{},{timeout:12000});await p.locator('[data-play]').click();await p.locator('[data-play]').click();await p.waitForTimeout(1500);ok(plays===1&&starts===1,'five seconds across pauses counts once');
 await p.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied')}},configurable:true});});await p.locator('[data-share]').click();ok(await p.locator('[data-copy-link]').isVisible(),'manual selectable link if clipboard unavailable');
 await p.locator('audio').evaluate(a=>a.dispatchEvent(new Event('error')));ok((await p.locator('[data-status]').textContent()).includes('could not load'),'visible playback error');
 output.push({counter:'mock transport only; native PostgreSQL tested separately',requests});await ctx.close();
}finally{await browser.close()}
if(evidence)await writeFile(evidence+'/browser-results.json',JSON.stringify({checks,output},null,2));console.log(`PASS ${checks} browser assertions`);
