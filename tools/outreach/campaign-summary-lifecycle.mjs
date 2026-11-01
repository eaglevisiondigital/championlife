// Offline/nonpublic lifecycle coordinator for the campaign-scoped summary reader.
// NO browser mount, credentials, external provider, service-role or transport.
// A trusted server integration must still supply genuinely verified session/RPC
// bindings and enforce authorization/RLS on every underlying request.
const KEYS=['households','attendees','adults','minors','checked_in'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE=new Set(['INVALID_CAMPAIGN','UNAUTHENTICATED','STALE_SCOPE','ACCESS_DENIED','REQUEST_FAILED','INVALID_SUMMARY']);
const fail=code=>Object.assign(new Error(code),{code});

function minimalSummary(value,id){
 if(!value || value.kind!=='event-registration-summary' || value.campaignId!==id)throw fail('INVALID_SUMMARY');
 const counts={};
 for(const key of KEYS){
  const n=value.counts?.[key];
  if(!Number.isSafeInteger(n)||n<0)throw fail('INVALID_SUMMARY');
  counts[key]=n;
 }
 if(counts.adults+counts.minors!==counts.attendees || counts.checked_in>counts.attendees)throw fail('INVALID_SUMMARY');
 // Clone and whitelist. Never emit registration rows, finance, contact details or notes
 // even if a future reader accidentally returns more fields.
 return Object.freeze({campaignId:id,kind:'event-registration-summary',counts:Object.freeze(counts)});
}

export function createCampaignSummaryLifecycle({reader,onSnapshot=()=>{}}={}){
 if(!reader||typeof reader.read!=='function'||typeof reader.invalidate!=='function'||typeof onSnapshot!=='function')
  throw new TypeError('A trusted reader and snapshot callback are required');
 let epoch=0,selected=null,visible=null,closed=false;
 const clear=()=>{epoch++;selected=null;visible=null;reader.invalidate();onSnapshot(null)};
 function select(campaignId){
  if(closed)throw fail('WORKSPACE_CLOSED');
  clear(); // A permission or campaign change clears visible information first.
  if(typeof campaignId!=='string'||!UUID.test(campaignId))throw fail('INVALID_CAMPAIGN');
  selected=campaignId;
 }
 async function refresh(){
  if(closed)throw fail('WORKSPACE_CLOSED');
  if(!selected)throw fail('INVALID_CAMPAIGN');
  const id=selected,token=++epoch;
  visible=null;reader.invalidate();onSnapshot(null);
  try{
   if(closed||epoch!==token||selected!==id)throw fail('STALE_SCOPE');
   const raw=await reader.read(id);
   if(closed||epoch!==token||selected!==id)throw fail('STALE_SCOPE');
   const dto=minimalSummary(raw,id);
   visible=dto;onSnapshot(dto);
   // A synchronous consumer callback may have revoked or changed the scope.
   if(closed||epoch!==token||selected!==id)throw fail('STALE_SCOPE');
   return dto;
  }catch(error){
   const stale=closed||epoch!==token||selected!==id;
   if(!stale)clear();
   // No provider stack, query text, secret or private row detail escapes.
   throw fail(stale?'STALE_SCOPE':SAFE.has(error?.code)?error.code:'REQUEST_FAILED');
  }
 }
 function revoke(){if(!closed)clear()}
 function close(){if(!closed){clear();closed=true}}
 return Object.freeze({select,refresh,revoke,close,snapshot:()=>visible});
}
