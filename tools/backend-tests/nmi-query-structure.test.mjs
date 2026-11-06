// Fictional XML and injected transport only; never calls a provider or posts a ledger.
import test from 'node:test';
import assert from 'node:assert/strict';
import {queryProjection,createNmiQuery} from '../../supabase/functions/_shared/payments/nmi-query.mjs';
import {executeNmiGiving} from '../../supabase/functions/_shared/payments/nmi-executor.mjs';
const scope={organization_id:'74000000-0000-4000-8000-000000000001',gateway_id:'74000000-0000-4000-8000-000000000031',provider:'nmi',environment:'sandbox',secret_version:1,processor_id:'FictionalProcessor',route_verified:true,currency:'USD'};
const project='https://cccccccccccccccccccc.supabase.co',config={project,enabled:true,organization_id:scope.organization_id,gateway_id:scope.gateway_id,acceptance_pin:{name:'champion-life-nmi-giving-acceptance',project}};
const fields='<transaction_id>FictionalTransaction</transaction_id><processor_id>FictionalProcessor</processor_id><currency>USD</currency><condition>complete</condition><order_id>FictionalOrder</order_id>';
const action=(type='sale',amount='50.00')=>`<action><action_type>${type}</action_type><amount>${amount}</amount><success>1</success><batch_id>FictionalBatch</batch_id></action>`;
const xml=`<nm_response><transaction>${fields}${action()}</transaction></nm_response>`;
const wrap=s=>`<nm_response><transaction>${s}</transaction></nm_response>`;
const query=(body,counters={queries:0})=>createNmiQuery({config,scope,readSecret:()=> 'FICTIONAL_KEY_NEVER_REAL',fetcher:async(url,init)=>{assert.equal(url,'https://sandbox.nmi.com/api/query.php');assert.equal(init.method,'POST');assert.equal(init.redirect,'error');counters.queries++;return new Response(body)}});
const malformed=[
 ['unclosed additional transaction',xml.replace('</nm_response>','<transaction></nm_response>')],
 ['unclosed unknown tail',xml.replace('</nm_response>','<unknown></nm_response>')],
 ['mismatched wrapper',xml.replace('<transaction>','<unknown><transaction>')],
 ['wrong closing element',xml.replace('</order_id>','</other>')],
 ['second root',xml+xml],['extra root close',xml+'</nm_response>'],
 ['non-XML leading whitespace','\u00a0'+xml],['non-XML trailing whitespace',xml+'\ufeff'],
 ['non-XML root whitespace',xml.replace('<nm_response>','<nm_response>\u2003')],
 ['non-XML transaction whitespace',xml.replace('<transaction>','<transaction>\u00a0')],
 ['non-XML action whitespace',xml.replace('<action>','<action>\u00a0')],
 ['leading text','fictional'+xml],['trailing text',xml+'fictional'],
 ['invalid unknown entity',xml.replace('</transaction>','<ignored>&unknown;</ignored></transaction>')],
 ['raw ampersand',xml.replace('</transaction>','<ignored>A&B</ignored></transaction>')],
 ['unclosed tag',xml.replace('</transaction>','<ignored</transaction>')],
 ['unclosed comment',xml.replace('</transaction>','<!--</transaction>')],
 ['comment transaction',`<nm_response><!--${xml.replace(/<\/?nm_response>/g,'')}--></nm_response>`],
 ['DTD','<!DOCTYPE nm_response>'+xml],['numeric entity',xml.replace('FictionalOrder','&#70;ictionalOrder')],
 ['unknown processing instruction',xml.replace('</transaction>','<?unknown?></transaction>')],
 ['unsupported attribute',xml.replace('<transaction>','<transaction id="fictional">')],
 ['nested transaction',`<nm_response><transaction>${xml.replace(/<\/?nm_response>/g,'')}</transaction></nm_response>`],
 ['root nontransaction element',xml.replace('</nm_response>','<ignored/></nm_response>')],
 ['invalid character',xml.replace('</transaction>','<ignored>\u0001</ignored></transaction>')],
 ['invalid surrogate',xml.replace('</transaction>','<ignored>\ud800</ignored></transaction>')],
 ['CDATA terminator text',xml.replace('</transaction>','<ignored>]]></ignored></transaction>')],
 ['duplicate scalar',xml.replace('</transaction>','<currency>USD</currency></transaction>')],
 ['duplicate direct amount',wrap(fields+'<amount>50.00</amount><amount>25.00</amount>'+action())],
 ['nested scalar value',xml.replace('<currency>USD</currency>','<currency><nested>USD</nested></currency>')],
 ['nested action',wrap(fields+'<product>'+action()+'</product>')],
 ['nested identity only',wrap('<product>'+fields+'</product>'+action())],
 ['mixed transaction text',xml.replace('<transaction>','<transaction>fictional')],
 ['mixed root text',xml.replace('<nm_response>','<nm_response>fictional')],
 ['mixed action text',xml.replace('<action>','<action>fictional')],
 ['unsupported XML declaration','<?xml version="1.0" encoding="UTF-16"?>'+xml],
 ['depth bound',xml.replace('</transaction>','<ignored>'.repeat(20)+'text'+'</ignored>'.repeat(20)+'</transaction>')],
];
for(const [name,body] of malformed)test(`structural ambiguity stays UNKNOWN: ${name}`,()=>assert.throws(()=>queryProjection(body,scope)));
test('direct-parent amount ignores documented product amount and unrelated metadata',()=>{
 const body=wrap(fields+'<product><sku>FictionalSKU</sku><amount>25.00</amount></product>'+action());
 assert.equal(queryProjection(body,scope)[0].amount_minor,'5000');
 assert.equal(queryProjection(body.replace('<product>','<product><currency>EUR</currency><transaction_id>OtherTransaction</transaction_id>'),scope)[0].provider_reference,'FictionalTransaction');
 assert(!JSON.stringify(queryProjection(body,scope)).includes('FictionalSKU'));
});
test('transaction amount, action refunds and settlement batches bind only direct fields',()=>{
 const rows=queryProjection(wrap(fields+'<amount>50.00</amount><product><amount>0.01</amount></product>'+action()+action('refund','5.00')+action('settle')),scope);
 assert.equal(rows[0].amount_minor,'5000');assert.equal(rows[0].refunded_minor,'500');assert.equal(rows[0].batches[0].gross_minor,'5000');
});
test('bounded documented XML declaration, empty fields and ordinary named entities are accepted',()=>{
 const body='<?xml version="1.0" encoding="UTF-8"?>\n'+wrap(fields+'<ignored>A &amp; B &lt; C &gt; D &quot; E &apos; F &amp;lt;</ignored><empty/>'+action());
 assert.equal(queryProjection(body,scope)[0].amount_minor,'5000');assert.deepEqual(queryProjection('<nm_response/>',scope),[]);assert.deepEqual(queryProjection('<nm_response></nm_response>',scope),[]);
});
test('unknown and inherited-object condition names are never authoritative',async()=>{
 for(const condition of ['unknown','toString','constructor','__proto__']){const r=await query(xml.replace('<condition>complete</condition>',`<condition>${condition}</condition>`)).transaction({order_reference:'FictionalOrder'});assert.equal(r.authoritative,false);assert.equal(r.status,'review');}
});
test('malformed transaction and batch lookups both fail instead of returning complete',async()=>{
 for(const [,body] of malformed.slice(0,8)){await assert.rejects(()=>query(body).transaction({order_reference:'FictionalOrder'}));await assert.rejects(()=>query(body).batch({batch_reference:'FictionalBatch',date:'2026-11-06'}));}
});
test('executor holds malformed lookup with no payment mutation or automatic retry',async()=>{
 for(const [,body] of malformed.slice(0,8)){
  const actions=[],transport=[];const claim={claimed:true,scope,operation:'transaction',lease:'FictionalLease',amount_minor:'5000',order_reference:'FictionalOrder'};
  const result=await executeNmiGiving({config:{...config,enabled:false,recoveryEnabled:true},organization_id:scope.organization_id,session_id:'FictionalSession',id:'FictionalAttempt',rpc:async(a,o,p)=>{actions.push(a);return a==='complete'?p:claim},readSecret:()=> 'FICTIONAL_KEY_NEVER_REAL',fetcher:async(url)=>{transport.push(url);return new Response(body)}});
  assert.deepEqual(actions,['claim','handoff','complete']);assert.deepEqual(transport,['https://sandbox.nmi.com/api/query.php']);assert.equal(result.status,'review');assert.equal(result.authoritative,false);assert.equal(result.category,'unknown');assert.equal(result.provider_reference,undefined);
 }
});
test('invalid UTF-8 cannot silently become a different lookup document',async()=>{
 const before=new TextEncoder().encode('<nm_response><transaction>'+fields+action()+'<ignored>'),after=new TextEncoder().encode('</ignored></transaction></nm_response>');
 const bytes=new Uint8Array(before.length+1+after.length);bytes.set(before);bytes[before.length]=0xff;bytes.set(after,before.length+1);
 await assert.rejects(()=>query(bytes).transaction({order_reference:'FictionalOrder'}));
});
