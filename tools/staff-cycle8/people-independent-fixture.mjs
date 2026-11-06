// Test-only extension of the accepted cycle7 fictional HTTP model. No RLS proof.
import {createFixture,ids} from '../staff-cycle7/people-registration-fixture.mjs';
export {ids,session} from '../staff-cycle7/people-registration-fixture.mjs';
export function createPeopleFixture({communicationsOnly=false,unsupported=false,historyOnly=false,activityRead=false}={}){
 const base=createFixture();let denied=false,hold=false,release=null;
 const response={external_delivery_enabled:false,organizations:[{id:ids.o,name:'Fictional Church',permissions:['communications.view','communications.send','communications.delivery.view']}],campaigns:[{id:ids.c,organization_id:ids.o,name:'Fictional Outreach',permissions:['communications.view','communications.send','communications.delivery.view']}]};
 if(historyOnly){response.organizations=[];response.campaigns=[ids.c,ids.otherCampaign].map((id,i)=>({id,organization_id:ids.o,name:'Read-only campaign '+(i+1),permissions:['communications.delivery.view']}))}
 async function backend(route){
  const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').at(-1);
  if(url.pathname.startsWith('/rest/v1/rpc/')&&communicationsOnly&&['staff_workspace_context','outreach_registration_workspace'].includes(name)){
   const payload=request.postDataJSON();base.calls.push({name,action:payload.p_action||'context',...payload});
   if(name==='staff_workspace_context')return route.fulfill({json:{organizations:[],grants:[]}});
   if(payload.p_action==='campaigns')return route.fulfill({json:[]});
   return route.fulfill({status:403,json:{code:'42501'}});
  }
  if(url.pathname==='/rest/v1/rpc/communications_workspace'){
   const payload=request.postDataJSON();base.calls.push({name,action:payload.p_action,...payload});
   if(activityRead&&payload.p_action==='activity')return route.fulfill({json:[{id:'44444444-4444-4444-8444-444444444444',campaign_id:ids.c,recipient_name:'Fictional private recipient',channel:'email',message_type:'operational',status:'failed',failure_class:'unknown',attempts:1,created_at:'2026-11-06T00:00:00Z'}]});
   if(activityRead&&payload.p_action==='message'){
    const captured={subject:'Fictional subject',rendered_body:'Captured private body'};
    if(hold==='message'){hold=false;await new Promise(resolve=>release=resolve)}
    // Deliberately return the already-authorized captured data even after denial.
    return route.fulfill({json:captured});
   }
   // The history-only route can read existing history, never compose or mutate.
   if(historyOnly&&['external_history','history','activity'].includes(payload.p_action))return route.fulfill({json:[]});
   // All other probes permit only context discovery.
   if(payload.p_action!=='context')throw Error('UNEXPECTED_COMMUNICATIONS_OPERATION:'+payload.p_action);
   const captured=structuredClone(response);
   if(hold==='context'){hold=false;await new Promise(resolve=>release=resolve)}
   if(denied)return route.fulfill({status:403,json:{code:'42501',message:'Fictional revoked discovery'}});
   if(unsupported)return route.fulfill({status:404,json:{code:'PGRST202',message:'Fictional optional RPC unavailable'}});
   return route.fulfill({json:captured});
  }
  return base.backend(route);
 }
 return{...base,backend,denyCommunications:()=>denied=true,holdCommunications:(action='context')=>hold=action,communicationsHeld:()=>!!release,releaseCommunications:()=>{release?.();release=null}};
}
