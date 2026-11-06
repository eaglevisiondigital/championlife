// Internal, read-only review adapter. No public handler, transaction creation or payment port.
// authenticate and evidence are trusted SERVER ports, never request-supplied snapshots.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const keys=['organizationId','formId','fundId','routeId'];
const result=(reason,reviewableSnapshot=false)=>Object.freeze({reason,reviewableSnapshot,canSubmit:false,canRetry:false,canPostLedger:false,providerVerified:false});
export function createDurablePilotReviewer({authenticate,resolveEvidence,withReadOnlyTransaction}) {
 return async selection=>{
  if(!selection||Array.isArray(selection)||Object.keys(selection).length!==4||keys.some(k=>!Object.hasOwn(selection,k)||!uuid(selection[k])))return result('INVALID_SELECTION');
  const scope=Object.freeze({...selection});
  try {
   const principal=await authenticate();if(!principal||principal.verified!==true||!uuid(principal.userId)||typeof principal.sessionId!=='string'||!principal.sessionId)return result('UNVERIFIED_IDENTITY');
   const identity=Object.freeze({userId:principal.userId,sessionId:principal.sessionId});
   const evidence=structuredClone(await resolveEvidence(scope,identity));
   // This package admits only explicitly fictional boarding evidence. Real custody remains gated.
   if(!evidence||evidence.fictional!==true||evidence.revoked!==false||evidence.approved!==true||evidence.independentReview!==true||evidence.kind!=='one-time'||!['MID-01','MID-02','MID-03','MID-04'].includes(evidence.midSlot)||keys.some(k=>evidence[k]!==scope[k])||!Number.isSafeInteger(evidence.revision)||evidence.revision<1||!Number.isFinite(Date.parse(evidence.expiresAt))||Date.parse(evidence.expiresAt)<=Date.now())return result('UNAPPROVED_BINDING');
   if(evidence.organization==='SowGo'&&(evidence.legalMerchant!=='SyntheticSowGoLegal'||evidence.settlementOwner!=='SyntheticSowGoBank'||evidence.receiptOwner!=='SyntheticSowGoReceipt'||evidence.purpose!=='charitable_contribution'))return result('SOWGO_OWNERSHIP_MISMATCH');
   if(!['SowGo','Champion Life'].includes(evidence.organization))return result('UNAPPROVED_BINDING');
   let completed=false,reviewable=false;
   await withReadOnlyTransaction(async db=>{
    if(completed)throw Error('DUPLICATE_SNAPSHOT');completed=true;
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[identity.userId]);
    const authority=await db.query("select private.outreach_verified($1::uuid) and private.has_staff_permission($2::uuid,'payments.configure') as allowed",[identity.userId,scope.organizationId]);
    if(authority.rows[0]?.allowed!==true)return;
    const canonical=(await db.query("select private.payments_route($1,$2,null,$3,'USD') as route",[scope.organizationId,scope.fundId,evidence.purpose])).rows[0]?.route;
    if(!canonical||canonical.provider!=='nmi'||canonical.environment!=='sandbox'||canonical.currency!=='USD'||canonical.processor_route_id!==scope.routeId)return;
    const incident=await db.query("select exists(select 1 from private.payment_ops_incidents where organization_id=$1 and (gateway_id is null or gateway_id=$2) and status<>'healthy') as blocked",[scope.organizationId,evidence.gatewayId]);
    if(incident.rows[0]?.blocked!==false)return;
    const snapshot=await db.query(`select ff.purpose, f.id as fund_id,f.status,f.is_public,d.gateway_id,d.processor_route_id,
      gr.mid_reference,gr.revision as route_revision,a.merchant_reference,a.enabled as account_enabled,
      proof.mid_reference as proof_mid,proof.settlement_reference,proof.merchant_reference as proof_merchant,proof.proof_reference,proof.enabled as proof_enabled,
      nr.enabled as nmi_route_enabled,c.receipt_identity,c.enabled as control_enabled,fo.recurring_allowed,fo.enabled as form_enabled,
      proof.verified_at is not null and nr.verified_at is not null and a.last_verified_at is not null as checked
      from private.nmi_giving_form_funds ff
      join private.nmi_giving_forms fo on fo.id=ff.form_id and fo.organization_id=ff.organization_id
      join public.giving_funds f on f.id=ff.fund_id and f.organization_id=ff.organization_id
      join public.giving_destinations d on d.id=f.destination_id and d.organization_id=f.organization_id
      join public.giving_processor_routes gr on gr.id=d.processor_route_id and gr.organization_id=d.organization_id and gr.gateway_id=d.gateway_id
      join private.payments_nmi_accounts a on a.gateway_id=d.gateway_id and a.organization_id=d.organization_id
      join private.payments_nmi_routes nr on nr.route_id=gr.id and nr.gateway_id=a.gateway_id and nr.organization_id=a.organization_id
      join private.nmi_giving_route_proofs proof on proof.route_id=nr.route_id and proof.gateway_id=nr.gateway_id and proof.organization_id=nr.organization_id
      join private.nmi_giving_control c on c.organization_id=f.organization_id
      where ff.organization_id=$1 and ff.form_id=$2 and ff.fund_id=$3 and gr.id=$4`,keys.map(k=>scope[k]));
    const s=snapshot.rows[0];
    reviewable=snapshot.rows.length===1&&s.checked===true&&s.status==='active'&&s.is_public===true&&s.account_enabled===true&&s.proof_enabled===true&&s.nmi_route_enabled===true&&s.recurring_allowed===false&&s.form_enabled===false&&s.control_enabled===false&&
     s.purpose===evidence.purpose&&s.gateway_id===evidence.gatewayId&&s.mid_reference===evidence.midAlias&&s.proof_mid===evidence.midAlias&&s.merchant_reference===evidence.legalMerchant&&s.proof_merchant===evidence.legalMerchant&&s.settlement_reference===evidence.settlementOwner&&s.receipt_identity===evidence.receiptOwner&&s.proof_reference===evidence.evidenceRef&&s.route_revision===evidence.revision;
   });
   const fresh=await authenticate();const current=await resolveEvidence(scope,identity);
   if(!completed||fresh?.verified!==true||fresh.userId!==identity.userId||fresh.sessionId!==identity.sessionId||JSON.stringify(current)!==JSON.stringify(evidence)||Date.parse(evidence.expiresAt)<=Date.now())return result('REVOKED_OR_CHANGED_BINDING');
   return result(reviewable?'DISABLED_DURABLE_SNAPSHOT_REVIEWABLE':'DURABLE_AUTHORITY_OR_ROUTE_DENIED',reviewable);
  }catch{return result('DURABLE_REVIEW_UNAVAILABLE');}
 };
}
