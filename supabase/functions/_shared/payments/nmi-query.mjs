// Official Classic Query API: bounded HTTPS, no raw XML persisted/logged, no DTD/entities.
import {credential,NmiFailure,reference,decimalMinor} from './nmi.mjs';
const fail=()=>{throw new NmiFailure('unknown','review')};
// Deliberately bounded subset of the documented transaction XML. Unsupported
// markup is UNKNOWN, never a partially recovered document. No DTD/entity parser,
// attributes, comments, CDATA, processing instructions or remote dependencies.
const xmlSpace=value=>/^[\x20\x09\x0A\x0D]*$/.test(value);
function document(xml){
 if(typeof xml!=='string'||xml.length>1048576||/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u.test(xml))fail();
 const declaration=/^<\?xml[ \t\r\n]+version=(?:"1\.0"|'1\.0')(?:[ \t\r\n]+encoding=(?:"[Uu][Tt][Ff]-8"|'[Uu][Tt][Ff]-8'))?(?:[ \t\r\n]+standalone=(?:"(?:yes|no)"|'(?:yes|no)'))?[ \t\r\n]*\?>/;
 xml=xml.replace(declaration,'');
 const stack=[];let root=null,at=0,nodes=0;
 const tag=/<(\/?)([A-Za-z_][A-Za-z0-9_.-]*)[ \t\r\n]*(\/?)>/y;
 while(at<xml.length){
  if(xml[at]!=='<'){
   const end=xml.indexOf('<',at),stop=end<0?xml.length:end,value=xml.slice(at,stop);
   if(value.includes(']]>')||/&(?!(?:amp|lt|gt|quot|apos);)/.test(value))fail();
   if(stack.length)stack.at(-1).text+=value;else if(!xmlSpace(value))fail();
   at=stop;continue;
  }
  tag.lastIndex=at;const match=tag.exec(xml);if(!match)fail();at=tag.lastIndex;
  const [,closing,name,empty]=match;
  if(closing){if(empty||stack.pop()?.name!==name)fail();continue;}
  if(++nodes>50000||stack.length>=16)fail();
  const node={name,text:'',children:[]};
  if(stack.length)stack.at(-1).children.push(node);else{if(root)fail();root=node;}
  if(!empty)stack.push(node);
 }
 if(stack.length||root?.name!=='nm_response'||!xmlSpace(root.text)||root.children.some(n=>n.name!=='transaction'))fail();
 return root;
}
function scalar(node,name){
 const matches=node.children.filter(n=>n.name===name);
 if(matches.length>1)fail();if(!matches.length)return null;
 if(matches[0].children.length)fail();
 // Decode once, without recursively interpreting escaped entity text.
 return matches[0].text.replace(/&(amp|lt|gt|quot|apos);/g,(_,name)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[name]);
}
export function queryProjection(xml,scope){
 const blocks=document(xml).children;if(blocks.length>100)fail();
 return blocks.map(b=>{
  if(!xmlSpace(b.text)||b.children.some(n=>n.name==='transaction'||n.name==='nm_response'))fail();
  const actions=b.children.filter(n=>n.name==='action').map(a=>{
   if(!xmlSpace(a.text))fail();
   return {type:scalar(a,'action_type'),amount:scalar(a,'amount'),batch:scalar(a,'batch_id'),success:scalar(a,'success')};
  });
  const id=reference(scalar(b,'transaction_id')||''),processor=reference(scalar(b,'processor_id')||''),currency=scalar(b,'currency');
  const amount=scalar(b,'amount')||actions.find(a=>['sale','auth','capture'].includes(a.type)&&a.success==='1')?.amount;
  if(currency!==scope.currency||!amount)fail();
  const refunded=actions.filter(a=>a.type==='refund'&&a.success==='1').reduce((s,a)=>s+BigInt(decimalMinor(a.amount)),0n);
  const statuses=new Map([['complete','settled'],['pendingsettlement','captured'],['pending','authorized'],['failed','failed'],['canceled','voided']]);
  return {subscription_reference:scalar(b,'subscription_id'),refunded_minor:refunded.toString(),provider_reference:id,processor_id:processor,currency,amount_minor:decimalMinor(amount),order_reference:scalar(b,'order_id'),status:statuses.get(scalar(b,'condition'))||'review',batches:actions.filter(a=>a.type==='settle'&&a.success==='1'&&a.batch).map(a=>({batch_reference:reference(a.batch),gross_minor:decimalMinor(a.amount)}))};
 });
}
export function createNmiQuery({config,scope,readSecret,fetcher=fetch}){
 async function page(params,page){
  const key=credential(config,scope,readSecret);let response;
  try{response=await fetcher('https://sandbox.nmi.com/api/query.php',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/xml'},body:new URLSearchParams({security_key:key,...params,result_limit:'100',page_number:String(page)}),signal:AbortSignal.timeout(12000)});}catch{fail()}
  if(!response.ok)fail();const reader=response.body?.getReader();if(!reader)fail();let n=0;const parts=[];
  for(;;){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>1048576){await reader.cancel();fail()}parts.push(r.value)}
  const bytes=new Uint8Array(n);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length}
  return queryProjection(new TextDecoder('utf-8',{fatal:true}).decode(bytes),scope);
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
