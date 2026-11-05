// Unmounted read-only consumer of campaign_person_task_context. Server RLS/RPC
// remains authoritative. No task creation, mutation, identity linking or retries.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=value=>typeof value==='string'&&UUID.test(value);
const failure=code=>Object.assign(new Error(code),{code});
const denied=value=>['42501','PGRST301','PGRST302','PGRST303'].includes(value?.code)||[401,403].includes(value?.status);
const selectionKeys=['organizationId','campaignId','registrationId','taskId','bindingId','bindingRevision'];
function capture(value){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==selectionKeys.length||selectionKeys.some(k=>!Object.hasOwn(value,k)))throw failure('INVALID_SELECTION');
 const result=Object.fromEntries(selectionKeys.map(k=>[k,value[k]]));
 if(selectionKeys.slice(0,5).some(k=>!id(result[k]))||!Number.isSafeInteger(result.bindingRevision)||result.bindingRevision<1)throw failure('INVALID_SELECTION');
 return Object.freeze(result);
}
function project(value,scope,actor){
 if(value?.kind!=='campaign-person-task'||value.actor_id!==actor||value.organization_id!==scope.organizationId||value.campaign_id!==scope.campaignId||value.registration_id!==scope.registrationId||value.binding_id!==scope.bindingId||value.binding_revision!==scope.bindingRevision)throw failure('INVALID_RESPONSE');
 const task=value.task;
 if(!task||task.id!==scope.taskId||!id(task.person_id)||task.title!=='Outreach follow-up'||!['open','completed','canceled'].includes(task.status)||task.assigned_user_id!==actor||!Number.isSafeInteger(task.revision)||task.revision<1||!(task.due_on===null||(typeof task.due_on==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(task.due_on))))throw failure('INVALID_RESPONSE');
 return Object.freeze({state:'ready',organizationId:scope.organizationId,campaignId:scope.campaignId,registrationId:scope.registrationId,bindingId:scope.bindingId,bindingRevision:scope.bindingRevision,task:Object.freeze({id:task.id,personId:task.person_id,title:'Outreach follow-up',status:task.status,dueOn:task.due_on,assignedUserId:task.assigned_user_id,revision:task.revision})});
}
export function createCampaignPersonTaskReader({auth,workspace,eventTarget,projectRef,onSnapshot=()=>{}}={}){
 if(typeof auth?.getSession!=='function'||typeof auth?.client?.auth?.getUser!=='function'||typeof auth?.client?.auth?.onAuthStateChange!=='function'||typeof auth?.client?.rpc!=='function'||typeof workspace?.active!=='function'||typeof eventTarget?.addEventListener!=='function'||typeof eventTarget?.removeEventListener!=='function'||typeof onSnapshot!=='function')throw new TypeError('Existing shared staff bindings required');
 if(typeof projectRef!=='string'||!/^[a-z]{20}$/.test(projectRef)||projectRef==='exdocjbmylgxssanymjk')throw new TypeError('Pinned nonproduction backend required');
 const client=auth.client,clientAuth=client.auth,url=`https://${projectRef}.supabase.co`;
 const pinned=()=>{if(auth.client!==client||client.auth!==clientAuth||client.supabaseUrl!==url||clientAuth.url!==url+'/auth/v1'||client.rest?.url!==url+'/rest/v1')throw failure('DENIED')};pinned();
 let generation=0,sequence=0,scope=null,ticket=null,principal=null,snapshot=null,closed=false,timer,subscription;
 const pending=new Set();
 const emit=value=>{snapshot=value;onSnapshot(value)};
 const retire=(message='Verify access again.')=>{clearTimeout(timer);generation++;sequence++;scope=null;ticket=null;principal=null;for(const controller of pending)controller.abort();pending.clear();emit(Object.freeze({state:'unavailable',message}))};
 const guard=(g,n,s,t)=>{pinned();const active=workspace.active();if(closed||g!==generation||n!==sequence||s!==scope||t!==ticket||active!==true)throw failure('STALE_CONTROL')};
 const verify=async(g,n,s,t,expected)=>{
  guard(g,n,s,t);const before=await auth.getSession();guard(g,n,s,t);
  if(typeof before?.access_token!=='string'||!before.access_token)throw failure('DENIED');
  const response=await clientAuth.getUser(before.access_token);guard(g,n,s,t);
  const after=await auth.getSession();guard(g,n,s,t);const user=response?.data?.user;
  if(response?.error||!id(user?.id)||!user.email_confirmed_at||user.is_anonymous||before.user?.id!==user.id||after?.user?.id!==user.id||after.access_token!==before.access_token||!Number.isFinite(after.expires_at)||after.expires_at*1000<=Date.now())throw failure('DENIED');
  const current={id:user.id,token:after.access_token};
  if(expected&&(current.id!==expected.id||current.token!==expected.token))throw failure('DENIED');
  principal=current;clearTimeout(timer);timer=setTimeout(()=>retire('Session expired. Verify access again.'),Math.min(2147483647,after.expires_at*1000-Date.now()));timer.unref?.();return current;
 };
 const retireDenial=(error,s,p)=>{if(denied(error)&&!closed&&scope?.organizationId===s.organizationId&&scope?.campaignId===s.campaignId&&principal?.id===p?.id&&principal?.token===p?.token)retire('Access is no longer available.')};
 const load=async selected=>{
  if(closed||!scope||selected!==ticket)throw failure('STALE_CONTROL');
  const s=scope,t=ticket,g=generation,n=++sequence,prior=principal;let p;
  for(const controller of pending)controller.abort();pending.clear();emit(Object.freeze({state:'loading'}));
  try{
   p=await verify(g,n,s,t,prior);guard(g,n,s,t);
   const controller=new AbortController();pending.add(controller);let response;
   try{let request=client.rpc('campaign_person_task_context',{p_org:s.organizationId,p_campaign:s.campaignId,p_registration:s.registrationId,p_payload:{task_id:s.taskId,binding_id:s.bindingId,binding_revision:s.bindingRevision}});if(typeof request?.abortSignal==='function')request=request.abortSignal(controller.signal);response=await request}
   catch(error){retireDenial(error,s,p);throw error}finally{pending.delete(controller)}
   // An explicit HTTP denial remains authoritative even when an accompanying
   // gateway/client error uses a generic network code.
   const error=denied(response)||denied(response?.error)?{code:'42501'}:response?.error;
   if(error){retireDenial(error,s,p);throw failure(denied(error)?'DENIED':error.code==='40001'?'CONFLICT':error.code==='PGRST202'?'NOT_INSTALLED':'UNAVAILABLE')}
   guard(g,n,s,t);await verify(g,n,s,t,p);guard(g,n,s,t);
   const next=project(response?.data,s,p.id);guard(g,n,s,t);emit(next);guard(g,n,s,t);return next;
  }catch(error){if(!closed&&g===generation&&n===sequence)retire(error.code==='CONFLICT'?'Binding changed. Reopen through the authorized source.':error.code==='NOT_INSTALLED'?'Campaign task review is not installed.':denied(error)||error.code==='DENIED'?'Access is no longer available.':'Details cleared. Verify access again.');throw failure(error.code||'UNAVAILABLE')}
 };
 const listeners=['staff-protected-clear','staff-access-denied','pagehide','pageshow','popstate','storage'].map(name=>{const handler=()=>retire();eventTarget.addEventListener(name,handler);return[name,handler]});
 try{subscription=clientAuth.onAuthStateChange(()=>{if(!closed)retire()})?.data?.subscription;if(typeof subscription?.unsubscribe!=='function')throw new TypeError('Disposable Auth subscription required')}
 catch(error){listeners.forEach(([name,handler])=>eventTarget.removeEventListener(name,handler));throw error}
 return Object.freeze({
  select(value){retire();const g=generation;const next=capture(value);pinned();if(closed||!workspace.active()||generation!==g)throw failure('STALE_CONTROL');scope=next;ticket=Object.freeze({generation:g});return ticket},
  load,revoke:retire,snapshot:()=>snapshot,
  close(){if(closed)return;retire();closed=true;subscription.unsubscribe();listeners.forEach(([name,handler])=>eventTarget.removeEventListener(name,handler));snapshot=null;onSnapshot(null)}
 });
}
