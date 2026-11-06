// Fictional HTTP only; no native authorization claim or mutation implementation.
export {session} from '../staff-cycle7/people-registration-fixture.mjs';
export const ids={a:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',b:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',o:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',other:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',person:'dddddddd-dddd-4ddd-8ddd-dddddddddd01',application:'dddddddd-dddd-4ddd-8ddd-dddddddddd02',account:'dddddddd-dddd-4ddd-8ddd-dddddddddd03',task:'dddddddd-dddd-4ddd-8ddd-dddddddddd04',form:'dddddddd-dddd-4ddd-8ddd-dddddddddd05',event:'dddddddd-dddd-4ddd-8ddd-dddddddddd06'};
export function fixture(){
 const calls=[],unexpected=[],writes=[];let actor=ids.a,hold=null,release=null,denial=null;
 const organizations=[{id:ids.o,name:'Fictional Church A',slug:'fictional-a'},{id:ids.other,name:'Fictional Church B',slug:'fictional-b'}];
 const suffix=org=>org===ids.other?'B':'A';
 const binding={application_id:ids.application,revision:3,person_id:ids.person,account_id:ids.account,link_revision:4};
 const grants=()=>organizations.flatMap(o=>['people.read','followup.read','events.view','dream_team.application.read','dream_team.application.restricted'].map(permission=>({organization_id:o.id,permission,department_ids:null})));
 async function backend(route){
  const req=route.request(),url=new URL(req.url()),send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});let sub;
  try{sub=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub}catch{}
  if(url.pathname==='/auth/v1/user')return sub===actor?send({id:actor,email:'synthetic@example.test',email_confirmed_at:'2026-01-01',aud:'authenticated',role:'authenticated'}):send({message:'Expired fictional account'},401);
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:'',headers:{'access-control-allow-origin':'*'}});
  if(!url.pathname.startsWith('/rest/v1/rpc/')){unexpected.push(req.method()+' '+url.pathname);return route.abort()}
  const name=url.pathname.split('/').at(-1),p=req.postDataJSON()||{},action=p.p_action||'context',key=name+':'+action;calls.push({name,action,sub,...p});
  if(name==='communications_workspace'&&action==='context')return send({code:'PGRST202',message:'Optional Communications RPC absent from this module fixture'},404);
  if(!['context','campaigns','list','detail'].includes(action)){writes.push({name,action,...p});return send({code:'42501',message:'Mutations absent from read-only fixture'},403)}
  if(denial===key){denial=null;return send({code:'42501',message:'Fictional permission revoked'},403)}
  const allowed=sub===ids.a&&sub===actor;let result;
  if(name==='staff_workspace_context')result={organizations:allowed?organizations:[],grants:allowed?grants():[]};
  else if(name==='outreach_registration_workspace'&&action==='campaigns')result=[];
  else if(name==='forms_workspace'&&action==='context')result={capabilities:{profile:'private_draft_v1'},organizations:allowed?organizations.map(o=>({...o,permissions:['forms.read'],scoped_forms:[]})):[]};
  else {
   if(!allowed||![ids.o,ids.other].includes(p.p_org))return send({code:'42501',message:'Fictional scope denied'},403);
   const s=suffix(p.p_org);
   if(name==='forms_workspace'&&action==='list')result={forms:[{id:ids.form,name:'Private draft '+s,type:'general',status:'draft',permissions:['forms.read'],payment_enabled:false,submission_count:null}]};
   else if(name==='dream_team_manual_followup'&&action==='list')result={applications:[{...binding,first_name:'Applicant',last_name:s,status:'submitted',identity_verified:true},{...binding,application_id:'dddddddd-dddd-4ddd-8ddd-dddddddddd07',first_name:'Pending',last_name:'relationship',status:'submitted',identity_verified:false}]};
   else if(name==='dream_team_manual_followup'&&action==='detail')result={...binding,status:'submitted',form:{fields:[{id:'interest',label:'Restricted answer'}]},answers:{interest:'Private answer '+s},task:{id:ids.task,title:'Existing manual task '+s,status:'open',revision:7,due_on:null},history:[{occurred_at:'2026-11-01T00:00:00Z',action:'existing_task_reviewed',after_state:{status:'open'}}]};
   else if(name==='events_workspace'&&action==='context')result={timezone:'UTC',manage_configuration:false,departments:[],locations:[],labels:[],approval_required:true};
   else if(name==='events_workspace'&&action==='list')result=[{id:ids.event,title:'Private event '+s,status:'draft',visibility:'staff',local_start:'2026-11-10T12:00:00'}];
   else if(name==='events_workspace'&&action==='detail')result={series:{id:ids.event,title:'Private event '+s,status:'draft',timezone:'UTC'},can_manage:false,conflicts:0,occurrences:[],audit:[{created_at:'2026-11-01T00:00:00Z',action:'existing_review'}]};
   else if(name==='people_workspace'&&action==='list')result=[{id:ids.person,first_name:'Canonical',last_name:'Person',relationships:[]}];
   else{unexpected.push(key);return send({code:'42501'},403)}
  }
  if(hold===key){hold=null;const captured=structuredClone(result);await new Promise(r=>release=r);return send(captured)}
  return send(result);
 }
 return{backend,calls,unexpected,writes,binding,setActor:value=>actor=value,hold:key=>hold=key,held:()=>!!release,release:()=>{release?.();release=null},deny:key=>denial=key};
}
