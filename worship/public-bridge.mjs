// Public-only bridge to the existing production discovery endpoint. No Auth,
// synthetic organization, staff authority, QA recording or Publisher dependency.
import {champion,gatherings,videoId} from './core.mjs';
export const publicConfig=Object.freeze({...champion,organization:null,personalNotes:false,localSynthetic:false,
 timezone:'America/Chicago',giving:'/give.html',schedule:[
 {key:'morning-prayer',name:'Morning Prayer',days:[1,2,3,4,5],hour:6,minute:0},
 {key:'sunday-prayer',name:'Sunday Prayer',days:[0],hour:7,minute:0},
 {key:'sunday-worship',name:'Sunday Worship Service',days:[0],hour:10,minute:30},
 {key:'wednesday-worship',name:'Wednesday Worship Service',days:[3],hour:18,minute:30}]});
const localParts=now=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:publicConfig.timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
export function publicSchedule(config=publicConfig,now=Date.now()){
 const all=gatherings(config,now),end=g=>g.startsAt+(['morning-prayer','sunday-prayer'].includes(g.key)?60:g.key==='sunday-worship'?150:150)*60000;
 const active=all.find(g=>now>=g.startsAt&&now<=end(g));
 const upcoming=all.find(g=>g.startsAt>now),waiting=upcoming&&now>=upcoming.startsAt-25*60000;
 return {state:waiting?'pre-live':'scheduled',gathering:active||upcoming,
 nextBoundary:Math.min(...all.flatMap(g=>[g.startsAt-25*60000,g.startsAt,end(g)+1]).filter(t=>t>now))};
}
export function serviceKind(now=Date.now(),search=''){
 const p=localParts(now),mins=Number(p.hour)*60+Number(p.minute),requested=new URLSearchParams(search).get('gathering');
 // Prayer never inherits the Sunday worship booklet, even if an archive was selected.
 if(requested==='prayer'||p.weekday==='Sun'&&mins<10*60+5)return 'sunday-prayer';
 return publicSchedule(publicConfig,now).gathering?.key||'morning-prayer';
}
export function inFallbackWindow(now=Date.now()){
 const p=localParts(now),mins=Number(p.hour)*60+Number(p.minute);
 return p.weekday==='Sun'&&mins>=630&&mins<=780||p.weekday==='Wed'&&mins>=1110&&mins<=1260;
}
export function discoveryReceipt(data,now=Date.now()){
 if(!data||typeof data.live!=='boolean'||data.error||data.live&&videoId(data.videoId)!==data.videoId)throw Error('Invalid discovery response');
 const candidate=data.candidateVideoId;
 if(candidate!=null&&(videoId(candidate)!==candidate||data.live))throw Error('Untrusted YouTube candidate');
 if(data.live)return {state:'live',checkedAt:now,provider:'youtube',identity:data.videoId,videoId:data.videoId,url:'https://www.youtube.com/watch?v='+data.videoId,provenance:'youtube-verified-live'};
 if(data.videoId!==null)throw Error('Unexpected inactive video');
 if(candidate){
  const selected=data.source==='church-selected-service-video';
  if(selected&&(!Number.isFinite(data.expiresAt)||now>=data.expiresAt))throw Error('Expired service video');
  return {state:'candidate',checkedAt:now,provider:'youtube',identity:candidate,videoId:candidate,url:'https://www.youtube.com/watch?v='+candidate,provenance:selected?'church-selected-broadcast':'youtube-unverified-candidate',...(selected?{expiresAt:data.expiresAt}:{})};
 }
 return {state:'scheduled',checkedAt:now,provider:'youtube',identity:null,videoId:null};
}
export const archiveBooklets=Object.freeze([
 Object.freeze({id:'sunday-2026-11-22',kind:'sunday-worship',date:'2026-11-22',title:'Light Be — Part Two',url:'/booklets/light-be-part-two/index.html',current:true}),
 Object.freeze({id:'sunday-2026-11-15',kind:'sunday-worship',date:'2026-11-15',title:'Light Be — Part One',url:'https://champion-life-sermon-booklets.netlify.app/booklets/light-be-part-one/',current:false}),
 Object.freeze({id:'wednesday-2026-11-18',kind:'wednesday-worship',date:'2026-11-18',title:'Rich, Refreshed, Blessed — Part Two',url:'https://champion-life-sermon-booklets.netlify.app/booklets/wednesday-2026-11-18-service-notes/',current:false})
]);
export function bookletFor(kind,selection){
 if(!['sunday-worship','wednesday-worship'].includes(kind))return null;
 return selection ? archiveBooklets.find(b=>b.id===selection)||null : archiveBooklets.find(b=>b.kind===kind)||null;
}
