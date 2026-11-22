// Shared tenant-scoped scheduling, public resource validation, and exact YouTube evidence.
export const champion = Object.freeze({
  organization:'11111111-1111-4111-8111-111111111111', name:'Champion Life', timezone:'America/New_York',
  channelId:'UCG7j8eiL-qW8nzr2Sg7o2oA', giving:'/giving-portal', logo:'/assets/images/logo-gold.png',
  facebookPage:'ChampionLifeFWB', facebook:'https://www.facebook.com/ChampionLifeFWB',
  resources:['https://championlifefwb.com','https://www.inrevival.com'],
  schedule:[{key:'morning-prayer',name:'Morning Prayer',days:[1,2,3,4,5],hour:6,minute:0},
    {key:'sunday-prayer',name:'Sunday Prayer',days:[0],hour:7,minute:0},
    {key:'sunday-worship',name:'Sunday Worship Service',days:[0],hour:10,minute:30},
    {key:'wednesday-worship',name:'Wednesday Worship Service',days:[3],hour:19,minute:30}]
});
export const worshipKind=kind=>['sunday-worship','wednesday-worship'].includes(kind);
export const youtubeChannelURL=config=>/^UC[\w-]{22}$/.test(config?.channelId||'')?'https://www.youtube.com/channel/'+config.channelId+'/live':'https://www.youtube.com/';
export function facebookVideo(value,config=champion){
 try{const u=new URL(value),p=u.pathname.split('/');return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&u.hostname==='www.facebook.com'&&p[1]===config.facebookPage&&p[2]==='videos'&&/^[0-9]{5,24}$/.test(p[3]||'')&&(p.length===4||p.length===5&&p[4]==='')?u.href:null;}catch{return null;}
}
export function broadcastReceipt(value,provider,config=champion,now=Date.now()){
 if(!value||!['live','completed','scheduled','unavailable'].includes(value.state)||!Number.isFinite(value.checkedAt)||value.checkedAt>now+5000)throw Error('Invalid broadcast evidence');
 if(provider==='youtube'){
  if(value.videoId&&!videoId(value.videoId)||['live','completed'].includes(value.state)&&!videoId(value.videoId))throw Error('Exact YouTube video required');
  const id=videoId(value.videoId);return {...value,videoId:id,provider,identity:id,url:id?'https://www.youtube.com/watch?v='+id:youtubeChannelURL(config)};
 }
 const url=facebookVideo(value.url,config),verified=value.verified===true&&value.public===true&&value.embeddable===true&&value.page===config.facebookPage;
 if(['live','completed'].includes(value.state)&&(!url||!verified))throw Error('Verified public Facebook broadcast required');
 return {...value,provider,identity:url,url:url||config.facebook};
}
export function videoId(value) {
  if(typeof value!=='string')return null;
  if(/^[\w-]{11}$/.test(value))return value;
  try {const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
    let id;if(u.hostname==='youtu.be')id=u.pathname.slice(1);
    else if(['www.youtube.com','youtube.com','m.youtube.com'].includes(u.hostname))
      id=u.pathname==='/watch'?u.searchParams.get('v'):/^\/(?:live|embed)\/([\w-]{11})\/?$/.exec(u.pathname)?.[1];
    return /^[\w-]{11}$/.test(id||'')?id:null;
  }catch{return null;}
}
const parts=(date,zone)=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
function instant(y,m,d,h,min,zone){
  const target=Date.UTC(y,m-1,d,h,min);let utc=target;
  for(let i=0;i<4;i++){const p=parts(new Date(utc),zone);const delta=target-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);utc+=delta;if(!delta)return utc;}
  throw Error('Unsupported ambiguous or missing gathering local time');
}
export function gatherings(config,now=Date.now()){
  const p=parts(new Date(now),config.timezone), result=[];
  for(let delta=-1;delta<=8;delta++){
    const date=new Date(Date.UTC(p.year,p.month-1,p.day+delta));
    for(const r of config.schedule)if(r.days.includes(date.getUTCDay())){
      const y=date.getUTCFullYear(),m=date.getUTCMonth()+1,d=date.getUTCDate();
      const startsAt=instant(y,m,d,r.hour,r.minute,config.timezone);
      result.push({...r,sessionKey:`${r.key}:${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`,startsAt,preliveAt:startsAt-300000});
    }
  }
  return result.sort((a,b)=>a.startsAt-b.startsAt);
}
export function scheduled(config,now=Date.now()){
  const all=gatherings(config,now), next=all.find(x=>x.startsAt>now);
  const waiting=all.find(x=>now>=x.preliveAt&&now<x.startsAt);
  return {state:waiting?'pre-live':'scheduled',gathering:waiting||next,
    nextBoundary:Math.min(...all.flatMap(x=>[x.preliveAt,x.startsAt]).filter(t=>t>now))};
}
export function classify(item,config,now=Date.now()){
  const at=Date.parse(item?.checkedAt);
  if(!Number.isFinite(at)||at>now+5000||now-at>90000||!videoId(item?.id)||item?.snippet?.channelId!==config.channelId||item?.status?.privacyStatus!=='public'||item?.status?.embeddable!==true)return {state:'unavailable',videoId:null};
  const d=item.liveStreamingDetails||{}, started=Date.parse(d.actualStartTime), ended=Date.parse(d.actualEndTime);
  if(Number.isFinite(ended)&&ended<=now)return {state:'completed',videoId:item.id};
  if(item.snippet.liveBroadcastContent==='live'&&Number.isFinite(started)&&started<=now&&!d.actualEndTime)return {state:'live',videoId:item.id};
  if(item.snippet.liveBroadcastContent==='upcoming'&&Number.isFinite(Date.parse(d.scheduledStartTime)))return {state:'scheduled',videoId:item.id};
  return {state:'unavailable',videoId:null};
}
export function selectBroadcast(items,config,now=Date.now(),override=null){
  if(override){const id=videoId(override);if(!id)return {state:'unavailable',videoId:null};const item=items.find(v=>v.id===id);return classify(item,config,now);}
  const live=items.map(v=>classify(v,config,now)).filter(v=>v.state==='live');
  if(live.length===1)return live[0];
  if(live.length>1)return {state:'unavailable',videoId:null,reason:'ambiguous'};
  const upcoming=items.filter(v=>classify(v,config,now).state==='scheduled').sort((a,b)=>Date.parse(a.liveStreamingDetails.scheduledStartTime)-Date.parse(b.liveStreamingDetails.scheduledStartTime));
  return upcoming.length===1?{state:'scheduled',videoId:upcoming[0].id}:{state:'unavailable',videoId:null};
}
export function resourceURL(value,config){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&config.resources.includes(u.origin)?u.href:null;}catch{return null;}
}
export function validateResource(value,config){
  if(!value||typeof value.title!=='string'||!value.title.trim()||value.title.length>180||!Array.isArray(value.blocks)||value.blocks.length>80)throw Error('Invalid notes');
  const blocks=value.blocks.map(b=>{if(!['heading','text','scripture','blank'].includes(b.type)||typeof b.text!=='string'||b.text.length>4000)throw Error('Invalid block');return {type:b.type,text:b.text};});
  const links=(value.links||[]).map(r=>{const url=resourceURL(r.url,config);if(!url||typeof r.label!=='string'||r.label.length>100)throw Error('Invalid resource');return {label:r.label,url};});
  if(links.length>8)throw Error('Too many resources');return {title:value.title,blocks,links};
}
