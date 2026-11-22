import{champion,videoId,facebookVideo}from'./core.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export function viewerConfig(value,{hostname}={}){
 const local=hostname==='127.0.0.1';if(value==null&&local)return {...champion,personalNotes:true,localSynthetic:true};
 if(!value)return {...champion,organization:null,personalNotes:false,localSynthetic:false};
 if(!uuid(value.organization)||!local&&value.organization===champion.organization||typeof value.timezone!=='string'||!/^UC[\w-]{22}$/.test(value.channelId)||!/^[A-Za-z0-9.]+$/.test(value.facebookPage))throw Error('Verified tenant configuration required');
 new Intl.DateTimeFormat('en-US',{timeZone:value.timezone}).format();
 const schedule=value.schedule||champion.schedule;if(!Array.isArray(schedule)||!schedule.length||schedule.some(r=>typeof r.key!=='string'||typeof r.name!=='string'||r.name.length>100||Object.keys(r).some(k=>!['key','name','days','hour','minute'].includes(k))||!Array.isArray(r.days)||!r.days.length||r.days.some(d=>!Number.isInteger(d)||d<0||d>6)||!Number.isInteger(r.hour)||r.hour<0||r.hour>23||!Number.isInteger(r.minute)||r.minute<0||r.minute>59))throw Error('Tenant schedule required');
 const resources=value.resources||champion.resources;if(!Array.isArray(resources)||resources.length>16||resources.some(v=>{try{const u=new URL(v);return u.protocol!=='https:'||u.origin!==v;}catch{return true;}}))throw Error('Approved resource origins required');
 if(value.personalNotes!=null&&typeof value.personalNotes!=='boolean')throw Error('Explicit personal-note acceptance flag required');
 return Object.freeze({...champion,resources,timezone:value.timezone,schedule,organization:value.organization,channelId:value.channelId,facebookPage:value.facebookPage,facebook:'https://www.facebook.com/'+value.facebookPage,personalNotes:value.personalNotes===true,localSynthetic:false});
}
export function selectedService(search){const p=new URLSearchParams(search);if(!p.has('service'))return null;if(p.getAll('service').length!==1||!uuid(p.get('service')))throw Error('Exact service selection required');return p.get('service');}
export function mountSchedule(root,config){
 const grid=root?.querySelector('.schedule-grid');if(!grid)return;const doc=root.ownerDocument;
 const days=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
 root.querySelector('p').textContent='All times '+config.timezone+(config.timezone==='America/New_York'?' (Eastern Time).':'.');
 grid.replaceChildren(...config.schedule.map(r=>{const article=doc.createElement('article'),label=doc.createElement('span'),name=doc.createElement('h3'),time=doc.createElement('p');label.textContent=r.days.join(',')==='1,2,3,4,5'?'MONDAY–FRIDAY':r.days.map(d=>days[d]).join(', ');name.textContent=r.name;time.textContent=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',hour:'numeric',minute:'2-digit'}).format(new Date(Date.UTC(2000,0,1,r.hour,r.minute)));article.append(label,name,time);return article;}));
}

// Public video selection for a separately approved private QA project only.
// This is not a canonical tenant/session, a LIVE receipt, or an account grant.
export const MEDIA_ONLY_QA='owner-selected-qa-media';
export function mediaQAHostname(project,hostname){
 if(typeof project!=='string'||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.netlify\.app$/.test(project))return false;
 return hostname===project||typeof hostname==='string'&&hostname.length===project.length+26&&
  /^[a-f0-9]{24}--/.test(hostname)&&hostname.slice(26)===project;
}
export function mediaOnlyQAConfig(value,{origin,tenant=champion}={}){
 if(value==null)return null;
 const keys=['mode','projectHostname','channelId','facebookPage','kind','title','youtubeVideoId','facebookURL'];
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value))||
  Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k))||value.mode!==MEDIA_ONLY_QA)
  throw Error('An exact public-media QA configuration is required.');
 const u=new URL(origin),local=u.hostname==='127.0.0.1'&&u.protocol==='http:';
 if(u.origin!==origin||u.username||u.password||!mediaQAHostname(value.projectHostname,value.projectHostname)||
  !local&&(u.protocol!=='https:'||u.port||!mediaQAHostname(value.projectHostname,u.hostname)))
  throw Error('The media selection is restricted to its approved QA project.');
 if(value.channelId!==tenant.channelId||value.facebookPage!==tenant.facebookPage||
  !tenant.schedule.some(r=>r.key===value.kind))throw Error('The media selection must match the tenant and gathering type.');
 if(typeof value.title!=='string'||!value.title.trim()||value.title.length>180||/[\u0000-\u001f\u007f]/.test(value.title))
  throw Error('A bounded, readable broadcast title is required.');
 const youtube=value.youtubeVideoId,facebook=value.facebookURL;
 if(youtube!==null&&(typeof youtube!=='string'||videoId(youtube)!==youtube)||
  facebook!==null&&(typeof facebook!=='string'||facebookVideo(facebook,tenant)!==facebook)||
  youtube===null&&facebook===null)throw Error('Use an exact YouTube ID and an approved Facebook video URL.');
 return Object.freeze({...value,title:value.title.trim()});
}
export function mediaOnlyQATarget(selection,provider){
 if(selection?.mode!==MEDIA_ONLY_QA)return null;
 if(provider==='youtube'&&videoId(selection.youtubeVideoId)===selection.youtubeVideoId&&selection.youtubeVideoId)
  return Object.freeze({provider,identity:selection.youtubeVideoId,videoId:selection.youtubeVideoId,
   url:'https://www.youtube.com/watch?v='+selection.youtubeVideoId,provenance:MEDIA_ONLY_QA});
 if(provider==='facebook'&&selection.facebookURL&&facebookVideo(selection.facebookURL,{facebookPage:selection.facebookPage})===selection.facebookURL)
  return Object.freeze({provider,identity:selection.facebookURL,url:selection.facebookURL,provenance:MEDIA_ONLY_QA});
 return null;
}
