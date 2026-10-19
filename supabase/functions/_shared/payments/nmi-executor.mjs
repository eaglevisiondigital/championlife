import {createNmiAdapter,credential,NmiFailure} from './nmi.mjs';
import {dedicatedAcceptance} from './acceptance-pin.mjs';
import {createNmiQuery} from './nmi-query.mjs';
export async function executeNmiGiving({config,organization_id,session_id,id,payment_token,rpc,fetcher=fetch,readSecret}){
 let claim=await rpc('claim',organization_id,{session_id,id});if(!claim.claimed)return {status:'pending',retry_automatically:false};
 const recovery=['transaction','refund','void','recurring_cancel','recurring_pause'].includes(claim.operation);
 const scoped={...config,enabled:config.enabled===true||(dedicatedAcceptance(config)&&config.recoveryEnabled===true&&recovery),organization_id,gateway_id:claim.scope.gateway_id};
 const adapter=createNmiAdapter({config:scoped,scope:claim.scope,readSecret,fetcher});
 try{credential(scoped,claim.scope,readSecret);if(['sale','authorize','recurring_create'].includes(claim.operation)&&!(/^[A-Za-z0-9_-]{8,256}$/.test(payment_token||'')) )throw Error('token');}
 catch{await rpc('release',organization_id,{session_id,id,lease:claim.lease});return {status:'held',retry_automatically:false};}
 claim=await rpc('handoff',organization_id,{session_id,id,lease:claim.lease});
 const query=createNmiQuery({config:scoped,scope:claim.scope,readSecret,fetcher});
 let provisional=null,result={status:'review',category:'unknown',authoritative:false};
 try{
  const op=claim.operation;
  if(['sale','authorize'].includes(op)){
   const response=await adapter[op]({amount_minor:claim.amount_minor,method:{payment_token},save_method:claim.save_method,order_reference:claim.order_reference});
   if(response.status==='failed')result={...response,authoritative:['declined','insufficient_funds','expired_card','invalid_payment_method'].includes(response.category)};
   else if(response.provider_reference){provisional=response.provider_reference;
    // A sale response or browser return is never enough to post: authoritative lookup.
    result=await query.transaction({transaction_reference:response.provider_reference});
    result.provider_reference??=response.provider_reference;if(claim.save_method&&response.customer_reference)result.customer_reference=response.customer_reference;
   }
  }else if(op==='transaction'){
   if(['recurring_create','recurring_cancel','recurring_pause'].includes(claim.recovery_operation)){
    const reference=claim.subscription_reference||claim.parent_provider_reference;
    if(reference){const check=await adapter.retrieve_subscription({subscription_reference:reference,cancelled:claim.recovery_operation==='recurring_cancel'});
     const expected={recurring_create:'active',recurring_cancel:'cancelled',recurring_pause:'paused'}[claim.recovery_operation];
     if(check.status===expected&&(expected!=='active'||check.plan_reference===claim.plan_reference))result={status:expected,authoritative:true,provider_reference:reference,amount_minor:claim.amount_minor,currency:claim.scope.currency,processor_id:claim.scope.processor_id};
    }
   }else{
    result=await query.transaction({transaction_reference:claim.transaction_reference,order_reference:claim.order_reference});
    if(claim.expected_subscription&&result.subscription_reference!==claim.expected_subscription)result={status:'review',authoritative:false,category:'routing_error'};
    if(claim.recovery_operation==='refund')result=result.authoritative===true&&result.refunded_minor===(BigInt(claim.refunded_minor_before)+BigInt(claim.amount_minor)).toString()?{...result,status:'refunded',amount_minor:claim.amount_minor}:{status:'review',authoritative:false,category:'unknown'};
    if(claim.recovery_operation==='void'&&result.status!=='voided')result={status:'review',authoritative:false,category:'unknown'};
   }
  }
  else if(op==='capture'){
   const r=await adapter.capture({transaction_reference:claim.transaction_reference,amount_minor:claim.amount_minor});
   if(r.status!=='failed')result=await query.transaction({transaction_reference:claim.transaction_reference});else result={...r,authoritative:false};
  }else if(['refund','void'].includes(op)){
   const r=await adapter[op]({transaction_reference:claim.transaction_reference,...(op==='refund'?{amount_minor:claim.amount_minor}:{})});
   const original=await query.transaction({transaction_reference:claim.transaction_reference});
   const verified=original.authoritative===true&&original.processor_id===claim.scope.processor_id&&original.currency===claim.scope.currency&&
    ((op==='void'&&r.status==='voided'&&original.status==='voided')||(op==='refund'&&r.status==='refunded'&&r.amount_minor===claim.amount_minor&&original.refunded_minor===(BigInt(claim.refunded_minor_before)+BigInt(claim.amount_minor)).toString()));
   result=verified?{status:op==='void'?'voided':'refunded',authoritative:true,provider_reference:r.provider_reference||claim.transaction_reference,amount_minor:claim.amount_minor,currency:original.currency,processor_id:original.processor_id}:{status:'review',category:'unknown',authoritative:false,provider_reference:r.provider_reference};
  }else if(op==='recurring_create'){
   const r=await adapter.create_recurring_profile({plan_id:claim.plan_reference,method:{payment_token},start_date:claim.start_date,active:true,save_method:claim.save_method,order_reference:claim.order_reference});
   if(r.provider_reference){
    const check=await adapter.retrieve_subscription({subscription_reference:r.provider_reference});
    result=check.status==='active'&&check.plan_reference===claim.plan_reference?{status:'active',authoritative:true,provider_reference:r.provider_reference,amount_minor:claim.amount_minor,currency:claim.scope.currency,processor_id:claim.scope.processor_id,...(claim.save_method&&r.customer_reference?{customer_reference:r.customer_reference}:{})}:{status:'review',authoritative:false,category:'unknown',provider_reference:r.provider_reference};
   }
  }else if(op==='recurring_cancel'){
   try{await adapter.cancel_recurring_profile({subscription_reference:claim.subscription_reference})}catch{/* Cancellation is confirmed only by the following authoritative GET. */}
   const check=await adapter.retrieve_subscription({subscription_reference:claim.subscription_reference,cancelled:true});
   result={status:check.status==='cancelled'?'cancelled':'review',authoritative:check.status==='cancelled',provider_reference:claim.subscription_reference};
  }else if(op==='recurring_pause'){
   try{await adapter.pause_recurring_profile({subscription_reference:claim.subscription_reference})}catch{/* Verify the provider state even if the update response was lost. */}
   const check=await adapter.retrieve_subscription({subscription_reference:claim.subscription_reference});
   result={status:check.status==='paused'?'paused':'review',authoritative:check.status==='paused',provider_reference:claim.subscription_reference};
  }
 }catch(e){result={status:'review',authoritative:false,category:e instanceof NmiFailure?e.category:'unknown',...(provisional?{provider_reference:provisional}:{})};}
 payment_token=null;
 const safe={session_id,id,lease:claim.lease};for(const k of ['status','authoritative','provider_reference','amount_minor','currency','processor_id','category','customer_reference'])if(result[k]!==undefined)safe[k]=result[k];
 return rpc('complete',organization_id,safe);
}
