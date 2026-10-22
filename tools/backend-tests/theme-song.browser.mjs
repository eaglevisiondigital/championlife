import {chromium,webkit} from 'playwright';import assert from 'node:assert/strict';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const base=process.env.THEME_SONG_PREVIEW||'http://127.0.0.1:4179';if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Local review only');
const evidence=process.env.EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});let checks=0;const ok=(v,l)=>{assert.ok(v,l);checks++;console.log('PASS '+l)};
const output=[];
for(const [engine,options] of [[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});try{
  for(const width of [1440,847,768,390]){
   const ctx=await browser.newContext({viewport:{width,height:width===390?844:1000},acceptDownloads:true});const p=await ctx.newPage();let errors=[];p.on('pageerror',e=>errors.push(e.message));const blocked=[],apiRequests=[];p.on('request',r=>{if(['fetch','xhr','websocket'].includes(r.resourceType())||r.method()!=='GET')apiRequests.push({method:r.method(),url:r.url()})});
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
   ok(await p.locator('[data-theme-song] [data-play]').count()===1&&await p.locator('[data-theme-song] [data-download]').count()===1&&await p.locator('[data-theme-song] [data-share]').count()===1&&await p.locator('[data-theme-song] [data-give]').count()===1,'exactly one control set '+width);
   ok(await p.locator('.theme-song-player,.theme-song-actions,.theme-song-meta,.theme-song-fuel a').count()===0,'duplicate control markup removed '+width);
   ok(await p.locator('[data-theme-song]').evaluate(root=>{const image=root.querySelector('img').getBoundingClientRect();return [...root.querySelectorAll('button,a,input:not([hidden])')].every(el=>{const r=el.getBoundingClientRect();return r.top>=image.top&&r.bottom<=image.bottom&&r.left>=image.left&&r.right<=image.right})}),'all visible controls contained in artwork '+width);
   ok(await p.locator('[data-total],[data-counter],.song-art-total').count()===0,'counter removed '+width);
   const artSeek=p.locator('[data-seek]'),seekBox=await artSeek.boundingBox();await artSeek.click({position:{x:seekBox.width*.6,y:seekBox.height/2}});
   await p.waitForFunction(()=>{const a=document.querySelector('audio');return a.currentTime/a.duration>.5&&a.currentTime/a.duration<.7});ok(true,'pointer seeking on artwork '+width);
   const artVolume=p.locator('[data-volume]'),volumeBox=await artVolume.boundingBox();await artVolume.click({position:{x:volumeBox.width*.3,y:volumeBox.height/2}});
   ok(await p.locator('audio').evaluate(a=>a.volume>.1&&a.volume<.5),'pointer volume on artwork '+width);
   await p.locator('[data-mute]').click();await p.waitForFunction(()=>document.querySelector('audio').muted&&document.querySelector('[data-mute]').getAttribute('aria-pressed')==='true');ok(true,'mute state announced '+width);await p.locator('[data-mute]').click();ok(await p.locator('audio').evaluate(a=>!a.muted),'unmute '+width);
   await p.locator('[data-play]').focus();await p.locator('[data-play]').press('Space');await p.waitForFunction(()=>!document.querySelector('audio').paused);await p.locator('[data-play]').press('Space');
   ok(await p.locator('[data-play]').evaluate(el=>el===document.activeElement&&getComputedStyle(el).outlineStyle!=='none'),'artwork keyboard activation and visible focus '+width);
   const seekBefore=Number(await artSeek.inputValue());await artSeek.press('ArrowRight');ok(Number(await artSeek.inputValue())>seekBefore,'keyboard seeking '+width);
   const volumeBefore=Number(await artVolume.inputValue());await artVolume.press('ArrowRight');ok(Number(await artVolume.inputValue())>volumeBefore,'keyboard volume '+width);
   ok(await p.getByRole('button',{name:'Play theme song',exact:true}).count()===1&&await p.getByRole('button',{name:'Share song',exact:true}).count()===1&&await p.getByRole('link',{name:'Download song (M4A)',exact:true}).count()===1&&await p.getByRole('link',{name:'Give to Outreach',exact:true}).count()===1,'single accessible action set '+width);
   if(evidence)await p.screenshot({path:`${evidence}/${engine.name()}-${width}-artwork-active.png`,fullPage:true});
   ok(errors.length===0&&blocked.length===0&&apiRequests.length===0,'no JS errors, tracking or API requests');ok((await ctx.cookies()).length===0,'no player cookies');output.push({engine:engine.name(),width,errors,blocked,apiRequests});await ctx.close();
  }
  // Production Outreach markup and registration links preserved; no remote calls allowed.
  for(const width of [1440,390]){
   const ctx=await browser.newContext({viewport:{width,height:1000}});const p=await ctx.newPage();await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());await p.goto(base+'/outreach.html');await p.waitForSelector('.theme-song.is-ready');ok(await p.locator('.outreach-hero + .theme-song').count()===1,'existing Outreach placement');ok(await p.locator('#upcoming').count()===1,'upcoming outreach section retained');ok(await p.locator('[data-theme-song] button').count()===3&&await p.locator('[data-theme-song] a').count()===2,'Outreach only play/mute/share and download/giving');if(evidence)await p.locator('[data-theme-song]').screenshot({path:`${evidence}/${engine.name()}-outreach-${width}.png`});await ctx.close();
  }
 }finally{await browser.close();}
}
// Both routes remain static after the former qualification threshold and navigation.
const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const ctx=await browser.newContext({acceptDownloads:true});const p=await ctx.newPage();const requests=[];
 await ctx.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==base)return route.abort();if(['fetch','xhr','websocket'].includes(r.resourceType())||r.method()!=='GET')requests.push({method:r.method(),path:u.pathname});return route.continue();});
 for(const path of ['/outreach.html','/outreach/theme-song']) {
  await p.goto(base+path);await p.waitForFunction(()=>Number.isFinite(document.querySelector('[data-theme-song] audio').duration));
  await p.locator('[data-play]').click();await p.waitForFunction(()=>document.querySelector('[data-theme-song] audio').currentTime>5.5);await p.locator('[data-play]').click();
  ok(await p.locator('[data-total],[data-counter]').count()===0,'no counter after listening '+path);
  ok(requests.length===0,'no tracking/API traffic after five seconds '+path);
  ok((await ctx.cookies()).length===0&&await p.evaluate(()=>localStorage.length===0&&sessionStorage.length===0),'no tracking cookies or browser storage '+path);
 }
 await p.evaluate(()=>{Object.defineProperty(navigator,'share',{value:async value=>{window.sharedSong=value},configurable:true})});await p.locator('[data-share]').click();ok(await p.evaluate(()=>window.sharedSong.url==='https://championlifefwb.com/outreach/theme-song'),'native share contract');
 await p.evaluate(()=>{Object.defineProperty(navigator,'share',{value:async()=>{throw new DOMException('Cancelled','AbortError')},configurable:true})});await p.locator('[data-share]').click();ok(await p.locator('[data-copy-link]').isHidden(),'cancelled share does not show failure');
 await p.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied')}},configurable:true});});await p.locator('[data-share]').click();ok(await p.locator('[data-copy-link]').isVisible(),'manual selectable link if clipboard unavailable');
 await p.locator('audio').evaluate(a=>a.dispatchEvent(new Event('error')));ok((await p.locator('[data-status]').textContent()).includes('could not load'),'visible playback error');
 await p.locator('[data-give]').click();await p.waitForURL(base+'/outreach-giving.html');ok(await p.locator('iframe').getAttribute('src')==='https://www.community.givehub.com/forms/outreach-main-giving','giving click reaches unchanged existing page/form; external form not submitted');
 output.push({privacy:'No counter/API requests, cookies or browser storage on either route',requests});await ctx.close();
 const noJS=await browser.newContext({javaScriptEnabled:false});const fallback=await noJS.newPage();await noJS.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());await fallback.goto(base+'/outreach/theme-song');ok(await fallback.locator('audio[controls]').isVisible(),'native audio fallback without JavaScript');ok(await fallback.locator('[data-download]').isVisible()&&await fallback.locator('[data-give]').isVisible(),'download and giving remain available without JavaScript');await noJS.close();
}finally{await browser.close()}
if(evidence)await writeFile(evidence+'/browser-results.json',JSON.stringify({checks,output},null,2));console.log(`PASS ${checks} browser assertions`);
