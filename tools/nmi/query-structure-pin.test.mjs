// Exercise the exact hash-checked executor dependency. All transport is fictional.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPinnedExecutor} from './pinned-executor.mjs';
const execute=await loadPinnedExecutor(),project='https://cccccccccccccccccccc.supabase.co';
const scope={organization_id:'74000000-0000-4000-8000-000000000001',gateway_id:'74000000-0000-4000-8000-000000000031',provider:'nmi',environment:'sandbox',secret_version:1,processor_id:'FictionalProcessor',route_verified:true,currency:'USD'};
const config={project,enabled:false,recoveryEnabled:true,acceptance_pin:{name:'champion-life-nmi-giving-acceptance',project}};
const body='<transaction><transaction_id>FictionalTransaction</transaction_id><processor_id>FictionalProcessor</processor_id><currency>USD</currency><order_id>FictionalOrder</order_id><condition>complete</condition><action><action_type>sale</action_type><amount>50.00</amount><success>1</success></action></transaction>';
const xml='<nm_response>'+body+'</nm_response>';
async function review(response){
 const calls=[],requests=[],claim={claimed:true,scope,operation:'transaction',lease:'FictionalLease',amount_minor:'5000',order_reference:'FictionalOrder'};
 const result=await execute({config,organization_id:scope.organization_id,session_id:'FictionalSession',id:'FictionalAttempt',rpc:async(a,o,p)=>{assert.equal(o,scope.organization_id);calls.push(a);return a==='complete'?p:claim},readSecret:()=> 'FICTIONAL_KEY_NEVER_REAL',fetcher:async(url,init)=>{requests.push(url);assert.equal(init.method,'POST');assert.equal(new URLSearchParams(init.body).get('order_id'),'FictionalOrder');return new Response(response)}});
 assert.deepEqual(calls,['claim','handoff','complete']);assert.deepEqual(requests,['https://sandbox.nmi.com/api/query.php']);return result;
}
test('exact pinned query preserves valid original-order recovery projection',async()=>{
 const r=await review(xml);assert.equal(r.authoritative,true);assert.equal(r.status,'settled');assert.equal(r.amount_minor,'5000');
});
for(const [name,response] of [
 ['unclosed transaction',xml.replace('</nm_response>','<transaction></nm_response>')],
 ['mismatched nesting',xml.replace('<transaction>','<unclosed><transaction>')],
 ['non-XML root separator','\u00a0'+xml],
 ['duplicate amount',xml.replace('</transaction>','<amount>50.00</amount><amount>25.00</amount></transaction>')],
])test('exact pinned query holds '+name,async()=>{
 const r=await review(response);assert.equal(r.authoritative,false);assert.equal(r.status,'review');assert.equal(r.category,'unknown');assert.equal(r.provider_reference,undefined);
});
test('exact pinned query never substitutes a product price for transaction total',async()=>{
 const r=await review(xml.replace('</transaction>','<product><amount>25.00</amount></product></transaction>'));assert.equal(r.amount_minor,'5000');assert.equal(r.authoritative,true);
});
test('exact pinned query holds unsupported inherited-object status',async()=>{
 const r=await review(xml.replace('<condition>complete</condition>','<condition>constructor</condition>'));assert.equal(r.authoritative,false);assert.equal(r.status,'review');
});
