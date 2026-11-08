// Genuine local native PostgreSQL; fictional identities and outcomes; NO provider/network transport.
import assert from 'node:assert/strict';
import {randomUUID as uid,createHash} from 'node:crypto';
import {verifiedDurableSources,pinnedFinancialFixtures} from './durable-source.mjs';
import {createDurablePilotReviewer} from './durable-pilot-review.mjs';
import {loadPinnedExecutor,loadPinnedGateway} from './pinned-executor.mjs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
const source=verifiedDurableSources(),{f,paymentsFixtureSQL}=await pinnedFinancialFixtures(source);
let n=0;const ok=(condition,label)=>{assert.ok(condition,label);n++;console.log('PASS '+label);};
const db=await localPostgres(),q=(...a)=>db.query(...a);
const tx=async(fn,{role='postgres',actor='',readOnly=false}={})=>{const c=await db.connect();try{await c.query(readOnly?'begin isolation level repeatable read read only':'begin');await c.query('set local role '+role);await c.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);const r=await fn(c);await c.query('commit');return r;}catch(e){await c.query('rollback');throw e;}finally{await c.end();}};
const svc=(action,payload,organization=f.org)=>tx(async c=>(await c.query('select public.nmi_giving_service($1,$2,$3) v',[action,organization,payload])).rows[0].v,{role:'service_role'});
const finance=(action,payload,actor=f.admin)=>tx(async c=>(await c.query('select public.payment_operations($1,$2,$3) v',[action,f.org,payload])).rows[0].v,{role:'authenticated',actor});
const form=uid(),sowForm=uid(),sowRoute=uid(),sowDest=uid(),sowFund=uid(),cap='a'.repeat(64),network='b'.repeat(64);
const create=(extra={})=>({form_id:form,request_key:uid(),capability_hash:cap,network_hash:network,receipt_email:uid()+'@example.test',donor_name:'Synthetic',frequency:'once',lines:[{fund_id:f.mainFund,amount_minor:'2500'}],...extra});
const prepare=(s,operation='sale',extra={})=>svc('prepare',{session_id:s.session_id,leg_id:s.legs[0].id,request_key:uid(),operation,capability_hash:cap,...extra});
const claim=(s,op)=>svc('claim',{session_id:s.session_id,id:op.id});
const handoff=(s,op,c)=>svc('handoff',{session_id:s.session_id,id:op.id,lease:c.lease});
const complete=(s,op,c,extra)=>svc('complete',{session_id:s.session_id,id:op.id,lease:c.lease,...extra});
const outcome=(ref,status='captured')=>({status,authoritative:true,provider_reference:ref,amount_minor:'2500',currency:'USD',processor_id:'SyntheticChurchProcessor'});
const count=table=>q(`select count(*)::int n from ${table}`).then(r=>r.rows[0].n);
const totals=async()=>({sessions:await count('public.giving_sessions'),attempts:await count('private.nmi_giving_attempts'),ledger:await count('public.giving_ledger'),audits:await count('public.giving_audit'),receipts:await count('private.nmi_giving_receipt_outbox')});
try {
 const baselineFingerprint=async()=>q("select proname,md5(prosrc) as hash from pg_proc where oid in (to_regprocedure('private.operational_relationship_visible(uuid,uuid,text)'),to_regprocedure('private.outreach_registration_can(uuid,text)')) order by proname").then(r=>r.rows);
 let before;
 for(const row of source.filter(r=>r.kind!=='fixture-module')){
  if(row.kind==='reviewed-nmi-gate0'&&!before)before=await baselineFingerprint();
  await db.exec(row.sql);
  if(row.kind==='local-bootstrap')await db.exec(`create schema if not exists storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;`);
 }
 assert.deepEqual(await baselineFingerprint(),before);ok(before.length===2,'current-main operational privacy functions unchanged after 39-migration composition');
 ok((await q("select count(*)::int n from pg_policies where policyname in ('followup_financial_boundary','followup_event_financial_boundary','people_relationship_financial_boundary')")).rows[0].n===3,'current-main restrictive financial privacy policies retained');
 ok((await q("select count(*)::int n from pg_tables where schemaname in ('public','private') and (tablename like 'giving_%' or tablename like 'payments_%' or tablename like 'nmi_giving_%') and not rowsecurity")).rows[0].n===0,'all composed financial tables retain RLS');
 await db.exec(paymentsFixtureSQL);
 await q('update giving_organization_config set recurring_enabled=false');
 await q(`insert into organization_staff_permissions(organization_id,user_id,permission)select $1,$2,k from unnest(private.payment_ops_permissions())k on conflict do nothing`,[f.org,f.admin]);
 await q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'payments.refund.approve'),($1,$2,'payments.void.approve')on conflict do nothing",[f.org,f.reader]);
 await q(`insert into private.payments_nmi_accounts(organization_id,gateway_id,enabled,last_verified_at,merchant_reference,subscription_default_verified,subscription_default_route_id,gateway_timezone)values($1,$2,true,now(),'SyntheticChurchLegal',true,$3,'America/Chicago')`,[f.org,f.nmi,f.mainRoute]);
 await q(`insert into private.payments_nmi_routes(organization_id,gateway_id,route_id,processor_id,enabled,verified_at,proof_reference)values($1,$2,$3,'SyntheticChurchProcessor',true,now(),'SyntheticChurchEvidence')`,[f.org,f.nmi,f.mainRoute]);
 await q(`update giving_processor_routes set mid_reference='MID-01' where id=$1`,[f.mainRoute]);
 await q(`insert into private.nmi_giving_control(organization_id,receipt_identity,fallback_path)values($1,'SyntheticChurchReceipt','/give.html');`,[f.org]);
 await q(`insert into private.nmi_giving_forms(id,organization_id,slug,label)values($1,$2,'synthetic-pilot','SYNTHETIC ONLY');`,[form,f.org]);
 await q(`insert into private.nmi_giving_form_funds(organization_id,form_id,fund_id)values($1,$2,$3)`,[f.org,form,f.mainFund]);
 await q(`insert into private.nmi_giving_route_proofs(organization_id,gateway_id,route_id,enabled,mid_reference,settlement_reference,merchant_reference,public_tokenization_key,verified_at,proof_reference)values($1,$2,$3,true,'MID-01','SyntheticChurchBank','SyntheticChurchLegal','xxxxxx-xxxxxx-xxxxxx-xxxxxx',now(),'SyntheticChurchEvidence')`,[f.org,f.nmi,f.mainRoute]);
 // SowGo uses a distinct organization, existing foreign gateway, route, fund, proof and recipient.
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic SowGo Finance')",[f.other,f.reader]);
 await q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'payments.configure')",[f.other,f.reader]);
 await q("insert into giving_processor_routes(id,organization_id,gateway_id,label,processor_reference,mid_reference)values($1,$2,$3,'Synthetic Soul Fuel','SyntheticSowGoProcessor','MID-02')",[sowRoute,f.other,f.foreignGateway]);
 await q("insert into giving_destinations(id,organization_id,purpose,provider,checkout_label,merchant_label,gateway_id,processor_route_id)values($1,$2,'outreach','nmi','Soul Fuel','SyntheticSowGoLegal',$3,$4)",[sowDest,f.other,f.foreignGateway,sowRoute]);
 await q("insert into giving_funds(id,organization_id,destination_id,name,code,tax_eligible,is_public)values($1,$2,$3,'Soul Fuel','soul-fuel',true,true)",[sowFund,f.other,sowDest]);
 await q("insert into private.payments_nmi_accounts(organization_id,gateway_id,enabled,last_verified_at,merchant_reference)values($1,$2,true,now(),'SyntheticSowGoLegal')",[f.other,f.foreignGateway]);
 await q("insert into private.payments_nmi_routes(organization_id,gateway_id,route_id,processor_id,enabled,verified_at,proof_reference)values($1,$2,$3,'SyntheticSowGoProcessor',true,now(),'SyntheticSowGoEvidence')",[f.other,f.foreignGateway,sowRoute]);
 await q("insert into private.nmi_giving_control(organization_id,receipt_identity,fallback_path)values($1,'SyntheticSowGoReceipt','/outreach-giving.html')",[f.other]);
 await q("insert into private.nmi_giving_forms(id,organization_id,slug,label)values($1,$2,'synthetic-sowgo','SYNTHETIC SOWGO')",[sowForm,f.other]);
 await q("insert into private.nmi_giving_form_funds(organization_id,form_id,fund_id)values($1,$2,$3)",[f.other,sowForm,sowFund]);
 await q("insert into private.nmi_giving_route_proofs(organization_id,gateway_id,route_id,enabled,mid_reference,settlement_reference,merchant_reference,public_tokenization_key,verified_at,proof_reference)values($1,$2,$3,true,'MID-02','SyntheticSowGoBank','SyntheticSowGoLegal','xxxxxx-xxxxxx-xxxxxx-xxxxxx',now(),'SyntheticSowGoEvidence')",[f.other,f.foreignGateway,sowRoute]);
 const selection={organizationId:f.org,formId:form,fundId:f.mainFund,routeId:f.mainRoute};
 let principal={userId:f.admin,sessionId:'fictional-session',verified:true};
 let evidence={...selection,fictional:true,approved:true,independentReview:true,revoked:false,expiresAt:'2099-01-01T00:00:00Z',kind:'one-time',organization:'Champion Life',midSlot:'MID-01',gatewayId:f.nmi,midAlias:'MID-01',legalMerchant:'SyntheticChurchLegal',settlementOwner:'SyntheticChurchBank',receiptOwner:'SyntheticChurchReceipt',evidenceRef:'SyntheticChurchEvidence',purpose:'charitable_contribution',revision:1};
 const reviewer=createDurablePilotReviewer({authenticate:async()=>principal,resolveEvidence:async()=>evidence,withReadOnlyTransaction:cb=>tx(cb,{readOnly:true})});
 let r=await reviewer(selection);ok(r.reviewableSnapshot&&r.canSubmit===false,'real stored route + verified finance identity produces disabled review snapshot');
 for(const field of ['midAlias','gatewayId','legalMerchant','settlementOwner','receiptOwner','evidenceRef','purpose','revision']){const saved=evidence[field];evidence[field]=field==='revision'?2:'SyntheticWrong';r=await reviewer(selection);ok(!r.reviewableSnapshot,`durable binding rejects mismatched ${field}`);evidence[field]=saved;}
 for(const field of ['organizationId','formId','fundId','routeId']){r=await reviewer({...selection,[field]:uid()});ok(!r.reviewableSnapshot,`selection cannot switch ${field}`);}
 for(const [table,column,id] of [['giving_funds','status',f.mainFund],['giving_destinations','active',f.mainDest],['giving_processor_routes','active',f.mainRoute]]){assert.ok(id);const saved=(await q(`select ${column} value from ${table} where id=$1`,[id])).rows[0].value;await q(`update ${table} set ${column}=$1 where id=$2`,[column==='status'?'archived':false,id]);ok(!(await reviewer(selection)).reviewableSnapshot,`inactive canonical ${table} denied`);await q(`update ${table} set ${column}=$1 where id=$2`,[saved,id]);}
 for(const status of ['unknown','maintenance','unavailable','degraded']){await q('insert into private.payment_ops_incidents(organization_id,gateway_id,status,reason)values($1,$2,$3,$4)on conflict(organization_id,gateway_id)do update set status=excluded.status',[f.org,f.nmi,status,'SYNTHETIC incident']);ok(!(await reviewer(selection)).reviewableSnapshot,`${status} incident blocks review`);}await q('delete from private.payment_ops_incidents where organization_id=$1 and gateway_id=$2',[f.org,f.nmi]);
 const originalPrincipal=principal;principal={userId:f.ordinary,sessionId:'fictional-session',verified:true};ok(!(await reviewer(selection)).reviewableSnapshot,'nonfinance verified user cannot review');principal=originalPrincipal;
 await q("update organization_staff_permissions set revoked_at=now()where organization_id=$1 and user_id=$2 and permission='payments.configure'",[f.org,f.admin]);ok(!(await reviewer(selection)).reviewableSnapshot,'stored authority revocation denies next review');await q("update organization_staff_permissions set revoked_at=null where organization_id=$1 and user_id=$2 and permission='payments.configure'",[f.org,f.admin]);
 await q('update auth.users set email_confirmed_at=null where id=$1',[f.admin]);ok(!(await reviewer(selection)).reviewableSnapshot,'provider assertion cannot replace actual database email confirmation');await q('update auth.users set email_confirmed_at=now()where id=$1',[f.admin]);
 const originalEvidence=evidence;
 const sowSelection={organizationId:f.other,formId:sowForm,fundId:sowFund,routeId:sowRoute};
 evidence={...originalEvidence,...sowSelection,organization:'SowGo',midSlot:'MID-02',midAlias:'MID-02',gatewayId:f.foreignGateway,legalMerchant:'SyntheticSowGoLegal',settlementOwner:'SyntheticSowGoBank',receiptOwner:'SyntheticSowGoReceipt',evidenceRef:'SyntheticSowGoEvidence'};
 ok(!(await reviewer(sowSelection)).reviewableSnapshot,'Church finance authority does not confer SowGo authority');principal={userId:f.reader,sessionId:'fictional-sowgo-session',verified:true};ok((await reviewer(sowSelection)).reviewableSnapshot,'Soul Fuel uses separately scoped SowGo legal merchant and settlement');
 for(const key of ['legalMerchant','settlementOwner','receiptOwner']){const saved=evidence[key];evidence[key]=originalEvidence[key];ok(!(await reviewer(sowSelection)).reviewableSnapshot,`Soul Fuel rejects Church ${key}`);evidence[key]=saved;}
 evidence=originalEvidence;principal=originalPrincipal;
 const originalCounts=await totals();const execute=await loadPinnedExecutor(),gateway=await loadPinnedGateway();let rpcCalls=0;
 const rpc=async(action,org,payload)=>{rpcCalls++;return svc(action,payload,org);};const forbidden=()=>assert.fail('Provider or credential access forbidden');
 await execute({config:{enabled:false,recoveryEnabled:false},organization_id:f.org,session_id:uid(),id:uid(),rpc,fetcher:forbidden,readSecret:forbidden});
 const project='https://cccccccccccccccccccc.supabase.co',origin='https://fictional--championlifechurch.netlify.app';
 const handler=gateway({enabled:false,recoveryEnabled:false,project,publicKey:'fictional',serviceKey:'fictional',origins:[origin],acceptance_pin:{name:'champion-life-nmi-giving-acceptance',project,origins:[origin]}},forbidden,forbidden);
 for(const action of ['create','execute','job'])assert.equal((await handler(new Request('https://fictional.invalid',{method:'POST',headers:{Origin:origin},body:JSON.stringify({action,organization_id:f.org})}))).status,503);
 assert.deepEqual(await totals(),originalCounts);ok(rpcCalls===0,'actual corrected gateway/executor preserve native durable state while disabled');
 await assert.rejects(()=>svc('create',create()));ok(true,'native database control independently denies checkout while disabled');
 // Test-only SQL state machine fixture, not runtime enablement. No execution transport exists.
 await q('update private.nmi_giving_control set enabled=true where organization_id=$1',[f.org]);await q('update private.nmi_giving_forms set enabled=true where id=$1',[form]);
 ok(!(await reviewer(selection)).reviewableSnapshot,'review-only adapter refuses an armed native form/control');
 await assert.rejects(()=>svc('create',create({frequency:'monthly',starts_on:'2027-01-01'})));ok(true,'one-time fixture cannot create recurring instruction');
 const auditFailureSession=await svc('create',create());const beforeAuditFailure=await totals();await db.exec(`create function public.synthetic_fail_audit()returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC AUDIT FAILURE';end$$;create trigger synthetic_fail_audit before insert on public.giving_audit for each row execute function public.synthetic_fail_audit();`);
 await assert.rejects(()=>prepare(auditFailureSession),/SYNTHETIC AUDIT FAILURE/);assert.deepEqual(await totals(),beforeAuditFailure);ok(true,'audit insertion failure rolls back native operation and successful-change audit');await db.exec('drop trigger synthetic_fail_audit on public.giving_audit;drop function public.synthetic_fail_audit();');
 const input=create(),s=await svc('create',input);assert.equal((await svc('create',input)).session_id,s.session_id);ok(true,'actual SQL checkout idempotency preserves session');
 await assert.rejects(()=>svc('create',{...input,receipt_email:'different@example.test'}));ok(true,'conflicting checkout replay rejected');
 const pp={session_id:s.session_id,leg_id:s.legs[0].id,operation:'sale',capability_hash:cap,request_key:uid()};
 const ops=await Promise.all(Array.from({length:8},()=>svc('prepare',pp)));ok(new Set(ops.map(x=>x.id)).size===1,'eight native backends prepare one durable operation');const op=ops[0];
 const claims=await Promise.all(Array.from({length:8},()=>claim(s,op)));ok(claims.filter(c=>c.claimed).length===1,'eight native backends obtain one lease');const c=claims.find(x=>x.claimed);
 const attempts=await Promise.allSettled(Array.from({length:8},()=>handoff(s,op,c)));ok(attempts.filter(x=>x.status==='fulfilled').length===1,'eight native handoffs dispatch once');
 const completes=await Promise.allSettled(Array.from({length:8},()=>complete(s,op,c,outcome('SyntheticCaptured'))));ok(completes.filter(x=>x.status==='fulfilled').length===1,'eight simultaneous authoritative fictional outcomes post once');
 ok((await q('select sum(amount_minor)::text n from giving_ledger where session_id=$1',[s.session_id])).rows[0].n==='2500','native ledger contains one exact principal');ok(await count('private.nmi_giving_receipt_outbox')===1,'native receipt remains held exactly once');
 await assert.rejects(()=>prepare(s));ok(true,'completed operation cannot recharge');
 const unknown=await svc('create',create()),uo=await prepare(unknown),uc=await claim(unknown,uo);await handoff(unknown,uo,uc);await complete(unknown,uo,uc,{status:'review',authoritative:false,category:'unknown'});
 await assert.rejects(()=>prepare(unknown));ok((await q('select count(*)::int n from giving_ledger where session_id=$1',[unknown.session_id])).rows[0].n===0,'UNKNOWN has zero ledger and prevents automatic recharge');
 const lookup=await prepare(unknown,'transaction',{parent_attempt_id:uo.id,actor_id:f.admin}),lc=await claim(unknown,lookup);await handoff(unknown,lookup,lc);
 const lookupOp=(await q('select operation from private.payments_operations where id=$1',[lookup.id])).rows[0].operation;ok(lookupOp==='transaction','UNKNOWN recovery is authoritative lookup operation, not another sale');
 await complete(unknown,lookup,lc,outcome('SyntheticRecovered','settled'));ok((await q('select count(*)::int n from giving_ledger where session_id=$1',[unknown.session_id])).rows[0].n===1,'authoritative fictional lookup resolves native UNKNOWN once');
 const event={gateway_id:f.nmi,event_id:'SyntheticReplay',digest:'d'.repeat(64),merchant_reference:'SyntheticChurchLegal',processor_id:'SyntheticChurchProcessor',provider_reference:'SyntheticCaptured',kind:'transaction',status:'captured'};
 const ev=await svc('webhook',event);ok(!!ev.lookup_id,'native webhook creates lookup only');ok((await svc('webhook',event)).duplicate,'native webhook identical replay dedupes');await assert.rejects(()=>svc('webhook',{...event,digest:'e'.repeat(64)}));ok(true,'conflicting webhook digest rejects');
 const settledLookup={id:ev.lookup_id},settledClaim=await claim(s,settledLookup);await handoff(s,settledLookup,settledClaim);await complete(s,settledLookup,settledClaim,outcome('SyntheticCaptured','settled'));ok((await q('select status from giving_transaction_legs where id=$1',[s.legs[0].id])).rows[0].status==='settled','authoritative fictional original-state lookup required before refund');
 const refund=await finance('refund_request',{request_key:uid(),leg_id:s.legs[0].id,amount_minor:'1000',reason:'SYNTHETIC refund'});await assert.rejects(()=>finance('refund_approve',{request_key:uid(),id:refund.id,reason:'SYNTHETIC self approval'}));ok(true,'native refund enforces independent approval');
 await finance('refund_approve',{request_key:uid(),id:refund.id,reason:'SYNTHETIC separate reviewer'},f.reader);const ro=await prepare(s,'refund',{actor_id:f.admin,refund_id:refund.id}),rc=await claim(s,ro);await handoff(s,ro,rc);await complete(s,ro,rc,{...outcome('SyntheticRefund','refunded'),amount_minor:'1000'});ok((await q('select sum(amount_minor)::text n from giving_ledger where session_id=$1',[s.session_id])).rows[0].n==='1500','native refund appends exact negative principal');
 const vs=await svc('create',create()),vo=await prepare(vs,'authorize'),vc=await claim(vs,vo);await handoff(vs,vo,vc);await complete(vs,vo,vc,outcome('SyntheticAuthorization','authorized'));
 const vr=await finance('void_request',{request_key:uid(),leg_id:vs.legs[0].id,amount_minor:'2500',reason:'SYNTHETIC void'});await finance('void_approve',{request_key:uid(),id:vr.id,reason:'SYNTHETIC separate reviewer'},f.reader);const vop=await prepare(vs,'void',{actor_id:f.admin,refund_id:vr.id}),vclaim=await claim(vs,vop);await handoff(vs,vop,vclaim);await complete(vs,vop,vclaim,outcome('SyntheticAuthorization','voided'));ok((await q('select count(*)::int n from giving_ledger where session_id=$1',[vs.session_id])).rows[0].n===0,'native authorization/void produces no gift');
 const stop=await svc('create',create()),so=await prepare(stop);await svc('shutdown',{actor_id:f.admin,reason:'SYNTHETIC STOP'});await assert.rejects(()=>claim(stop,so));await assert.rejects(()=>svc('create',create()));ok(true,'native emergency shutdown blocks prepared claim and new session');
 for(const role of ['anon','authenticated']){await assert.rejects(()=>tx(c=>c.query('select public.nmi_giving_service($1,$2,$3)',['status',f.org,{session_id:s.session_id,actor_id:f.admin}]),{role,actor:f.admin}));ok(true,`${role} cannot borrow service authority`);}
 await assert.rejects(()=>svc('status',{session_id:s.session_id,capability_hash:cap},f.other));ok(true,'other organization cannot view durable checkout');
 await assert.rejects(()=>q('update giving_ledger set amount_minor=1'));await assert.rejects(()=>q('delete from giving_receipts'));ok(true,'native ledger and receipt audit history remain immutable');
 ok((await q("select count(*)::int n from private.nmi_giving_receipt_outbox where state<>'held'")).rows[0].n===0,'all financial receipts remain unsent');
 ok((await q('select count(*)::int n from giving_recurring_instructions')).rows[0].n===0,'no recurring instructions enabled');
 console.log(JSON.stringify({nativeChecks:n,currentMainMigrations:26,reviewedForwardSources:13,providerCalls:0,credentials:0,publicCheckoutEnabled:false,canSubmit:false}));
}finally{await db.close();console.log('CLEANUP PASS disposable PostgreSQL cluster stopped and removed');}
