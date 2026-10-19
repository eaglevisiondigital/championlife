// Official Classic Query API: bounded HTTPS, no raw XML persisted/logged, no DTD/entities.
import {credential,NmiFailure,reference,decimalMinor} from './nmi.mjs';
const fail=()=>{throw new NmiFailure('unknown','review')};
function scalar(xml,name){const all=[...xml.matchAll(new RegExp('<'+name+'>([^<]*)</'+name+'>','g'))];if(all.length!==1)return null;const v=all[0][1];if(/&(?!(?:amp|lt|gt|quot|apos);)/.test(v))fail();return v.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");}
export function queryProjection(xml,scope){
 if(typeof xml!=='string'||xml.length>1048576||/<!DOCTYPE|<!ENTITY|<\?|&#/i.test(xml.replace(/^<\?xml[^?]*\?>/,''))||!/^\s*(?:<\?xml[^?]*\?>\s*)?<nm_response>/.test(xml)||!/<\/nm_response>\s*$/.test(xml))fail();
 const blocks=[...xml.matchAll(/<transaction>([\s\S]*?)<\/transaction>/g)];if(blocks.length>100)fail();
 return blocks.map(([,b])=>{
  const actions=[...b.matchAll(/<action>([\s\S]*?)<\/action>/g)].map(([,a])=>({type:scalar(a,'action_type'),amount:scalar(a,'amount'),batch:scalar(a,'batch_id'),success:scalar(a,'success')}));
  const clean=b.replace(/<action>[\s\S]*?<\/action>/g,'');
  const id=reference(scalar(clean,'transaction_id')||''),processor=reference(scalar(clean,'processor_id')||''),currency=scalar(clean,'currency');
  const amount=scalar(clean,'amount')||actions.find(a=>['sale','auth','capture'].includes(a.type)&&a.success==='1')?.amount;
  if(currency!==scope.currency||!amount)fail();
  const refunded=actions.filter(a=>a.type==='refund'&&a.success==='1').reduce((s,a)=>s+BigInt(decimalMinor(a.amount)),0n);
  return {subscription_reference:scalar(clean,'subscription_id'),refunded_minor:refunded.toString(),provider_reference:id,processor_id:processor,currency,amount_minor:decimalMinor(amount),order_reference:scalar(clean,'order_id'),status:({complete:'settled',pendingsettlement:'captured',pending:'authorized',failed:'failed',canceled:'voided'})[scalar(clean,'condition')]||'review',batches:actions.filter(a=>a.type==='settle'&&a.success==='1'&&a.batch).map(a=>({batch_reference:reference(a.batch),gross_minor:decimalMinor(a.amount)}))};
 });
}
export function createNmiQuery({config,scope,readSecret,fetcher=fetch}){
 async function page(params,page){
  const key=credential(config,scope,readSecret);let response;
  try{response=await fetcher('https://sandbox.nmi.com/api/query.php',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/xml'},body:new URLSearchParams({security_key:key,...params,result_limit:'100',page_number:String(page)}),signal:AbortSignal.timeout(12000)});}catch{fail()}
  if(!response.ok)fail();const reader=response.body?.getReader();if(!reader)fail();let n=0;const parts=[];
  for(;;){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>1048576){await reader.cancel();fail()}parts.push(r.value)}
  const bytes=new Uint8Array(n);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length}
  return queryProjection(new TextDecoder().decode(bytes),scope);
 }
 return Object.freeze({
  async transaction({transaction_reference,order_reference}){
   if(!transaction_reference&&!order_reference)fail();const rows=await page(transaction_reference?{transaction_id:reference(transaction_reference)}:{order_id:reference(order_reference)},0);
   if(rows.length!==1) return {status:'review',category:'unknown',authoritative:false};
   const r=rows[0];if(r.processor_id!==scope.processor_id||(transaction_reference&&r.provider_reference!==transaction_reference)||(!transaction_reference&&r.order_reference!==order_reference))fail();
   return {...r,authoritative:r.status!=='review'};
  },
  async batch({batch_reference,date}){
   reference(batch_reference);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))fail();const prefix=date.replaceAll('-',''),items=[];
   for(let i=0;i<10;i++){
    const rows=await page({condition:'complete',start_date:prefix+'000000',end_date:prefix+'235959'},i);
    for(const r of rows){if(r.processor_id!==scope.processor_id)continue;for(const b of r.batches)if(b.batch_reference===batch_reference)items.push({provider_reference:r.provider_reference,gross_minor:b.gross_minor,currency:r.currency});}
    if(rows.length<100){if(new Set(items.map(x=>x.provider_reference)).size!==items.length)fail();return {batch_reference,date,currency:scope.currency,processor_id:scope.processor_id,complete:true,items,gross_minor:items.reduce((s,x)=>s+BigInt(x.gross_minor),0n).toString(),fee_minor:null,net_minor:null};}
   }fail();
  }
 });
}
