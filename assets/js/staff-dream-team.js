(() => {
 'use strict';
 const root=document.getElementById('staff-dream-team'),T=window.DreamTrack,D=window.DreamTeam,auth=window.ChampionLifeAuth;
 if(!root||!D||!T||!auth)return;
 const {el}=T,client=auth.client;
 let user,org,context,generation=0,status,content,departments=[],offset=0,filter='',placement='',search='',selected=null,view='list',writing=false;
 const can=key=>!!context?.grants?.some(g=>g.organization_id===org&&g.permission===key&&!g.department_ids&&!g.revoked_at&&(!g.effective_at||Date.parse(g.effective_at)<=Date.now())&&(!g.expires_at||Date.parse(g.expires_at)>Date.now()));
 const binding=()=>({generation,account:user?.id,org,selected,view,route:location.href});
 const current=b=>b.generation===generation&&b.account===user?.id&&b.org===org&&b.selected===selected&&b.view===view&&b.route===location.href&&window.ChampionLifeAuth===auth&&auth.client===client&&root.isConnected;
 const personURL=id=>'staff-people.html?org='+encodeURIComponent(org)+'&person='+encodeURIComponent(id);
 function retire(message='Your access is no longer available. Reload to check your current access.'){
  generation++;context=null;selected=null;org=null;search='';filter='';placement='';offset=0;departments=[];writing=false;content=null;root.replaceChildren();
  status=el('p',message,{role:'alert'});root.append(status);
  const reload=el('button','Reload workspace',{type:'button',class:'btn gold'});reload.onclick=()=>{if(reload.isConnected)boot()};root.append(reload);
 }
 async function verify(b){
  if(!current(b))throw Error('retired');
  let session;try{session=await auth.getSession()}catch{if(current(b))retire('Your session could not be verified. Sign in again.');throw Error('retired')}
  if(!current(b))throw Error('retired');
  if(!session||session.user.id!==b.account){retire('Your account changed. Reload to continue.');throw Error('retired')}
 }
 async function request(run,b=binding()){
  await verify(b);let r;try{r=await run()}catch{if(current(b))retire('The request could not be confirmed. Reload before trying again.');throw Error('unconfirmed')}
  if(!current(b))throw Error('retired');
  if(r?.error||r?.status===401||r?.status===403){
   const denied=r.status===401||r.status===403||r.error?.code==='42501';
   retire(denied?'Your access is no longer available. Reload to check your current access.':'The request could not be confirmed. Reload before trying again.');throw Error('rejected');
  }
  await verify(b);return r.data;
 }
 const rpc=(action,data={},b=binding())=>request(()=>client.rpc('dream_team_admin',{p_org:b.org,p_action:action,p_data:data}),b);
 async function permissions(b=binding()){
  const next=await request(()=>client.rpc('staff_workspace_context',{}),b);
  if(!current(b))throw Error('retired');context=next;
  const required=view==='detail'?['dream_team.application.read','dream_team.application.restricted']:view==='place'?['dream_team.application.read','dream_team.placement.manage']:view==='enable'?['dream_team.application.read','dream_team.application.manage','people.read']:[];
  if(!context.organizations.some(o=>o.id===b.org)||!['dream_team.application.read','courses.manage','dream_team.placement.manage'].some(can)||!required.every(can)){retire();throw Error('denied')}
 }
 function button(text,fn){
  const b=binding(),node=el('button',text,{type:'button',class:'btn gold'});
  node.addEventListener('click',async()=>{if(window.ChampionLifeAuth!==auth||auth.client!==client){retire('Your account client changed. Reload to continue.');return}if(!current(b)||!node.isConnected||node.disabled||writing)return;node.disabled=true;try{await verify(b);if(current(b)&&node.isConnected)await fn(b)}catch{}finally{if(current(b)&&node.isConnected)node.disabled=false}});return node;
 }
 function input(label,type='text'){const box=el('label',label),i=el(type==='textarea'?'textarea':'input',null,type==='textarea'?{}:{type});box.append(i);return{box,i}}
 function begin(nextView,id=null){generation++;selected=id;view=nextView;content.replaceChildren();status.textContent='Loading…';return binding()}
 async function mutate(b,keys,run,done){
  if(writing||!current(b))return;writing=true;
  try{await permissions(b);if(!keys.every(can)){retire();return}await verify(b);await run();if(current(b))await done()}
  catch{if(current(b))retire('The change could not be confirmed. Reload to inspect the saved state before retrying.')}
  finally{writing=false}
 }
 async function load(){
  const b=begin('list');await permissions(b);
  const alerts=await request(()=>client.rpc('dream_team_alerts',{p_org:b.org}),b);if(!current(b))return;
  content.append(el('h2','Action center'));
  for(const a of alerts){const card=el('article');card.append(el('strong',D.title(a.event_type.replaceAll('.',' '))),el('p',new Date(a.occurred_at).toLocaleString()));if(a.person_id&&can('people.read'))card.append(el('a','Open Person / Create task',{href:personURL(a.person_id)}));if(a.event_type.startsWith('dream_team.')&&can('dream_team.application.read')&&can('dream_team.application.restricted'))card.append(button('Review application',()=>detail(a.source_id)));content.append(card)}
  if(!can('dream_team.application.read')){status.textContent='Only alerts permitted by your assigned capabilities are shown.';return}
  const data=await rpc('list',{status:filter,placement,search,offset},b);await permissions(b);if(!current(b))return;if(!can('dream_team.application.read')){retire();return}
  departments=data.departments;status.textContent='';const find=input('Search Person','search'),select=el('select',null,{'aria-label':'Application status'}),ps=el('select',null,{'aria-label':'Placement status'});find.i.value=search;
  for(const s of ['','available','invited','started','submitted','under_review','more_info_requested','approved_for_placement','declined','withdrawn'])select.append(el('option',s?D.title(s):'All applications',{value:s}));select.value=filter;
  for(const s of ['','unassigned','assigned'])ps.append(el('option',s?D.title(s):'All placements',{value:s}));ps.value=placement;
  content.append(el('h2','Applications'),find.box,select,ps,button('Filter',()=>{search=find.i.value.slice(0,100);filter=select.value;placement=ps.value;offset=0;return load()}));
  if(can('dream_team.application.manage')&&can('people.read'))content.append(button('Enable application for Person',enable));
  for(const a of data.applications){const card=el('article');card.append(el('h3',a.name||'Person link awaiting review'),el('p',D.title(a.status)+' · '+D.title(a.placement_status)),el('p','Email: '+(a.email_status||'Not queued')));
   if(a.person_id&&can('people.read'))card.append(el('a','Open Person',{href:personURL(a.person_id)}));
   if(can('dream_team.application.restricted'))card.append(button('Restricted review',()=>detail(a.id)));
   if(can('dream_team.application.manage')&&can('communications.send')&&['available','invited','started','more_info_requested'].includes(a.status))card.append(button('Send / resend application',b=>mutate(b,['dream_team.application.read','dream_team.application.manage','communications.send'],()=>rpc('send',{id:a.id,reason:'Staff invitation'},b),load)));
   if(can('dream_team.placement.manage')&&a.status==='approved_for_placement')card.append(button('Assign to team',()=>place(a)));content.append(card)
  }
  content.append(button('Previous',()=>{offset=Math.max(0,offset-50);return load()}),button('Next',()=>{offset+=50;return load()}));
 }
 async function enable(){
  const b=begin('enable');await permissions(b);if(!can('dream_team.application.manage')||!can('people.read')){retire();return}status.textContent='';
  content.append(button('Back',load),el('h2','Enable application'));const find=input('Find Person','search'),list=el('div');let lookup=0;
  content.append(find.box,button('Search',async b=>{const requestId=++lookup;list.replaceChildren();await permissions(b);if(!can('people.read')){retire();return}
   const data=await request(()=>client.rpc('people_workspace',{p_org:b.org,p_action:'list',p_payload:{search:find.i.value.slice(0,100),page:0}}),b);if(!current(b)||requestId!==lookup)return;
   for(const p of data.slice(0,25))list.append(button([p.first_name,p.last_name].join(' '),b=>mutate(b,['dream_team.application.read','dream_team.application.manage','people.read'],()=>rpc('enable',{person_id:p.id,reason:'Manual staff enablement'},b),load)));
  }),list,el('p','A reviewed active Person/account link is required. This does not complete Dream Track or grant authority.'));
 }
 async function nextSteps(a,b){
  const panel=el('section',null,{'aria-label':'Applicant next steps'});content.append(panel);panel.append(el('h3','Applicant next steps'),el('p','Administrative follow-up only. Completing a task does not verify age, training, Dream Track completion, contact permission or serving readiness.'));
  if(!a.identity_ready||!a.person_id){panel.append(el('p','A reviewed active Person/account link is required before recording a next step.'));return}
  if(!can('people.read')||!can('followup.read')){panel.append(el('p','Separate People and follow-up permissions are required.'));return}
  await request(()=>client.rpc('people_workspace',{p_org:b.org,p_action:'detail',p_payload:{person_id:a.person_id}}),b);
  const tasks=await request(()=>client.from('followup_tasks').select('id,title,status,due_on,assigned_user_id,revision').eq('organization_id',b.org).eq('person_id',a.person_id).order('created_at',{ascending:false}).limit(25),b);
  await permissions(b);if(!current(b)||!panel.isConnected)return;
  if(!can('dream_team.application.read')||!can('dream_team.application.restricted')||!can('people.read')||!can('followup.read')){retire();return}
  const keys=['dream_team.application.read','dream_team.application.restricted','people.read','followup.read','followup.manage'];
  async function taskWrite(binding,run){
   await mutate(binding,keys,async()=>{
    const fresh=await rpc('detail',{id:a.id},binding);
    if(!fresh.identity_ready||fresh.person_id!==a.person_id){retire('The reviewed Person association changed. Reload before recording a next step.');throw Error('identity changed')}
    await request(()=>client.rpc('people_workspace',{p_org:binding.org,p_action:'detail',p_payload:{person_id:a.person_id}}),binding);
    const saved=await request(run,binding);if(!saved){retire('The task changed or access was removed. Reload before trying again.');throw Error('conflict')}
   },()=>detail(a.id));
  }
  if(can('followup.manage')){
   const action=el('select',null,{'aria-label':'Administrative next step'});for(const title of ['Dream Team — review next steps','Dream Team — review training requirements'])action.append(el('option',title,{value:title}));
   const due=input('Next-step due date','date'),assign=el('select',null,{'aria-label':'Next-step owner'});assign.append(el('option','Unassigned',{value:''}),el('option','Assign to me',{value:user.id}));
   panel.append(action,due.box,assign,button('Create next-step task',async b=>{
    // Existing open tasks are shown before creation; exact repeats are refused, never auto-merged.
    if(!['Dream Team — review next steps','Dream Team — review training requirements'].includes(action.value))return;
    if(tasks.some(t=>t.title===action.value&&t.status==='open')){status.textContent='An open task with this next step already exists. Review it before adding another.';return}
    if(due.i.value&&!/^\d{4}-\d{2}-\d{2}$/.test(due.i.value))return;
    await taskWrite(b,()=>client.from('followup_tasks').insert({organization_id:b.org,person_id:a.person_id,title:action.value,due_on:due.i.value||null,assigned_user_id:assign.value===b.account?b.account:null}).select('id,revision').single());
   }));
  }
  if(!tasks.length)panel.append(el('p','No follow-up tasks are recorded for this Person.'));
  for(const task of tasks){
   const card=el('article');card.append(el('h4',task.title),el('p',task.status+' · '+(task.due_on||'No due date')+' · '+(task.assigned_user_id===user.id?'Assigned to me':task.assigned_user_id?'Assigned to authorized staff':'Unassigned')));
   if(can('followup.manage')){
    const select=el('select',null,{'aria-label':'Task status'});for(const value of ['open','completed','canceled'])select.append(el('option',value,{value}));select.value=task.status;
    const due=input('Task due date','date');due.i.value=task.due_on||'';
    card.append(select,due.box,button('Save next-step task',b=>taskWrite(b,()=>client.from('followup_tasks').update({status:select.value,due_on:due.i.value||null}).eq('organization_id',b.org).eq('person_id',a.person_id).eq('id',task.id).eq('revision',task.revision).select('id,revision').maybeSingle())));
   }
   const history=el('div');card.append(button('Review task history',async b=>{history.replaceChildren();await permissions(b);if(!can('people.read')||!can('followup.read')||!can('dream_team.application.read')||!can('dream_team.application.restricted')){retire();return}
    const entries=await request(()=>client.from('followup_task_events').select('action,occurred_at,actor_user_id,before_state,after_state').eq('organization_id',b.org).eq('task_id',task.id).order('occurred_at',{ascending:false}).limit(30),b);
    await permissions(b);if(!current(b)||!history.isConnected)return;if(!can('people.read')||!can('followup.read')||!can('dream_team.application.read')||!can('dream_team.application.restricted')){retire();return}
    for(const e of entries)history.append(el('p',new Date(e.occurred_at).toLocaleString()+' · '+e.action+' · '+(e.actor_user_id===b.account?'You':'Authorized staff')+' · '+(e.after_state?.status||'')+' · revision '+e.after_state?.revision));
   }),history);panel.append(card);
  }
 }
 async function detail(id){
  const b=begin('detail',id);await permissions(b);if(!can('dream_team.application.read')||!can('dream_team.application.restricted')){retire();return}
  const a=await rpc('detail',{id},b);await permissions(b);if(!current(b))return;status.textContent='';
  content.append(button('Back to applications',load),el('h2',D.title(a.status)),el('p',a.dream_track?.badge_awarded_at?'Dream Track completed':a.dream_track?.online_completed_at?'Online coursework complete · Final meeting required':'Online coursework not yet complete'));
  if(a.person_id&&can('people.read'))content.append(el('a','Open Person',{href:personURL(a.person_id)}));
  for(const [label,key] of [['Available','available_at'],['Invited','invited_at'],['Started','started_at'],['Submitted','submitted_at'],['Decision','decision_at']])if(a[key])content.append(el('p',label+': '+new Date(a[key]).toLocaleString()));
  if(can('dream_team.application.manage')&&can('communications.send')&&['available','invited','started','more_info_requested'].includes(a.status))content.append(button('Send / resend application',b=>mutate(b,['dream_team.application.read','dream_team.application.manage','communications.send'],()=>rpc('send',{id:a.id,reason:'Staff invitation from application detail'},b),()=>detail(id))));
  for(const s of a.submissions){const section=el('section');if(s.snapshot.form)D.answers(section,s.snapshot);else section.append(el('h3','Additional information'),el('p',s.snapshot.request),el('p',s.snapshot.response));content.append(section)}
  for(const d of a.documents||[])content.append(button('Download protected PDF',async b=>{await permissions(b);if(!can('dream_team.application.read')||!can('dream_team.application.restricted')){retire();return}try{await D.documentDownload(d.id,b.account,()=>current(b)&&can('dream_team.application.read')&&can('dream_team.application.restricted'))}catch(error){if(current(b)){if([401,403].includes(error.status))retire();else status.textContent='Protected document unavailable. Reload before retrying.'}}}));
  if(can('dream_team.application.manage')&&['submitted','under_review'].includes(a.status)){
   const note=input('Private reviewer note','textarea'),request=input('Applicant-facing information request','textarea');note.i.value=a.private_note||'';content.append(note.box,request.box);
   for(const [label,target] of [['Begin review','under_review'],['Request more information','more_info_requested'],['Approve for placement','approved_for_placement'],['Decline','declined']])content.append(button(label,async b=>{if(!confirm(label+'?'))return;await mutate(b,['dream_team.application.read','dream_team.application.restricted','dream_team.application.manage'],()=>rpc('review',{id,revision:a.revision,status:target,note:note.i.value,request:request.i.value},b),()=>detail(id))}));
  }
  content.append(el('h3','Review history'));for(const h of a.history)content.append(el('p',`${new Date(h.at).toLocaleString()} · ${D.title(h.action)}${h.note?' · '+h.note:''}`));
  await nextSteps(a,b);
 }
 async function place(a){
  const b=begin('place',a.id);await permissions(b);if(!can('dream_team.placement.manage')){retire();return}status.textContent='';
  content.append(button('Back',load),el('h2','Team placement'),el('p','Placement does not grant staff, administrative or financial access.'));
  const dep=el('select',null,{'aria-label':'Ministry'});for(const d of departments)dep.append(el('option',d.name,{value:d.id}));const team=input('Team'),role=input('Role / title'),effective=input('Effective date','date'),note=input('Placement note','textarea');
  content.append(dep,team.box,role.box,effective.box,note.box,button('Assign team',b=>mutate(b,['dream_team.application.read','dream_team.placement.manage'],()=>rpc('place',{id:a.id,revision:a.revision,department_id:dep.value,team:team.i.value,role_title:role.i.value,effective_at:effective.i.value||undefined,note:note.i.value},b),load)));
 }
 async function boot(){
  const oldAccount=user?.id;generation++;context=null;org=null;selected=null;view='list';writing=false;root.replaceChildren();const g=generation;
  try{
   const nextUser=await auth.getUser();if(g!==generation)return;if(nextUser?.id!==oldAccount){search='';filter='';placement='';offset=0}user=nextUser;
   if(!user){retire('Sign in to access your ministry workspace.');root.append(el('a','Sign in',{href:'discipleship-login.html?next=%2Fstaff-dream-team.html'}));return}
   status=el('p','Loading…',{role:'status'});content=el('div');root.append(status);
   let b=binding();context=await request(()=>client.rpc('staff_workspace_context',{}),b);if(!current(b))return;
   const orgs=context.organizations.filter(o=>context.grants.some(x=>x.organization_id===o.id&&!x.department_ids&&['dream_team.application.read','courses.manage','dream_team.placement.manage'].includes(x.permission)));
   const query=new URLSearchParams(location.search),hints=query.getAll('org');
   if(!orgs.length||hints.length>1||(hints.length===1&&!orgs.some(o=>o.id===hints[0]))){retire('Dream Team permissions are unavailable for the requested organization.');return}
   const select=el('select',null,{'aria-label':'Organization'});for(const o of orgs)select.append(el('option',o.name,{value:o.id}));org=hints[0]||select.value;select.value=org;
   select.addEventListener('change',()=>{if(!select.isConnected)return;generation++;org=select.value;selected=null;search='';filter='';placement='';offset=0;load().catch(()=>{})});root.append(select,content);
   await load();const application=query.get('application'),person=query.get('person');if(application&&can('dream_team.application.restricted'))await detail(application);
   else if(person&&can('dream_team.application.manage')&&can('people.read')){
    begin('enable',person);content.append(el('p','Enable the application for this reviewed Person/account?'),button('Enable application',b=>mutate(b,['dream_team.application.read','dream_team.application.manage','people.read'],()=>rpc('enable',{person_id:person,reason:'Manual Person profile enablement'},b),load)),button('Cancel',load));status.textContent='';
   }
  }catch{if(g===generation)retire('Workspace unavailable. Reload to verify your access.')}
 }
 auth.client.auth.onAuthStateChange((_e,s)=>{if(s?.user?.id!==user?.id){retire('Your account changed. Reload to continue.');setTimeout(boot,0)}});
 window.addEventListener('staff-protected-clear',()=>retire());window.addEventListener('pagehide',()=>retire());
 window.addEventListener('popstate',()=>{retire();boot()});window.addEventListener('pageshow',e=>{if(e.persisted)boot()});window.addEventListener('focus',()=>boot());
 boot();
})();
