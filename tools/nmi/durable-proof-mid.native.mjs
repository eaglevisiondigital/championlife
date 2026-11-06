// Read-only reviewer parity with the existing execution route contract.
// Native disposable PostgreSQL, fictional merchant rows only; no provider transport.
import assert from 'node:assert/strict';
import {randomUUID as uid} from 'node:crypto';
import {verifiedDurableSources,pinnedFinancialFixtures} from './durable-source.mjs';
import {createDurablePilotReviewer} from './durable-pilot-review.mjs';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
const source=verifiedDurableSources(),{f,paymentsFixtureSQL}=await pinnedFinancialFixtures(source);
const db=await localPostgres(),q=(...a)=>db.query(...a);let checks=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label);};
const tx=async cb=>{const c=await db.connect();try{await c.query('begin isolation level repeatable read read only');const value=await cb(c);await c.query('commit');return value;}catch(e){await c.query('rollback');throw e;}finally{await c.end();}};
const form=uid(),sowForm=uid(),sowRoute=uid(),sowDest=uid(),sowFund=uid();
const totals=async()=>{const r=await q(`select (select count(*) from giving_sessions)::int sessions,(select count(*) from private.nmi_giving_attempts)::int attempts,(select count(*) from giving_ledger)::int ledger,(select count(*) from giving_receipts)::int receipts,(select count(*) from giving_audit)::int audits`);return r.rows[0];};
// Probe the existing execution predicate in a rollback-only fixture transaction.
// No source/executor/transport is enabled, and stored controls remain false.
const routeOK=async(org,route)=>{const c=await db.connect();try{await c.query('begin');await c.query('update private.nmi_giving_control set enabled=true where organization_id=$1',[org]);return (await c.query('select private.nmi_giving_route_ok($1,$2) ok',[org,route])).rows[0].ok;}finally{await c.query('rollback');await c.end();}};
try{
 for(const row of source.filter(r=>r.kind!=='fixture-module')){await db.exec(row.sql);if(row.kind==='local-bootstrap')await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;`);}
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
 const reviewer=createDurablePilotReviewer({authenticate:async()=>principal,resolveEvidence:async()=>evidence,withReadOnlyTransaction:tx});
 const before=await totals(),churchEvidence=structuredClone(evidence);
 const cases=[{name:'Church',selection,principal:{userId:f.admin,sessionId:'fictional-church',verified:true},evidence:churchEvidence},
 {name:'SowGo Soul Fuel',selection:{organizationId:f.other,formId:sowForm,fundId:sowFund,routeId:sowRoute},principal:{userId:f.reader,sessionId:'fictional-sowgo',verified:true},evidence:{...churchEvidence,organizationId:f.other,formId:sowForm,fundId:sowFund,routeId:sowRoute,organization:'SowGo',midSlot:'MID-02',midAlias:'MID-02',gatewayId:f.foreignGateway,legalMerchant:'SyntheticSowGoLegal',settlementOwner:'SyntheticSowGoBank',receiptOwner:'SyntheticSowGoReceipt',evidenceRef:'SyntheticSowGoEvidence'}}];
 for(const item of cases){
  principal=item.principal;evidence=structuredClone(item.evidence);const o=item.selection.organizationId,r=item.selection.routeId,original=evidence.midAlias;
  const review=async expected=>{const value=await reviewer(item.selection);equal(value.reviewableSnapshot,expected,item.name+' review matches stored and reviewed MID');for(const key of ['canSubmit','canRetry','canPostLedger','providerVerified'])equal(value[key],false,item.name+' '+key+' remains false');};
  await review(true);equal(await routeOK(o,r),true,item.name+' valid existing execution predicate');
  for(const wrong of ['MID-03',item.name==='Church'?'MID-02':'MID-01']){
   await q('update private.nmi_giving_route_proofs set mid_reference=$1 where organization_id=$2 and route_id=$3',[wrong,o,r]);
   await review(false);equal(await routeOK(o,r),false,item.name+' mismatched stored proof denied by existing execution predicate');
  }
  await q('update private.nmi_giving_route_proofs set mid_reference=$1 where organization_id=$2 and route_id=$3',[original,o,r]);
  await review(true);
  // The execution predicate alone cannot replace the independent evidence binding.
  await q("update private.nmi_giving_route_proofs set mid_reference='MID-04' where organization_id=$1 and route_id=$2",[o,r]);
  await q("update giving_processor_routes set mid_reference='MID-04' where organization_id=$1 and id=$2",[o,r]);
  equal(await routeOK(o,r),true,item.name+' consistent changed stored MID remains internally valid');await review(false);
  await q('update private.nmi_giving_route_proofs set mid_reference=$1 where organization_id=$2 and route_id=$3',[original,o,r]);
  await q('update giving_processor_routes set mid_reference=$1 where organization_id=$2 and id=$3',[original,o,r]);
  await review(true);
 }
 equal(await totals(),before,'all review/proof probes leave sessions attempts ledger receipts and audit unchanged');
 equal((await q('select bool_or(enabled) value from private.nmi_giving_control')).rows[0].value,false,'rollback-only predicate probes preserve disabled controls');
 equal((await q('select bool_or(enabled) value from private.nmi_giving_forms')).rows[0].value,false,'all fictional forms remain disabled');
 equal((await q('select count(*)::int n from giving_recurring_instructions')).rows[0].n,0,'no recurring instruction created');
 console.log(JSON.stringify({status:'PASS',checks,providerNetworkCalls:0,checkoutEnabled:false,hosted:false}));
}finally{await db.close();console.log('CLEANUP PASS own native cluster stopped and removed');}
