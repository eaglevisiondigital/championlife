import test from 'node:test';
import assert from 'node:assert/strict';
import {createIsolatedStaffSummaryAuth} from './isolated-staff-summary-auth.mjs';
import {createChurchOutreachAuthBinding} from './church-outreach-auth-binding.mjs';
const REF='abcdefghijklmnopqrst',URL=`https://${REF}.supabase.co`;
const USER='00000000-0000-4000-8000-000000000001',OTHER='00000000-0000-4000-8000-000000000002';
const A='00000000-0000-4000-8000-000000000003',B='00000000-0000-4000-8000-000000000004';
const counts={households:1,adults:1,minors:0,attendees:1,checked_in:0};
const gate=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve}};
function fixture(){
 let session={user:{id:USER},access_token:'fictional-A'},handler=null,userHandler=null,listener;
 const calls=[],tokens=[],signals=[];
 const auth={getSession:async()=>session,client:{supabaseUrl:URL,rest:{url:URL+'/rest/v1'},auth:{
  url:URL+'/auth/v1',getUser:async token=>{tokens.push(token);return userHandler?userHandler():{data:{user:{id:session.user.id,email_confirmed_at:'2026-11-01',is_anonymous:false}}}},
  onAuthStateChange:fn=>{listener=fn;return {data:{subscription:{unsubscribe(){listener=null}}}}}
 },rpc(name,args){
  calls.push({name,args});
  const result=handler?handler(args):Promise.resolve(args.p_campaign===B?{error:{code:'42501'},status:403}:{data:args.p_action==='context'?{capabilities:['registration.view']}:{summary:counts}});
  return {abortSignal(signal){signals.push(signal);return this},then(resolve,reject){return result.then(resolve,reject)}};
 }}};
 const adapted=createIsolatedStaffSummaryAuth({auth,projectRef:REF,supabaseUrl:URL});
 return {auth,adapted,calls,tokens,signals,setSession:s=>{session=s},setHandler:f=>{handler=f},setUser:f=>{userHandler=f},emit:e=>listener?.(e),
 bind(){return createChurchOutreachAuthBinding({auth:adapted,workspace:{active:()=>true},eventTarget:new EventTarget(),getAllowedCampaigns:()=>[A,B]})}};
}
const args={p_action:'context',p_campaign:A,p_payload:{}};
for(const config of [{},{projectRef:REF},{projectRef:'exdocjbmylgxssanymjk',supabaseUrl:'https://exdocjbmylgxssanymjk.supabase.co'},
 {projectRef:REF,supabaseUrl:URL+'/'},{projectRef:REF,supabaseUrl:'http://'+REF+'.supabase.co'},
 {projectRef:REF,supabaseUrl:URL+'?host=other'},{projectRef:REF+'\n',supabaseUrl:URL}]){
 test('reject invalid isolated configuration '+JSON.stringify(config),()=>{
  const f=fixture();assert.throws(()=>createIsolatedStaffSummaryAuth({auth:f.auth,...config}));assert.equal(f.calls.length,0);
 });
}
for(const field of ['client','auth','rest'])test('reject mismatched '+field+' endpoint before Auth/network',()=>{
 const f=fixture();if(field==='client')f.auth.client.supabaseUrl='https://other.supabase.co';else f.auth.client[field].url='https://other.supabase.co';
 assert.throws(()=>createIsolatedStaffSummaryAuth({auth:f.auth,projectRef:REF,supabaseUrl:URL}),{code:'BACKEND_PIN_MISMATCH'});
 assert.equal(f.tokens.length,0);assert.equal(f.calls.length,0);
});
test('complete existing lifecycle uses verified token and exact read-only RPC sequence',async()=>{
 const f=fixture(),binding=f.bind();binding.select(A);assert.deepEqual((await binding.refresh()).counts,counts);
 assert.deepEqual(f.calls.map(c=>c.args.p_action),['context','list','context']);assert.ok(f.tokens.length>3);
 assert.ok(f.tokens.every(t=>t==='fictional-A'));assert.equal(f.signals.length,3);binding.close();
});
test('existing shell Promise interception is preserved, never bypassed for cancellation',async()=>{
 const f=fixture();const original=f.auth.client.rpc;let intercepts=0;
 f.auth.client.rpc=async(...a)=>{intercepts++;return original(...a)};
 const binding=f.bind();binding.select(A);await binding.refresh();assert.equal(intercepts,3);assert.equal(f.signals.length,0);binding.close();
});
for(const mutation of ['csv','detail','checkin','reverse','assign','grant','save'])test('deny unsupported action '+mutation,async()=>{
 const f=fixture();assert.equal((await f.adapted.client.rpc('outreach_registration_workspace',{...args,p_action:mutation})).status,403);assert.equal(f.calls.length,0);
});
for(const invalid of [{...args,p_payload:{email:'no'}},{...args,p_campaign:A+'\n'},{...args,p_user:USER},{...args,p_payload:null}])test('deny malformed RPC arguments '+JSON.stringify(invalid),async()=>{
 const f=fixture();assert.equal((await f.adapted.client.rpc('outreach_registration_workspace',invalid)).status,403);assert.equal(f.calls.length,0);
});
test('deny any other RPC',async()=>{
 const f=fixture();assert.equal((await f.adapted.client.rpc('staff_permission_grant',args)).status,403);assert.equal(f.calls.length,0);
});
test('backend denial overrides local campaign hints',async()=>{
 const f=fixture(),binding=f.bind();binding.select(B);await assert.rejects(binding.refresh(),{code:'ACCESS_DENIED'});assert.equal(f.calls.length,1);assert.equal(binding.snapshot(),null);binding.close();
});
for(const outcome of ['error','unconfirmed','anonymous','different-subject','session-change'])test('provider '+outcome+' denies before RPC',async()=>{
 const f=fixture();f.setUser(()=>{if(outcome==='session-change')f.setSession({user:{id:OTHER},access_token:'fictional-B'});
  return outcome==='error'?{error:{message:'private error'}}:{data:{user:{id:outcome==='different-subject'?OTHER:USER,email_confirmed_at:outcome==='unconfirmed'?null:'2026-11-01',is_anonymous:outcome==='anonymous'}}};});
 assert.equal((await f.adapted.client.rpc('outreach_registration_workspace',args)).status,403);assert.equal(f.calls.length,0);
});
test('changed endpoint cannot use retained adapter',async()=>{
 const f=fixture();f.auth.client.rest.url='https://exdocjbmylgxssanymjk.supabase.co/rest/v1';
 assert.equal((await f.adapted.client.rpc('outreach_registration_workspace',args)).status,403);assert.equal(f.calls.length,0);
});
for(const change of ['abort','account','endpoint','signout'])test('pending response rejected after '+change,async()=>{
 const f=fixture(),slow=gate();f.setHandler(()=>slow.promise);const binding=f.bind();binding.select(A);const pending=binding.refresh();
 while(!f.calls.length)await new Promise(r=>setImmediate(r));
 if(change==='abort')binding.revoke();if(change==='signout')f.emit('SIGNED_OUT');
 if(change==='account')f.setSession({user:{id:OTHER},access_token:'fictional-B'});
 if(change==='endpoint')f.auth.client.supabaseUrl='https://other.supabase.co';
 slow.resolve({data:{capabilities:['registration.view']}});await assert.rejects(pending);assert.equal(binding.snapshot(),null);assert.equal(f.calls.length,1);binding.close();
});
test('denial after list prevents count publication',async()=>{
 const f=fixture();let n=0;f.setHandler(async p=>++n===3?{error:{code:'42501'},status:403}:{data:p.p_action==='context'?{capabilities:['registration.view']}:{summary:counts}});
 const binding=f.bind();binding.select(A);await assert.rejects(binding.refresh(),{code:'ACCESS_DENIED'});assert.equal(binding.snapshot(),null);assert.equal(n,3);binding.close();
});
test('pre-aborted request never verifies or dispatches',async()=>{
 const f=fixture(),abort=new AbortController();abort.abort();assert.equal((await f.adapted.client.rpc('outreach_registration_workspace',args,{signal:abort.signal})).status,403);assert.equal(f.calls.length,0);assert.equal(f.tokens.length,0);
});
