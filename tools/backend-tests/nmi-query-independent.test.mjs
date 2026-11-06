// Independent parser/executor probes. Fictional XML, no provider connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {queryProjection,createNmiQuery} from '../../supabase/functions/_shared/payments/nmi-query.mjs';
import {executeNmiGiving} from '../../supabase/functions/_shared/payments/nmi-executor.mjs';
const scope={organization_id:'74000000-0000-4000-8000-000000000001',gateway_id:'74000000-0000-4000-8000-000000000031',provider:'nmi',environment:'sandbox',secret_version:1,processor_id:'IndependentFixture',route_verified:true,currency:'USD'};
const project='https://cccccccccccccccccccc.supabase.co',config={project,enabled:true,organization_id:scope.organization_id,gateway_id:scope.gateway_id,acceptance_pin:{name:'champion-life-nmi-giving-acceptance',project}};
const fields='<transaction_id>FixtureTransaction</transaction_id><processor_id>IndependentFixture</processor_id><currency>USD</currency><condition>complete</condition><order_id>FixtureOrder</order_id>';
const action=(type='sale',amount='11.00',extra='')=>`<action><action_type>${type}</action_type><amount>${amount}</amount><success>1</success>${extra}</action>`;
const wrap=body=>`<nm_response><transaction>${body}</transaction></nm_response>`,xml=wrap(fields+action());
const unknown=body=>assert.throws(()=>queryProjection(body,scope),e=>['unknown','configuration_error'].includes(e.category)&&e.retry_automatically===false&&e.message!=='FICTIONAL_PRIVATE_DATA');
const query=body=>createNmiQuery({config,scope,readSecret:()=> 'FICTIONAL_ONLY',fetcher:async(url,init)=>{assert.equal(url,'https://sandbox.nmi.com/api/query.php');assert.equal(init.redirect,'error');return new Response(body)}});

