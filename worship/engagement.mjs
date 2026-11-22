// Official platform destinations only. No messages, identities, OAuth or delivery assertions.
import{videoId,facebookVideo,youtubeChannelURL}from'./core.mjs';
import{MEDIA_ONLY_QA,mediaQAHostname,mediaOnlyQATarget}from'./config.mjs';
export function desktopChatEnvironment(nav=globalThis.navigator,media=query=>globalThis.matchMedia?.(query)){
 const mobile=nav?.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod/i.test(nav?.userAgent||'')||(nav?.platform==='MacIntel'&&nav?.maxTouchPoints>1)||(media?.('(pointer:coarse)')?.matches&&media?.('(hover:none)')?.matches);
 return !mobile;
}
// Keep the provider's minimum 200px player height while leaving room below it.
// Width is capped by the actual workspace in CSS; narrow devices use a handoff.
export function playerWidthLimit(height){return Math.ceil(Math.max(200,Number.isFinite(height)&&height>0?height*.45:200)*16/9);}
export function conversationPlan({provider,receipt,admitted,host,desktop,playerSupported=true,viewerMode='watch-only',config,now=Date.now(),selectedMedia=null,selectedState=null}){
 const selection=selectedMedia?.mode===MEDIA_ONLY_QA&&selectedMedia.channelId===config.channelId&&
  selectedMedia.facebookPage===config.facebookPage&&(mediaQAHostname(selectedMedia.projectHostname,host)||host==='127.0.0.1')?
  mediaOnlyQATarget(selectedMedia,provider):null;
 const target=admitted||(selection&&(!receipt||receipt.state==='unavailable')?selection:receipt),participating=viewerMode==='participate';
 const watchingHelp='Watch without opening the platform conversation. No My Champion Life sign-in is needed to watch.';
 if(provider==='facebook'){const exact=facebookVideo(target?.url,config);return {href:exact||config.facebook,exactBroadcast:!!exact,iframeURL:null,mode:participating?'direct-platform-required':'watch-only',title:'Facebook Conversation',help:participating?'Join the original Facebook conversation. Use Facebook’s own identity controls for your profile or an eligible Page.':watchingHelp};}
 const id=videoId(target?.videoId),href=id?'https://www.youtube.com/watch?v='+id:youtubeChannelURL(config);
 const fresh=receipt?.state==='live'&&Number.isFinite(receipt.checkedAt)&&receipt.checkedAt<=now+5000&&now-receipt.checkedAt<90000&&videoId(receipt.videoId)===id;
 // A church-selected service video is an explicitly authorized exact broadcast
 // selection. It may open its matching official chat even when server-side
 // discovery is unavailable; this never upgrades its LIVE verification state.
 const selectedServiceChat=admitted?.provenance==='church-selected-broadcast'&&
  admitted.provider==='youtube'&&admitted.identity===id&&videoId(admitted.videoId)===id&&
  ['selected','playing','paused'].includes(selectedState)&&
  receipt?.state==='candidate'&&videoId(receipt.videoId)===id;
 // An owner-selected QA conversation remains explicitly unverified and isolated.
 const selectedChat=!!selection&&admitted?.provenance===MEDIA_ONLY_QA&&admitted.provider==='youtube'&&
  admitted.identity===selection.identity&&videoId(admitted.videoId)===selection.videoId&&
  ['selected','playing','paused'].includes(selectedState)&&(!receipt||receipt.state==='unavailable')&&
  (!receipt?.videoId||videoId(receipt.videoId)===selection.videoId);
 let validHost=false;try{const u=new URL('https://'+host);validHost=u.hostname===host&&!u.port&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash;}catch{}
 const iframeURL=participating&&desktop&&playerSupported&&(fresh||selectedChat||selectedServiceChat)&&id&&validHost?'https://www.youtube.com/live_chat?'+new URLSearchParams({v:id,embed_domain:host}):null;
 return {href,exactBroadcast:!!id,iframeURL,mode:!participating?'watch-only':iframeURL?(selectedChat||selectedServiceChat)?'official-selected-chat-unverified':'official-embed-unverified':desktop&&playerSupported?'awaiting-live-chat':'direct-platform-required',title:selection?'Original YouTube Conversation':'YouTube Live Chat',help:!participating?watchingHelp:iframeURL?(selectedChat||selectedServiceChat)?'Official conversation for the selected broadcast. YouTube controls availability, sign-in and comments. This page has not verified comment delivery.':'Official chat for this broadcast. YouTube controls sign-in and commenting. If chat is blank or your existing session is not recognized, use the original conversation below and sign in on YouTube if requested.':!playerSupported?'This screen is too narrow for the supported player. Open the original broadcast and conversation on its platform.':selection&&selectedState==='ended'?'The selected video has ended in this player. Open the original broadcast for any recording and chat replay the provider makes available.':receipt?.state==='completed'?'This gathering has ended. Open the original broadcast for any available recording and chat replay.':desktop?(selection||selectedServiceChat)?'The provider controls conversation availability. If the embedded player is unavailable, use the original broadcast below.':'The original conversation is available on YouTube. Embedded chat appears when this broadcast is confirmed live.':'YouTube does not support embedded Live Chat on mobile web. Open the original conversation and keep this workspace for your notes and Bible.'};
}
