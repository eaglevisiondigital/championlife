import test from 'node:test';
import assert from 'node:assert/strict';
import {createChurchOutreachAuthBinding} from './church-outreach-auth-binding.mjs';

const USER='00000000-0000-4000-8000-000000000011';
const OTHER='00000000-0000-4000-8000-000000000022';
const A='00000000-0000-4000-8000-000000000033';
const B='00000000-0000-4000-8000-000000000044';
const COUNTS={households:2,attendees:5,adults:3,minors:2,checked_in:1};
const gate=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve}};
const fail=code=>({error:{code,status:403},status:403});

function fixture(){
 let active=true,subject=USER,sessionSubject=USER,verified=true,anonymous=false;
 let token='fictional-token-not-a-secret',throwAuth=false,authorized=[A],revoked=false;
 let authListener,disposed=0,rpcHandler=null;
 const events=new EventTarget(),snapshots=[],calls=[];
 const user=()=>({id:subject,email_confirmed_at:verified?'2026-01-01T00:00:00Z':null,is_anonymous:anonymous});
 const auth={
  client:{
   auth:{
    getUser:async()=>{if(throwAuth)throw Error('Private provider error');return{data:{user:user()},error:null}},
    onAuthStateChange:fn=>{authListener=fn;return{data:{subscription:{unsubscribe(){disposed++;authListener=null}}}}}
   },
   rpc:async(name,args,options)=>{
    calls.push({name,args,options});
    if(rpcHandler)return rpcHandler(name,args,options);
    if(revoked)return fail('42501');
    if(name!=='outreach_registration_workspace')throw Error('Wrong RPC');
    if(args.p_action==='context')
     return{data:{capabilities:args.p_campaign===A?['registration.view']:[]}};
    return{data:{summary:COUNTS,registrations:[{email:'do-not-show@example.invalid'}],
      finance:{private:'secret'}}};
   }
  },
  getSession:async()=>({user:{id:sessionSubject},access_token:token})
 };
 const shell={active:()=>active};
 const binding=createChurchOutreachAuthBinding({
  auth,workspace:shell,eventTarget:events,
  getAllowedCampaigns:()=>authorized,
  onSnapshot:snapshot=>snapshots.push(snapshot)
 });
 return{
  binding,auth,calls,snapshots,events,
  setUser:id=>{subject=id},
  setSessionUser:id=>{sessionSubject=id},
  setToken:v=>{token=v},
  setVerified:v=>{verified=v},
  setAnonymous:v=>{anonymous=v},
  setActive:v=>{active=v},
  setAuthorized:v=>{authorized=v},
  setRevoked:v=>{revoked=v},
  setHandler:v=>{rpcHandler=v},
  setThrowAuth:v=>{throwAuth=v},
  emitAuth:event=>authListener?.(event,{user:user()}),
  get disposed(){return disposed}
 };
}

test('provider getUser + current token yield only a campaign-authorized count snapshot',async()=>{
 const f=fixture();
 f.binding.select(A);
 const result=await f.binding.refresh();
 assert.deepEqual(result.counts,COUNTS);
 assert.deepEqual(Object.keys(result).sort(),['campaignId','counts','kind']);
 assert.deepEqual(f.calls.map(x=>x.args.p_action),['context','list','context']);
 assert.ok(!JSON.stringify(f.snapshots).includes('do-not-show'));
 assert.ok(!JSON.stringify(f.snapshots).includes('fictional-token'));
 f.binding.close();
 assert.equal(f.disposed,1);
});

test('nonauthorized campaign is rejected before any RPC and clears scope',async()=>{
 const f=fixture();
 assert.throws(()=>f.binding.select(B),{code:'CAMPAIGN_NOT_ALLOWED'});
 assert.equal(f.binding.snapshot(),null);
 assert.equal(f.calls.length,0);
 f.binding.close();
});

test('server-side permission denial overrides locally authorized campaign selection',async()=>{
 const f=fixture();
 f.setRevoked(true);f.binding.select(A);
 await assert.rejects(f.binding.refresh(),{code:'ACCESS_DENIED'});
 assert.equal(f.binding.snapshot(),null);
 assert.equal(f.calls.length,1);
 f.binding.close();
});

for(const invalidity of ['unconfirmed','anonymous','wrong-user','no-token','provider-error']){
 test('invalid provider Auth '+invalidity+' cannot reach registration RPC',async()=>{
  const f=fixture();
  if(invalidity==='unconfirmed')f.setVerified(false);
  if(invalidity==='anonymous')f.setAnonymous(true);
  if(invalidity==='wrong-user')f.setSessionUser(OTHER);
  if(invalidity==='no-token')f.setToken('');
  if(invalidity==='provider-error')f.setThrowAuth(true);
  f.binding.select(A);
  await assert.rejects(f.binding.refresh(),{code:'UNAUTHENTICATED'});
  assert.equal(f.calls.length,0);
  assert.equal(f.binding.snapshot(),null);
  f.binding.close();
 });
}

