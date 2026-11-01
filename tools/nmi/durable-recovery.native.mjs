// Existing handler/executor/query parser plus real disposable PostgreSQL. No network fallback.
import assert from 'node:assert/strict';
import {randomUUID as uid,createHmac} from 'node:crypto';
import {verifiedDurableSources,pinnedFinancialFixtures} from './durable-source.mjs';
import {loadPinnedGateway,loadPinnedWebhook} from './pinned-executor.mjs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
const sources=verifiedDurableSources(),{f,paymentsFixtureSQL}=await pinnedFinancialFixtures(sources);
const db=await localPostgres(),q=(...a)=>db.query(...a);let checks=0;const ok=(x,label)=>{assert.ok(x,label);checks++;console.log('PASS '+label);};
const svc=async(action,payload,org=f.org)=>{const c=await db.connect();try{await c.query('begin;set local role service_role');const r=(await c.query('select public.nmi_giving_service($1,$2,$3) v',[action,org,payload])).rows[0].v;await c.query('commit');return r;}catch(e){await c.query('rollback');throw e;}finally{await c.end();}};
const form=uid(),cap='a'.repeat(64),network='b'.repeat(64),key='SYNTHETIC_SECRET_NEVER_REAL';
const project='https://cccccccccccccccccccc.supabase.co',origin='https://fictional--championlifechurch.netlify.app';
const config={project,enabled:false,recoveryEnabled:true,serviceKey:'SYNTHETIC_SERVICE_KEY',publicKey:'SYNTHETIC_PUBLIC',origins:[origin],acceptance_pin:{project,name:'champion-life-nmi-giving-acceptance',origins:[origin]}};
let unresolved;let mode='settled',calls=[],providerQueries=[],secretReads=0,releaseQuery=null,enteredQuery=null;
const records=new Map();
const xml=r=>`<nm_response><transaction><transaction_id>${r.id}</transaction_id><processor_id>${mode==='wrong-processor'?'WrongProcessor':'SyntheticProcessor'}</processor_id><currency>${mode==='wrong-currency'?'EUR':'USD'}</currency><order_id>${mode==='wrong-order'?'WrongOrder':r.order}</order_id><condition>${mode==='failed'?'failed':'complete'}</condition><amount>${mode==='wrong-amount'?'26.00':'25.00'}</amount></transaction></nm_response>`;
const transport=async(url,init={})=>{
 if(url===project+'/auth/v1/user')return Response.json({id:f.admin,email_confirmed_at:'2026-11-01T00:00:00Z',is_anonymous:false});
 if(url===project+'/rest/v1/rpc/nmi_giving_service'){
  const p=JSON.parse(init.body);calls.push(p.p_action);
  try{return Response.json(await svc(p.p_action,p.p_payload,p.p_org));}catch{return Response.json({error:'denied'},{status:403});}
 }
 assert.equal(url,'https://sandbox.nmi.com/api/query.php','no mutation provider endpoint permitted');
 const params=new URLSearchParams(init.body);assert.equal(params.get('security_key'),key);providerQueries.push({transactionId:params.get('transaction_id'),orderId:params.get('order_id')});
 assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
 if(mode==='delayed'){enteredQuery?.();await new Promise(resolve=>{releaseQuery=resolve;});}
 if(mode==='timeout')throw Error('SYNTHETIC_UNCERTAIN');
 const r=params.has('transaction_id')?[...records.values()].find(x=>x.id===params.get('transaction_id')):records.get(params.get('order_id'));
 return new Response(mode==='absent'||!r?'<nm_response></nm_response>':mode==='ambiguous'?'<nm_response>'+xml(r).replace(/<\/?nm_response>/g,'').repeat(2)+'</nm_response>':xml(r),{headers:{'Content-Type':'application/xml'}});
};
const readSecret=()=>{secretReads++;return key;};
const ledger=s=>q('select count(*)::int n from giving_ledger where session_id=$1',[s.session_id]).then(r=>r.rows[0].n);
const create=()=>svc('create',{form_id:form,request_key:uid(),capability_hash:cap,network_hash:network,receipt_email:uid()+'@example.test',donor_name:'SYNTHETIC',frequency:'once',lines:[{fund_id:f.mainFund,amount_minor:'2500'}]});
async function unknown(){const s=await create(),p=await svc('prepare',{session_id:s.session_id,leg_id:s.legs[0].id,operation:'sale',capability_hash:cap,request_key:uid()}),c=await svc('claim',{session_id:s.session_id,id:p.id});await svc('handoff',{session_id:s.session_id,id:p.id,lease:c.lease});await svc('complete',{session_id:s.session_id,id:p.id,lease:c.lease,status:'review',category:'unknown',authoritative:false});records.set(p.id,{id:'Synthetic_'+p.id,order:p.id});return{s,p};}
try{
 for(const row of sources.filter(x=>x.kind!=='fixture-module')){await db.exec(row.sql);if(row.kind==='local-bootstrap')await db.exec('create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;');}
 await db.exec(paymentsFixtureSQL);
 await q('update giving_organization_config set recurring_enabled=false');
 // Fictional SQL state only; all application checkout flags remain false and no payment transport exists.
 await q("insert into private.nmi_giving_control(organization_id,enabled,receipt_identity,fallback_path)values($1,true,'SyntheticReceipt','/give.html')",[f.org]);
 await q("insert into private.nmi_giving_forms(id,organization_id,slug,label,enabled,recurring_allowed)values($1,$2,'synthetic-recovery','SYNTHETIC',true,false)",[form,f.org]);
 await q('insert into private.nmi_giving_form_funds(organization_id,form_id,fund_id)values($1,$2,$3)',[f.org,form,f.mainFund]);
 await q("update giving_processor_routes set mid_reference='MID-01'where id=$1",[f.mainRoute]);
 await q("insert into private.payments_nmi_accounts(organization_id,gateway_id,enabled,last_verified_at,merchant_reference)values($1,$2,true,now(),'SyntheticMerchant')",[f.org,f.nmi]);
 await q("insert into private.payments_nmi_routes(organization_id,gateway_id,route_id,processor_id,enabled,verified_at,proof_reference)values($1,$2,$3,'SyntheticProcessor',true,now(),'SyntheticEvidence')",[f.org,f.nmi,f.mainRoute]);
 await q("insert into private.nmi_giving_route_proofs(organization_id,gateway_id,route_id,enabled,mid_reference,settlement_reference,merchant_reference,public_tokenization_key,verified_at,proof_reference)values($1,$2,$3,true,'MID-01','SyntheticBank','SyntheticMerchant','xxxxxx-xxxxxx-xxxxxx-xxxxxx',now(),'SyntheticEvidence')",[f.org,f.nmi,f.mainRoute]);
 await q('insert into organization_staff_permissions(organization_id,user_id,permission)select $1,$2,k from unnest(private.payment_ops_permissions())k on conflict do nothing',[f.org,f.admin]);
 const handler=(await loadPinnedGateway())(config,transport,readSecret),webhookFactory=await loadPinnedWebhook();
 const recover=({s,p},extra={})=>handler(new Request(origin+'/nmi',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer synthetic_verified_session_123456789'},body:JSON.stringify({action:'execute',organization_id:f.org,session_id:s.session_id,leg_id:s.legs[0].id,operation:'transaction',parent_attempt_id:p.id,request_key:uid(),...extra})}));
 for(const state of ['settled','failed','timeout','absent','ambiguous','wrong-processor','wrong-currency','wrong-order','wrong-amount']){
  const u=await unknown();if(state==='timeout')unresolved=u;mode=state;const before=providerQueries.length;const response=await recover(u);const result=await response.json();
  ok(providerQueries.length===before+1&&providerQueries.at(-1).orderId===u.p.id,`${state}: actual executor queries original operation order exactly once`);
  const n=await ledger(u.s);ok(n===(state==='settled'?1:0),`${state}: authoritative response binding controls native posting`);
  assert(!JSON.stringify(result).includes(key));
  if(state!=='settled'&&state!=='failed'){const count=providerQueries.length;await assert.rejects(()=>svc('prepare',{session_id:u.s.session_id,leg_id:u.s.legs[0].id,operation:'sale',capability_hash:cap,request_key:uid()}));ok(providerQueries.length===count,`${state}: UNKNOWN cannot recharge`);}
 }
 const u=await unknown();mode='settled';const beforeCalls=calls.length,beforeQueries=providerQueries.length;
 for(const operation of ['sale','authorize','recurring_create']){const response=await recover(u,{operation});ok(response.status===503,`disabled checkout rejects ${operation} before prepare`);}
 ok(calls.length===beforeCalls&&providerQueries.length===beforeQueries,'disabled requests issue no durable prepare, claim or query');
 const unsigned=JSON.stringify({event_id:'SyntheticUnsigned',event_type:'transaction.sale.success',event_body:{features:{is_test_mode:true},merchant:{id:'SyntheticMerchant'},transaction_id:'SyntheticTransaction',processor_id:'SyntheticProcessor'}});
 const webhook=webhookFactory({...config,enabled:true,recoveryEnabled:false},transport,readSecret); // offline handler only, query-only transport
 const signed=(event,secret=key)=>{const raw=JSON.stringify(event),nonce='synthetic-nonce',sig='t='+nonce+',s='+createHmac('sha256',secret).update(nonce+'.'+raw).digest('hex');return new Request(project+'/functions/v1/nmi-giving-webhook?organization='+f.org+'&gateway='+f.nmi,{method:'POST',headers:{'Webhook-Signature':sig},body:raw});};
 const event=JSON.parse(unsigned);const n=calls.length;ok((await webhook(signed(event,'WRONG_SYNTHETIC_KEY'))).status===409&&calls.length===n,'bad webhook signature denied before database');
 // First resolve UNKNOWN, then exercise exact signed webhook lookup and duplicate races.
 await recover(u);event.event_id='SyntheticSigned';event.event_body.transaction_id=records.get(u.p.id).id;
 mode='delayed';let entered;const waiting=new Promise(resolve=>{entered=resolve;});enteredQuery=entered;const first=webhook(signed(event));let timer;try{await Promise.race([waiting,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Webhook did not reach query boundary')),10000);})]);}finally{clearTimeout(timer);}
 const duplicates=await Promise.all(Array.from({length:8},()=>webhook(signed(event))));ok(duplicates.every(r=>r.status===200),'eight signed duplicate webhooks safely acknowledged during pending lookup');
 mode='settled';releaseQuery();ok((await first).status===200,'delayed authoritative webhook lookup completes');ok(await ledger(u.s)===1,'concurrent webhook replay cannot duplicate native ledger');
 const wrongMerchant=structuredClone(event);wrongMerchant.event_id='SyntheticWrongMerchant';wrongMerchant.event_body.merchant.id='DifferentMerchant';const before=providerQueries.length;ok((await webhook(signed(wrongMerchant))).status===409&&providerQueries.length===before,'signed wrong merchant cannot issue provider lookup');
 const tamper=structuredClone(event);tamper.event_body.processor_id='DifferentProcessor';ok((await webhook(signed(tamper))).status===409,'same event ID with changed signed payload rejects replay');
 await svc('shutdown',{actor_id:f.admin,reason:'SYNTHETIC emergency stop'});const beforeStop=providerQueries.length;const stopped=await recover(unresolved);ok(stopped.status===200&&providerQueries.length===beforeStop+1,'new-charge shutdown preserves separately enabled read-only original-state recovery');
 ok((await ledger(unresolved.s))===1,'only authoritative original-order query resolves UNKNOWN after new-charge shutdown');
 config.recoveryEnabled=false;const beforeFullStop=[calls.length,providerQueries.length,secretReads];ok((await recover(unresolved)).status===503,'independent complete stop rejects recovery');assert.deepEqual([calls.length,providerQueries.length,secretReads],beforeFullStop);ok(true,'complete stop touches no RPC, query or secret');
 ok((await q('select count(*)::int n from giving_recurring_instructions')).rows[0].n===0,'no recurring instructions created');
 ok((await q("select count(*)::int n from private.nmi_giving_receipt_outbox where state<>'held'")).rows[0].n===0,'all receipts held, no communication');
 const persisted=JSON.stringify((await q('select to_jsonb(a) v from private.nmi_giving_attempts a')).rows);ok(!persisted.includes(key)&&!persisted.includes('SYNTHETIC_UNCERTAIN'),'secrets and raw transport exceptions absent from durable attempts');
 console.log(JSON.stringify({nativeRecoveryChecks:checks,providerNetworkCalls:0,queriesIntercepted:providerQueries.length,checkoutEnabled:config.enabled,recurringEnabled:false}));
}finally{await db.close();console.log('CLEANUP PASS own native cluster stopped and removed');}
