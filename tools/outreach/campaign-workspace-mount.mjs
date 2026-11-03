// Isolated source-only mounting. The existing shared client and PR81 view remain authoritative.
import {mountCampaignDecisionView} from './campaign-decision-view.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure=code=>Object.assign(new Error(code),{code});
const denied=r=>['42501','PGRST301','PGRST302','PGRST303'].includes(r?.error?.code)||[401,403].includes(r?.status)||[401,403].includes(r?.error?.status);
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const same=(a,b)=>a&&b&&a.id===b.id&&a.token===b.token;
function project(data){
 if(!exact(data,['kind','campaigns'])||data.kind!=='assigned-decision-campaign-directory'||!Array.isArray(data.campaigns))throw failure('INVALID_RESPONSE');
 const seen=new Set();return Object.freeze(data.campaigns.map(row=>{
  if(!exact(row,['organization_id','campaign_id','campaign_name','scope','capabilities'])||typeof row.organization_id!=='string'||typeof row.campaign_id!=='string'||!UUID.test(row.organization_id)||!UUID.test(row.campaign_id)||typeof row.campaign_name!=='string'||!row.campaign_name.trim()||row.campaign_name.length>200||row.scope!=='assigned'||!Array.isArray(row.capabilities)||!row.capabilities.includes('decisions.read')||row.capabilities.some(x=>!['decisions.read','followup.manage'].includes(x))||new Set(row.capabilities).size!==row.capabilities.length)throw failure('INVALID_RESPONSE');
  const key=row.organization_id+'/'+row.campaign_id;if(seen.has(key))throw failure('INVALID_RESPONSE');seen.add(key);
  return Object.freeze({organizationId:row.organization_id,campaignId:row.campaign_id,name:row.campaign_name});
 }));
}
export function mountCampaignDecisionWorkspace({root,auth,workspace,eventTarget,projectRef}={}){
 if(typeof root?.replaceChildren!=='function'||typeof auth?.getSession!=='function'||typeof auth?.client?.rpc!=='function'||typeof auth?.client?.auth?.getUser!=='function'||typeof auth?.client?.auth?.onAuthStateChange!=='function'||typeof workspace?.active!=='function'||typeof eventTarget?.addEventListener!=='function')throw new TypeError('Shared verified staff bindings and DOM root required');
 if(typeof projectRef!=='string'||!/^[a-z]{20}$/.test(projectRef)||projectRef==='exdocjbmylgxssanymjk')throw new TypeError('Pinned nonproduction backend required');
 const original=auth.client,url=`https://${projectRef}.supabase.co`,doc=root.ownerDocument;
 const pinned=()=>{if(auth.client!==original||original.supabaseUrl!==url||original.auth.url!==url+'/auth/v1'||original.rest?.url!==url+'/rest/v1')throw failure('DENIED')};pinned();
 let generation=0,closed=false,principal=null,campaigns=Object.freeze([]),selected=null,view=null,state='unavailable',message='Verify your assigned decision campaigns.',expiryTimer,subscription;
 const section=doc.createElement('section');section.className='panel';section.setAttribute('aria-label','Decision campaign workspace');
 const heading=doc.createElement('h2');heading.textContent='Decision campaigns';
 const status=doc.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const label=doc.createElement('label');label.textContent='Assigned campaign';
 let selector;
 const refreshButton=doc.createElement('button');refreshButton.type='button';refreshButton.className='btn';refreshButton.textContent='Refresh assigned campaigns';
 const detailRoot=doc.createElement('div');section.append(heading,status,label,refreshButton,detailRoot);root.replaceChildren(section);
 const render=()=>{status.textContent=message;selector=doc.createElement('select');selector.setAttribute('aria-label','Assigned decision campaign');label.replaceChildren(doc.createTextNode('Assigned campaign'),selector);const capturedGeneration=generation,capturedCampaigns=campaigns;selector.addEventListener('change',event=>{if(closed||generation!==capturedGeneration||campaigns!==capturedCampaigns)return;const value=event.currentTarget.value,c=capturedCampaigns[Number(value)];if(value!==''&&c)select(c.organizationId,c.campaignId).catch(()=>{})});const blank=doc.createElement('option');blank.value='';blank.textContent='Select an assigned campaign';selector.append(blank);for(const [index,c] of campaigns.entries()){const option=doc.createElement('option');option.value=String(index);option.textContent=c.name;option.selected=selected===c;selector.append(option)}selector.disabled=state!=='ready'||!campaigns.length;refreshButton.disabled=state==='loading'||closed};
 const clear=(reason='Verify access again.')=>{generation++;clearTimeout(expiryTimer);principal=null;campaigns=Object.freeze([]);selected=null;if(view){view.close();view=null}detailRoot.replaceChildren();state='unavailable';message=reason;if(!closed)render()};
 const checkedPin=()=>{try{pinned()}catch(error){clear('Access is no longer available.');throw error}};
 const guard=g=>{checkedPin();if(closed||g!==generation||!workspace.active())throw failure('STALE_SCOPE')};
 const verify=async(g,prior)=>{
  guard(g);const before=await auth.getSession();guard(g);if(!before?.access_token)throw failure('DENIED');
  const {data,error}=await original.auth.getUser(before.access_token);guard(g);const session=await auth.getSession();guard(g);const user=data?.user;
  if(error||typeof user?.id!=='string'||!UUID.test(user.id)||!user.email_confirmed_at||user.is_anonymous||before.user?.id!==user.id||session?.user?.id!==user.id||before.access_token!==session.access_token||typeof session.access_token!=='string'||!Number.isFinite(session.expires_at)||session.expires_at*1000<=Date.now())throw failure('DENIED');
  const next={id:user.id,token:session.access_token};if(prior&&!same(next,prior))throw failure('DENIED');principal=next;clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>clear('Session expired. Verify access again.'),Math.min(2147483647,session.expires_at*1000-Date.now()));expiryTimer.unref?.();return next;
 };
 const retireDenial=(response,captured)=>{if(denied(response)&&!closed&&same(principal,captured))clear('Access is no longer available.')};
 // This stable facade delegates to the SAME shared client; it creates no client, session or login.
 // It observes explicit foundation denials so even campaign selector metadata is retired.
 const facade={get supabaseUrl(){return original.supabaseUrl},get rest(){return original.rest},get auth(){return original.auth},async rpc(name,args){
  checkedPin();if(name!=='campaign_decision_foundation'||!selected||args?.p_org!==selected.organizationId||args?.p_campaign!==selected.campaignId)throw failure('DENIED');const captured=principal,capturedScope=selected;
  let response;try{response=await original.rpc(name,args)}catch(error){if(selected?.organizationId===capturedScope.organizationId&&selected?.campaignId===capturedScope.campaignId)retireDenial({error},captured);throw error}checkedPin();if(selected?.organizationId===capturedScope.organizationId&&selected?.campaignId===capturedScope.campaignId)retireDenial(response,captured);return response;
 }};
 const shared={getSession:async()=>{checkedPin();const session=await auth.getSession();checkedPin();return session},client:facade};
 const discover=async(requested=null)=>{
  if(closed)throw failure('CLOSED');clear();const g=generation;state='loading';message='Verifying assigned decision campaigns…';render();
  try{
   const who=await verify(g);let response;try{response=await original.rpc('campaign_decision_directory')}catch(error){retireDenial({error},who);throw error}retireDenial(response,who);guard(g);
   if(response?.error||denied(response))throw failure(denied(response)?'DENIED':response?.error?.code==='PGRST202'?'NOT_INSTALLED':'UNAVAILABLE');
   await verify(g,who);guard(g);const rows=project(response?.data);campaigns=rows;state='ready';message=rows.length?'Choose a campaign to view only your assigned decision registrations.':'No assigned decision campaigns are available.';
   if(requested){selected=rows.find(x=>x.organizationId===requested.organizationId&&x.campaignId===requested.campaignId);if(!selected)throw failure('DENIED')}
   render();if(selected){
    const capturedSelected=selected;
    view=mountCampaignDecisionView({root:detailRoot,auth:shared,workspace:{active:()=>!closed&&workspace.active()&&selected===capturedSelected&&principal!==null},eventTarget,getAllowedCampaigns:()=>campaigns,projectRef});
    view.select(selected.organizationId,selected.campaignId);await view.list();guard(g);
   }
   return snapshot();
  }catch(error){if(g===generation&&!closed)clear(error.code==='NOT_INSTALLED'?'Decision campaign discovery is not installed.':error.code==='DENIED'?'Access is no longer available.':'Campaigns cleared. Verify access again.');throw failure(error.code||'UNAVAILABLE')}
 };
 const select=(organizationId,campaignId)=>{
  if(closed||state!=='ready'||!campaigns.some(x=>x.organizationId===organizationId&&x.campaignId===campaignId))return Promise.reject(failure('STALE_CONTROL'));
  return discover({organizationId,campaignId});
 };
 const snapshot=()=>Object.freeze({state,message,campaigns,selected,record:view?.snapshot()??null});
 refreshButton.addEventListener('click',()=>{if(!closed&&state!=='loading')discover().catch(()=>{})});
 const listeners=['staff-protected-clear','staff-access-denied','pagehide','pageshow','popstate','storage'].map(name=>{const handler=()=>{if(!closed)clear()};eventTarget.addEventListener(name,handler);return[name,handler]});
 try{subscription=original.auth.onAuthStateChange(()=>{if(!closed)clear()})?.data?.subscription;if(typeof subscription?.unsubscribe!=='function')throw new TypeError('Disposable Auth subscription required')}catch(error){listeners.forEach(([n,h])=>eventTarget.removeEventListener(n,h));root.replaceChildren();throw error}
 render();return Object.freeze({refresh:()=>discover(),select,snapshot,close(){if(closed)return;clear();closed=true;subscription.unsubscribe();listeners.forEach(([n,h])=>eventTarget.removeEventListener(n,h));root.replaceChildren()}});
}
