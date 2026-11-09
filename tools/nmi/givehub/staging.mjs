// Offline staging, never a second ledger. No network, database writes or provider API.
import {createHash} from 'node:crypto';
import {prepareDisabledRoute} from '../disabled-routing.mjs';
export const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
export const digest=x=>createHash('sha256').update(canonical(x)).digest('hex');
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(x);
const money=x=>typeof x==='string'&&/^(0|[1-9][0-9]{0,17})$/.test(x);
const time=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x.replace(/(?<!\.\d{3})Z$/,'.000Z');
const key=r=>JSON.stringify([r.source_account_reference,r.recipient_organization_id,r.source_transaction_id]);
const scope=r=>JSON.stringify([r.source_account_reference,r.recipient_organization_id]);
const fundKey=r=>JSON.stringify([r.source_account_reference,r.recipient_organization_id,r.source_fund_id]);
const requiredPermissions=['finance.read','finance.gifts.read','finance.reconciliation.read'];
function authority(input,auth){
 if(!auth||auth.current!==true||!requiredPermissions.every(p=>auth.permissions?.includes(p))||!Array.isArray(auth.organizations))throw Error('FINANCIAL_ACCESS_DENIED');
 for(const row of input)if(!auth.organizations.includes(row?.recipient_organization_id))throw Error('FINANCIAL_SCOPE_DENIED');
}
function unique(rows,keyFn){const map=new Map(),bad=new Set();for(const r of rows){const k=keyFn(r);if(map.has(k))bad.add(k);else map.set(k,r)}for(const k of bad)map.delete(k);return{map,bad}}
const serial=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
export function dryRun(bundle,authorityContext,previous=null){
 if(bundle?.contract_version!==1||bundle.source_system!=='GiveHub'||bundle.synthetic!==true)throw Error('SYNTHETIC_NORMALIZED_CONTRACT_REQUIRED');
 for(const name of ['transactions','funds','donors','statements','recurring'])if(!Array.isArray(bundle[name])||bundle[name].length>10000)throw Error('BOUNDED_DATASETS_REQUIRED');
 authority([...bundle.transactions,...bundle.funds,...bundle.donors,...bundle.statements,...bundle.recurring,...(bundle.control_totals||[]).map(c=>({recipient_organization_id:c.recipient})),...(previous?.records||[])],authorityContext);
 if(previous&&(previous.version!==1||previous.digest!==digest(previous.records)))throw Error('INVALID_STAGING_SNAPSHOT');
 const exceptions=[],note=(record,code)=>exceptions.push({source_transaction_id:record?.source_transaction_id||null,recipient:record?.recipient_organization_id||null,code});
 const funds=unique(bundle.funds,fundKey),donors=unique(bundle.donors,r=>scope(r)+'/'+r.source_donor_id);
 for(const bad of funds.bad)note(null,'AMBIGUOUS_FUND:'+bad);
 for(const bad of donors.bad)note(null,'AMBIGUOUS_DONOR:'+bad);
 const priorKeys=new Set((previous?.records||[]).map(key));
 const records=new Map(),conflicts=new Set();let added=0,replayed=0;
 // Both prior records and new input must pass current mapping checks, never trust a snapshot as authority.
 for(const [isPrior,rows]of [[true,previous?.records||[]],[false,bundle.transactions]])for(const r of rows){
  try{
   if(Object.keys(r).some(k=>!['source_transaction_id','source_account_reference','recipient_organization_id','source_donor_id_or_null','source_household_id_or_null','source_fund_id','received_at_utc','source_timezone','amount_minor','currency','status','payment_method_class','source_batch_id_or_null','processor_fee_minor_or_null','net_minor_or_null','source_receipt_reference_or_null','source_statement_reference_or_null','source_schedule_id_or_null','original_source_transaction_id_or_null','correction_kind_or_null','correction_amount_minor_or_null','adjustment_direction'].includes(k)))throw Error('UNSUPPORTED_TRANSACTION_FIELDS');
   for(const field of ['source_transaction_id','source_account_reference','recipient_organization_id','source_fund_id'])if(!id(r[field]))throw Error('MISSING_ID');
   if(!money(r.amount_minor)||!(/^[A-Z]{3}$/.test(r.currency)))throw Error('INVALID_MONEY_OR_CURRENCY');
   if(!time(r.received_at_utc))throw Error('INVALID_TIMESTAMP');
   if(!r.source_timezone)throw Error('MISSING_TIMEZONE');
   new Intl.DateTimeFormat('en-US',{timeZone:r.source_timezone}).format(new Date(r.received_at_utc));
   if(!['settled','pending','failed','voided','unknown','refunded','partially_refunded'].includes(r.status))throw Error('UNMAPPED_STATUS');
   const f=funds.map.get(fundKey(r));if(!f||!id(f.canonical_fund_id)||typeof f.tax_eligible!=='boolean'||!id(f.tax_classification_evidence)||!id(f.mapping_approved_by)||!time(f.mapping_approved_at)||!['contribution','event_fee','purchase'].includes(f.transaction_purpose))throw Error('FUND_MAPPING_HELD');
   if(r.source_donor_id_or_null!==null&&!donors.map.has(scope(r)+'/'+r.source_donor_id_or_null))throw Error('DONOR_MAPPING_HELD');
   if(r.correction_kind_or_null===null&&r.amount_minor==='0')throw Error('ZERO_GIFT');
   if(r.correction_kind_or_null!==null){if(r.amount_minor!=='0')throw Error('AMBIGUOUS_CORRECTION_AMOUNT');if(!['refund','adjustment'].includes(r.correction_kind_or_null)||!id(r.original_source_transaction_id_or_null)||!money(r.correction_amount_minor_or_null)||r.correction_amount_minor_or_null==='0')throw Error('INVALID_CORRECTION');if(r.correction_kind_or_null==='adjustment'&&!['increase','decrease'].includes(r.adjustment_direction))throw Error('AMBIGUOUS_ADJUSTMENT');}
   else if(r.original_source_transaction_id_or_null!==null||r.correction_amount_minor_or_null!==null)throw Error('CONFLICTING_CORRECTION');
   for(const field of ['processor_fee_minor_or_null','net_minor_or_null'])if(r[field]!==null&&!money(r[field]))throw Error('INVALID_FEE_NET');
   if(r.processor_fee_minor_or_null!==null&&r.net_minor_or_null!==null&&BigInt(r.amount_minor)!==BigInt(r.processor_fee_minor_or_null)+BigInt(r.net_minor_or_null))throw Error('FEE_NET_MISMATCH');
   if(!Object.hasOwn(r,'source_receipt_reference_or_null')||!Object.hasOwn(r,'source_statement_reference_or_null'))throw Error('MISSING_HISTORY_FIELDS');
   const k=key(r);if(conflicts.has(k)){note(r,'CONFLICTING_SOURCE_KEY');continue}
   if(records.has(k)){if(canonical(records.get(k))!==canonical(r)){records.delete(k);conflicts.add(k);note(r,'CONFLICTING_SOURCE_KEY')}else if(!isPrior)replayed++;}
   else {records.set(k,structuredClone(r));if(!isPrior)added++;}
  }catch(e){note(r,e.message)}
 }
 const amounts=new Map(),invalid=new Set();
 for(const [k,r]of records)if(r.correction_kind_or_null!==null){
  const parent=records.get(key({...r,source_transaction_id:r.original_source_transaction_id_or_null}));
  if(!parent||parent.correction_kind_or_null!==null||parent.currency!==r.currency||parent.source_fund_id!==r.source_fund_id||parent.source_donor_id_or_null!==r.source_donor_id_or_null||!['settled','refunded','partially_refunded'].includes(parent.status)||r.status!=='settled'){note(r,'CORRECTION_PARENT_MISMATCH');invalid.add(k);continue}
  const pk=key(parent),delta=BigInt(r.correction_amount_minor_or_null)*(r.correction_kind_or_null==='refund'||r.adjustment_direction==='decrease'?-1n:1n);amounts.set(pk,(amounts.get(pk)||0n)+delta);
 }
 for(const [pk,delta]of amounts)if(BigInt(records.get(pk).amount_minor)+delta<0n){note(records.get(pk),'CORRECTIONS_EXCEED_GROSS');for(const[k,r]of records)if(r.original_source_transaction_id_or_null===records.get(pk).source_transaction_id&&scope(r)===scope(records.get(pk)))invalid.add(k)}
 for(const k of invalid)records.delete(k);
 const groups=new Map(),proposal=[];
 for(const r of records.values()){
  const f=funds.map.get(fundKey(r)),year=new Intl.DateTimeFormat('en-US',{year:'numeric',timeZone:r.source_timezone}).format(new Date(r.received_at_utc));
  const k=JSON.stringify([r.recipient_organization_id,r.source_fund_id,year,r.currency,r.status]);
  if(!groups.has(k))groups.set(k,{recipient:r.recipient_organization_id,fund:r.source_fund_id,year,currency:r.currency,status:r.status,gifts:0,gross:0n,refunds:0n,adjustments:0n,contribution:0n,noncontribution:0n,fees:0n,net:0n,unknownFeeNet:0});
  const g=groups.get(k);let amount=0n;
  if(r.correction_kind_or_null==='refund'){g.refunds+=BigInt(r.correction_amount_minor_or_null);amount=-BigInt(r.correction_amount_minor_or_null)}
  else if(r.correction_kind_or_null==='adjustment'){amount=BigInt(r.correction_amount_minor_or_null)*(r.adjustment_direction==='decrease'?-1n:1n);g.adjustments+=amount}
  else{g.gifts++;amount=BigInt(r.amount_minor);g.gross+=amount;}
  if(f.tax_eligible)g.contribution+=amount;else g.noncontribution+=amount;
  if(r.processor_fee_minor_or_null===null||r.net_minor_or_null===null)g.unknownFeeNet++;else{g.fees+=BigInt(r.processor_fee_minor_or_null);g.net+=BigInt(r.net_minor_or_null)}
  if(['pending','failed','voided','unknown'].includes(r.status))note(r,'NOT_CONFIRMED_GIFT');
  if(['refunded','partially_refunded'].includes(r.status)&&!amounts.has(key(r)))note(r,'REFUND_DETAIL_MISSING');
  proposal.push({identity:JSON.parse(key(r)),canonicalFund:f.canonical_fund_id,source_system:'GiveHub:'+r.source_account_reference,external_transaction_id:r.source_transaction_id,canonicalBoundary:r.correction_kind_or_null==='refund'?'HELD: historical refund import contract absent':r.correction_kind_or_null?'giving_workspace.adjust (reviewed replacement, not delta import)':'giving_workspace.import',receipt:r.source_receipt_reference_or_null,statement:r.source_statement_reference_or_null,personLink:'NOT_INFERRED',taxEligible:f.tax_eligible,canPost:false});
 }
 const statementKeys=unique(bundle.statements,s=>JSON.stringify([s.source_account_reference,s.recipient_organization_id,s.source_statement_reference,s.version]));
 for(const r of records.values())if(r.source_statement_reference_or_null!==null&&!bundle.statements.some(s=>scope(s)===scope(r)&&s.source_statement_reference===r.source_statement_reference_or_null&&s.source_donor_id===r.source_donor_id_or_null))note(r,'STATEMENT_REFERENCE_MISSING');
 const statementReviews=bundle.statements.map(s=>{
  const rows=[...records.values()].filter(r=>r.recipient_organization_id===s.recipient_organization_id&&r.source_donor_id_or_null===s.source_donor_id&&r.source_account_reference===s.source_account_reference&&r.currency===s.currency&&new Intl.DateTimeFormat('en-US',{year:'numeric',timeZone:r.source_timezone}).format(new Date(r.received_at_utc))===String(s.tax_year));
  let contribution=0n,noncontribution=0n,refund=0n;
  for(const r of rows){if(!['settled','refunded','partially_refunded'].includes(r.status))continue;const f=funds.map.get(fundKey(r));if(r.correction_kind_or_null==='refund'){refund+=BigInt(r.correction_amount_minor_or_null);continue}const amount=BigInt(r.correction_kind_or_null?r.correction_amount_minor_or_null:r.amount_minor)*(r.adjustment_direction==='decrease'?-1n:1n);if(f.tax_eligible)contribution+=amount;else noncontribution+=amount}
  const match=!statementKeys.bad.has(JSON.stringify([s.source_account_reference,s.recipient_organization_id,s.source_statement_reference,s.version]))&&Number.isInteger(s.version)&&s.version>0&&time(s.issued_at)&&s.do_not_resend===true&&/^[a-f0-9]{64}$/.test(s.private_archive_sha256)&&money(s.contribution_minor)&&money(s.noncontribution_minor)&&money(s.refund_minor)&&String(contribution)===s.contribution_minor&&String(noncontribution)===s.noncontribution_minor&&String(refund)===s.refund_minor;
  return{reference:s.source_statement_reference,recipient:s.recipient_organization_id,year:s.tax_year,sourceVersion:s.version,doNotResend:true,status:match?'PASS':'HOLD',computed:{contribution,noncontribution,refund},original:structuredClone(s)};
 });
 const scheduleKeys=unique(bundle.recurring,r=>scope(r)+'/'+r.source_schedule_id);
 const recurring=bundle.recurring.map(r=>({source_schedule_id:r.source_schedule_id,recipient:r.recipient_organization_id,fund:r.source_fund_id,amount_minor:r.amount_minor,currency:r.currency,status:r.status,nextCharge:r.next_charge_at_or_null,frequency:r.frequency,interval:r.interval,observedAt:r.inventory_observed_at,inventoryValid:!scheduleKeys.bad.has(scope(r)+'/'+r.source_schedule_id)&&id(r.source_schedule_id)&&funds.map.has(fundKey(r))&&donors.map.has(scope(r)+'/'+r.source_donor_id)&&money(r.amount_minor)&&r.amount_minor!=='0'&&['weekly','monthly','quarterly','yearly'].includes(r.frequency)&&Number.isInteger(r.interval)&&r.interval>0&&['active','paused','cancelled','failed','unknown'].includes(r.status)&&time(r.inventory_observed_at)&&time(r.next_charge_at_or_null)&&time(r.next_date_verified_at_or_null)&&Date.parse(r.next_date_verified_at_or_null)<=Date.parse(r.inventory_observed_at)&&Date.parse(r.inventory_observed_at)<=Date.parse(bundle.reviewed_at),transition:'hold_in_GiveHub',canActivate:false,portability:'UNVERIFIED'}));
 const sourceControlReviews=[];
 const totals=Array.isArray(bundle.control_totals)?bundle.control_totals:[];
 const controlKey=c=>JSON.stringify([c.recipient,c.fund,String(c.year),c.currency,c.status]);
 const controls=unique(totals,controlKey);
 for(const [k,g]of groups){const expected=controls.map.get(k);sourceControlReviews.push({scope:k,status:expected&&['gifts','gross','refunds','adjustments'].every(f=>String(g[f])===String(expected[f]))?'PASS':'HOLD'});}
 for(const k of controls.map.keys())if(!groups.has(k))sourceControlReviews.push({scope:k,status:'HOLD'});
 for(const k of controls.bad)sourceControlReviews.push({scope:k,status:'HOLD'});
 if(!groups.size)sourceControlReviews.push({scope:'EMPTY_EXPORT',status:'HOLD'});
 const staged=[...records.values()].sort((a,b)=>key(a).localeCompare(key(b)));
 return serial({mode:'synthetic-dry-run',release:'HOLD',canPostLedger:false,canCharge:false,canSend:false,canCancel:false,sourceDigest:digest(bundle),sourceControlReviews,localReconciliation:sourceControlReviews.some(c=>c.status!=='PASS')||exceptions.length||statementReviews.some(s=>s.status!=='PASS')||recurring.some(r=>!r.inventoryValid)?'HOLD':'PASS',donorReviews:bundle.donors.map(d=>({account:d.source_account_reference,recipient:d.recipient_organization_id,sourceDonor:d.source_donor_id,duplicateReview:d.duplicate_review_status,consent:d.contact_consent_status,canonicalLink:'HELD_NOT_INFERRED',canGrant:false})),fundReviews:bundle.funds.map(f=>({account:f.source_account_reference,recipient:f.recipient_organization_id,sourceFund:f.source_fund_id,canonicalFund:f.canonical_fund_id,purpose:f.transaction_purpose,taxEligible:f.tax_eligible,taxEvidence:f.tax_classification_evidence,destination:f.destination_id,status:'REVIEW_ONLY'})),counts:{input:bundle.transactions.length,distinct:staged.length,added:staged.filter(r=>!priorKeys.has(key(r))).length,replayed,exceptions:exceptions.length},groups:[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v),exceptions,mappings:proposal,statements:statementReviews,recurring,routes:['Main','Youth','Outreach','Events','Merch'].map(route=>({route,...prepareDisabledRoute(bundle.boarding,route,null,bundle.reviewed_at)})),blockers:['ACTUAL_GIVEHUB_SCHEMA_AND_EXPORT_UNVERIFIED','CANONICAL_PERSON_LINKS_NOT_AUTHORIZED','CANONICAL_BATCH_AND_TARGET_ACCEPTANCE_REQUIRED','FOUR_MID_LEGAL_SETTLEMENT_PROOF_REQUIRED','VAULT_PORTABILITY_AND_RECURRING_CONSENT_UNVERIFIED','HISTORICAL_REFUND_AND_MULTI_CORRECTION_IMPORT_CONTRACT_REQUIRED','NO_PROVIDER_OR_OWNER_RELEASE_ACCEPTANCE'],snapshot:{version:1,records:staged,digest:digest(staged)}});
}
// Review-only payload projection for the EXISTING canonical import API. No dispatch.
export function importProjection(row,{fundId,batchId,personId=null,householdId=null,identityReviewed=false}){
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 if(row.status!=='settled'||row.correction_kind_or_null!==null||!money(row.amount_minor)||row.amount_minor==='0'||!time(row.received_at_utc)||!id(row.source_account_reference)||!id(row.source_transaction_id)||!uuid(fundId)||!uuid(batchId))throw Error('CANONICAL_IMPORT_NOT_SUPPORTED');
 if((row.source_donor_id_or_null!==null||personId||householdId)&&(!identityReviewed||!uuid(personId)))throw Error('VERIFIED_PERSON_MAPPING_REQUIRED');
 if(householdId&&!uuid(householdId))throw Error('VERIFIED_HOUSEHOLD_MAPPING_REQUIRED');
 const hash=digest({scope:JSON.parse(key(row)),operation:'historical-gift'}),request_key=hash.slice(0,8)+'-'+hash.slice(8,12)+'-5'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
 return{canPost:false,action:'import',organization:row.recipient_organization_id,payload:{request_key,person_id:personId,household_id:householdId,fund_id:fundId,batch_id:batchId,amount_minor:row.amount_minor,currency:row.currency,gift_at:row.received_at_utc,payment_method:'external',external_reference:row.source_transaction_id,source_system:'GiveHub:'+row.source_account_reference,external_transaction_id:row.source_transaction_id,receipt_history_reference:row.source_receipt_reference_or_null,notes:'',anonymous_public:false}};
}
