// Fictional HTTP model for a novel, exact-source composition. It is not RLS proof.
export const ids={a:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',b:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',o:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',otherOrg:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',c:'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',otherCampaign:'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',p:'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',r:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'};
export const session=id=>{const exp=Math.floor(Date.now()/1000)+3600,user={id,email:(id===ids.a?'church':'campaign-only')+'@example.test',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01'};return{access_token:[{alg:'HS256',typ:'JWT'},{sub:id,exp,aud:'authenticated',role:'authenticated'},'fictional-signature'].map((x,i)=>i===2?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.'),refresh_token:'fictional-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user}};
export function createFixture(){
 const calls=[],writes=[],served=new Set(),unexpected=[];let currentActor=ids.a,revokedPeople=false,revokedCampaign=false,denyNext=null,hold=null,release=null;
 const tasks=Array.from({length:102},(_,i)=>({id:'11111111-1111-4111-8111-'+String(i+1).padStart(12,'0'),organization_id:ids.o,person_id:ids.p,title:'Care '+String(i+1).padStart(3,'0'),status:'open',due_on:'2026-11-10',revision:1,created_at:'2026-11-01T12:00:00.123456+00:00'}));
 tasks.push({id:'11111111-1111-4111-8111-999999999999',organization_id:ids.otherOrg,person_id:ids.p,title:'Other organization care',status:'open',due_on:null,revision:1,created_at:'2026-11-02T12:00:00Z'});
 const registration={id:ids.r,reference:'R-SYNTHETIC',first_name:'Jordan',last_name:'Household',phone:'+15555550123',email:'household@example.test',address:'100 Fixture Street',source:'public',status:'submitted',revision:1,notes:'',signatures:[],attendees:[{id:'22222222-2222-4222-8222-222222222222',client_key:'33333333-3333-4333-8333-333333333333',first_name:'Jordan',last_name:'Household',age:32,relationship:'self',guardian_relationship:'',active:true,attending:true,waiver_covered:true,prize_participation:false,checked_in_at:null,wristband:'',notes:'',revision:1}]};
 const config={name:'Fictional Outreach',slug:'fictional',timezone:'America/Chicago',waiver_required:true,address_required:true,prize_choices:[],extra_fields:[]};
 const campaigns=()=>revokedCampaign?[]:[{id:ids.c,name:'Fictional Outreach'},{id:ids.otherCampaign,name:'Second Outreach'}];
 const organizationNames=[{id:ids.o,name:'Fictional Church'},{id:ids.otherOrg,name:'Second Church'}];
 async function backend(route){
  const req=route.request(),u=new URL(req.url());let actor;try{actor=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub}catch{}
  const respond=(data,status=200)=>route.fulfill({json:data,status});
  if(u.pathname==='/auth/v1/user')return actor&&actor===currentActor?respond(session(actor).user):respond({message:'Fictional session expired'},401);
  if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
  if(![ids.a,ids.b].includes(actor))return respond({code:'42501',message:'Denied'},403);
  if(u.pathname.startsWith('/rest/v1/rpc/')){
   const name=u.pathname.split('/').at(-1),p=req.postDataJSON(),action=p.p_action||'context';calls.push({name,action,actor,...p});
   if(hold===name+':'+action){hold=null;const captured=action==='detail'?(name==='outreach_registration_workspace'?structuredClone(registration):name==='people_workspace'?{person:{id:ids.p,first_name:'Taylor',last_name:'Person'},relationships:[]}:null):null;await new Promise(r=>release=r);if(captured)return respond(captured)}
   if(denyNext===name+':'+action){denyNext=null;return respond({code:'42501',message:'PRIVATE_DENIAL'},403)}
   if(name==='staff_workspace_context')return respond({organizations:actor===ids.a&&!revokedPeople?organizationNames:[],grants:actor===ids.a&&!revokedPeople?organizationNames.flatMap(o=>['people.read','followup.read','followup.manage'].map(permission=>({organization_id:o.id,permission,department_ids:null}))):[]});
   if(name==='forms_workspace')return respond({capabilities:{profile:'private_draft_v1'},organizations:[]});
   if(name==='people_workspace'){
    if(actor!==ids.a||revokedPeople)return respond({code:'42501'},403);
    const person={id:ids.p,first_name:p.p_org===ids.otherOrg?'Other':'Taylor',last_name:'Person',email:'person@example.test',relationships:[]};return respond(action==='list'?[person]:{person,relationships:[]});
   }
   if(name==='outreach_registration_workspace'){
    if(action==='campaigns')return respond(campaigns());
    if(revokedCampaign||![ids.c,ids.otherCampaign].includes(p.p_campaign))return respond({code:'42501'},403);
    if(action==='context')return respond({name:p.p_campaign===ids.c?config.name:'Second Outreach',config,capabilities:['registration.view','registration.manage','registration.export','checkin.manage'],admin:false,can_manage_access:false});
    if(action==='list')return respond({registrations:[{id:ids.r,name:registration.first_name+' '+registration.last_name,reference:registration.reference,phone:registration.phone,status:registration.status,source:'public',attendees:1}],summary:{households:1,adults:1,minors:0,attendees:1,checked_in:registration.attendees[0].checked_in_at?1:0}});
    if(action==='detail')return respond(structuredClone(registration));
    if(action==='csv')return respond({csv:'Reference,Attendee\r\nR-SYNTHETIC,Jordan Fixture',filename:'fictional.csv'});
    if(action==='checkin'){writes.push({name,action,actor,...p});if(!['submitted','confirmed','checked_in'].includes(registration.status))return respond({code:'23514',message:'Household is not open'},400);registration.attendees[0].checked_in_at='2026-11-06T18:00:00Z';return respond({saved:true})}
   }
   unexpected.push({name,action});return respond({code:'42501'},403);
  }
  if(u.pathname==='/rest/v1/followup_tasks'){
   const filters=Object.fromEntries(u.searchParams),base=tasks.filter(t=>['organization_id','person_id'].every(k=>filters[k]==='eq.'+t[k]));calls.push({name:'followup_tasks',action:req.method(),actor,filters});
   if(actor!==ids.a||revokedPeople)return respond({code:'42501'},403);
   if(req.method()==='GET'){
    let result=base.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));const cursor=filters.or;if(cursor){const match=/created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([a-f0-9-]+)\)/.exec(cursor);if(!match)throw Error('Invalid composite cursor');result=result.filter(t=>t.created_at<match[1]||t.created_at===match[1]&&t.id<match[3])}return respond(result.slice(0,Number(filters.limit)));
   }
   if(req.method()==='PATCH'){const payload=req.postDataJSON(),row=base.find(t=>filters.id==='eq.'+t.id&&filters.revision==='eq.'+t.revision);writes.push({name:'followup_tasks',action:'PATCH',actor,filters,payload});if(row){Object.assign(row,payload);row.revision++}return respond(row?[{id:row.id}]:[])}
  }
  unexpected.push(req.method()+' '+u.pathname);return route.abort();
 }
 return{backend,calls,writes,served,unexpected,tasks,registration,setActor:id=>currentActor=id,revokePeople:()=>revokedPeople=true,revokeCampaign:()=>revokedCampaign=true,deny:action=>denyNext=action,hold:action=>hold=action,release:()=>{release?.();release=null},held:()=>!!release};
}
