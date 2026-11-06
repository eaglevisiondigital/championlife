// Independent native adversarial review of merchant, settlement and tenant isolation.
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
 // Independent adversarial assertions; setup above reuses the author's fictional
 // two-organization schema fixture. These are distinct from the MID-only matrix.
 const expected=reviewableSnapshot=>({reason:reviewableSnapshot?'DISABLED_DURABLE_SNAPSHOT_REVIEWABLE':'DURABLE_AUTHORITY_OR_ROUTE_DENIED',reviewableSnapshot,canSubmit:false,canRetry:false,canPostLedger:false,providerVerified:false});
 for(const [index,item] of cases.entries()){
  const foreign=cases[1-index];principal=item.principal;evidence=structuredClone(item.evidence);
  const o=item.selection.organizationId,r=item.selection.routeId;
  const review=async(want,label)=>equal(await reviewer(item.selection),expected(want),item.name+' '+label);
  await review(true,'independent disabled positive control');
  // Case folding must not invent equality between independently reviewed aliases.
  await q('update private.nmi_giving_route_proofs set mid_reference=$1 where organization_id=$2 and route_id=$3',[item.evidence.midAlias.toLowerCase(),o,r]);
  await review(false,'case-folded proof alias is not exact reviewed MID');
  equal(await routeOK(o,r),false,item.name+' canonical SQL also denies case-folded proof alias');
  await q('update private.nmi_giving_route_proofs set mid_reference=$1 where organization_id=$2 and route_id=$3',[item.evidence.midAlias,o,r]);
  // Every mismatch uses the other tenant's syntactically valid fictional value.
  for(const [column,key,canonical] of [
   ['merchant_reference','legalMerchant',false],
   ['settlement_reference','settlementOwner',true],
   ['proof_reference','evidenceRef',true]]){
   await q(`update private.nmi_giving_route_proofs set ${column}=$1 where organization_id=$2 and route_id=$3`,[foreign.evidence[key],o,r]);
   await review(false,'foreign '+column+' cannot borrow matching MID');
   equal(await routeOK(o,r),canonical,item.name+' exact canonical predicate behavior for '+column);
   await q(`update private.nmi_giving_route_proofs set ${column}=$1 where organization_id=$2 and route_id=$3`,[item.evidence[key],o,r]);
  }
  // Coordinated account+proof merchant corruption can pass internal SQL parity,
  // but cannot change independently reviewed merchant ownership.
  await q('update private.payments_nmi_accounts set merchant_reference=$1 where organization_id=$2 and gateway_id=$3',[foreign.evidence.legalMerchant,o,item.evidence.gatewayId]);
  await q('update private.nmi_giving_route_proofs set merchant_reference=$1 where organization_id=$2 and route_id=$3',[foreign.evidence.legalMerchant,o,r]);
  equal(await routeOK(o,r),true,item.name+' coordinated foreign merchant is internally consistent only');
  await review(false,'independent merchant evidence vetoes internally consistent corruption');
  await q('update private.payments_nmi_accounts set merchant_reference=$1 where organization_id=$2 and gateway_id=$3',[item.evidence.legalMerchant,o,item.evidence.gatewayId]);
  await q('update private.nmi_giving_route_proofs set merchant_reference=$1 where organization_id=$2 and route_id=$3',[item.evidence.legalMerchant,o,r]);
  await q('update private.nmi_giving_control set receipt_identity=$1 where organization_id=$2',[foreign.evidence.receiptOwner,o]);
  await review(false,'foreign receipt identity cannot borrow matching MID');
  await q('update private.nmi_giving_control set receipt_identity=$1 where organization_id=$2',[item.evidence.receiptOwner,o]);
  for(const key of ['formId','fundId','routeId']){
   const mixed={...item.selection,[key]:foreign.selection[key]};
   evidence={...item.evidence,...mixed}; // trusted fictional approval alone cannot bridge stored organization joins
   equal(await reviewer(mixed),{...expected(false),...(key==='fundId'?{reason:'DURABLE_REVIEW_UNAVAILABLE'}:{})},item.name+' mixed organization '+key+' denied by canonical SQL');
  }
  evidence=structuredClone(item.evidence);principal=foreign.principal;
  await review(false,'other organization principal cannot use reviewed proof');
  principal=item.principal;
  await review(true,'restored owner retains disabled review');
 }
 // Reusing an alias in a different legal organization is not an identity link.
 const sow=cases[1];principal=sow.principal;evidence={...sow.evidence,midAlias:'MID-01',midSlot:'MID-01'};
 await q("update private.nmi_giving_route_proofs set mid_reference='MID-01' where organization_id=$1 and route_id=$2",[sow.selection.organizationId,sow.selection.routeId]);
 await q("update giving_processor_routes set mid_reference='MID-01' where organization_id=$1 and id=$2",[sow.selection.organizationId,sow.selection.routeId]);
 equal(await reviewer(sow.selection),expected(true),'same alias in distinct organization retains its own merchant/bank/receipt');
 evidence={...evidence,legalMerchant:cases[0].evidence.legalMerchant,settlementOwner:cases[0].evidence.settlementOwner};
 equal(await reviewer(sow.selection),{...expected(false),reason:'SOWGO_OWNERSHIP_MISMATCH'},'Church merchant and bank cannot be approved as SowGo ownership despite identical MID alias');
 equal(await totals(),before,'all review probes leave sessions attempts ledger receipts and audits unchanged');
 equal((await q('select bool_or(enabled) value from private.nmi_giving_control')).rows[0].value,false,'controls remain disabled after rollback-only predicate observations');
 equal((await q('select bool_or(enabled) value from private.nmi_giving_forms')).rows[0].value,false,'forms remain disabled');
 equal((await q('select count(*)::int n from giving_recurring_instructions')).rows[0].n,0,'no recurring instruction created');
 console.log(JSON.stringify({status:'PASS',checks,providerNetworkCalls:0,checkoutEnabled:false,hosted:false}));
}finally{await db.close();console.log('CLEANUP PASS own native cluster stopped and removed');}
