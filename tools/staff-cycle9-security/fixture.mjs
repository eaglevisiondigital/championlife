// Reuse accepted fictional response models, never their runtime-source overlays.
// This HTTP fixture proves client behavior only, not genuine Auth/RLS enforcement.
import {fixture as moduleFixture} from '../staff-cycle8/modules-fixture.mjs';
import {createFixture,ids,session} from '../staff-cycle7/people-registration-fixture.mjs';
export {ids,session};
export function securityFixture(){
 const people=createFixture(),modules=moduleFixture(),calls=[],writes=[],unexpected=[];
 let actor=ids.a,expired=false,revoked=false,deniedModule=null;
 const organizations=[{id:ids.o,name:'Fictional Church'},{id:ids.otherOrg,name:'Second Church'}];
 const permissions=['people.read','followup.read','events.view','dream_team.application.read','dream_team.application.restricted'];
 async function backend(route){
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').at(-1),payload=req.postDataJSON?.()||{},action=payload.p_action||'context';
  const respond=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
  let sub;try{sub=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub}catch{}
  if(url.pathname==='/auth/v1/user')return !expired&&sub===actor?respond(session(actor).user):respond({message:'Fictional expired session'},401);
  if(url.pathname.startsWith('/rest/v1/')){
   calls.push({name,action,sub,payload,method:req.method()});
   if(expired||sub!==actor)return respond({code:'42501',message:'Fictional current identity required'},403);
   if(!['context','campaigns','list','detail','activity','history','external_history','message'].includes(action)||!['GET','POST'].includes(req.method())){
    writes.push({name,action,payload});return respond({code:'42501',message:'Mutations deliberately absent'},403);
   }
  }
  if(name==='staff_workspace_context')return respond({organizations:actor===ids.a&&!revoked?organizations:[],grants:actor===ids.a&&!revoked?organizations.flatMap(o=>permissions.map(permission=>({organization_id:o.id,permission,department_ids:null}))):[]});
  if(name==='communications_workspace'){
   if(action==='context')return respond({external_delivery_enabled:false,organizations:[],campaigns:[{id:ids.c,organization_id:ids.o,name:'Fictional Outreach',permissions:['communications.delivery.view']}]});
   if(payload.p_campaign!==ids.c||payload.p_payload?.organization_id!==ids.o)return respond({code:'42501'},403);
   if(['activity','history','external_history'].includes(action))return respond([]);
   unexpected.push({name,action});return respond({code:'42501'},403);
  }
  if(name===deniedModule)return respond({code:'42501',message:'Fictional permission revoked'},403);
  const wrapped={request:()=>req,abort:(...a)=>route.abort(...a),fulfill:options=>route.fulfill({...options,headers:{...options.headers,'access-control-allow-origin':'*'}})};
  if(['forms_workspace','events_workspace','dream_team_manual_followup'].includes(name))return modules.backend(wrapped);
  return people.backend(wrapped);
 }
 return{backend,calls,writes,unexpected,people,modules,setActor:id=>{actor=id;people.setActor(id);modules.setActor(id)},expire:()=>expired=true,revoke:()=>{revoked=true;people.revokePeople()},denyModule:name=>deniedModule=name};
}
