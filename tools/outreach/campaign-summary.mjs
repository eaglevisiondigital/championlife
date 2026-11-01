// Unregistered server-side composition. Reuses existing RLS-backed RPC with the
// caller's session, never a service-role client. No transport or credentials here.
const uuid=v=>typeof v==='string'&&v.length===36&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const failure=code=>Object.assign(new Error(code),{code});
const key=s=>s?.verified===true&&uuid(s.userId)&&typeof s.sessionId==='string'&&s.sessionId.length>0&&Number.isSafeInteger(s.generation)?JSON.stringify([s.userId,s.sessionId,s.generation]):null;
export function createCampaignSummaryReader({getVerifiedSession,rpc,onInvalidate=()=>{}}){
 let generation=0,controller=null;
 function invalidate(){generation++;controller?.abort();controller=null;onInvalidate();}
 async function read(campaignId){
  invalidate();const g=generation,abort=new AbortController();controller=abort;
  try{
   if(!uuid(campaignId))throw failure('INVALID_CAMPAIGN');
   const principal=key(await getVerifiedSession());if(!principal)throw failure('UNAUTHENTICATED');
   const current=async()=>{if(g!==generation||abort.signal.aborted||key(await getVerifiedSession())!==principal||g!==generation)throw failure('STALE_SCOPE');};
   const call=async action=>{await current();const result=await rpc('outreach_registration_workspace',{p_action:action,p_campaign:campaignId,p_payload:{}},{signal:abort.signal});await current();
    if(result?.error||result?.status===401||result?.status===403){const denied=result?.error?.code==='42501'||[401,403].includes(result?.status)||[401,403].includes(result?.error?.status);throw failure(denied?'ACCESS_DENIED':'REQUEST_FAILED');}return result?.data;};
   const allowed=c=>Array.isArray(c?.capabilities)&&c.capabilities.includes('registration.view');
   if(!allowed(await call('context')))throw failure('ACCESS_DENIED');
   const response=await call('list'),counts={};
   for(const name of ['households','attendees','adults','minors','checked_in']){const n=response?.summary?.[name];if(!Number.isSafeInteger(n)||n<0)throw failure('INVALID_SUMMARY');counts[name]=n;}
   if(counts.adults+counts.minors!==counts.attendees||counts.checked_in>counts.attendees)throw failure('INVALID_SUMMARY');
   // Recheck server authority after list; a previous successful context is not a grant.
   if(!allowed(await call('context')))throw failure('ACCESS_DENIED');
   await current();
   return Object.freeze({campaignId,kind:'event-registration-summary',counts:Object.freeze(counts),decisionEngagement:'not-linked',partnerCare:'separate-permission-and-implementation-required'});
  }catch(e){if(g===generation)invalidate();throw failure(['INVALID_CAMPAIGN','UNAUTHENTICATED','STALE_SCOPE','ACCESS_DENIED','REQUEST_FAILED','INVALID_SUMMARY'].includes(e?.code)?e.code:'REQUEST_FAILED');}
 }
 return Object.freeze({read,invalidate});
}
