// Independent public Watch bridge acceptance. Network responses are intercepted
// fictional fixtures; this is not actual provider or physical-device acceptance.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.env.WATCH_ROOT||'.');
const evidence=resolve(process.env.WATCH_EVIDENCE||'/tmp/champion-watch-browser');
const {chromium,webkit}=await import(pathToFileURL(resolve(process.env.WATCH_PLAYWRIGHT||'tools/backend-tests/node_modules/playwright/index.mjs')));
mkdirSync(evidence,{recursive:true});
const origin='https://championlifefwb.com',video='Abc123XYZ_0';
const delta=process.env.WATCH_DELTA==='1';
let checks=0,current='setup';const results=[];
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const mime=p=>({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'}[extname(p)]||'application/octet-stream');
const geometry=page=>page.evaluate(()=>{
 const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
 return {video:r('#player-shell'),left:r('.left-workspace'),right:r('.worship-notebook'),scroll:r('#service-content'),overflow:document.documentElement.scrollWidth>innerWidth,split:document.querySelector('#worship-workspace').dataset.compactSplit};
});
const viewports=[{name:'desktop',width:1440,height:900},{name:'portrait',width:390,height:844},{name:'landscape',width:844,height:390},{name:'small-landscape',width:667,height:375}];
const cspFile=join(root,'_headers');
const toml=readFileSync(join(root,'netlify.toml'),'utf8');
const csp=existsSync(cspFile)?(/Content-Security-Policy:\s*(.*)/.exec(readFileSync(cspFile,'utf8'))?.[1]):(/Content-Security-Policy\s*=\s*"([^"]*)"/.exec(toml)?.[1]);
async function fixture(browser,v,clock='2026-11-22T16:35:00Z',initial={live:true,videoId:video}){
 const context=await browser.newContext({viewport:{width:v.width,height:v.height},...(v.name==='desktop'?{}:{hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'})});
 const trace={writes:0,privateRequests:0,detector:0,players:0,unexpected:[],errors:[]};
 const state={response:initial,pending:[]};
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(req.method()!=='GET'){trace.writes++;return route.abort();}
  if(u.origin===origin){
   if(u.pathname==='/.netlify/functions/youtube-live'){
    trace.detector++;
    if(state.response==='pending')return new Promise(resolve=>state.pending.push({route,resolve}));
    if(state.response==='transport')return route.abort('failed');
    if(state.response==='http')return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    return route.fulfill({contentType:'application/json',body:JSON.stringify(state.response)});
   }
   if(u.pathname.startsWith('/api/')||/auth|supabase|notebook\.js|installation\.js/.test(u.pathname)){trace.privateRequests++;return route.abort();}
   const p=resolve(root,'.'+decodeURIComponent(u.pathname));
   if(!p.startsWith(root+'/')||!existsSync(p)){trace.unexpected.push(u.pathname);return route.fulfill({status:404,body:'Fixture unavailable'});}
   return route.fulfill({body:readFileSync(p),contentType:mime(p),headers:csp?{'Content-Security-Policy':csp}:{}});
  }
  if(u.hostname==='www.youtube.com'&&u.pathname==='/iframe_api')return route.fulfill({contentType:'text/javascript',body:`window.__owned=[];window.YT={Player:function(frame,options){this.getIframe=()=>frame;this.destroy=()=>frame.remove();window.__owned.push({frame,options,player:this});}};window.onYouTubeIframeAPIReady();`});
  if(u.hostname==='www.youtube.com'&&u.pathname.startsWith('/embed/')){trace.players++;return route.fulfill({contentType:'text/html',body:'<body style="background:#111;color:white">SYNTHETIC PROVIDER: no real playback</body>'});}
  if(u.hostname==='www.youtube.com'&&u.pathname==='/live_chat')return route.fulfill({contentType:'text/html',body:'SYNTHETIC CONVERSATION'});
  if(u.hostname==='champion-life-sermon-booklets.netlify.app')return route.fulfill({contentType:'text/html',body:'<body>Fictional booklet fixture. This is not content acceptance.</body>'});
  trace.unexpected.push(u.origin+u.pathname);return route.abort();
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>trace.errors.push(e.message));
 await page.clock.install({time:new Date(clock)});
 await page.goto(origin+'/watch.html');
 await page.getByRole('heading',{name:'John 1',exact:true}).waitFor();
 return {context,page,trace,state};
}
try{
 for(const [engineName,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch();
  try{
   for(const v of delta?[]:viewports){
    current=engineName+'-'+v.name;
    const {context,page,trace,state}=await fixture(browser,v);
    try{
     await page.waitForFunction(()=>document.querySelector('#broadcast-state').dataset.state==='live');
     const g=await geometry(page);ok(!g.overflow,'no horizontal page overflow');
     ok(Math.abs(g.video.width/g.video.height-16/9)<.03,'16:9 video geometry');
     if(v.name!=='portrait')ok(g.video.right<=g.right.x+1,'desktop/landscape has video left, content right');
     ok(await page.locator('#watch-only').getAttribute('aria-pressed')==='true','anonymous Watch Only default');
     ok(await page.locator('#conversation-frame').isHidden(),'no conversation until selected');
     ok(await page.locator('#worship-player').getAttribute('src').then(s=>s.includes('/embed/'+video)),'public detector supplies exact video');
     ok(await page.locator('#worship-workspace').getAttribute('data-service-kind')==='sunday-worship','current Sunday worship context remains after start');
     ok(await page.locator('#pastor').isVisible(),'worship booklet panel available');
     ok(await page.locator('#booklet-selection').inputValue()==='sunday-worship','Sunday archive selected for worship');
     ok(await page.locator('#published-booklet-host').textContent().then(t=>t.includes('2026-11-15')&&t.includes('Archived')),'Sunday archive has honest date and archive label');
     await page.locator('#booklet-selection').selectOption('wednesday-worship');
     ok(await page.locator('#published-booklet-host iframe').getAttribute('src')==='https://champion-life-sermon-booklets.netlify.app/booklets/wednesday-2026-11-18-service-notes/','Wednesday exact approved archive');
     ok(await page.locator('#published-booklet-host iframe').getAttribute('sandbox')==='allow-scripts','booklet has opaque sandbox');
     const frame=await page.locator('#worship-player').elementHandle(),mounted=trace.players;
     await page.locator('#guest-notes').fill('Synthetic confidential note — MiXeD Case');
     await page.locator('#bible-chapter').fill('2');await page.locator('#bible-form').evaluate(f=>f.requestSubmit());
     await page.getByRole('heading',{name:'John 2',exact:true}).waitFor();
     const beforeContentScroll=await geometry(page);
     await page.locator('#service-content').evaluate(e=>e.scrollTop=350);
     ok(await frame.evaluate(e=>e===document.querySelector('#worship-player'))&&trace.players===mounted,'notes/Bible preserve mounted video');
     const scrollGeometry=await geometry(page);ok(Math.abs(scrollGeometry.video.y-beforeContentScroll.video.y)<1,'content scrolling preserves video position');
     await page.setViewportSize({width:v.width,height:v.height-1});await page.setViewportSize({width:v.width,height:v.height});
     ok(await frame.evaluate(e=>e===document.querySelector('#worship-player'))&&trace.players===mounted,'resize preserves mounted video');
     await page.locator('#watch-participate').evaluate(e=>e.click());
     ok(trace.players===mounted,'participation selection preserves video');
     ok(await page.locator('#youtube-chat-link').getAttribute('href')==='https://www.youtube.com/watch?v='+video,'conversation handoff exact original provider');
     if(v.name!=='desktop')ok(await page.locator('#conversation-frame').isHidden(),'mobile uses native provider handoff');
     await page.locator('#provider-facebook').evaluate(e=>e.click());
     ok(await page.locator('#facebook-player').isHidden(),'unknown Facebook broadcast never fabricated');
     ok(await page.locator('#open-broadcast').getAttribute('href')==='https://www.facebook.com/ChampionLifeFWB','Facebook handoff official page');
     ok(await page.locator('#open-broadcast').isVisible(),'Facebook handoff always available');
     ok(await page.locator('#guest-notes').inputValue()==='Synthetic confidential note — MiXeD Case','provider switch preserves exact temporary notes');
     await page.locator('#provider-youtube').evaluate(e=>e.click());
     await page.waitForFunction(()=>!document.querySelector('#worship-player').hidden);
     await page.evaluate(()=>{scrollTo(0,document.querySelector('#worship-workspace').getBoundingClientRect().top+scrollY);document.querySelector('#service-content').scrollTop=0;});
     await page.screenshot({path:join(evidence,current+'-synthetic.png')});
     ok(trace.writes===0&&trace.privateRequests===0,'no writes or private/Auth API');
     ok(trace.errors.length===0,'no browser application errors');
     ok(trace.unexpected.length===0,'no unexpected network dependency');
     results.push({case:current,geometry:g,trace,synthetic:true});
    }finally{await context.close();}
   }
   // Only new bridge boundaries are exercised; existing media suites are reused.
   for(const scenario of [
    {name:'offline',clock:'2026-11-21T20:00:00Z',response:{live:false,videoId:null},expected:'scheduled'},
    {name:'soon',clock:'2026-11-22T16:10:00Z',response:{live:false,videoId:null},expected:'pre-live'},
    {name:'transport-service',clock:'2026-11-22T16:35:00Z',response:'transport',expected:'channel-fallback'},
    {name:'http-service',clock:'2026-11-22T16:35:00Z',response:'http',expected:'channel-fallback'},
    {name:'invalid-video',clock:'2026-11-22T16:35:00Z',response:{live:true,videoId:'https://evil.invalid/'},expected:'channel-fallback'},
     {name:'unverified-candidate-service',clock:'2026-11-22T16:35:00Z',response:{live:false,videoId:null,candidateVideoId:video},expected:'candidate-broadcast'},
    {name:'error-outside-window',clock:'2026-11-21T20:00:00Z',response:'transport',expected:'unavailable'},
    {name:'sunday-prayer',clock:'2026-11-22T13:00:00Z',response:{live:true,videoId:video},expected:'live',prayer:true},
    {name:'weekday-prayer',clock:'2026-11-24T12:10:00Z',response:{live:true,videoId:video},expected:'live',prayer:true},
    {name:'wednesday',clock:'2026-11-19T00:35:00Z',response:{live:true,videoId:video},expected:'live',wednesday:true}
   ].filter(()=>!delta)){
    current=engineName+'-'+scenario.name;
    const {context,page,trace}=await fixture(browser,viewports[0],scenario.clock,scenario.response);
    try{
     await page.waitForFunction(s=>document.querySelector('#broadcast-state').dataset.state===s,scenario.expected);
     if(scenario.expected==='channel-fallback'){
      ok(await page.locator('#worship-player').isHidden(),'unverified status never mounts deprecated channel embed');
      ok((await page.locator('#broadcast-message').textContent()).includes('cannot verify'),'fallback does not claim verified LIVE');
      ok((await page.locator('#open-broadcast').getAttribute('href')).endsWith('/live'),'direct channel live route remains available');
     }
     if(scenario.expected==='candidate-broadcast'){
      ok((await page.locator('#worship-player').getAttribute('src')).includes('/embed/'+video),'candidate uses exact video ID rather than channel embed');
      ok((await page.locator('#broadcast-message').textContent()).includes('not verified'),'candidate does not claim verified LIVE');
     }
     if(['scheduled','pre-live','unavailable'].includes(scenario.expected))ok(await page.locator('#worship-player').isHidden(),'offline/unavailable has no misleading player');
     if(scenario.prayer){ok(await page.locator('#pastor').isHidden(),'prayer hides sermon panel');ok(await page.locator('#published-booklet-host iframe').count()===0,'prayer removes stale booklet iframe');}
     if(scenario.wednesday)ok(await page.locator('#booklet-selection').inputValue()==='wednesday-worship','Wednesday selects Wednesday archive');
     ok(trace.writes===0&&trace.privateRequests===0&&trace.errors.length===0,'scenario preserves anonymous readonly boundary');
     results.push({case:current,state:scenario.expected,trace,synthetic:true});
    }finally{await context.close();}
   }
   current=engineName+'-stale-response';
   if(!delta){
    const {context,page,trace,state}=await fixture(browser,viewports[0]);
    try{
     await page.waitForFunction(()=>document.querySelector('#broadcast-state').dataset.state==='live');
     state.response='pending';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
     for(let i=0;i<100&&state.pending.length===0;i++)await new Promise(r=>setTimeout(r,20));
     ok(state.pending.length===1,'exactly one bounded deferred request');
     const old=state.pending.shift();state.response={live:false,videoId:null};
     await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
     await page.waitForFunction(()=>document.querySelector('#broadcast-state').dataset.state==='channel-fallback');
     await old.route.fulfill({contentType:'application/json',body:JSON.stringify({live:true,videoId:'Zyx987ABC_1'})});old.resolve();
     await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
     ok(await page.locator('#broadcast-state').getAttribute('data-state')==='channel-fallback','late superseded live response ignored');
     ok(await page.locator('#worship-player').isHidden(),'late superseded response cannot restore old player');
     results.push({case:current,trace,synthetic:true});
    }finally{for(const pending of state.pending){await pending.route.abort().catch(()=>{});pending.resolve();}await context.close();}
   }
   current=engineName+'-expired-receipt-pending-refresh';
   {
    const {context,page,trace,state}=await fixture(browser,viewports[0]);
    try{
     await page.waitForFunction(()=>document.querySelector('#broadcast-state').dataset.state==='live');
     state.response='pending';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
     for(let i=0;i<100&&state.pending.length===0;i++)await new Promise(r=>setTimeout(r,20));
     ok(state.pending.length===1,'one outstanding refresh before stale expiry');
     await page.clock.setSystemTime(new Date('2026-11-22T16:36:31Z'));
     await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
     ok(await page.locator('#broadcast-state').getAttribute('data-state')==='unavailable','expired evidence cannot retain LIVE label');
     ok(await page.locator('#worship-player').isHidden(),'expired evidence retires old live iframe');
     ok((await page.locator('#worship-player').getAttribute('src'))!=='https://www.youtube.com/embed/'+video,'old source not active');
     results.push({case:current,trace,synthetic:true});
    }finally{for(const pending of state.pending){await pending.route.abort().catch(()=>{});pending.resolve();}await context.close();}
   }
   current=engineName+'-channel-error-no-loop';
   {
    const {context,page,trace}=await fixture(browser,viewports[0],'2026-11-22T16:35:00Z','transport');
    try{
     await page.waitForFunction(()=>document.querySelector('#broadcast-state').dataset.state==='channel-fallback');
     const count=trace.players;
     await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('resize'));});
     ok(await page.locator('#worship-player').isHidden(),'uncertain service has no deprecated channel player');
     ok(trace.players===count,'uncertain service never mounts deprecated channel player');
     ok(await page.locator('#open-broadcast').isVisible(),'original provider handoff survives embed failure');
     results.push({case:current,trace,synthetic:true});
    }finally{await context.close();}
   }
   for(const [name,time]of [['monday-prayer','2026-11-23T12:10:00Z'],['sunday-seven-prayer','2026-11-22T13:10:00Z']]){
    current=engineName+'-'+name;
    const {context,page,trace}=await fixture(browser,viewports[1],time);
    try{
     ok(await page.locator('#pastor').isHidden(),'owner-approved prayer schedule hides sermon');
     ok(await page.locator('#published-booklet-host iframe').count()===0,'no Sunday/Wed booklet loaded during prayer');
     ok(await page.locator('#personal-title').textContent()==='My Prayer Notes','prayer notes visible');
     await page.locator('#personal').evaluate(e=>e.scrollIntoView({block:'start'}));
     const g=await geometry(page);ok(g.video.y>=0&&g.video.y<100,'mobile video stays sticky while reaching notes');
     ok(g.video.bottom<=844,'sticky mobile video remains on screen');
     await page.screenshot({path:join(evidence,current+'-synthetic.png')});
     results.push({case:current,geometry:g,trace,synthetic:true});
    }finally{await context.close();}
   }
  }finally{await browser.close();}
 }
 writeFileSync(join(evidence,'RESULT.json'),JSON.stringify({status:'PASS',checks,cspApplied:!!csp,results,realProviderPlayback:false,realBookletReadback:false,physicalDevices:false},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',checks,cases:results.length,cspApplied:!!csp}));
}catch(e){writeFileSync(join(evidence,'FAILURE.json'),JSON.stringify({status:'FAIL',case:current,message:e.message,stack:e.stack},null,2)+'\n');throw e;}
