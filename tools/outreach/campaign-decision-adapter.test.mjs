import assert from 'node:assert/strict';
import {createCampaignDecisionAdapter} from './campaign-decision-adapter.mjs';
const org='10000000-0000-4000-8000-000000000001',campaign='20000000-0000-4000-8000-000000000001',a='30000000-0000-4000-8000-000000000001',b='30000000-0000-4000-8000-000000000002',user='40000000-0000-4000-8000-000000000001';
let count=0;const check=(x,m)=>{assert.ok(x,m);count++};
function fixture(){
 const f={user,token:'fictional-token',revoked:false,mutations:[],revision:1,hold:null,unknown:false,manage:true,expiry:Math.floor(Date.now()/1000)+3600};const events=new EventTarget();
 const row=id=>({organization_id:org,campaign_id:campaign,registration_id:id,kind:'decision-free-book-registration',name:id===a?'Fictional A':'Fictional B',status:'new',revision:f.revision,next_contact_on:null,consent:true,contact_allowed:false,identity_status:'not_linked',contact_reason:'verified_contact_route_not_installed',book:'not_instrumented',course:'separate_permission_and_authority_required',email:'NEVER_RENDER'});
 const client={supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',rest:{url:'https://abcdefghijklmnopqrst.supabase.co/rest/v1'},auth:{url:'https://abcdefghijklmnopqrst.supabase.co/auth/v1',getUser:async()=>({data:{user:{id:f.user,email_confirmed_at:'2026-01-01',is_anonymous:false}}}),onAuthStateChange:fn=>{f.authEvent=fn;return{data:{subscription:{unsubscribe(){}}}}}},rpc:async(name,p)=>{
  check(name==='campaign_decision_foundation','fixed RPC');
  if(p.p_action===f.hold){f.hold=null;await new Promise(resolve=>f.release=resolve)}
  if(f.revoked){if(f.throwDenial)throw Object.assign(new Error('Explicit fixture denial'),f.denial??{code:'42501'});return{error:f.denial??{code:'42501'}};}
  if(p.p_action==='context')return{data:{organization_id:org,campaign_id:campaign,scope:'assigned',capabilities:f.manage?['decisions.read','followup.manage']:['decisions.read']}};
  if(p.p_action==='list')return{data:{organization_id:org,campaign_id:campaign,page:p.p_payload.page,registrations:[row(a),row(b)]}};
  if(p.p_action==='detail')return{data:row(p.p_payload.registration_id)};
  f.mutations.push(p.p_payload);f.revision++;if(f.unknown)throw Error('network');return{data:{saved:true,revision:f.revision,replayed:false}};
 }};
 const auth={client,getSession:async()=>({user:{id:f.user},access_token:f.token,expires_at:f.expiry})};
 const adapter=createCampaignDecisionAdapter({auth,workspace:{active:()=>true},eventTarget:events,getAllowedCampaigns:()=>[{organizationId:org,campaignId:campaign}],projectRef:'abcdefghijklmnopqrst',newRequestId:()=>crypto.randomUUID()});
 return{f,auth,events,adapter,select:()=>adapter.select(org,campaign)};
}
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
{
 const {f,adapter,select}=fixture();select();await adapter.list();check(adapter.snapshot().rows.length===2,'list');check(!JSON.stringify(adapter.snapshot()).includes('NEVER_RENDER'),'projection drops contact');const first=await adapter.detail(a);check(!JSON.stringify(first).includes('fictional-token'),'snapshot no token');await adapter.save(first.ticket,{status:'in_progress',nextContactOn:null});check(f.mutations.length===1&&adapter.snapshot().record.revision===2,'normal save');await assert.rejects(adapter.save(first.ticket,{status:'new',nextContactOn:null}));check(f.mutations.length===1,'retained control rejected');adapter.close();
}
for(const event of ['SIGNED_OUT','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED']){
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);f.authEvent(event);check(adapter.snapshot().state==='unavailable','auth clears '+event);await assert.rejects(adapter.save(old.ticket,{status:'new',nextContactOn:null}));check(!f.mutations.length,'auth no mutation');adapter.close();
}
for(const event of ['storage','popstate','pagehide','pageshow','staff-access-denied','staff-protected-clear']){
 const {f,adapter,events,select}=fixture();select();const old=await adapter.detail(a);events.dispatchEvent(new Event(event));await assert.rejects(adapter.save(old.ticket,{status:'new',nextContactOn:null}));check(!f.mutations.length&&adapter.snapshot().state==='unavailable','lifecycle '+event);adapter.close();
}
{
 const {f,adapter,select}=fixture();select();f.hold='detail';const pending=adapter.detail(a).catch(e=>e.code);await tick();select();await adapter.detail(b);f.release();check(await pending==='STALE_SCOPE','late A rejected');check(adapter.snapshot().record.registrationId===b,'B preserved');adapter.close();
}
{
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);f.revoked=true;await assert.rejects(adapter.list());check(adapter.snapshot().state==='unavailable','denial clears');await assert.rejects(adapter.save(old.ticket,{status:'new',nextContactOn:null}));check(!f.mutations.length,'denial no new mutation');f.revoked=false;select();await adapter.detail(b);check(adapter.snapshot().record.registrationId===b,'fresh authorization');adapter.close();
}
{
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);f.unknown=true;await assert.rejects(adapter.save(old.ticket,{status:'new',nextContactOn:null}));check(adapter.snapshot().message.includes('uncertain'),'unknown explicit');await assert.rejects(adapter.save(old.ticket,{status:'new',nextContactOn:null}));check(f.mutations.length===1,'unknown no retry');adapter.close();
}
{
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);const first=adapter.save(old.ticket,{status:'new',nextContactOn:null});await assert.rejects(adapter.save(old.ticket,{status:'new',nextContactOn:null}));await first;check(f.mutations.length===1,'double submit one request');adapter.close();
}
{
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);f.token='other-session';await assert.rejects(adapter.save(old.ticket,{status:'new',nextContactOn:null}));check(!f.mutations.length,'silent token change denied');adapter.close();
}
{
 const {auth,adapter,select}=fixture();select();await adapter.detail(a);auth.client.rest.url='https://exdocjbmylgxssanymjk.supabase.co/rest/v1';await assert.rejects(adapter.list());check(adapter.snapshot().state==='unavailable','pin drift clears');adapter.close();
}
{
 const {f,adapter,select}=fixture();select();f.hold='detail';const pending=adapter.detail(a).catch(e=>e.code);await tick();await adapter.detail(b);const ticket=adapter.snapshot().ticket;f.revoked=true;f.release();await pending;check(adapter.snapshot().state==='unavailable','late same-scope denial clears B');await assert.rejects(adapter.save(ticket,{status:'new',nextContactOn:null}));check(!f.mutations.length,'late denial zero retained mutations');adapter.close();
}
for(const denial of [{code:'PGRST303'},{status:401},{status:403}]){
 const {f,adapter,select}=fixture();select();f.hold='detail';const pending=adapter.detail(a).catch(e=>e.code);await tick();await adapter.detail(b);f.denial=denial;f.revoked=true;f.release();await pending;check(adapter.snapshot().state==='unavailable','late alternate auth denial clears');adapter.close();
}
for(const denial of [{code:'42501'},{code:'PGRST301'},{code:'PGRST302'},{code:'PGRST303'},{status:401},{status:403}]){
 const {f,adapter,select}=fixture();select();f.hold='detail';const pending=adapter.detail(a).catch(e=>e.code);await tick();await adapter.detail(b);const ticket=adapter.snapshot().ticket;f.denial=denial;f.throwDenial=true;f.revoked=true;f.release();await pending;check(adapter.snapshot().state==='unavailable','late rejected explicit denial clears '+JSON.stringify(denial));await assert.rejects(adapter.save(ticket,{status:'new',nextContactOn:null}));check(!f.mutations.length,'rejected denial retires saved ticket');adapter.close();
}
for(const oldAccount of [false,true]){
 const {f,adapter,select}=fixture();select();f.hold='detail';const pending=adapter.detail(a).catch(e=>e.code);await tick();if(oldAccount){f.user=b;f.token='new-account-token';f.authEvent('SIGNED_IN');select()}await adapter.detail(b);f.throwDenial=true;f.denial={code:oldAccount?'42501':'NETWORK'};f.revoked=true;f.release();await pending;check(adapter.snapshot().state==='detail'&&adapter.snapshot().record.registrationId===b,oldAccount?'old-account rejection does not retire new authority':'ordinary late network error is not revocation');check(!f.mutations.length,'late non-current rejection performs no write');adapter.close();
}
// The reviewed update is one immutable intent across asynchronous Auth/context checks.
{
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);
 const changes={status:'in_progress',nextContactOn:'2026-11-20'};
 f.hold='context';const saving=adapter.save(old.ticket,changes);await tick();
 changes.status='completed';changes.nextContactOn='2026-12-25';
 f.release();await saving;
 check(f.mutations.length===1,'pending intent submits once');
 check(f.mutations[0].status==='in_progress'&&f.mutations[0].next_contact_on==='2026-11-20','pending intent remains bound to reviewed values');
 adapter.close();
}
for(const later of [{status:'invalid',nextContactOn:'invalid'},{status:null,nextContactOn:null},{status:'declined',nextContactOn:'2027-01-01'}]){
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);
 const changes={status:'needs_contact',nextContactOn:null};f.hold='context';
 const saving=adapter.save(old.ticket,changes);await tick();Object.assign(changes,later);f.release();await saving;
 check(f.mutations.length===1&&f.mutations[0].status==='needs_contact'&&f.mutations[0].next_contact_on===null,'late mutation cannot replace validated intent');adapter.close();
}
{
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);let statusReads=0,dateReads=0;
 await adapter.save(old.ticket,{get status(){return ++statusReads===1?'in_progress':'completed'},get nextContactOn(){return ++dateReads===1?null:'2027-01-01'}});
 check(statusReads===1&&dateReads===1,'capture caller fields once');check(f.mutations[0].status==='in_progress'&&f.mutations[0].next_contact_on===null,'validated accessor values are submitted');adapter.close();
}
for(const invalid of [{status:'completed',nextContactOn:'invalid'},{status:'invalid',nextContactOn:null},{status:'new'},null,[]]){
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);await assert.rejects(adapter.save(old.ticket,invalid),{code:'INVALID_UPDATE'});check(f.mutations.length===0,'invalid original intent has no mutation');adapter.close();
}
{
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);const changes={status:'in_progress',nextContactOn:null};f.hold='context';const pending=adapter.save(old.ticket,changes).catch(e=>e.code);await tick();changes.status='completed';f.authEvent('SIGNED_OUT');f.release();await pending;check(f.mutations.length===0,'snapshot does not bypass logout');adapter.close();
}
{
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);let coercions=0;
 await assert.rejects(adapter.save(old.ticket,{status:'new',nextContactOn:{toString(){coercions++;return '2026-11-20'}}}),{code:'INVALID_UPDATE'});
 check(coercions===0&&f.mutations.length===0,'nonprimitive date rejected without coercion');
 await assert.rejects(adapter.save(old.ticket,Object.create({status:'new',nextContactOn:null})),{code:'INVALID_UPDATE'});
 check(f.mutations.length===0,'inherited update intent rejected');adapter.close();
}
for(const stage of ['status','date','ownKeys','descriptor'])for(const action of ['select','revoke','close','logout','account']){
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);let triggered=false;
 const retire=()=>{if(triggered)return;triggered=true;if(action==='select')select();else if(action==='revoke')adapter.revoke();else if(action==='close')adapter.close();else {if(action==='account'){f.user=b;f.token='fictional-B'}f.authEvent(action==='account'?'SIGNED_IN':'SIGNED_OUT')}};
 let changes={status:'in_progress',nextContactOn:null};
 if(stage==='status')Object.defineProperty(changes,'status',{enumerable:true,get(){retire();return 'in_progress'}});
 if(stage==='date')Object.defineProperty(changes,'nextContactOn',{enumerable:true,get(){retire();return null}});
 if(stage==='ownKeys')changes=new Proxy(changes,{ownKeys(target){retire();return Reflect.ownKeys(target)}});
 if(stage==='descriptor')changes=new Proxy(changes,{getOwnPropertyDescriptor(target,key){retire();return Reflect.getOwnPropertyDescriptor(target,key)}});
 await assert.rejects(adapter.save(old.ticket,changes));check(triggered&&f.mutations.length===0,stage+' '+action+' retires old intent before mutation');adapter.close();
}
for(const stage of ['status','date','ownKeys','descriptor']){
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);let triggered=false,nested;
 const begin=()=>{if(triggered)return;triggered=true;nested=adapter.save(old.ticket,{status:'needs_contact',nextContactOn:'2026-11-21'})};
 let changes={status:'completed',nextContactOn:null};
 if(stage==='status')Object.defineProperty(changes,'status',{enumerable:true,get(){begin();return 'completed'}});
 if(stage==='date')Object.defineProperty(changes,'nextContactOn',{enumerable:true,get(){begin();return null}});
 if(stage==='ownKeys')changes=new Proxy(changes,{ownKeys(target){begin();return Reflect.ownKeys(target)}});
 if(stage==='descriptor')changes=new Proxy(changes,{getOwnPropertyDescriptor(target,key){begin();return Reflect.getOwnPropertyDescriptor(target,key)}});
 await assert.rejects(adapter.save(old.ticket,changes),{code:'STALE_CONTROL'});await nested;
 check(f.mutations.length===1&&f.mutations[0].status==='needs_contact'&&f.mutations[0].next_contact_on==='2026-11-21',stage+' cannot override nested legitimate save');check(adapter.snapshot().state==='detail','nested save remains usable');adapter.close();
}
{
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);
 const changes={get status(){f.user=b;f.token='fictional-new-account';return 'completed'},nextContactOn:null};
 await assert.rejects(adapter.save(old.ticket,changes));check(f.mutations.length===0,'silent account change in getter cannot reuse old principal');adapter.close();
}
{
 const {f,adapter,select}=fixture();select();const loading=adapter.list();f.authEvent('INITIAL_SESSION',{user:{id:f.user},access_token:f.token});await loading;
 check(adapter.snapshot().state==='list','initial SDK notification preserves verified initial list');
 f.authEvent('INITIAL_SESSION',{user:{id:f.user},access_token:f.token});check(adapter.snapshot().state==='unavailable','duplicate initial event retires adapter');adapter.close();
}
for(const value of [null,{user:{id:'00000000-0000-4000-8000-000000000099'},access_token:'other'},{user:{id:user},access_token:'other'}]){
 const {f,adapter,select}=fixture();select();const old=await adapter.detail(a);f.authEvent('INITIAL_SESSION',value);check(adapter.snapshot().state==='unavailable','initial missing/replacement principal retires adapter');await assert.rejects(adapter.save(old.ticket,{status:'new',nextContactOn:null}));check(!f.mutations.length,'initial replacement cannot reuse ticket');adapter.close();
}
console.log(JSON.stringify({passed:count,failed:0}));
