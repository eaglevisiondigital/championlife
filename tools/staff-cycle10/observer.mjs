// Bounded observation of the existing fictional fixture. No response, request or runtime changes.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ids} from '../staff-cycle8/modules-fixture.mjs';
const label=value=>value===ids.a?'account-A':value===ids.b?'account-B':value===ids.o?'organization-A':value===ids.other?'organization-B':value==null?'absent':'other';
const headers=value=>Object.fromEntries(Object.entries(value||{}).filter(([key])=>['access-control-allow-origin','access-control-allow-credentials','access-control-allow-headers','access-control-allow-methods','content-type','vary','origin','sec-fetch-mode','sec-fetch-site'].includes(key.toLowerCase())).map(([k,v])=>[k.toLowerCase(),String(v).slice(0,256)]));
const safeURL=value=>{try{const u=new URL(value);return {origin:u.origin,path:u.pathname,scope:label(u.searchParams.get('organization')||u.searchParams.get('org'))}}catch{return {path:'unavailable'}}};
export async function observe({page,context,fixture,getPhase,backend}){
 const events=[],requestIds=new WeakMap();let nextRequest=0,documentEpoch=0,currentActor=ids.a,overflow=false;
 const file=resolve(process.env.DIAGNOSTIC_DIR||'/tmp/staff-cycle10-diagnostic','legacy-observations.json');
 const record=(kind,data={})=>{try{if(events.length>=5000){overflow=true;return}events.push({kind,time:Date.now(),phase:getPhase(),documentEpoch,...data})}catch{overflow=true}};
 const requestInfo=req=>{
  if(!requestIds.has(req))requestIds.set(req,++nextRequest);
  let frame;try{frame=safeURL(req.frame().url())}catch{frame={path:'detached'}}
  let principal;try{principal=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub}catch{}
  let payload;try{payload=req.postDataJSON()}catch{}
  return {requestId:requestIds.get(req),url:safeURL(req.url()),method:req.method(),resourceType:req.resourceType(),frame,principal:label(principal),fixtureActor:label(currentActor),action:typeof payload?.p_action==='string'?payload.p_action:null,organization:label(payload?.p_org),requestHeaders:headers(req.headers())};
 };
 const relevant=req=>{try{return new URL(req.url()).origin===backend}catch{return false}};
 page.on('framenavigated',frame=>{if(frame===page.mainFrame()){documentEpoch++;record('document-commit',{url:safeURL(frame.url())})}});
 page.on('request',req=>{if(relevant(req))record('request',requestInfo(req))});
 page.on('response',response=>{if(relevant(response.request()))record('response',{...requestInfo(response.request()),status:response.status(),responseHeaders:headers(response.headers())})});
 page.on('requestfinished',req=>{if(relevant(req))record('requestfinished',{...requestInfo(req),timing:req.timing()})});
 page.on('requestfailed',req=>{if(relevant(req))record('requestfailed',{...requestInfo(req),failure:req.failure()})});
 page.on('pageerror',error=>record('pageerror',{message:error.message,stack:error.stack}));
 page.on('console',message=>{
  if(message.type()==='error')record('console-error',{message:message.text(),location:message.location()});
  if(message.type()==='debug'&&message.text().startsWith('CYCLE10_LIFECYCLE ')){
   try{record('browser-lifecycle',JSON.parse(message.text().slice(18)))}catch{record('invalid-diagnostic-event')}
  }
 });
 await page.addInitScript(()=>{
  const documentId=crypto.randomUUID();
  for(const type of ['beforeunload','pagehide','pageshow','visibilitychange'])addEventListener(type,event=>console.debug('CYCLE10_LIFECYCLE '+JSON.stringify({type,documentId,time:Date.now(),path:location.pathname,persisted:event.persisted??null,readyState:document.readyState,visibility:document.visibilityState,formsConnected:!!document.getElementById('forms-app')?.isConnected,trusted:event.isTrusted})));
 });
 const wrapped=new Proxy(fixture,{get(target,key){
  if(key==='setActor')return value=>{record('fixture-actor-change',{from:label(currentActor),to:label(value)});currentActor=value;return target.setActor(value)};
  if(key==='backend')return route=>{
   const request=route.request();record('route-received',requestInfo(request));
   const observed=new Proxy(route,{get(targetRoute,property){
    if(property==='fulfill')return options=>{
      const info=requestInfo(request);record('route-fulfill-intent',{...info,status:options.status??200,responseHeaders:headers(options.headers)});
      const result=targetRoute.fulfill(options);
      result.then(()=>record('route-fulfill-resolved',info),error=>record('route-fulfill-rejected',{...info,reason:String(error?.message||'').includes('Target page, context or browser has been closed')?'target-closed':'other',errorName:['Error','TypeError'].includes(error?.name)?error.name:'other'}));
      return result;
    };
    if(property==='abort')return (...args)=>{record('route-abort-intent',{...requestInfo(request),code:typeof args[0]==='string'&&/^[a-z]+$/.test(args[0])?args[0].slice(0,40):null});return targetRoute.abort(...args)};
    const value=targetRoute[property];return typeof value==='function'?value.bind(targetRoute):value;
   }});
   return target.backend(observed);
  };
  return target[key];
 }});
 const flush=()=>{mkdirSync(resolve(file,'..'),{recursive:true});writeFileSync(file,JSON.stringify({events,overflow,observationOnly:true,rawHeadersBodiesTokensRecorded:false,scope:'exact legacy WebKit390 Forms; all acceptance predicates unchanged'},null,2)+'\n')};
 page.on('close',flush);process.once('exit',flush);
 return {fixture:wrapped,flush};
}
