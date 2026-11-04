/* Restricted manual next-step review. No applicant ingestion or course/serving decisions. */
(() => {
 'use strict';
 const root=document.getElementById('dream-team-manual'), auth=window.ChampionLifeAuth, client=auth?.client;
 if(!root||!client?.auth?.getUser)return;
 const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n};
 const required=['dream_team.application.read','dream_team.application.restricted','people.read','followup.read'];
 let epoch=0,principal=null,org=null,selected=null,grants=[],body=null,status=null;
 const denial=e=>['42501','401','403'].includes(String(e?.code||e?.status));
 function retire(message='Your access is no longer available. Sign in and reload to continue.'){
  epoch++;selected=null;org=null;principal=null;grants=[];body=null;status=null;root.replaceChildren(el('p',message,{role:'alert'}),el('a','Sign in',{href:'discipleship-login.html?next=%2Fstaff-dream-team-manual.html'}));
  const email=document.getElementById('staff-session-email');if(email)email.textContent='';
 }
 const current=t=>t.epoch===epoch&&t.principal===principal&&t.org===org&&window.ChampionLifeAuth===auth&&auth.client===client;
 const ticket=()=>({epoch,principal,org});
 async function verify(t){
  if(!current(t)){if(t.epoch===epoch)retire();throw Error('Retired request')}
  let response;try{response=await client.auth.getUser()}catch(e){if(t.epoch===epoch)retire('Identity could not be verified. Reload before continuing.');throw e}
  if(!current(t))throw Error('Retired request');
  if(response.error||response.data?.user?.id!==principal){retire();throw Error('Identity changed')}
 }
 async function rpc(action,data,t){
  await verify(t);let response;
  try{response=await client.rpc('dream_team_manual_followup',{p_org:t.org,p_action:action,p_data:data})}
  catch(e){await verify(t);throw e}
  // An explicit denial still retires newer views of the same principal/organization.
  if(response.error&&denial(response.error)&&t.principal===principal&&t.org===org&&window.ChampionLifeAuth===auth&&auth.client===client){retire();throw response.error}
  await verify(t);
  if(response.error){if(denial(response.error))retire();throw response.error}
  return response.data;
 }
 function failure(t,e,mutation=false){
  if(!current(t))return;
  if(denial(e)){retire();return}
  // Never retain an old review after a rejected or uncertain operation, and never retry a mutation.
  epoch++;selected=null;body?.replaceChildren();if(status)status.textContent=mutation?'Save was not confirmed. Reload the application and inspect its task history before retrying.':'Review unavailable or changed. Reload the list before continuing.';
 }
 const binding=a=>({application_id:a.application_id,revision:a.revision,person_id:a.person_id,account_id:a.account_id,link_revision:a.link_revision});
 function button(label,action){const t=ticket(),b=el('button',label,{type:'button',class:'staff-action'});let busy=false;b.onclick=async()=>{if(busy||!b.isConnected||!current(t))return;busy=true;b.disabled=true;try{await action(t)}catch(e){failure(t,e)}finally{if(b.isConnected&&current(t))b.disabled=false;busy=false}};return b}
 async function list(){
  epoch++;selected=null;body.replaceChildren();status.textContent='Loading applications…';const t=ticket();
  try{const data=await rpc('list',{},t);if(!current(t))return;status.textContent=data.applications.length?'':'No existing applications are available. Public interest forms are not imported here.';
   for(const a of data.applications){const card=el('article',null,{class:'staff-person-card'});card.append(el('h2',[a.first_name,a.last_name].filter(Boolean).join(' ')||'Application'),el('p',a.status||'Pending verification'));
    if(a.identity_verified===true)card.append(button('Review application',()=>detail(a)));
    else card.append(el('p','Verified Person/account relationship pending. Review and task creation are unavailable.'));
    body.append(card);
   }
  }catch(e){failure(t,e)}
 }
 async function detail(a){
  epoch++;selected=binding(a);body.replaceChildren();status.textContent='Loading restricted review…';const t=ticket();
  try{const d=await rpc('detail',selected,t);if(!current(t))return;
   if(JSON.stringify(binding(d))!==JSON.stringify(selected)){retire('Application identity changed. Reload to review.');return}
   status.textContent='Manual review only. Course completion and serving eligibility have not been verified.';
   body.append(button('Back to applications',()=>list()),el('h2','Restricted application review'),el('p','Application status: '+d.status));
   const answers=el('details'),summary=el('summary','Application answers (restricted)');answers.append(summary);
   // Exact approved field labels; values are text, never HTML or copied into a generic task.
   for(const field of d.form?.fields||[]){if(!(field.id in (d.answers||{})))continue;answers.append(el('h3',field.label||field.id),el('p',JSON.stringify(d.answers[field.id],null,2)))}
   body.append(answers);
   if(d.task)body.append(el('h3',d.task.title),el('p','Task status: '+d.task.status));
   const history=el('details');history.append(el('summary','Task history'));for(const h of d.history||[])history.append(el('p',[h.occurred_at,h.action,h.after_state?.status].filter(Boolean).join(' · ')));body.append(history);
   if(!grants.some(g=>g.organization_id===org&&g.permission==='followup.manage'&&!g.department_ids))return;
   const form=el('form'),due=el('input',null,{type:'date','aria-label':'Next-step due date'});due.value=d.task?.due_on||'';
   const assignment=el('select',null,{'aria-label':'Task assignment'});for(const[v,label]of [['self','Assign to me'],['unassigned','Leave unassigned']])assignment.append(el('option',label,{value:v}));if(d.task){assignment.prepend(el('option',d.task.assigned_user_id===principal?'Keep current assignment (me)':d.task.assigned_user_id?'Keep current assigned worker':'Keep unassigned',{value:'keep'}));assignment.value='keep'}else assignment.value='unassigned';
   const state=el('select',null,{'aria-label':'Task status'});for(const s of ['open','completed','canceled'])state.append(el('option',s,{value:s}));state.value=d.task?.status||'open';
   for(const [label,input]of [['Next-step due date',due],['Assignment',assignment],...(d.task?[['Status',state]]:[])]){const l=el('label',label);l.append(input);form.append(l)}
   const save=el('button',d.task?'Save next-step task':'Create manual next-step task',{type:'submit',class:'staff-action'});form.append(save);body.append(form);let saving=false;
   form.onsubmit=async e=>{e.preventDefault();if(saving||!form.isConnected||!current(t)||JSON.stringify(selected)!==JSON.stringify(binding(d)))return;saving=true;save.disabled=true;
    const payload={...binding(d),request_id:crypto.randomUUID(),assignment:assignment.value,due_on:due.value||null};if(d.task)Object.assign(payload,{task_id:d.task.id,task_revision:d.task.revision,status:state.value});
    try{const result=await rpc(d.task?'update_task':'create_task',payload,t);if(!current(t)||!form.isConnected)return;await detail({...d,revision:result.application_revision})}
    catch(err){failure(t,err,true)}finally{saving=false}
   };
  }catch(e){failure(t,e)}
 }
 async function boot(){
  const start=++epoch;root.replaceChildren(el('p','Verifying staff identity…',{role:'status'}));
  try{const response=await client.auth.getUser();if(start!==epoch)return;if(response.error||!response.data?.user?.id){retire();return}principal=response.data.user.id;
   const t=ticket();await verify(t);const ctx=await client.rpc('staff_workspace_context',{});await verify(t);if(ctx.error)throw ctx.error;
   grants=ctx.data.grants||[];const choices=(ctx.data.organizations||[]).filter(o=>required.every(k=>grants.some(g=>g.organization_id===o.id&&g.permission===k&&!g.department_ids)));
   if(!choices.length){retire();return}
   const hints=new URLSearchParams(location.search).getAll('org');if(hints.length>1||(hints.length===1&&!choices.some(o=>o.id===hints[0]))){retire('Requested organization is unavailable.');return}
   org=hints[0]||choices[0].id;const select=el('select',null,{'aria-label':'Organization'});for(const o of choices)select.append(el('option',o.name,{value:o.id}));select.value=org;
   select.onchange=()=>{if(!select.isConnected)return;org=select.value;list()};
   status=el('p','',{role:'status',class:'staff-status'});body=el('div',null,{class:'staff-content'});root.replaceChildren(select,status,body);
   root.append(el('a','Reload workspace',{href:location.pathname+location.search}));await list();
  }catch{if(start===epoch)retire('Workspace unavailable. Reload to verify access.')}
 }
 client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(principal&&session?.user?.id!==principal))retire()});
 window.addEventListener('pagehide',()=>retire());window.addEventListener('popstate',()=>retire());window.addEventListener('pageshow',e=>{if(e.persisted)retire()});
 document.getElementById('staff-logout')?.addEventListener('click',()=>retire());
 boot();
})();
