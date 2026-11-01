// Unmounted source-only binding: PR61 staff shell → PR67 read-only summary composition.
// No new Auth client, provider configuration, credentials or public UI.
// Trust the verified provider's getUser(), NOT an injected client-side "verified" flag.
import {createChurchOutreachSummaryComposition} from './church-outreach-summary-composition.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure=code=>Object.assign(new Error(code),{code});

export function createChurchOutreachAuthBinding({
 auth,workspace,eventTarget,getAllowedCampaigns,onSnapshot=()=>{}
}={}){
 if(typeof auth?.client?.auth?.getUser!=='function'||
    typeof auth?.client?.auth?.onAuthStateChange!=='function'||
    typeof auth?.client?.rpc!=='function'||
    typeof auth?.getSession!=='function'||
    typeof workspace?.active!=='function'||
    typeof eventTarget?.addEventListener!=='function'||
    typeof eventTarget?.removeEventListener!=='function'||
    typeof getAllowedCampaigns!=='function'||
    typeof onSnapshot!=='function')
  throw new TypeError('Approved Auth, staff-shell and campaign-scope bindings are required');

 let generation=0,closed=false,selected=null;
 const permitted=id=>{
  const scopes=getAllowedCampaigns();
  // This list is a UI-scoping hint, NEVER a replacement for backend authorization.
  return Array.isArray(scopes)&&scopes.some(value=>value===id);
 };
 const getVerifiedSession=async()=>{
  const current=generation;
  if(closed||!workspace.active())return null;
  try {
   // Provider-verified user must be confirmed, nonanonymous, and match the
   // current access token's session subject. Neither metadata nor a UI claim grants access.
   const {data,error}=await auth.client.auth.getUser();
   if(error||!data?.user?.id||!UUID.test(data.user.id)||
      !data.user.email_confirmed_at||data.user.is_anonymous)return null;
   const session=await auth.getSession();
   if(closed||current!==generation||!workspace.active()||
      session?.user?.id!==data.user.id||
      typeof session?.access_token!=='string'||!session.access_token)return null;
   // Token only exists inside a local, temporary reader key; never output/log/store it.
   return {verified:true,userId:data.user.id,sessionId:session.access_token,generation:current};
  }catch{return null}
 };
 const subscribeEvent=(name,handler)=>{
  eventTarget.addEventListener(name,handler);
  return()=>eventTarget.removeEventListener(name,handler);
 };
 const composition=createChurchOutreachSummaryComposition({
  getVerifiedSession,rpc:(...args)=>auth.client.rpc(...args),
  subscribeEvent,onSnapshot
 });
 let subscription=null;
 const revoke=()=>{
  if(closed)return;
  generation++;selected=null;
  composition.revoke();
 };
 const close=()=>{
  if(closed)return;
  closed=true;generation++;selected=null;
  try{composition.close()}finally{subscription?.unsubscribe?.()}
 };
 try{
  const listener=auth.client.auth.onAuthStateChange((event)=>{
   // Synchronous invalidation only. Never await Supabase Auth inside its own callback.
   if(event==='SIGNED_OUT'){close();return}
   if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED','PASSWORD_RECOVERY'].includes(event))revoke();
  });
  subscription=listener?.data?.subscription??listener?.subscription;
  if(!subscription||typeof subscription.unsubscribe!=='function')
   throw new TypeError('Provider Auth listener must be disposable');
 }catch(error){close();throw error}
 const ensureActive=()=>{
  if(closed)throw failure('WORKSPACE_CLOSED');
  if(!workspace.active()){close();throw failure('WORKSPACE_CLOSED')}
 };
 return Object.freeze({
  select(campaignId){
   ensureActive();
   if(typeof campaignId!=='string'||!UUID.test(campaignId)||!permitted(campaignId)){
    revoke();throw failure('CAMPAIGN_NOT_ALLOWED');
   }
   selected=campaignId;
   composition.select(campaignId);
  },
  async refresh(){
   ensureActive();
   if(!selected||!permitted(selected)){revoke();throw failure('CAMPAIGN_NOT_ALLOWED')}
   return composition.refresh();
  },
  revoke,
  close,
  snapshot:()=>closed?null:composition.snapshot()
 });
}
