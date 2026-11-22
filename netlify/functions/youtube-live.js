'use strict';
// Public Champion Life channel lookup. Never assert LIVE from an unverified
// YouTube page or an unrelated recommended video. No API keys or user data.
const CHANNEL_ID = 'UCG7j8eiL-qW8nzr2Sg7o2oA';
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
  const start=html.indexOf('"videoDetails":{');
  if(start<0)return null;
  const section=html.slice(start,start+24000);
  const id=/"videoDetails":\{"videoId":"([A-Za-z0-9_-]{11})"/.exec(section)?.[1];
  const channel=/"channelId":"(UC[A-Za-z0-9_-]{22})"/.exec(section)?.[1];
  if(!id||!channel)return null;
  return {id,channel,live:/"isLive":true(?:[,}])/.test(section)};
}
async function youtubeFetch(url,redirect) {
  return fetch(url,{redirect,headers:BROWSER,signal:AbortSignal.timeout(2400)});
}
async function checkCandidate(id) {
  try {
    const response=await youtubeFetch('https://www.youtube.com/watch?v='+id,'follow');
    if(!response.ok)return {id,live:false};
    const body=(await response.text()).slice(0,2000000);
    const d=details(body);
    if(d&&d.id!==id)return null;
    if(d&&d.channel!==CHANNEL_ID)return null;
    return {id,live:!!d?.live};
  } catch{return {id,live:false};}
}
exports.handler=async function() {
  let uncertain=false;
  for (const route of ROUTES) {
    try {
      const response=await youtubeFetch(route,'manual');
      if(response.status>=300&&response.status<400) {
        const id=redirectVideoId(response.headers.get('location')||'',route);
        if(!id)continue;
        const candidate=await checkCandidate(id);
        if(!candidate){uncertain=true;continue;}
        if(candidate.live)return {statusCode:200,headers:HEADERS,body:JSON.stringify({live:true,videoId:id,source:'youtube-live-route-verified'})};
        return {statusCode:200,headers:HEADERS,body:JSON.stringify({live:false,videoId:null,candidateVideoId:id,source:'youtube-live-route-unverified'})};
      }
      if(!response.ok){uncertain=true;continue;}
      const body=(await response.text()).slice(0,2000000);
      const parsed=details(body);
      if(parsed?.channel===CHANNEL_ID&&parsed.live)
        return {statusCode:200,headers:HEADERS,body:JSON.stringify({live:true,videoId:parsed.id,source:'youtube-live-page-verified'})};
      if(parsed?.channel===CHANNEL_ID)
        return {statusCode:200,headers:HEADERS,body:JSON.stringify({live:false,videoId:null,candidateVideoId:parsed.id,source:'youtube-live-page-unverified'})};
      // An ordinary channel page or a bot/consent page proves neither live nor offline.
      uncertain=true;
    } catch {uncertain=true;}
  }
  return {statusCode:200,headers:HEADERS,body:JSON.stringify({live:false,videoId:null,error:uncertain?'provider-not-verified':'channel-not-live-confirmed'})};
};
