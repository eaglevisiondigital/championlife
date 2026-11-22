import {resourceURL,worshipKind,videoId} from './core.mjs';
import {publicConfig,publicSchedule as scheduled,serviceKind,inFallbackWindow,discoveryReceipt,bookletFor} from './public-bridge.mjs';
import {mountBible} from './bible.mjs';
import {mountSchedule} from './config.mjs';
import {conversationPlan,desktopChatEnvironment,playerWidthLimit} from './engagement.mjs';
const config=publicConfig,$=id=>document.getElementById(id),workspace=$('worship-workspace');
let fallback=false,bookletSelection=null,bookletKey=null;
const mediaActive=false,mediaRequested=false,mediaSelection=null,invalidMedia=false,invalidService=false,requestedService=null;
let admitted={},receipts={},session=null,resource=null,resourceRevision=null,provider='youtube',viewerMode='watch-only',mountedKey=null,blockedKey=null,mediaGeneration=0,apiPromise=null;
let youtube=$('worship-player'),facebook=$('facebook-player'),boundaryTimer,pollTimer,expiryTimer,request=0,contextKey=null,active=true,blockedMessage='';
let youtubeAPI=null;
const youtubeFrameTemplate=youtube.cloneNode(false);
const selectedPlayback={};
const guestDrafts=new Map(),dismissed=new Set();
function viewportGeometry(){
 const view=window.visualViewport,height=view?.height||innerHeight,mobile=innerWidth<=980,root=document.documentElement;
 // Only use columns when both the supported player and readable notes fit.
 // A portrait keyboard cannot opt a narrow phone into this layout.
 const split=mobile&&innerWidth>=660&&innerWidth>innerHeight;
 workspace.dataset.compactSplit=String(split);
 root.style.setProperty('--watch-viewport-height',Math.floor(height)+'px');
 root.style.setProperty('--watch-player-width',playerWidthLimit(height)+'px');
 root.style.setProperty('--watch-viewport-offset',(mobile?Math.max(0,view?.offsetTop||0):0)+'px');
 const stage=document.querySelector('.video-stage').getBoundingClientRect().height;
 root.style.setProperty('--watch-sticky-height',(mobile&&!split?Math.ceil(stage):0)+'px');
 workspace.dataset.shortViewport=String(height<stage+96);
 $('viewport-help').hidden=height>=stage+96;
}

