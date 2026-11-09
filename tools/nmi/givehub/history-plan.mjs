import {dryRun,digest,importProjection} from './staging.mjs';
// Review-only plan; identity bindings are explicit inputs, never inferred from source names.
export function historyPlan(bundle,authority,bindings){
 const report=dryRun(bundle,authority),hold=reason=>({status:'HOLD',reason,canExecute:false,operations:[]});
 if(report.localReconciliation!=='PASS')return hold('SOURCE_RECONCILIATION_REQUIRED');
 const ops=[];
 for(const original of report.snapshot.records.filter(r=>r.correction_kind_or_null===null)){
  const matches=bindings.filter(b=>b.account===original.source_account_reference&&b.organization===original.recipient_organization_id&&b.sourceDonor===original.source_donor_id_or_null&&b.sourceFund===original.source_fund_id);
  if(matches.length!==1||matches[0].reviewed!==true||!matches[0].reviewReference)return hold('EXACT_REVIEWED_BINDING_REQUIRED');
  const b=matches[0],fund=bundle.funds.find(f=>f.source_account_reference===b.account&&f.recipient_organization_id===b.organization&&f.source_fund_id===b.sourceFund);
  if(!fund||fund.canonical_fund_id!==b.fundId)return hold('CANONICAL_FUND_BINDING_REQUIRED');
  if(BigInt(original.amount_minor)>1000000000000n)return hold('CANONICAL_AMOUNT_BOUND_REQUIRED');
  let projection;try{projection=importProjection(original,{...b,identityReviewed:true})}catch{return hold('ORIGINAL_IMPORT_NOT_SUPPORTED')}
  ops.push({type:'original',source:original.source_transaction_id,...projection});
  let balance=BigInt(original.amount_minor);const timestamps=new Set();
  const corrections=report.snapshot.records.filter(r=>r.source_account_reference===b.account&&r.recipient_organization_id===b.organization&&r.original_source_transaction_id_or_null===original.source_transaction_id).sort((a,c)=>Date.parse(a.received_at_utc)-Date.parse(c.received_at_utc));
  for(const r of corrections){
   if(timestamps.has(Date.parse(r.received_at_utc))||Date.parse(r.received_at_utc)<Date.parse(original.received_at_utc))return hold('AUTHORITATIVE_CORRECTION_ORDER_REQUIRED');timestamps.add(Date.parse(r.received_at_utc));
   const statements=bundle.statements.filter(s=>s.source_account_reference===b.account&&s.recipient_organization_id===b.organization&&s.source_donor_id===b.sourceDonor&&s.source_statement_reference===r.source_statement_reference_or_null);
   if(r.source_statement_reference_or_null!==null&&statements.length!==1)return hold('EXACT_STATEMENT_VERSION_REQUIRED');
   const h=digest({account:b.account,organization:b.organization,source:r.source_transaction_id,operation:'historical-correction-v1'}),request_key=`${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
   const direction=r.correction_kind_or_null==='refund'?'decrease':r.adjustment_direction;
   const payload={request_key,person_id:b.personId??null,fund_id:b.fundId,currency:r.currency,source_system:'GiveHub:'+b.account,source_transaction_id:r.source_transaction_id,original_source_transaction_id:original.source_transaction_id,kind:r.correction_kind_or_null==='refund'?'refund':'correction',direction,amount_minor:r.correction_amount_minor_or_null,expected_balance_minor:String(balance),occurred_at:r.received_at_utc,tax_eligible:fund.tax_eligible,receipt_reference:r.source_receipt_reference_or_null,statement_reference:r.source_statement_reference_or_null,statement_archive_sha256:statements[0]?.private_archive_sha256??null,review_reference:b.reviewReference};
   balance+=BigInt(payload.amount_minor)*(direction==='decrease'?-1n:1n);if(balance<0n||balance>1000000000000n)return hold('ORDERED_BALANCE_INVALID');
   ops.push({type:'history',source:r.source_transaction_id,originalSource:original.source_transaction_id,organization:b.organization,payload,canPost:false});
  }
 }
 return{status:'PASS',reason:'LOCAL_SYNTHETIC_PLAN_ONLY',canExecute:false,operations:ops};
}
