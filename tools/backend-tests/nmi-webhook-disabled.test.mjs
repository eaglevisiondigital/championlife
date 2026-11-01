import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createGivingWebhook} from '../../supabase/functions/nmi-giving-webhook/gateway.mjs';
const project='https://cccccccccccccccccccc.supabase.co',origin='https://fictional--championlifechurch.netlify.app';
const base={project,origins:[origin],serviceKey:'SYNTHETIC_SERVICE',acceptance_pin:{project,name:'champion-life-nmi-giving-acceptance',origins:[origin]}};
const key='SYNTHETIC_SECRET_NEVER_REAL',url=project+'/functions/v1/nmi-giving-webhook?organization=74000000-0000-4000-8000-000000000001&gateway=74000000-0000-4000-8000-000000000031';
const event={event_id:'SyntheticEvent',event_type:'transaction.sale.success',event_body:{features:{is_test_mode:true},merchant:{id:'SyntheticMerchant'},transaction_id:'SyntheticTransaction',processor_id:'SyntheticProcessor'}};
function request(value=event,secret=key){const body=JSON.stringify(value),nonce='synthetic-nonce',signature='t='+nonce+',s='+createHmac('sha256',secret).update(nonce+'.'+body).digest('hex');return new Request(url,{method:'POST',headers:{'Webhook-Signature':signature},body});}
for(const value of [undefined,null,false,'false','true','',0,1,-1,[],[true],{}, {enabled:true},NaN])for(const recoveryEnabled of [false,true])test(`webhook refuses ${String(value)} with recovery=${recoveryEnabled} before body/secret/RPC`,async()=>{
 let bodyReads=0,secretReads=0,rpcCalls=0;
 const handler=createGivingWebhook({...base,enabled:value,recoveryEnabled},async()=>{rpcCalls++;assert.fail('RPC forbidden');},()=>{secretReads++;assert.fail('Secret forbidden');});
 const req=new Proxy(request(),{get(target,key){if(key==='body'){bodyReads++;assert.fail('Body forbidden');}return Reflect.get(target,key,target);}});
 const response=await handler(req);assert.equal(response.status,503);assert.deepEqual(await response.json(),{accepted:false});assert.deepEqual([bodyReads,secretReads,rpcCalls],[0,0,0]);
});
test('literal true retains signed merchant-scoped ingestion; event alone never posts ledger',async()=>{
 const actions=[];const handler=createGivingWebhook({...base,enabled:true},async(url,init)=>{assert.equal(url,project+'/rest/v1/rpc/nmi_giving_service');const p=JSON.parse(init.body);actions.push(p.p_action);return Response.json(p.p_action==='webhook_scope'?{merchant_reference:'SyntheticMerchant'}:{duplicate:false});},()=>key);
 const response=await handler(request());assert.equal(response.status,200);assert.deepEqual(actions,['webhook_scope','webhook']);
});
test('literal true does not bypass signature verification',async()=>{
 let calls=0;const handler=createGivingWebhook({...base,enabled:true},async()=>{calls++;assert.fail('RPC forbidden');},()=>key);assert.equal((await handler(request(event,'WRONG_SYNTHETIC_SECRET'))).status,409);assert.equal(calls,0);
});
test('literal true does not bypass merchant scope',async()=>{
 const actions=[];const handler=createGivingWebhook({...base,enabled:true},async(url,init)=>{actions.push(JSON.parse(init.body).p_action);return Response.json({merchant_reference:'AnotherMerchant'});},()=>key);assert.equal((await handler(request())).status,409);assert.deepEqual(actions,['webhook_scope']);
});