const localMode=null;
function frameFor(p){return p==='youtube'?youtube:facebook;}
function retireConversation(){const chat=$('conversation-frame');if(chat.getAttribute('src')&&chat.getAttribute('src')!=='about:blank')chat.src='about:blank';chat.dataset.target='';chat.hidden=true;$('conversation-scroll').hidden=true;}
function releaseYouTube({player,frame}){
 const current=frame===youtube,parent=frame.parentNode,next=frame.nextSibling,blank=current?youtubeFrameTemplate.cloneNode(false):null;
 if(blank){blank.removeAttribute('src');blank.hidden=true;}
 // destroy() removes its owned iframe. Never let a stale handle remove a newer one.
 let owned=frame;try{owned=player.getIframe?.()||frame;}catch{}
 if(owned===frame)try{player.destroy?.();}catch{}
 if(current&&frame===youtube){
  if(frame.parentNode)frame.replaceWith(blank);
  else if(parent?.isConnected)parent.insertBefore(blank,next?.parentNode===parent?next:null);
  youtube=blank;
 }
}
function stopPlayback(){retireConversation();mediaGeneration++;const retired=youtubeAPI;youtubeAPI=null;if(retired)releaseYouTube(retired);for(const f of [youtube,facebook]){if(f.getAttribute('src')&&f.getAttribute('src')!=='about:blank')f.src='about:blank';f.hidden=true;}mountedKey=null;}
function playerError(p,key,g,code=null){
 if(!active||provider!==p||mountedKey!==key||g!==mediaGeneration)return;
 blockedKey=key;selectedPlayback[p]='unavailable';
 blockedMessage=({100:'This video is unavailable or private. Use the original broadcast if available.',101:'The provider does not allow this video to be embedded. Use the original broadcast.',150:'The provider does not allow this video to be embedded. Use the original broadcast.',153:'The provider could not identify this embedded player. Use the original broadcast while this is reviewed.'})[code]||'This video cannot play here. Open the broadcast on its platform.';
 stopPlayback();paint();$('broadcast-message').textContent=blockedMessage;
}
function connectYouTube(frame,key,g){
 if(!apiPromise)apiPromise=new Promise(resolve=>{if(window.YT?.Player)return resolve();const prior=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{prior?.();resolve();};const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';document.head.append(s);});
 void apiPromise.then(()=>{
  if(!active||provider!=='youtube'||mountedKey!==key||g!==mediaGeneration||frame!==youtube)return;
  let player;try{player=new window.YT.Player(frame,{events:{onError:event=>playerError('youtube',key,g,event.data)}});}catch{playerError('youtube',key,g);return;}
  const registration={player,frame};
  if(!active||provider!=='youtube'||mountedKey!==key||g!==mediaGeneration||frame!==youtube)releaseYouTube(registration);
  else youtubeAPI=registration;
 });
}
function mountMedia(r){
 const p=provider,key=p+':'+r.identity;if(key===mountedKey)return;
 if(p==='facebook')$('facebook-recovery-status').textContent='';
 stopPlayback();const g=mediaGeneration,old=frameFor(provider),frame=old.cloneNode(false);old.replaceWith(frame);if(provider==='youtube')youtube=frame;else facebook=frame;
 mountedKey=key;admitted[provider]=Object.freeze({...r});frame.title=provider==='youtube'?'YouTube Broadcast Player':'Facebook Broadcast Player';frame.addEventListener('error',()=>playerError(p,key,g));frame.src=provider==='youtube'?(r.channelFallback?`https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(config.channelId)}&playsinline=1&rel=0`:`https://www.youtube.com/embed/${r.videoId}?playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`):'https://www.facebook.com/plugins/video.php?href='+encodeURIComponent(r.url)+'&show_text=false&width=1280';
 if(provider==='youtube'&&!r.channelFallback)connectYouTube(frame,key,g);
}
for(const p of ['youtube','facebook'])$('provider-'+p).onclick=()=>{if(provider===p)return;stopPlayback();provider=p;for(const n of ['youtube','facebook'])$('provider-'+n).setAttribute('aria-pressed',String(n===p));paint();};
// User-requested recovery only. A cross-origin frame load cannot prove playback.
$('reload-facebook').onclick=()=>{
 const current=admitted.facebook;
 if(!active||provider!=='facebook'||!current||mountedKey!=='facebook:'+current.identity)return;
 stopPlayback();mountMedia(current);paint();
 $('facebook-recovery-status').textContent='The Facebook player was reloaded. Playback is not confirmed. Your notes and Bible remain here.';
};
function cloud(){}
function applyContext(){
 const kind=serviceKind(Date.now(),location.search),mode=worshipKind(kind)?'worship':'prayer';
 workspace.dataset.layout=mode;workspace.dataset.serviceKind=kind||'';workspace.dataset.sessionId=session?.id||'';
 $('pastor').hidden=mode!=='worship';$('personal-title').textContent=mode==='prayer'?'My Prayer Notes':'My Personal Notes';$('guest-label').textContent=mode==='prayer'?'My Temporary Prayer Notes':'My Temporary Notes';
 $('workspace-eyebrow').textContent=mode==='prayer'?'YOUR PRAYER WORKSPACE':'YOUR SERVICE WORKSPACE';$('workspace-title').textContent=mode==='prayer'?'Pray. Listen. Remember.':'The Word. Your Next Step.';
 const context={organization:config.organization,id:session?.id||null,kind,startsAt:session?.startsAt||null,bookletId:session?.bookletId||null,preview:session?.bookletPreview===true&&!!localMode,mode};
 renderBooklet(kind);
 const key=JSON.stringify(context);if(key!==contextKey){contextKey=key;workspace.dataset.serviceContext=key;renderResource(resource);window.dispatchEvent(new CustomEvent('champion-service-context',{detail:context}));}
}
function renderResource(r){
 const root=$('pastor-content');root.replaceChildren();resourceRevision=r?.revision||null;$('resource-prompt').hidden=true;
 if(!r||workspace.dataset.layout!=='worship')return;
 const heading=document.createElement('h4');heading.textContent=r.title;root.append(heading);
 for(const b of r.blocks||[]){const el=document.createElement(({heading:'h4',text:'p',scripture:'blockquote',blank:'p'})[b.type]||'p');el.textContent=b.text;root.append(el);if(b.type==='blank'){const input=document.createElement('input');input.autocomplete='off';input.maxLength=1000;input.placeholder='Reflect here (temporary)';input.setAttribute('aria-label',b.text);root.append(input);}}
 for(const l of r.links||[]){const href=resourceURL(l.url,config);if(!href)continue;const a=document.createElement('a');a.href=href;a.textContent=l.label+' ↗';a.target='_blank';a.rel='noopener noreferrer';root.append(a);if(new URL(href).pathname.toLowerCase().endsWith('.pdf')){const details=document.createElement('details'),summary=document.createElement('summary'),frame=document.createElement('iframe');summary.textContent='View Resource Here';frame.title='Service Resource: '+l.label;frame.className='booklet-frame';frame.loading='lazy';details.append(summary,frame);details.addEventListener('toggle',()=>{if(details.open&&!frame.src)frame.src=href;});root.append(details);}}
 $('resource-prompt').hidden=!session||dismissed.has(`${session.id}:${r.revision}`);
}
$('dismiss-notes').onclick=()=>{dismissed.add(`${session?.id}:${resourceRevision}`);$('resource-prompt').hidden=true;};
$('open-notes').onclick=()=>{$('pastor-content').scrollIntoView({block:'nearest',behavior:'auto'});$('resource-prompt').hidden=true;};
$('copy-notes').onclick=async()=>{try{await navigator.clipboard.writeText($('guest-notes').value);$('guest-status').textContent='Copied. Keep your notes somewhere private.';}catch{$('guest-status').textContent='Copy is unavailable. Select and copy your notes before leaving.';}};
function conversations(now){
 const r=receipts[provider],current=admitted[provider],retained=current&&mountedKey===provider+':'+current.identity?current:null;
 const plan=conversationPlan({provider,receipt:r,admitted:retained,host:location.hostname,desktop:desktopChatEnvironment(),viewerMode,playerSupported:$('player-shell').clientWidth>=356,config,now,selectedMedia:mediaActive?mediaSelection:null,selectedState:selectedPlayback[provider]||'selected'});
 $('conversation-panel').hidden=viewerMode!=='participate';
 $('viewing-mode-help').textContent=viewerMode==='participate'?'Your browser may recognize your existing platform sign-in. If it does not, open the original conversation and sign in there. My Champion Life is not needed to comment.':'Watch an eligible public broadcast without joining the conversation. No My Champion Life account is needed to watch.';
 $('conversation-title').textContent=plan.title;$('chat-help').textContent=plan.help;
 const y=$('youtube-chat-link'),f=$('facebook-chat-link'),link=provider==='youtube'?y:f;y.hidden=provider!=='youtube';f.hidden=provider!=='facebook';link.href=plan.href;link.textContent=(plan.exactBroadcast?'Open The Original '+(provider==='youtube'?'YouTube':'Facebook')+' Conversation':'Open The '+(provider==='youtube'?'YouTube Channel':'Facebook Page'))+' (New Tab) ↗';
 $('open-broadcast').href=plan.href;$('open-broadcast').textContent='Open '+(provider==='youtube'?'YouTube':'Facebook')+' '+(plan.exactBroadcast?'Broadcast':provider==='youtube'?'Channel':'Page')+' (New\u00a0Tab)\u00a0↗';
 $('facebook-recovery').hidden=provider!=='facebook';$('facebook-recovery').open=provider==='facebook';
 $('facebook-recovery-link').href=plan.href;
 const chat=$('conversation-frame'),scroll=$('conversation-scroll');chat.dataset.support=plan.mode;scroll.setAttribute('aria-label',plan.title+' Scroll Area');
 $('tv-platform-link').href=plan.href;$('tv-platform-link').textContent=(plan.exactBroadcast?'Open This Broadcast In ':'Open The Channel On ')+(provider==='youtube'?'YouTube':'Facebook')+' (New Tab)';
 $('tv-provider-help').textContent=!plan.exactBroadcast?'An exact broadcast is not available yet. Open the selected channel to find its current broadcast and available TV options.':provider==='youtube'?'Open the original broadcast to see the viewing and TV controls offered by YouTube on your device. This website does not establish or verify a casting connection.':'Facebook TV options depend on your device. Open the original broadcast to see available controls, or use compatible device screen mirroring. This page cannot confirm a TV connection.';
 if(plan.iframeURL){if(chat.dataset.target!==plan.iframeURL){chat.src=plan.iframeURL;chat.dataset.target=plan.iframeURL;}chat.hidden=false;scroll.hidden=false;}
 else retireConversation();
}
// Viewing preference is local memory only; it does not inspect provider identity or remount media/notes.
for(const [id,mode]of [['watch-only','watch-only'],['watch-participate','participate']])$(id).onclick=()=>{
 if(!active||viewerMode===mode)return;viewerMode=mode;
 $('watch-only').setAttribute('aria-pressed',String(mode==='watch-only'));
 $('watch-participate').setAttribute('aria-pressed',String(mode==='participate'));
 conversations(Date.now());
};
function paint(){
 if(!active)return;viewportGeometry();clearTimeout(boundaryTimer);const now=Date.now(),schedule=scheduled(config,now),r=receipts[provider];let state=schedule.state;
 if(r&&now-r.checkedAt<90000)state=['live','completed'].includes(r.state)?r.state:(schedule.state==='pre-live'?'pre-live':r.state);else if(r)state=schedule.state==='pre-live'?'pre-live':'unavailable';
 const selected=null;
 const inWindow=provider==='youtube'&&inFallbackWindow(now);
 const candidate=inWindow&&r?.state==='candidate'&&now-r.checkedAt>=0&&now-r.checkedAt<90000&&!!r?.identity;
 const uncertain=inWindow&&(fallback||!r||['scheduled','unavailable'].includes(r.state));
 const key=candidate?'youtube:'+r.identity:r?.identity?provider+':'+r.identity:null;
 if(mediaActive)state=!selected?'unavailable':mountedKey===key?({ended:'video-ended',playing:'playing',paused:'paused'})[selectedPlayback[provider]]||'selected':'selected';
 if(mediaRequested&&!mediaActive)state='unavailable';
 if(provider==='facebook')state='unavailable';
 if(candidate)state='candidate-broadcast';
 else if(uncertain)state='channel-fallback';
 if(key&&key===blockedKey)state='unavailable';
 const min=provider==='youtube'?356:220,narrow=$('player-shell').clientWidth<min;
 if(narrow&&mountedKey){stopPlayback();if(mediaActive&&state!=='unavailable')state='selected';}
 $('broadcast-state').textContent=({live:'LIVE','channel-fallback':'CHECK YOUTUBE','candidate-broadcast':'CHECK BROADCAST',completed:'COMPLETED','video-ended':'VIDEO ENDED','pre-live':'STARTING SHORTLY',scheduled:'SCHEDULED',unavailable:'BROADCAST UNAVAILABLE',selected:'SELECTED BROADCAST',playing:'PLAYING',paused:'PAUSED'})[state];$('broadcast-state').dataset.state=state;
 $('gathering-name').textContent=session?.title||(mediaActive?mediaSelection.title:null)||schedule.gathering?.name||'Gather With Us';
 $('broadcast-message').textContent=narrow?'Open the broadcast on its platform for a player that fits this screen.':state==='live'?'Join us in worship and the Word.':state==='completed'?'This gathering has ended. The recording may be available.':state==='pre-live'?'We’re preparing to gather. Video starts when the broadcast is verified.':state==='unavailable'?'We can’t confirm this platform’s broadcast right now. You can open its page below.':schedule.gathering?new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,weekday:'long',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(schedule.gathering.startsAt):'We look forward to gathering with you.';
 if(provider==='facebook')$('broadcast-message').textContent='Open Champion Life’s original Facebook page below to find the current broadcast. Facebook controls availability and may request its own sign-in. The video is not embedded here because playback could not be confirmed on iPhone.';
 if(state==='channel-fallback')$('broadcast-message').textContent='We cannot verify the broadcast automatically. Open Champion Life Live directly on YouTube below; an old channel-based embed is not a reliable fallback.';
 if(state==='candidate-broadcast')$('broadcast-message').textContent='A possible current broadcast was found on Champion Life YouTube. Live status is not verified. Press play or open the original video to confirm.';
 $('waiting-label').textContent=state==='pre-live'?'WE’LL BEGIN SHORTLY':'YOU BELONG HERE';$('waiting-title').textContent=state==='pre-live'?(schedule.gathering?.name||'Let’s Gather.'):'Let’s Gather.';$('waiting-detail').textContent=state==='pre-live'?'Prepare your heart. We’re gathering soon.':'Worship. The Word. A life of faith.';
 if(state==='candidate-broadcast'&&!narrow)mountMedia(r);
 else if(selected&&['selected','playing','paused','video-ended'].includes(state)&&!narrow)mountMedia(selected);
 else if(!mediaActive&&r?.identity&&['live','completed'].includes(state)&&!narrow)mountMedia(r);
 else if(mountedKey)stopPlayback();
 const show=!!mountedKey&&mountedKey.startsWith(provider+':')&&!narrow;frameFor(provider).hidden=!show;$('waiting-design').hidden=show;
 applyContext();conversations(now);viewportGeometry();
 boundaryTimer=setTimeout(paint,Math.max(1,Math.min(2147483647,Math.min(schedule.nextBoundary,r?.state==='live'&&r.checkedAt+90000>now?r.checkedAt+90000:Infinity)-now)));
}
async function refresh(){
 const g=++request;clearTimeout(pollTimer);
 try{const response=await fetch('/.netlify/functions/youtube-live?t='+Date.now(),{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();const text=await response.text();if(text.length>4096)throw Error();const d=JSON.parse(text);if(!active||g!==request)return;
  receipts={youtube:discoveryReceipt(d),facebook:{state:'unavailable',checkedAt:Date.now()}};fallback=false;
 }catch{if(!active||g!==request)return;receipts={youtube:{state:'unavailable',checkedAt:Date.now()},facebook:{state:'unavailable',checkedAt:Date.now()}};fallback=true;}
 paint();clearTimeout(expiryTimer);expiryTimer=setTimeout(paint,90000);pollTimer=setTimeout(refresh,60000);
}
$('fullscreen').onclick=async()=>{try{await $('player-shell').requestFullscreen();}catch{$('broadcast-message').textContent='Use the player’s full-screen control or open the broadcast on its platform.';}};
const tv=$('tv-guidance'),tvButton=$('watch-tv');tvButton.onclick=()=>{tv.open=!tv.open;tvButton.setAttribute('aria-expanded',String(tv.open));if(tv.open){tv.querySelector('summary').focus({preventScroll:true});tv.scrollIntoView({block:'nearest',behavior:'auto'});}};tv.addEventListener('toggle',()=>tvButton.setAttribute('aria-expanded',String(tv.open)));
$('share').onclick=async()=>{const url=new URL('/watch.html',location.origin);if(session)url.searchParams.set('service',session.id);try{if(navigator.share)await navigator.share({title:'Champion Life — Gather With Us',url:url.href});else await navigator.clipboard.writeText(url.href);}catch{}};
window.addEventListener('resize',paint);window.visualViewport?.addEventListener('resize',paint);window.visualViewport?.addEventListener('scroll',paint);window.addEventListener('focus',()=>{paint();void refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){paint();void refresh();}});
window.addEventListener('pagehide',()=>{active=false;request++;clearTimeout(boundaryTimer);clearTimeout(pollTimer);clearTimeout(expiryTimer);guestDrafts.clear();$('guest-notes').value='';stopPlayback();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
mountSchedule($('gatherings'),config);cloud(null);mountBible($('bible'));paint();void refresh();

function renderBooklet(kind){
 const root=$('published-booklet-host'),booklet=bookletFor(kind,bookletSelection),key=booklet?.url||'prayer';if(key===bookletKey)return;bookletKey=key;root.replaceChildren();if(!booklet)return;
 const label=document.createElement('label');label.textContent='Published booklet archive';const select=document.createElement('select');select.id='booklet-selection';select.setAttribute('aria-label','Published Booklet Service');for(const [v,t]of [['sunday-worship','Sunday'],['wednesday-worship','Wednesday']]){const o=document.createElement('option');o.value=v;o.textContent=t;select.append(o);}select.value=booklet.kind;select.onchange=()=>{bookletSelection=select.value;renderBooklet(serviceKind(Date.now(),location.search));};label.append(select);
 const heading=document.createElement('h4');heading.textContent=booklet.title;const notice=document.createElement('p');notice.textContent='Published '+booklet.date+' · Archived '+(booklet.kind==='sunday-worship'?'Sunday':'Wednesday')+' booklet. A newer service booklet is not yet verified here.';
 const link=document.createElement('a');link.href=booklet.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open This Published Booklet (New Tab) ↗';
 const frame=document.createElement('iframe');frame.className='publisher-live-frame';frame.title=booklet.title+' — '+booklet.date;frame.loading='lazy';frame.referrerPolicy='no-referrer';frame.setAttribute('sandbox','allow-scripts');frame.src=booklet.url;
 root.append(label,heading,notice,link,frame);
}
