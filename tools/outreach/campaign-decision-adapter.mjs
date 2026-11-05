// Unmounted source-only consumer of the reviewed PR80 RPC. Never an authorization substitute.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=x=>typeof x==='string'&&UUID.test(x);
const statuses=new Set(['new','needs_contact','attempted','connected','in_progress','completed','declined']);
const failure=code=>Object.assign(new Error(code),{code});
const denied=response=>['42501','PGRST301','PGRST302','PGRST303'].includes(response?.error?.code)||[401,403].includes(response?.status)||[401,403].includes(response?.error?.status);
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x)}return x};
const text=x=>typeof x==='string'&&x.length<=500?x:null;
function project(row,detail=false){
 if(!row||!id(row.registration_id)||row.kind!=='decision-free-book-registration'||!statuses.has(row.status)||!Number.isSafeInteger(row.revision)||row.revision<1||text(row.name)===null||row.contact_allowed!==false||typeof row.consent!=='boolean')throw failure('INVALID_RESPONSE');
 if(row.next_contact_on!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(row.next_contact_on))throw failure('INVALID_RESPONSE');
 const result={registrationId:row.registration_id,name:row.name,status:row.status,revision:row.revision,nextContactOn:row.next_contact_on,consent:row.consent,contactAllowed:false};
 if(detail){
  if(!['not_linked','reviewed_existing_account_link'].includes(row.identity_status)||row.contact_reason!=='verified_contact_route_not_installed'||row.book!=='not_instrumented'||row.course!=='separate_permission_and_authority_required')throw failure('INVALID_RESPONSE');
  result.identityStatus=row.identity_status;result.book='not_instrumented';result.course='unavailable';
 }
 return result;
}
export function createCampaignDecisionAdapter({auth,workspace,eventTarget,getAllowedCampaigns,projectRef,onSnapshot=()=>{},newRequestId=()=>crypto.randomUUID()}={}){
 if(typeof auth?.client?.auth?.getUser!=='function'||typeof auth?.getSession!=='function'||typeof auth?.client?.rpc!=='function'||typeof auth?.client?.auth?.onAuthStateChange!=='function'||typeof workspace?.active!=='function'||typeof getAllowedCampaigns!=='function'||typeof eventTarget?.addEventListener!=='function')throw new TypeError('Shared verified staff bindings required');
 const client=auth.client,url=`https://${projectRef}.supabase.co`;
 if(typeof projectRef!=='string'||!/^[a-z]{20}$/.test(projectRef)||projectRef==='exdocjbmylgxssanymjk')throw new TypeError('Pinned nonproduction backend required');
 const pinned=()=>{if(client!==auth.client||client.supabaseUrl!==url||client.auth.url!==url+'/auth/v1'||client.rest?.url!==url+'/rest/v1')throw failure('DENIED')};pinned();
 const principals=new WeakMap();const pending=new Set();
 let generation=0,scope=null,snapshot=null,closed=false,busy=false,subscription,expiryTimer,activePrincipal=null;
 const emit=(value)=>{snapshot=value?freeze(value):null;onSnapshot(snapshot)};
 const invalidate=(reason='Access must be verified again')=>{clearTimeout(expiryTimer);generation++;scope=null;activePrincipal=null;busy=false;for(const c of pending)c.abort();pending.clear();emit({state:'unavailable',message:reason})};
 const guard=(g,s)=>{pinned();if(closed||generation!==g||scope!==s||!workspace.active())throw failure('STALE_SCOPE')};
 const permitted=s=>(getAllowedCampaigns()??[]).some(x=>x.organizationId===s.organizationId&&x.campaignId===s.campaignId);
 const verify=async(g,s,prior)=>{
  guard(g,s);if(!permitted(s))throw failure('DENIED');
  const before=await auth.getSession();guard(g,s);
  if(typeof before?.access_token!=='string'||!before.access_token)throw failure('DENIED');
  const {data,error}=await client.auth.getUser(before.access_token);guard(g,s);
  const session=await auth.getSession();guard(g,s);
  const u=data?.user;
  if(error||!id(u?.id)||!u.email_confirmed_at||u.is_anonymous||session?.user?.id!==u.id||before.user?.id!==u.id||before.access_token!==session.access_token||typeof session.access_token!=='string'||!session.access_token||!Number.isFinite(session.expires_at)||session.expires_at*1000<=Date.now())throw failure('DENIED');
  clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>invalidate('Session expired. Verify access again.'),Math.min(2147483647,session.expires_at*1000-Date.now()));expiryTimer.unref?.();
  const principal={id:u.id,token:session.access_token};
  if(prior&&(prior.id!==principal.id||prior.token!==principal.token))throw failure('DENIED');
  activePrincipal=principal;return principal;
 };
 const call=async(action,payload,g,s,principal)=>{
  await verify(g,s,principal);guard(g,s);
  const controller=new AbortController();pending.add(controller);let response;
  const retireDenial=response=>{if(denied(response)&&!closed&&scope?.organizationId===s.organizationId&&scope?.campaignId===s.campaignId&&activePrincipal?.id===principal.id&&activePrincipal?.token===principal.token)invalidate('Access is no longer available.')};
  try{let request=client.rpc('campaign_decision_foundation',{p_action:action,p_org:s.organizationId,p_campaign:s.campaignId,p_payload:payload});if(typeof request?.abortSignal==='function')request=request.abortSignal(controller.signal);response=await request}catch(error){retireDenial({error});if(denied({error}))throw failure('DENIED');throw error}finally{pending.delete(controller)}
  const isDenied=denied(response);
  // A late denial still retires the current same-principal/campaign workspace.
  // Navigation generation must not discard authoritative revocation evidence.
  retireDenial(response);
  guard(g,s);
  if(response?.error||isDenied){const code=response.error?.code;throw failure(isDenied?'DENIED':code==='40001'?'CONFLICT':code==='PGRST202'?'NOT_INSTALLED':'UNAVAILABLE')}
  await verify(g,s,principal);guard(g,s);return response?.data;
 };
 const context=async(g,s,p)=>{
  const c=await call('context',{},g,s,p);
  if(c?.organization_id!==s.organizationId||c?.campaign_id!==s.campaignId||c.scope!=='assigned'||!Array.isArray(c.capabilities)||!c.capabilities.includes('decisions.read')||c.capabilities.some(x=>!['decisions.read','followup.manage'].includes(x)))throw failure('DENIED');
  return c.capabilities.includes('followup.manage');
 };
 const run=async(action,payload,registrationId=null)=>{
  if(!scope||closed)throw failure('NO_SCOPE');
  const s=scope,g=++generation;busy=true;emit({state:'loading'});
  try{
   const p=await verify(g,s);await context(g,s,p);
   const data=await call(action,payload,g,s,p);const manage=await context(g,s,p);guard(g,s);
   if(data?.organization_id!==s.organizationId||data?.campaign_id!==s.campaignId)throw failure('INVALID_RESPONSE');
   if(action==='list'){
    if(!Array.isArray(data.registrations)||data.registrations.length>50||data.page!==payload.page)throw failure('INVALID_RESPONSE');
    const rows=data.registrations.map(x=>project(x));if(new Set(rows.map(x=>x.registrationId)).size!==rows.length)throw failure('INVALID_RESPONSE');
    emit({state:'list',organizationId:s.organizationId,campaignId:s.campaignId,rows,page:data.page});
   }else{
    if(data.registration_id!==registrationId)throw failure('INVALID_RESPONSE');
    const ticket={generation:g,registrationId};principals.set(ticket,p);
    emit({state:'detail',organizationId:s.organizationId,campaignId:s.campaignId,record:project(data,true),canSave:manage&&data.consent===true,ticket});
   }
   return snapshot;
  }catch(e){if(g===generation&&!closed)invalidate(e.code==='NOT_INSTALLED'?'Decision workspace is not installed.':e.code==='DENIED'?'Access is no longer available.':'Details cleared. Verify access again.');throw failure(e.code||'UNAVAILABLE')}
  finally{if(g===generation)busy=false}
 };
 const save=async(ticket,changes)=>{
  const current=snapshot,s=scope,g=generation,p=principals.get(ticket);
  if(closed||busy||!scope||current?.state!=='detail'||!current.canSave||ticket!==current.ticket||ticket.generation!==generation||ticket.registrationId!==current.record.registrationId)throw failure('STALE_CONTROL');
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.hasOwn(changes,'status')||!Object.hasOwn(changes,'nextContactOn')||Object.keys(changes).some(k=>!['status','nextContactOn'].includes(k)))throw failure('INVALID_UPDATE');
  // Capture and validate one intent before any asynchronous authorization work.
  const status=changes.status,nextContactOn=changes.nextContactOn;
  if(!statuses.has(status)||!(nextContactOn===null||(typeof nextContactOn==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(nextContactOn))))throw failure('INVALID_UPDATE');
  // Caller getters/proxies may retire navigation or begin a different save.
  guard(g,s);
  if(closed||busy||snapshot!==current||scope!==s||generation!==g)throw failure('STALE_CONTROL');
  busy=true;emit({state:'saving'});
  let submitted=false;
  try{
   await verify(g,s,p);if(!await context(g,s,p))throw failure('DENIED');guard(g,s);
   const requestId=newRequestId();if(!id(requestId))throw failure('INVALID_REQUEST_ID');
   const payload={registration_id:current.record.registrationId,revision:current.record.revision,status,next_contact_on:nextContactOn,request_id:requestId};
   // No automatic retry. A transport failure after this point has unknown commit state.
   submitted=true;const response=await call('followup_save',payload,g,s,p);
   if(response?.saved!==true||response.revision!==current.record.revision+1||typeof response.replayed!=='boolean')throw failure('INVALID_RESPONSE');
   if(!await context(g,s,p))throw failure('DENIED');guard(g,s);
   busy=false;return await run('detail',{registration_id:current.record.registrationId},current.record.registrationId);
  }catch(e){if(g===generation&&!closed)invalidate(e.code==='DENIED'?'Access is no longer available.':e.code==='CONFLICT'?'Record changed. Reopen before editing.':submitted?'Save outcome is uncertain. Reauthorize and inspect current record; do not repeat the operation.':'Save not submitted. Verify access again.');throw failure(e.code||'UNAVAILABLE')}
  finally{if(g===generation)busy=false}
 };
 const listeners=['staff-protected-clear','staff-access-denied','pagehide','pageshow','popstate','storage'].map(name=>{const handler=()=>invalidate();eventTarget.addEventListener(name,handler);return[name,handler]});
 try{subscription=auth.client.auth.onAuthStateChange(()=>{if(!closed)invalidate()})?.data?.subscription;if(typeof subscription?.unsubscribe!=='function')throw new TypeError('Disposable Auth subscription required')}catch(e){listeners.forEach(([n,h])=>eventTarget.removeEventListener(n,h));throw e}
 return Object.freeze({
  select(organizationId,campaignId){invalidate();if(closed||!workspace.active()||!id(organizationId)||!id(campaignId))throw failure('DENIED');const next={organizationId,campaignId};if(!permitted(next))throw failure('DENIED');scope=next},
  list(page=0){if(!Number.isInteger(page)||page<0||page>9999)throw failure('INVALID_PAGE');return run('list',{page})},
  detail(registrationId){if(!id(registrationId))throw failure('INVALID_RECORD');return run('detail',{registration_id:registrationId},registrationId)},
  save,revoke:invalidate,snapshot:()=>snapshot,
  close(){if(closed)return;invalidate();closed=true;subscription.unsubscribe();listeners.forEach(([n,h])=>eventTarget.removeEventListener(n,h));snapshot=null;onSnapshot(null)}
 });
}
