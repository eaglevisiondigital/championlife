// Fictional transport composition. Existing models remain separate; no database authority claim.
import assert from 'node:assert/strict';
import {createFixture,ids as peopleIds,session} from '../staff-cycle7/people-registration-fixture.mjs';
import {fixture as moduleFixture,ids} from '../staff-cycle8/modules-fixture.mjs';
export {peopleIds,ids,session};
export function fixture(){
 const people=createFixture(),modules=moduleFixture(),calls=[],writes=[];
 const permissions=['forms.read','forms.edit'];
 const form={id:ids.form,name:'Private editable draft',type:'general',description:'Fictional draft',status:'draft',permissions,payment_enabled:false};
 let version={id:'11111111-2222-4333-8444-555555555555',version:1,revision:1,definition:{sections:[{key:'main',title:'Your information',description:'',columns:1,fields:[]}],conditions:[],settings:{branding:'champion-life',public_available:false,timezone:'America/Chicago',success_message:'Thank you.'},payment:{}}};
 const proxy=(route,change)=>new Proxy(route,{get(target,key){if(key==='fulfill')return opts=>target.fulfill({...opts,json:change(opts.json),headers:{...opts.headers,'access-control-allow-origin':'*'}});const value=target[key];return typeof value==='function'?value.bind(target):value}});
 async function backend(route){
  const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').at(-1),p=request.method()==='POST'?request.postDataJSON()||{}:{};
  if(name==='forms_workspace'){
   const actor=JSON.parse(Buffer.from(request.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub;assert.equal(actor,ids.a,'Forms current fictional actor');
   const action=p.p_action;calls.push({name,action,...p});
   const send=json=>route.fulfill({json,headers:{'access-control-allow-origin':'*'}});
   if(action==='context')return send({capabilities:{profile:'private_draft_v1'},organizations:[{id:ids.o,name:'Fictional Church',permissions,scoped_forms:[]}]});
   assert.equal(p.p_org,ids.o,'Forms organization authority');
   if(action==='list')return send({forms:[structuredClone(form)]});
   assert.equal(p.p_payload.id,ids.form,'Forms subject binding');
   if(action==='draft'||action==='get')return send({form:structuredClone(form),version:structuredClone(version),permissions});
   if(action==='save'){
    assert.equal(p.p_payload.revision,version.revision,'optimistic draft revision');
    assert.equal(p.p_payload.definition.settings.public_available,false,'private draft stays private');
    assert.deepEqual(p.p_payload.definition.payment,{},'no payment configuration');
    writes.push({name,action,...p});version={...version,revision:version.revision+1,definition:structuredClone(p.p_payload.definition)};form.name=p.p_payload.name;form.description=p.p_payload.description;
    return send({form:structuredClone(form),version:structuredClone(version)});
   }
   throw Error('Unapproved Forms action '+action);
  }
  if(name==='staff_workspace_context')return people.backend(proxy(route,data=>({...data,grants:[...data.grants,...data.organizations.flatMap(o=>['events.view','dream_team.application.read','dream_team.application.restricted'].map(permission=>({organization_id:o.id,permission,department_ids:null})))]})));
  if(name==='communications_workspace')return route.fulfill({status:404,json:{code:'PGRST202',message:'Optional module is unavailable in this fixture'}});
  if(name==='events_workspace')return modules.backend(proxy(route,data=>p.p_action==='detail'?{...data,occurrences:[{starts_at:'2026-11-10T12:00:00Z',ends_at:'2026-11-10T13:00:00Z',scheduled:true}]}:data));
  if(name==='dream_team_manual_followup')return modules.backend(route);
  return people.backend(route);
 }
 return {backend,people,modules,calls,writes,get version(){return version},get form(){return form}};
}
