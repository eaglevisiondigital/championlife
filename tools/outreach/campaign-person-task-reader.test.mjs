import assert from 'node:assert/strict';
import {createCampaignPersonTaskReader} from './campaign-person-task-reader.mjs';
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const selection={organizationId:uuid(1),campaignId:uuid(2),registrationId:uuid(3),taskId:uuid(4),bindingId:uuid(5),bindingRevision:1};
let checks=0;const check=(value,label)=>{assert.ok(value,label);checks++};
function fixture(){
 const f={user:uuid(6),token:'fictional-A',expiry:Math.floor(Date.now()/1000)+3600,requests:[],active:true,hold:false,error:null,throwError:false,extra:{},snapshots:[]};
 const events=new EventTarget();
 const client={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',rest:{url:'https://abcdefghijklmnopqrst.supabase.co/rest/v1'},auth:{url:'https://abcdefghijklmnopqrst.supabase.co/auth/v1',getUser:async()=>({data:{user:{id:f.user,email_confirmed_at:f.unverified?null:'2026-01-01',is_anonymous:false}}}),onAuthStateChange:fn=>{f.authEvent=fn;return{data:{subscription:{unsubscribe(){f.unsubscribed=true}}}}}},rpc:async(name,args)=>{
  f.requests.push({name,args:structuredClone(args)});const actor=f.user;
  if(f.hold){f.hold=false;await new Promise(resolve=>f.release=resolve)}
  if(f.error){if(f.throwError)throw Object.assign(Error('Fictional rejection'),f.error);return{error:f.error,status:f.responseStatus}}
  return{data:{kind:'campaign-person-task',actor_id:actor,organization_id:args.p_org,campaign_id:args.p_campaign,registration_id:args.p_registration,binding_id:args.p_payload.binding_id,binding_revision:args.p_payload.binding_revision,task:{id:args.p_payload.task_id,person_id:uuid(7),title:'Outreach follow-up',status:'open',due_on:null,assigned_user_id:actor,revision:1,prayer:'PRIVATE-PRAYER',email:'PRIVATE-EMAIL',...f.taskExtra},raw:'PRIVATE-SOURCE',...f.extra}};
 }};
 const auth={client,getSession:async()=>({user:{id:f.user},access_token:f.token,expires_at:f.expiry})};
 const reader=createCampaignPersonTaskReader({auth,workspace:{active:()=>{f.activeHook?.();return f.active}},eventTarget:events,projectRef:'abcdefghijklmnopqrst',onSnapshot:value=>{f.snapshots.push(value);f.hook?.(value)}});
 return{f,auth,reader,events,select:()=>reader.select(selection)};
}
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
{
 const {f,reader,select}=fixture(),ticket=select(),value=await reader.load(ticket);
 check(value.state==='ready'&&value.task.title==='Outreach follow-up','authorized neutral metadata');
 check(!JSON.stringify(value).includes('PRIVATE-')&&!JSON.stringify(value).includes('fictional-A'),'private payload and token excluded');
 check(Object.isFrozen(value)&&Object.isFrozen(value.task),'immutable projection');
 check(f.requests.length===1&&f.requests[0].name==='campaign_person_task_context','one fixed read-only RPC');
 assert.deepEqual(f.requests[0].args,{p_org:selection.organizationId,p_campaign:selection.campaignId,p_registration:selection.registrationId,p_payload:{task_id:selection.taskId,binding_id:selection.bindingId,binding_revision:1}});checks++;
 check(!('save'in reader)&&!('create'in reader)&&!('update'in reader)&&!('retry'in reader),'no mutation or retry ports');
 await reader.load(ticket);check(f.requests.length===2,'same-authority explicit read-only refresh works');
 await assert.rejects(reader.load({...ticket}));check(f.requests.length===2,'forged ticket rejected');reader.close();check(f.unsubscribed&&reader.snapshot()===null,'close clears subscription/state');
}
for(const event of ['SIGNED_OUT','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED','storage','popstate','pagehide','pageshow','staff-protected-clear','staff-access-denied']){
 const {f,reader,select,events}=fixture(),ticket=select();await reader.load(ticket);
 if(event.includes('_'))f.authEvent(event);else events.dispatchEvent(new Event(event));
 check(reader.snapshot().state==='unavailable',event+' removes state');await assert.rejects(reader.load(ticket));check(f.requests.length===1,event+' retained control cannot request');reader.close();
}
for(const change of ['user','token','expired','unverified','inactive','client','rest']){
 const {f,auth,reader,select}=fixture(),ticket=select();await reader.load(ticket);
 if(change==='user')f.user=uuid(8);if(change==='token')f.token='fictional-B';if(change==='expired')f.expiry=0;if(change==='unverified')f.unverified=true;if(change==='inactive')f.active=false;if(change==='client')auth.client={...auth.client};if(change==='rest')auth.client.rest.url='https://exdocjbmylgxssanymjk.supabase.co/rest/v1';
 await assert.rejects(reader.load(ticket));check(reader.snapshot().state==='unavailable',change+' clears without callback');check(f.requests.length===1,change+' no stale request');reader.close();
}
for(const error of [{code:'42501'},{code:'PGRST301'},{code:'PGRST302'},{code:'PGRST303'},{status:401},{status:403},{code:'40001'},{code:'PGRST202'},{code:'NETWORK'}])for(const throwing of [false,true]){
 const {f,reader,select}=fixture(),ticket=select();await reader.load(ticket);f.error=error;f.throwError=throwing;
 await assert.rejects(reader.load(ticket));check(reader.snapshot().state==='unavailable','denial/conflict/network clears '+JSON.stringify(error)+' '+throwing);const count=f.requests.length;await assert.rejects(reader.load(ticket));check(f.requests.length===count,'no automatic/retained retry');reader.close();
}
for(const field of ['actor_id','organization_id','campaign_id','registration_id','binding_id','binding_revision','kind']){
 const {f,reader,select}=fixture();f.extra[field]=field==='binding_revision'?2:field==='kind'?'other':uuid(20);await assert.rejects(reader.load(select()));check(reader.snapshot().state==='unavailable',field+' response binding rejected');reader.close();
}
for(const [field,value]of[['id',uuid(99)],['person_id',null],['title','Sensitive note'],['status','unknown'],['due_on',{}],['assigned_user_id',null],['assigned_user_id',uuid(99)],['revision',0]]){
 const {f,reader,select}=fixture();f.taskExtra={[field]:value};await assert.rejects(reader.load(select()));check(reader.snapshot().state==='unavailable',field+' invalid task rejected');reader.close();
}
for(const bad of [null,[],{},Object.create(selection),{...selection,personId:uuid(7)},{...selection,bindingRevision:0},{...selection,bindingRevision:'1'},{...selection,taskId:'not-uuid'}]){
 const {f,reader}=fixture();assert.throws(()=>reader.select(bad));check(!f.requests.length,'invalid selector has no request');reader.close();
}
{
 const {f,reader,select}=fixture(),first=select();f.hold=true;const pending=reader.load(first).catch(e=>e.code);await tick();const second=reader.select({...selection,taskId:uuid(9),registrationId:uuid(10)});await reader.load(second);f.release();await pending;check(reader.snapshot().task.id===uuid(9),'late old task cannot restore');await assert.rejects(reader.load(first));check(f.requests.length===2,'old task ticket cannot reopen');reader.close();
}
for(const oldAccount of [false,true])for(const throwing of [false,true]){
 const {f,reader,select}=fixture(),first=select();f.hold=true;const pending=reader.load(first).catch(e=>e.code);await tick();
 if(oldAccount){f.user=uuid(8);f.token='fictional-B';f.authEvent('SIGNED_IN')}
 const second=reader.select({...selection,taskId:uuid(9)});await reader.load(second);f.error={code:'42501'};f.throwError=throwing;f.release();await pending;
 check(reader.snapshot().state===(oldAccount?'ready':'unavailable'),'late denial scope/account isolation '+oldAccount+' '+throwing);reader.close();
}
{
 const {f,reader,select}=fixture(),first=select();f.hold=true;const pending=reader.load(first).catch(e=>e.code);await tick();f.user=uuid(8);f.token='fictional-B';f.release();await pending;check(reader.snapshot().state==='unavailable','silent account replacement during request clears');reader.close();
}
for(const stage of ['getter','keys']){
 const {f,reader}=fixture();let value={...selection};const retire=()=>reader.revoke();
 if(stage==='getter')Object.defineProperty(value,'taskId',{enumerable:true,get(){retire();return selection.taskId}});
 else value=new Proxy(value,{ownKeys(target){retire();return Reflect.ownKeys(target)}});
 assert.throws(()=>reader.select(value));check(!f.requests.length&&reader.snapshot().state==='unavailable',stage+' reentrant selector cannot restore');reader.close();
}
for(const stage of ['loading','ready']){
 const {f,reader,select}=fixture(),ticket=select();f.hook=value=>{if(value?.state===stage){f.hook=null;reader.revoke()}};
 await assert.rejects(reader.load(ticket));check(reader.snapshot().state==='unavailable','synchronous snapshot '+stage+' retirement remains final');check(f.requests.length===(stage==='loading'?0:1),'synchronous snapshot '+stage+' request count');reader.close();
}
for(let boundary=1;boundary<=5;boundary++){
 const {f,reader,select}=fixture(),ticket=select();let calls=0;
 f.activeHook=()=>{if(++calls===boundary){f.activeHook=null;reader.revoke()}};
 await assert.rejects(reader.load(ticket));check(!f.requests.length,'reentrant shared workspace boundary '+boundary+' prevents retired RPC');check(reader.snapshot().state==='unavailable','reentrant shared workspace stays cleared');reader.close();
}
{
 const {f,reader,select}=fixture();f.expiry=(Date.now()+150)/1000;const ticket=select();await reader.load(ticket);await new Promise(resolve=>setTimeout(resolve,200));check(reader.snapshot().state==='unavailable','session expiration timer clears without another request');await assert.rejects(reader.load(ticket));check(f.requests.length===1,'expired ticket cannot reload');reader.close();
}
{
 const {f,reader,select}=fixture(),first=select();f.hold=true;const pending=reader.load(first).catch(e=>e.code);await tick();const second=reader.select({...selection,taskId:uuid(9)});await reader.load(second);f.error={code:'NETWORK'};f.responseStatus=403;f.release();await pending;check(reader.snapshot().state==='unavailable','explicit HTTP denial overrides ordinary error code on late response');reader.close();
}
console.log(JSON.stringify({passed:checks,failed:0,providerCalls:0,mutationPorts:0}));