test('reverified provider subject is mandatory on every reauthorization',async()=>{
 const f=fixture();f.binding.select(A);await f.binding.refresh();
 f.setUser(OTHER);
 await assert.rejects(f.binding.refresh(),{code:'UNAUTHENTICATED'});
 assert.equal(f.binding.snapshot(),null);
 assert.deepEqual(f.calls.map(x=>x.args.p_action),['context','list','context']);
 f.binding.close();
});

test('changing the permitted campaign set revokes selected scope',async()=>{
 const f=fixture();f.binding.select(A);await f.binding.refresh();
 f.setAuthorized([B]);
 await assert.rejects(f.binding.refresh(),{code:'CAMPAIGN_NOT_ALLOWED'});
 assert.equal(f.binding.snapshot(),null);
 assert.equal(f.calls.length,3);
 f.binding.close();
});

test('sign-out immediately clears all data, closes and unsubscribes',async()=>{
 const f=fixture();f.binding.select(A);await f.binding.refresh();
 f.emitAuth('SIGNED_OUT');
 assert.equal(f.binding.snapshot(),null);
 assert.equal(f.snapshots.at(-1),null);
 assert.equal(f.disposed,1);
 assert.throws(()=>f.binding.select(A),{code:'WORKSPACE_CLOSED'});
});

test('token refresh and account event clear the selected scope without Auth callbacks awaiting',async()=>{
 const f=fixture();f.binding.select(A);await f.binding.refresh();
 f.emitAuth('TOKEN_REFRESHED');
 assert.equal(f.binding.snapshot(),null);
 await assert.rejects(f.binding.refresh(),{code:'CAMPAIGN_NOT_ALLOWED'});
 f.binding.select(A);await f.binding.refresh();
 f.emitAuth('USER_UPDATED');
 assert.equal(f.binding.snapshot(),null);
 assert.equal(f.disposed,0);
 f.binding.close();
});

test('staff protected-clear and pagehide close Auth listener as well as composition',async()=>{
 for(const event of ['staff-protected-clear','pagehide']){
  const f=fixture();f.binding.select(A);await f.binding.refresh();
  f.events.dispatchEvent(new Event(event));
  assert.equal(f.binding.snapshot(),null);assert.equal(f.disposed,1);
  assert.throws(()=>f.binding.select(A),{code:'WORKSPACE_CLOSED'});
 }
});

test('inactive workspace refuses reads without any provider RPC',async()=>{
 const f=fixture();f.binding.select(A);f.setActive(false);
 await assert.rejects(f.binding.refresh(),{code:'WORKSPACE_CLOSED'});
 assert.equal(f.calls.length,0);assert.equal(f.disposed,1);
});

test('identity switch mid-request rejects late result, even if context earlier passed',async()=>{
 const f=fixture(),slow=gate();
 f.setHandler(async(_name,p)=>{
  if(p.p_action==='context')return slow.promise;
  return{data:{summary:COUNTS}};
 });
 f.binding.select(A);
 const pending=f.binding.refresh();
 await new Promise(resolve=>setImmediate(resolve));
 f.setSessionUser(OTHER);
 slow.resolve({data:{capabilities:['registration.view']}});
 await assert.rejects(pending,{code:'UNAUTHENTICATED'});
 assert.equal(f.binding.snapshot(),null);
 assert.equal(f.snapshots.filter(Boolean).length,0);
 f.binding.close();
});

test('server revocation after list blocks release, not merely UI navigation',async()=>{
 const f=fixture();let n=0;
 f.setHandler(async(_name,p)=>{
  n++;if(n===3)return fail('42501');
  return p.p_action==='context'?{data:{capabilities:['registration.view']}}:
   {data:{summary:COUNTS,private:[{email:'do-not-show@example.invalid'}]}};
 });
 f.binding.select(A);
 await assert.rejects(f.binding.refresh(),{code:'ACCESS_DENIED'});
 assert.equal(n,3);
 assert.equal(f.snapshots.filter(Boolean).length,0);
 f.binding.close();
});

test('binding exposes no financial operations, exports, grants, account keys or provider configuration',()=>{
 const f=fixture();
 assert.deepEqual(Object.keys(f.binding).sort(),['close','refresh','revoke','select','snapshot']);
 f.binding.close();
});
