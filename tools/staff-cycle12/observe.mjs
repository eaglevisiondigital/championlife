import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {observe as observeInitiation} from '../staff-cycle11/observe.mjs';
import {ids} from '../staff-cycle8/modules-fixture.mjs';
import {installNavigationGate} from './gate.mjs';
export async function observe(options) {
 const {page,getPhase}=options, mode=process.env.CYCLE12_ARM;
 assert(['auth-after-pagehide','rpc-across-pagehide','settled-before-pagehide'].includes(mode),'explicit bounded arm');
 const events=[],faults=[];let armed=false,authCount=0,selected=false,completed=false,overflow=false,gateDocument=null;
 const directory=resolve(process.env.DIAGNOSTIC_DIR);
 const record=(kind,data={})=>{if(events.length>=500){overflow=true;return}events.push({kind,receivedAt:Date.now(),phase:getPhase(),...data})};
 page.on('console',message=>{if(message.type()==='debug'&&message.text().startsWith('CYCLE12_GATE ')){
  try{const event=JSON.parse(message.text().slice(13));record(event.kind,event);if(event.kind==='leave-selected')gateDocument=event.documentId}catch{faults.push('INVALID_GATE_EVENT')}
 }});
 await page.addInitScript({content:`(${function(install){
  const documentId=crypto.randomUUID();let sequence=0;
  const record=event=>console.debug('CYCLE12_GATE '+JSON.stringify({...event,documentId,sequence:++sequence,path:location.pathname,formsConnected:!!document.getElementById('forms-app')?.isConnected}));
  install(window,record);
  addEventListener('pagehide',event=>record({kind:'pagehide',time:Date.now(),trusted:event.isTrusted}));
 }.toString()})(${installNavigationGate.toString()});`});
 const existing=await observeInitiation(options);
 const waitUntil=async(predicate,label)=>{
  const start=Date.now();while(!predicate()) {if(Date.now()-start>4500)throw Error('GATE_WAIT_'+label);await new Promise(r=>setTimeout(r,10));}
 };
 const release=async()=>{
  await page.waitForFunction(()=>window.__cycle12Gate?.ready,{},{timeout:4500});
  assert.equal(await page.evaluate(()=>window.__cycle12Gate.release()),true,'one original callback released');
 };
 const afterPagehide=()=>waitUntil(()=>events.some(e=>e.kind==='pagehide'&&e.documentId===gateDocument),'PAGEHIDE');
 const fixture=new Proxy(existing.fixture,{get(target,key){
  if(key==='setActor')return value=>{armed=value===ids.b;return target.setActor(value)};
  if(key!=='backend')return target[key];
  return async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   let sub;try{sub=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub}catch{}
   const relevant=armed&&getPhase()==='account-replacement'&&sub===ids.b;
   try {
    if(relevant&&path==='/auth/v1/user'&&++authCount===2){
     assert.equal(await page.evaluate(()=>!!document.getElementById('forms-app')?.isConnected),false,'target Auth begins after root detachment');
     await waitUntil(()=>gateDocument!==null,'SELECTED');
     selected=true;record('target-auth',{authOrdinal:authCount});
     if(mode==='auth-after-pagehide'){
      record('hold-auth');await release();await afterPagehide();record('release-auth-after-pagehide');
      const result=await target.backend(route);completed=true;return result;
     }
    }
    if(relevant&&selected&&path==='/rest/v1/rpc/forms_workspace'){
     assert.equal(req.postDataJSON()?.p_action,'context','only natural refresh context RPC');
     record('target-rpc');
     if(mode==='rpc-across-pagehide'){
      record('hold-rpc');await release();await afterPagehide();record('release-rpc-after-pagehide');
      const result=await target.backend(route);completed=true;return result;
     }
     if(mode==='settled-before-pagehide'){
      const result=await target.backend(route);
      await page.waitForFunction(id=>window.ChampionLifeFormsContext?.context?.user?.id===id,ids.b,{timeout:4500});
      record('refresh-settled');await release();completed=true;return result;
     }
    }
    return await target.backend(route);
   }catch(error){faults.push(String(error.message).slice(0,300));record('intervention-failed');throw error;}
  };
 }});
 const flush=()=>{mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,'intervention.json'),JSON.stringify({mode,events,faults,overflow,selected,completed,authCount,strictAssertionChanged:false,fixtureTimingIntervention:true,originalCause:'UNKNOWN'},null,2)+'\n')};
 page.on('close',flush);process.once('exit',flush);
 return {fixture,flush:()=>{existing.flush();flush()}};
}
