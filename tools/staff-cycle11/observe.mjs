import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {observe as observeRoutes} from '../staff-cycle10/observer.mjs';
import {ids} from '../staff-cycle8/modules-fixture.mjs';
import {installInitiation} from './initiation.mjs';
export async function observe(options) {
 const {page,getPhase}=options,events=[];let overflow=false,actor='account-A';
 const file=resolve(process.env.DIAGNOSTIC_DIR||'/tmp/staff-cycle11-diagnostic','initiation-observations.json');
 const record=value=>{try{if(events.length>=2000){overflow=true;return}events.push({receivedAt:Date.now(),phase:getPhase(),fixtureActorAtObservation:actor,...value})}catch{overflow=true}};
 page.on('console',message=>{if(message.type()==='debug'&&message.text().startsWith('CYCLE11_INIT ')){try{record(JSON.parse(message.text().slice(13)))}catch{overflow=true}}});
 await page.addInitScript({content:`(${function(install,accounts){
  const documentId=crypto.randomUUID();let sequence=0;
  const state=()=>({documentId,sequence:++sequence,documentPath:location.pathname,readyState:document.readyState,visibility:document.visibilityState,formsConnected:!!document.getElementById('forms-app')?.isConnected});
  const record=value=>console.debug('CYCLE11_INIT '+JSON.stringify(value));
  install(window,record,state,accounts);
  for(const type of ['beforeunload','pagehide','pageshow','visibilitychange'])addEventListener(type,event=>record({kind:'lifecycle',type,time:Date.now(),trusted:event.isTrusted,persisted:event.persisted??null,...state()}));
 }.toString()})(${installInitiation.toString()},${JSON.stringify({a:ids.a,b:ids.b})});`});
 const existing=await observeRoutes(options);
 const fixture=new Proxy(existing.fixture,{get(target,key){if(key==='setActor')return value=>{const next=value===ids.a?'account-A':value===ids.b?'account-B':'other';record({kind:'fixture-actor-change',from:actor,to:next});actor=next;return target.setActor(value)};return target[key]}});
 const flush=()=>{mkdirSync(resolve(file,'..'),{recursive:true});writeFileSync(file,JSON.stringify({events,overflow,scope:'fixed fictional request initiation only; original promise untouched',noRootCauseClaim:true},null,2)+'\n')};
 page.on('close',flush);process.once('exit',flush);
 return {fixture,flush:()=>{existing.flush();flush()}};
}
