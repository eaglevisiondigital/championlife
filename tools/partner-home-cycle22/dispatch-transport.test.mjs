// Exercise actual Auth transport with a deliberately controlled SDK double.
// This does not claim provider acceptance or that the pinned SDK retries POST.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../assets/js/champion-life-auth.js',import.meta.url),'utf8');
function fixture({token='fictional-A',replay=false,lost=false}={}){
 let transport,requests=0,signals=[];
 const client={rpc(){return{abortSignal(signal){signals.push(signal);return(async()=>{
  try{const result=await transport('https://fictional.invalid/rest/v1/rpc/outreach_registration_workspace',{method:'POST',headers:{Authorization:'Bearer '+token},signal});if(replay)await transport('https://fictional.invalid/rest/v1/rpc/outreach_registration_workspace',{method:'POST',headers:{Authorization:'Bearer '+token},signal});return result}
  catch(e){return {data:null,error:{code:'TRANSPORT',message:e.message},status:0}}
 })()}}}};
 const window={CHAMPION_LIFE_SUPABASE:{url:'https://fictional.invalid',publishableKey:'fictional'},fetch:async()=>{requests++;if(lost)throw Error('Fictional response lost after dispatch');return{data:{saved:true},error:null,status:200}},supabase:{createClient(_url,_key,options){transport=options.global.fetch;return client}}};
 vm.runInNewContext(source,{window,console,Headers,DOMException,AbortController});
 return{auth:window.ChampionLifeAuth,count:()=>requests,signals,transport:(...args)=>transport(...args)};
}
const call=(f,veto,token='fictional-A')=>f.auth.dispatchGuardedRpc('outreach_registration_workspace',{p_action:'checkin'}, {}, veto, token);
test('only exact true admits guarded dispatch; missing or throwing veto fails closed',async()=>{
 for(const value of [false,undefined,null,1,'true']){const f=fixture(),r=await call(f,()=>value);assert.equal(f.count(),0);assert.equal(r.error.code,'STAFF_CONTROL_RETIRED')}
 const f=fixture();assert.equal((await call(f,()=>{throw Error('retired')})).error.code,'STAFF_CONTROL_RETIRED');await assert.rejects(call(f,null));await assert.rejects(call(f,()=>true,''));assert.equal(f.count(),0);
});
test('actual outgoing bearer must equal verified preflight bearer',async()=>{
 const f=fixture({token:'fictional-B'}),r=await call(f,()=>true);assert.equal(f.count(),0);assert.equal(r.error.code,'STAFF_CONTROL_RETIRED');
});
test('legitimate request submits once without cancellation',async()=>{
 const f=fixture(),r=await call(f,()=>true);assert.equal(f.count(),1);assert.equal(r.data.saved,true);assert.equal(f.signals[0].aborted,false);
});
test('lost response remains uncertain after submission, not proven unsent',async()=>{
 const f=fixture({lost:true}),r=await call(f,()=>true);assert.equal(f.count(),1);assert.equal(r.error.code,'TRANSPORT');assert.equal(f.signals[0].aborted,false);
});
test('attempted transport reuse cannot dispatch again or misclassify submitted outcome as unsent',async()=>{
 const f=fixture({replay:true}),r=await call(f,()=>true);assert.equal(f.count(),1);assert.equal(r.error.code,'TRANSPORT');assert.equal(f.signals[0].aborted,false);
});
test('ordinary unguarded transport and existing requests remain unchanged',async()=>{
 const f=fixture(),r=await f.transport('https://fictional.invalid/auth/v1/user',{method:'GET'});assert.equal(f.count(),1);assert.equal(r.data.saved,true);
});
