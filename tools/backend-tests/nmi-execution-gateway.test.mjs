import assert from 'node:assert/strict';import {randomUUID as uid,createHmac} from 'node:crypto';
import {createGivingHandler} from '../../supabase/functions/nmi-giving/gateway.mjs';
import {createGivingWebhook} from '../../supabase/functions/nmi-giving-webhook/gateway.mjs';
import {database,seed,f,form} from './nmi-execution-fixture.mjs';
const db=await database();const project='https://cccccccccccccccccccc.supabase.co',origin='https://deploy-preview-999--championlifechurch.netlify.app',key='SYNTHETIC_NMI_SECRET_NOT_REAL';
const config={project,enabled:true,acceptance_pin:{project,name:'champion-life-nmi-giving-acceptance',origins:[origin]},origins:[origin],serviceKey:'SYNTHETIC_SERVICE_KEY',publicKey:'sb_publishable_SYNTHETIC',turnstileSecret:'SYNTHETIC_CHALLENGE',pepper:'SYNTHETIC_HASH_PEPPER_WITH_32_CHARS'};
let mode='success',sales=0,lookups=0,completeFailure=false,queries=[];const transactions=new Map();
const xml=row=>'<nm_response><transaction><transaction_id>'+row.id+'</transaction_id><processor_id>synthetic-main</processor_id><currency>USD</currency><order_id>'+row.order+'</order_id><condition>complete</condition><action><amount>25.00</amount><action_type>sale</action_type><success>1</success></action><cc_number>xxxx1111</cc_number></transaction></nm_response>';
const fetcher=async(url,init={})=>{
 if(url===project+'/rest/v1/rpc/nmi_giving_service'){
  const p=JSON.parse(init.body);assert(!JSON.stringify(p).includes('synthetic-hosted-token'));
  if(p.p_action==='complete'&&completeFailure){completeFailure=false;return new Response('{}',{status:503})}
  try{await db.exec('reset role;set role service_role');const result=(await db.query('select nmi_giving_service($1,$2,$3)v',[p.p_action,p.p_org,p.p_payload])).rows[0].v;return Response.json(result)}catch{return Response.json({error:'denied'},{status:403})}
 }
 if(url===project+'/auth/v1/user')return Response.json({id:f.admin,email_confirmed_at:'2026-10-18T12:00:00Z',is_anonymous:false});
 if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify')return Response.json({success:true,action:'nmi_giving',hostname:new URL(origin).hostname});
 if(url==='https://sandbox.nmi.com/api/v5/payments/sale'){
  sales++;assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,key);const p=JSON.parse(init.body);assert.equal(p.payment_details.payment_token,'synthetic-hosted-token');assert.equal(p.processor_id,'synthetic-main');assert.equal(p.customer_receipt,false);
  if(mode==='decline')return Response.json({response:'2',response_code:'200'});
  const id='synthetic-http-'+sales;transactions.set(id,{id,order:p.order_details.order_id});if(mode==='timeout')throw Error('SYNTHETIC_SENSITIVE_EXCEPTION');
  return Response.json({response:'1',id,amount:'25.00',currency:'USD',processor_id:'synthetic-main',customer_vault_id:'synthetic-safe-vault'});
 }
 if(url==='https://sandbox.nmi.com/api/query.php'){
  lookups++;const p=new URLSearchParams(init.body);assert.equal(p.get('security_key'),key);queries.push(Object.fromEntries(p));const row=p.has('transaction_id')?transactions.get(p.get('transaction_id')):[...transactions.values()].find(x=>x.order===p.get('order_id'));return new Response(row?xml(row):'<nm_response></nm_response>',{headers:{'Content-Type':'application/xml'}});
 }
 throw Error('Unexpected transport '+url);
};
const handler=createGivingHandler(config,fetcher,()=>key),call=async(data,auth=false,handlerOverride=handler)=>handlerOverride(new Request(origin+'/functions/v1/nmi-giving',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...(auth?{Authorization:'Bearer synthetic_verified_session_123456789'}:{})},body:JSON.stringify(data)}));
const cap='d'.repeat(64);const newSession=async(email)=>{const response=await call({action:'create',organization_id:f.org,form_id:form,request_key:uid(),capability:cap,receipt_email:email,donor_name:'Synthetic',frequency:'once',lines:[{fund_id:f.mainFund,amount_minor:'2500'}],challenge_token:'synthetic-one-use-challenge'});assert.equal(response.status,200);return response.json()};
const pay=s=>({action:'execute',organization_id:f.org,session_id:s.session_id,leg_id:s.legs[0].id,request_key:uid(),capability:cap,operation:'sale',payment_token:'synthetic-hosted-token',save_method:true});
try{
 await db.exec(seed);
 let touched=false;const held=createGivingHandler({...config,enabled:false},async()=>{touched=true;throw Error()},()=>key);assert.equal((await call({action:'form',organization_id:f.org,form_id:form},false,held)).status,503);assert(!touched);
 const wrong=createGivingHandler({...config,project:'https://exdocjbmylgxssanymjk.supabase.co'},async()=>{touched=true;throw Error()},()=>key);assert.equal((await call({},false,wrong)).status,503);assert(!touched);
 let s=await newSession('http-success@example.test'),p=pay(s),response=await call(p),result=await response.json();assert.equal(result.status,'success');assert.equal(sales,1);assert.equal(lookups,1);assert.equal((await(await call(p)).json()).status,'success');assert.equal(sales,1);
 mode='decline';s=await newSession('http-decline@example.test');result=await(await call(pay(s))).json();assert.equal(result.status,'declined');assert.equal(lookups,1);
 mode='timeout';s=await newSession('http-timeout@example.test');p=pay(s);result=await(await call(p)).json();assert.equal(result.status,'pending');assert(!JSON.stringify(result).includes('SENSITIVE'));const before=sales;
 assert.equal((await(await call({...p,request_key:uid()})).json()).status,'pending');assert.equal(sales,before);
 await db.exec('reset role');const original=(await db.query('select id from private.nmi_giving_attempts where session_id=$1',[s.session_id])).rows[0].id;
 mode='success';const recoveryHandler=createGivingHandler({...config,enabled:false,recoveryEnabled:true},fetcher,()=>key);result=await(await call({action:'execute',organization_id:f.org,session_id:s.session_id,leg_id:s.legs[0].id,operation:'transaction',parent_attempt_id:original,request_key:uid()},true,recoveryHandler)).json();assert.equal(result.status,'success');assert.equal(sales,before);assert(queries.some(q=>q.order_id===original));
 // Verified signed webhook creates lookup only, never another sale or direct posting.
 const webhook=createGivingWebhook(config,fetcher,()=>key),event={event_id:'synthetic-http-event',event_type:'transaction.sale.success',event_body:{features:{is_test_mode:true},merchant:{id:'synthetic-merchant'},transaction_id:[...transactions.keys()][0],processor_id:'synthetic-main'}};
 const body=JSON.stringify(event),nonce='synthetic-nonce',signature='t='+nonce+',s='+createHmac('sha256',key).update(nonce+'.'+body).digest('hex');
 const request=()=>new Request(project+'/functions/v1/nmi-giving-webhook?organization='+f.org+'&gateway='+f.nmi,{method:'POST',headers:{'Webhook-Signature':signature},body});
 assert.equal((await webhook(request())).status,200);assert.equal((await webhook(request())).status,200);assert.equal(sales,before);
 const bad=new Request(project+'/functions/v1/nmi-giving-webhook?organization='+f.org+'&gateway='+f.nmi,{method:'POST',headers:{'Webhook-Signature':signature},body:body+' '});assert.equal((await webhook(bad)).status,409);
 await db.exec('reset role');const stored=JSON.stringify((await db.query('select to_jsonb(a) v from private.nmi_giving_attempts a')).rows);assert(!stored.includes('hosted-token'));assert(!stored.includes(key));
 console.log('PASS dedicated gateway + real synthetic SQL pipeline: anonymous sale/authoritative query/ledger/held receipt, replay, decline, timeout/order lookup recovery, verified webhook/replay/tamper, fixed sandbox host, zero provider network calls');
}catch(e){console.error('GATEWAY FAILURE',e.message);process.exitCode=1}finally{await db.close()}
