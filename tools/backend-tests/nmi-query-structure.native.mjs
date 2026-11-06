// Disposable native PostgreSQL, existing migrations and fictional query responses.
// No external connection, payment transport, real identity or activation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {localPostgres} from './local-postgres.mjs';
import {migrationOrder} from './migration-order.mjs';
import {paymentsFixtureSQL} from './payments-fixture.mjs';
import {seed,f,form,cap,network} from './nmi-execution-fixture.mjs';
import {executeNmiGiving} from '../../supabase/functions/_shared/payments/nmi-executor.mjs';
const db=await localPostgres(),q=(...a)=>db.query(...a);let checks=0,queries=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const svc=async(action,payload)=>{const c=await db.connect();try{await c.query('begin;set local role service_role');const r=(await c.query('select public.nmi_giving_service($1,$2,$3) v',[action,f.org,payload])).rows[0].v;await c.query('commit');return r;}catch(e){await c.query('rollback');throw e;}finally{await c.end();}};
const project='https://cccccccccccccccccccc.supabase.co',config={project,enabled:false,recoveryEnabled:true,acceptance_pin:{name:'champion-life-nmi-giving-acceptance',project}};
const action=(amount='25.00')=>`<action><action_type>sale</action_type><amount>${amount}</amount><success>1</success></action>`;
const modes=['valid','unclosed-transaction','mismatched-wrapper','nested-product-total','unknown-status'];
try{
 await db.exec(readFileSync(new URL('./fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));
 for(const name of migrationOrder)await db.exec(readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.exec(paymentsFixtureSQL);await db.exec(seed);
 // Enabling fictional SQL rows lets the existing state machine be exercised.
 // Actual executor checkout stays false; only its injected read-only query exists.
 await db.exec('update giving_organization_config set recurring_enabled=false;update private.nmi_giving_forms set recurring_allowed=false;');
 for(const mode of modes){
  const s=await svc('create',{form_id:form,request_key:randomUUID(),capability_hash:cap,network_hash:network,receipt_email:randomUUID()+'@example.test',donor_name:'Fictional',frequency:'once',lines:[{fund_id:f.mainFund,amount_minor:'2500'}]});
  const original=await svc('prepare',{session_id:s.session_id,leg_id:s.legs[0].id,operation:'sale',capability_hash:cap,request_key:randomUUID()});
  const claim=await svc('claim',{session_id:s.session_id,id:original.id});await svc('handoff',{session_id:s.session_id,id:original.id,lease:claim.lease});
  await svc('complete',{session_id:s.session_id,id:original.id,lease:claim.lease,status:'review',category:'unknown',authoritative:false});
  const lookup=await svc('prepare',{session_id:s.session_id,leg_id:s.legs[0].id,operation:'transaction',actor_id:f.admin,parent_attempt_id:original.id,request_key:randomUUID()});
  const fields=`<transaction_id>Fictional_${original.id}</transaction_id><processor_id>synthetic-main</processor_id><currency>USD</currency><condition>${mode==='unknown-status'?'constructor':'complete'}</condition><order_id>${original.id}</order_id>`;
  let xml=`<nm_response><transaction>${fields}${mode==='nested-product-total'?'<product><amount>25.00</amount></product>'+action('50.00'):action()}</transaction></nm_response>`;
  if(mode==='unclosed-transaction')xml=xml.replace('</nm_response>','<transaction></nm_response>');
  if(mode==='mismatched-wrapper')xml=xml.replace('<transaction>','<unclosed><transaction>');
  const calls=[];await executeNmiGiving({config,organization_id:f.org,session_id:s.session_id,id:lookup.id,rpc:async(a,o,p)=>{assert.equal(o,f.org);calls.push(a);return svc(a,p)},readSecret:()=> 'FICTIONAL_KEY_NEVER_REAL',fetcher:async(url,init)=>{equal(url,'https://sandbox.nmi.com/api/query.php',mode+' read-only query transport');equal(new URLSearchParams(init.body).get('order_id'),original.id,mode+' original operation identity');queries++;return new Response(xml)}});
  equal(calls,['claim','handoff','complete'],mode+' only existing lookup state transitions');
  const ledger=(await q('select count(*)::int n,coalesce(sum(amount_minor),0)::int amount from giving_ledger where session_id=$1',[s.session_id])).rows[0];
  equal(ledger,{n:mode==='valid'?1:0,amount:mode==='valid'?2500:0},mode+' exact ledger result');
  equal((await q('select count(*)::int n from private.nmi_giving_receipt_outbox o join giving_receipts r on r.id=o.receipt_id where r.session_id=$1',[s.session_id])).rows[0].n,mode==='valid'?1:0,mode+' no false receipt');
  await assert.rejects(()=>svc('prepare',{session_id:s.session_id,leg_id:s.legs[0].id,operation:'sale',capability_hash:cap,request_key:randomUUID()}));checks++;console.log('PASS '+mode+' cannot repeat original charge');
 }
 equal(queries,modes.length,'one query per original recovery, no retries');
 equal(config.enabled,false,'actual checkout remains disabled');
 equal((await q('select count(*)::int n from giving_recurring_instructions')).rows[0].n,0,'no recurring instructions');
 equal((await q("select count(*)::int n from private.nmi_giving_receipt_outbox where state<>'held'")).rows[0].n,0,'all receipts remain held');
 console.log(JSON.stringify({status:'PASS',checks,providerNetworkCalls:0,hosted:false,checkoutEnabled:false,automaticRetry:false}));
}finally{await db.close();console.log('CLEANUP PASS own native cluster stopped and removed');}