// XML S consists solely of space, tab, carriage return and line feed.
for(const[name,value]of[['NBSP','\u00a0'],['BOM','\ufeff'],['EM SPACE','\u2003'],['LINE SEPARATOR','\u2028'],['NARROW NBSP','\u202f']]){
 for(const[position,body]of[['before',value+xml],['after',xml+value],['root',xml.replace('<nm_response>','<nm_response>'+value)],['action',xml.replace('<action>','<action>'+value)]])test(`independent non-XML separator ${name} ${position}`,()=>unknown(body));
}
test('independent XML whitespace positive control and leaf Unicode content',()=>{
 const body=' \t\r\n'+wrap(fields+'<ignored>Fictional\u00a0text</ignored>'+action()).replace('<transaction>','<transaction> \t\r\n').replace('<action>','<action> \t\r\n')+'\n';
 assert.equal(queryProjection(body,scope)[0].amount_minor,'1100');
});
test('independent parent binding follows documented product/action structure',()=>{
 const product='<product><sku>FixtureSKU</sku><quantity>1.0000</quantity><amount>10.0000</amount><transaction_id>WrongTransaction</transaction_id><processor_id>WrongProcessor</processor_id><currency>EUR</currency><condition>failed</condition><order_id>WrongOrder</order_id>'+action('refund','999.00')+'</product>';
 const actual=queryProjection(wrap(fields+product+action()+action('settle','11.00','<batch_id>FixtureBatch</batch_id>')),scope)[0];
 assert.equal(actual.amount_minor,'1100');assert.equal(actual.refunded_minor,'0');assert.equal(actual.provider_reference,'FixtureTransaction');assert.equal(actual.processor_id,'IndependentFixture');assert.equal(actual.order_reference,'FixtureOrder');assert.equal(actual.status,'settled');assert.deepEqual(actual.batches,[{batch_reference:'FixtureBatch',gross_minor:'1100'}]);assert(!JSON.stringify(actual).includes('FixtureSKU'));
});
test('independent nested action fields do not shadow direct settlement/refund values',()=>{
 const hidden='<product><amount>99.00</amount><batch_id>WrongBatch</batch_id><success>0</success><action_type>sale</action_type></product>';
 const actual=queryProjection(wrap(fields+action()+action('refund','2.00',hidden)+action('settle','11.00',hidden+'<batch_id>FixtureBatch</batch_id>')),scope)[0];
 assert.equal(actual.refunded_minor,'200');assert.deepEqual(actual.batches,[{batch_reference:'FixtureBatch',gross_minor:'1100'}]);
});
const invalid=[
 ['action amount contains an element',wrap(fields+action().replace('<amount>11.00</amount>','<amount>11.00<unknown/></amount>'))],
 ['duplicate action success',wrap(fields+action('sale','11.00','<success>0</success>'))],
 ['duplicate action type',wrap(fields+action('sale','11.00','<action_type>refund</action_type>'))],
 ['duplicate settlement batch',wrap(fields+action('settle','11.00','<batch_id>One</batch_id><batch_id>Two</batch_id>'))],
 ['scalar only in nested parent',wrap(fields.replace('<currency>USD</currency>','<metadata><currency>USD</currency></metadata>')+action())],
 ['well formed first record cannot hide incomplete second',xml.replace('</nm_response>','<transaction><transaction_id>Other</transaction_id></transaction></nm_response>')],
 ['unclosed root after valid record',xml.replace('</nm_response>','')],
 ['closing tag self closes',xml.replace('</transaction>','</transaction/>')],
 ['namespace shape unsupported',xml.replace('<transaction>','<transaction xmlns="fixture">')],
 ['unsupported escaped Unicode separator',xml.replace('</transaction>','<ignored>&#x20;</ignored></transaction>')],
 ['second declaration',xml+'<?xml version="1.0"?>'],
 ['size boundary','<nm_response>'+(' '.repeat(1048576))+'</nm_response>'],
 ['node bound',wrap(fields+action()+'<ignored/>'.repeat(50001))],
 ['transaction count bound','<nm_response>'+('<transaction>'+fields+action()+'</transaction>').repeat(101)+'</nm_response>'],
];
for(const[name,body]of invalid)test('independent rejected response: '+name,()=>unknown(body));
test('independent sibling records cannot supply missing required fields',()=>{
 const a=fields.replace('<processor_id>IndependentFixture</processor_id>',''),b=fields.replace('FixtureTransaction','SecondTransaction');
 unknown('<nm_response><transaction>'+a+action()+'</transaction><transaction>'+b+action()+'</transaction></nm_response>');
});
test('independent duplicate matching records produce non-authoritative lookup',async()=>{
 const duplicate='<nm_response>'+('<transaction>'+fields+action()+'</transaction>').repeat(2)+'</nm_response>';
 assert.deepEqual(await query(duplicate).transaction({order_reference:'FixtureOrder'}),{status:'review',category:'unknown',authoritative:false});
});
test('independent empty query is not terminal no-pending evidence',async()=>{
 const actual=await query('<nm_response/>').transaction({order_reference:'FixtureOrder'});assert.equal(actual.authoritative,false);assert.equal(actual.status,'review');
});
for(const[name,body]of[['separator',xml+'\u00a0'],['two roots',xml+xml],['partial second',xml.replace('</nm_response>','<transaction></nm_response>')],['missing processor',wrap(fields.replace('<processor_id>IndependentFixture</processor_id>','')+action())],['nested currency',wrap(fields.replace('<currency>USD</currency>','<extra><currency>USD</currency></extra>')+action())]]){
 test('independent recovery executor holds '+name,async()=>{
  const calls=[],requests=[],claim={claimed:true,scope,operation:'transaction',lease:'FixtureLease',amount_minor:'1100',order_reference:'FixtureOrder'};
  const result=await executeNmiGiving({config:{...config,enabled:false,recoveryEnabled:true},organization_id:scope.organization_id,session_id:'FixtureSession',id:'FixtureAttempt',rpc:async(action,org,p)=>{assert.equal(org,scope.organization_id);calls.push(action);return action==='complete'?p:claim},readSecret:()=> 'FICTIONAL_ONLY',fetcher:async(url,init)=>{requests.push({url,params:new URLSearchParams(init.body)});return new Response(body)}});
  assert.deepEqual(calls,['claim','handoff','complete']);assert.equal(requests.length,1);assert.equal(requests[0].url,'https://sandbox.nmi.com/api/query.php');assert.equal(requests[0].params.get('order_id'),'FixtureOrder');assert.equal(result.status,'review');assert.equal(result.category,name==='missing processor'?'configuration_error':'unknown');assert.equal(result.authoritative,false);assert.equal(result.provider_reference,undefined);assert(!JSON.stringify(result).includes('<'));assert(!JSON.stringify(result).includes('FICTIONAL_ONLY'));
 });
}
