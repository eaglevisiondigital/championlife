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
console.log(JSON.stringify({passed:count,failed:0}));
