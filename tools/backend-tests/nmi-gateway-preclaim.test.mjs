import test from 'node:test';
import assert from 'node:assert/strict';
import {createGivingHandler} from '../../supabase/functions/nmi-giving/gateway.mjs';
const project='https://cccccccccccccccccccc.supabase.co',origin='https://fictional--championlifechurch.netlify.app';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const config=()=>({project,enabled:false,recoveryEnabled:false,acceptance_pin:{name:'champion-life-nmi-giving-acceptance',project,origins:[origin]},origins:[origin],serviceKey:'fictional-service',publicKey:'fictional-public'});
const body=(action,operation='sale')=>({action,operation,organization_id:id(1),session_id:id(2),leg_id:id(3),request_key:id(4),job_id:id(5),form_id:id(6)});
const request=data=>new Request('https://fictional.invalid',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer fictional_session_token_12345'},body:JSON.stringify(data)});
const reply=v=>new Response(JSON.stringify(v),{status:200});
for(const flag of [false,undefined,null,'true','false',0,1,'',[],{}])for(const action of ['create','execute','job'])test(`gateway disabled ${JSON.stringify(flag)} ${action} makes zero requests`,async()=>{
 const c=config();c.enabled=flag;let calls=0;const handler=createGivingHandler(c,()=>{calls++;assert.fail('network');},()=>assert.fail('secret'));
 const r=await handler(request(body(action)));assert.equal(r.status,503);assert.equal(calls,0);
});
for(const flag of [undefined,null,'true','false',0,1,'',[],{}])test(`malformed recovery ${JSON.stringify(flag)} cannot arm gateway`,async()=>{
 const c=config();c.recoveryEnabled=flag;let calls=0;assert.equal((await createGivingHandler(c,()=>{calls++;throw Error();})(request(body('execute','transaction')))).status,503);assert.equal(calls,0);
});
for(const operation of ['sale','authorize','capture','recurring_create',undefined,'unknown'])test(`recovery-only rejects ${operation} before prepare`,async()=>{
 const c=config();c.recoveryEnabled=true;let calls=0;const data=body('execute');data.operation=operation;
 assert.equal((await createGivingHandler(c,()=>{calls++;throw Error();})(request(data))).status,503);assert.equal(calls,0);
});
for(const action of ['job','create','form'])test(`recovery-only rejects opaque ${action} before claim or authentication`,async()=>{
 const c=config();c.recoveryEnabled=true;let calls=0;assert.equal((await createGivingHandler(c,()=>{calls++;throw Error();})(request(body(action)))).status,503);assert.equal(calls,0);
});
for(const action of ['execute','job'])test(`disabled during authentication blocks earlier ${action} claim`,async()=>{
 const c=config();c.enabled=true;const calls=[];const fetcher=async url=>{calls.push(url);if(url.endsWith('/auth/v1/user')){c.enabled=false;return reply({id:id(7),email_confirmed_at:'synthetic',is_anonymous:false});}assert.fail('durable RPC');};
 const response=await createGivingHandler(c,fetcher)(request(body(action)));assert.equal(response.status,409);assert.equal((await response.json()).retry_automatically,false);assert.equal(calls.length,1);
});
for(const action of ['execute','job'])test(`enabled ${action} reaches only its expected fictional claim`,async()=>{
 const c=config();c.enabled=true;const calls=[];const fetcher=async(url,opts)=>{if(url.endsWith('/auth/v1/user'))return reply({id:id(7),email_confirmed_at:'synthetic'});const p=JSON.parse(opts.body);calls.push(p.p_action);if(p.p_action==='prepare')return reply({state:'review'});if(p.p_action==='status')return reply({status:'review',retry_automatically:false});if(p.p_action==='operation_job')return reply({claimed:false});assert.fail('unexpected RPC');};
 const response=await createGivingHandler(c,fetcher,()=>assert.fail('secret'))(request(body(action)));assert.equal(response.status,200);assert.deepEqual(calls,action==='job'?['operation_job']:['prepare','status']);
});
for(const operation of ['transaction','refund','void','recurring_cancel','recurring_pause'])test(`pinned recovery ${operation} preserves explicit recovery without new submission`,async()=>{
 const c=config();c.recoveryEnabled=true;const calls=[];const fetcher=async(url,opts)=>{if(url.endsWith('/auth/v1/user'))return reply({id:id(7),email_confirmed_at:'synthetic'});const p=JSON.parse(opts.body);calls.push(p.p_action);if(p.p_action==='prepare')return reply({state:'review'});if(p.p_action==='status')return reply({status:'review',retry_automatically:false});assert.fail('provider');};
 const response=await createGivingHandler(c,fetcher)(request(body('execute',operation)));assert.equal(response.status,200);assert.deepEqual(calls,['prepare','status']);
});
for(const action of ['status','shutdown','operations'])test(`recovery-only ${action} keeps existing administrative recovery boundary`,async()=>{
 const c=config();c.recoveryEnabled=true;const calls=[];const fetcher=async(url,opts)=>{if(url.endsWith('/auth/v1/user'))return reply({id:id(7),email_confirmed_at:'synthetic'});const p=JSON.parse(opts.body);calls.push(p.p_action);return reply({status:'held'});};
 assert.equal((await createGivingHandler(c,fetcher)(request(body(action)))).status,200);assert.deepEqual(calls,[action]);
});
test('concurrent disabled duplicate requests never prepare or claim',async()=>{
 const calls=[];const handler=createGivingHandler(config(),(...args)=>{calls.push(args);throw Error();});const responses=await Promise.all(Array.from({length:20},()=>handler(request(body('execute')))));assert(responses.every(r=>r.status===503));assert.deepEqual(calls,[]);
});
for(const user of [{id:id(7)}, {id:id(7),email_confirmed_at:'synthetic',is_anonymous:true}, {id:'unverified',email_confirmed_at:'synthetic'}])test(`unverified identity ${JSON.stringify(user)} cannot claim job`,async()=>{
 const c=config();c.enabled=true;let rpc=0;const r=await createGivingHandler(c,async url=>{if(url.endsWith('/auth/v1/user'))return reply(user);rpc++;throw Error();})(request(body('job')));assert.equal(r.status,409);assert.equal(rpc,0);
});
test('disabled during challenge verification cannot create a giving session',async()=>{
 const c=config();Object.assign(c,{enabled:true,turnstileSecret:'fictional-challenge',pepper:'synthetic-pepper-at-least-thirty-two-characters'});const calls=[];
 const fetcher=async url=>{calls.push(url);if(url.endsWith('/auth/v1/user'))return reply({id:id(7),email_confirmed_at:'synthetic'});if(url.endsWith('/siteverify')){c.enabled=false;return reply({success:true,action:'nmi_giving',hostname:new URL(origin).hostname});}assert.fail('create RPC');};
 const req=request({...body('create'),capability:'a'.repeat(64),challenge_token:'fictional'});req.headers.set('CF-Connecting-IP','192.0.2.1');const r=await createGivingHandler(c,fetcher)(req);assert.equal(r.status,409);assert.equal(calls.length,2);
});
