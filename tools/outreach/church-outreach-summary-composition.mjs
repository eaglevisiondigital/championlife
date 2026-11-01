// Nonpublic, fictional-data-compatible composition boundary for PR61 + PR63 + PR65/66.
// Does NOT mount into the live staff shell or supply provider authorization.
import {createCampaignSummaryReader} from './campaign-summary.mjs';
import {createCampaignSummaryLifecycle} from './campaign-summary-lifecycle.mjs';

/**
 * Bind only a verified, server-authorized session/RPC implementation.
 * subscribeEvent must be provided by the trusted future staff shell consumer;
 * no DOM, Supabase or network client is introduced by this package.
 */
export function createChurchOutreachSummaryComposition({
 getVerifiedSession,rpc,onSnapshot=()=>{},subscribeEvent=()=>()=>{}
}={}){
 if(typeof getVerifiedSession!=='function'||typeof rpc!=='function'||
    typeof onSnapshot!=='function'||typeof subscribeEvent!=='function')
   throw new TypeError('Trusted session, RPC, snapshot and event bindings required');

 const reader=createCampaignSummaryReader({getVerifiedSession,rpc});
 const lifecycle=createCampaignSummaryLifecycle({reader,onSnapshot});
 let closed=false;
 const unsubs=[];
 const close=()=>{
  if(closed)return;
  closed=true;
  try{lifecycle.close()}
  finally{for(const unsub of unsubs.splice(0))unsub()}
 };
 try{
  // These exact event names are already emitted by frozen PR61. A protected
  // clear is permanent in that shell; do not silently reacquire a session.
  for(const name of ['staff-protected-clear','pagehide']){
   const unsub=subscribeEvent(name,close);
   if(typeof unsub!=='function')throw new TypeError('Event subscription must support cleanup');
   unsubs.push(unsub);
  }
 }catch(error){close();throw error}
 return Object.freeze({
  select:campaignId=>lifecycle.select(campaignId),
  refresh:()=>lifecycle.refresh(),
  revoke:()=>lifecycle.revoke(),
  snapshot:()=>lifecycle.snapshot(),
  close
 });
}
