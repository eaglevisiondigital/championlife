'use strict';
// Public Champion Life channel lookup. Never assert LIVE from an unverified
// YouTube page or an unrelated recommended video. No API keys or user data.
const CHANNEL_ID = 'UCG7j8eiL-qW8nzr2Sg7o2oA';
// Explicitly supplied by Champion Life for this service. Never carry this
// recovery selection into a later gathering or label it verified LIVE.
const SERVICE_VIDEO = Object.freeze({id:'RMSPr30f6W8',startsAt:Date.parse('2026-11-22T16:30:00Z'),expiresAt:Date.parse('2026-11-22T19:00:00Z')});
const ROUTES = [
  'https://www.youtube.com/@ChampionLifeFWB/live',
  'https://www.youtube.com/channel/' + CHANNEL_ID + '/live'
];
const ID = /^[A-Za-z0-9_-]{11}$/;
const HEADERS = {
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, max-age=10, s-maxage=20',
  'access-control-allow-origin':'*'
};
const BROWSER = {'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36','accept-language':'en-US,en;q=0.9'};
function redirectVideoId(location,base) {
  try {
    const url=new URL(location,base);
    if(!['www.youtube.com','youtube.com','m.youtube.com'].includes(url.hostname)||url.protocol!=='https:'||url.username||url.password||url.port)return null;
    const path=url.pathname;
    const id=path==='/watch'?url.searchParams.get('v'):/^\/live\/([A-Za-z0-9_-]{11})\/?$/.exec(path)?.[1];
    return ID.test(id||'')?id:null;
  } catch {return null;}
}
function details(html) {
  if(typeof html!=='string')return null;
  // The canonical player response owns the broadcast identity and live state.
  // ytInitialData also contains UI objects named videoDetails (for example
  // playerOverlayVideoDetailsRenderer); those are not broadcast records.
  // Never infer LIVE from recommendations, overlays, or nearby live flags.
  const pattern=/(?:\bytInitialPlayerResponse|window\["ytInitialPlayerResponse"\])\s*=\s*\{/g;
  let match,inspected=0,found=null;
  while((match=pattern.exec(html))!==null) {
    if(++inspected>8)return null; // ambiguous/unbounded document: fail closed
    const opening=match.index+match[0].length-1;
    const limit=Math.min(html.length,opening+1048576);
    let depth=0,inString=false,escaped=false,end=-1;
    for(let i=opening;i<limit;i++){
      const c=html[i];
      if(inString){
        if(escaped)escaped=false;
        else if(c==='\\')escaped=true;
        else if(c==='"')inString=false;
      }else if(c==='"')inString=true;
      else if(c==='{')depth++;
      else if(c==='}'&&--depth===0){end=i+1;break;}
    }
    if(end<0)return null;
    let player;
    try{player=JSON.parse(html.slice(opening,end));}catch{return null;}
    const value=player?.videoDetails;
    if(!value||Array.isArray(value)||typeof value!=='object'||
      !ID.test(value.videoId||'')||
      !/^UC[A-Za-z0-9_-]{22}$/.test(value.channelId||''))return null;
    const current={id:value.videoId,channel:value.channelId,live:value.isLive===true};
    if(found&&(found.id!==current.id||found.channel!==current.channel||found.live!==current.live))return null;
    found=current;
  }
  return found;
}

async function youtubeFetch(url,redirect) {
  return fetch(url,{redirect,headers:BROWSER,signal:AbortSignal.timeout(2400)});
}
function diagnostic(response,body,route) {
  return {route,status:response.status,bytes:body.length,playerAssignments:(body.match(/(?:\bytInitialPlayerResponse|window\["ytInitialPlayerResponse"\])\s*=\s*\{/g)||[]).length,pageTitle:((/<title[^>]*>([^<]*)<\/title>/i.exec(body)||[])[1]||'').slice(0,160)};
}
async function checkCandidate(id,checks=[],route='redirect-video') {
  try {
    const response=await youtubeFetch('https://www.youtube.com/watch?v='+id,'follow');
    const body=(await response.text()).slice(0,2000000);
    checks.push(diagnostic(response,body,route));
    if(!response.ok)return {id,live:false};
    const d=details(body);
    if(d&&d.id!==id)return null;
    if(d&&d.channel!==CHANNEL_ID)return null;
    return {id,live:!!d?.live};
  } catch(error){checks.push({route,error:error?.name||'Error'});return {id,live:false};}
}
exports.handler=async function() {
  let uncertain=false,unverifiedCandidate=null;
  const now=Date.now(),checks=[];
  const selected=now>=SERVICE_VIDEO.startsAt&&now<SERVICE_VIDEO.expiresAt?SERVICE_VIDEO:null;
  // Run the known service URL alongside discovery, within the existing timeout
  // budget. A successful channel discovery still wins without a manual pin.
  const selectedCheck=selected?checkCandidate(selected.id,checks,'selected-service-video'):null;
  for (const route of ROUTES) {
    try {
      const response=await youtubeFetch(route,'manual');
      if(response.status>=300&&response.status<400) {
        const id=redirectVideoId(response.headers.get('location')||'',route);
        if(!id)continue;
        checks.push({route:route.includes('@')?'handle-live':'channel-live',status:response.status,redirectVideoId:id});
        const candidate=await checkCandidate(id,checks);
        if(!candidate){uncertain=true;continue;}
        if(candidate.live)return {statusCode:200,headers:HEADERS,body:JSON.stringify({live:true,videoId:id,source:'youtube-live-route-verified'})};
        unverifiedCandidate={live:false,videoId:null,candidateVideoId:id,source:'youtube-live-route-unverified'};
        continue;
      }
      const body=(await response.text()).slice(0,2000000);
      checks.push(diagnostic(response,body,route.includes('@')?'handle-live':'channel-live'));
      if(!response.ok){uncertain=true;continue;}
      const parsed=details(body);
      if(parsed?.channel===CHANNEL_ID&&parsed.live)
        return {statusCode:200,headers:HEADERS,body:JSON.stringify({live:true,videoId:parsed.id,source:'youtube-live-page-verified'})};
      if(parsed?.channel===CHANNEL_ID){
        unverifiedCandidate={live:false,videoId:null,candidateVideoId:parsed.id,source:'youtube-live-page-unverified'};
        continue;
      }
      // An ordinary channel page or a bot/consent page proves neither live nor offline.
      uncertain=true;
    } catch(error) {checks.push({route:route.includes('@')?'handle-live':'channel-live',error:error?.name||'Error'});uncertain=true;}
  }
  const verifiedSelection=await selectedCheck;
  if(verifiedSelection?.live)return {statusCode:200,headers:HEADERS,body:JSON.stringify({live:true,videoId:selected.id,source:'youtube-service-video-verified'})};
  if(selected&&verifiedSelection)return {statusCode:200,headers:HEADERS,body:JSON.stringify({live:false,videoId:null,candidateVideoId:selected.id,source:'church-selected-service-video',expiresAt:selected.expiresAt,checks})};
  if(unverifiedCandidate)return {statusCode:200,headers:HEADERS,body:JSON.stringify(unverifiedCandidate)};
  return {statusCode:200,headers:HEADERS,body:JSON.stringify({live:false,videoId:null,error:uncertain?'provider-not-verified':'channel-not-live-confirmed',checks})};
};
