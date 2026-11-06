(() => {
 'use strict';
 const root=document.getElementById('outreach-people'),auth=window.ChampionLifeAuth,{el}=window.OutreachUI;
 if(!root||(window.StaffWorkspace&&!window.StaffWorkspace.active()))return;
 let generation=0,user,org,grants=[],content,status,page=0,search='';
 const resetList=()=>{page=0;search=''};
 const financialLink=document.getElementById('financial-outreach-link');
 const updateNavigation=()=>{if(financialLink)financialLink.hidden=!(can('outreach.view')&&can('finance.read'))};
 const can=k=>grants.some(g=>g.organization_id===org&&g.permission===k&&!g.department_ids);
 const login=()=>el('a','Sign in to your workspace',{href:'discipleship-login.html?next=%2Fstaff-people.html'});
 function fail(code){if(window.StaffWorkspace)window.dispatchEvent(new Event('staff-access-denied'));
  generation++;resetList();grants=[];org=null;content?.replaceChildren();content=null;
  updateNavigation();root.replaceChildren(el('p',code===401?'Your session has expired. Sign in to continue.':'Your access is no longer available. Contact an administrator if you believe you should still have access.',{role:'alert'}));
  root.append(code===401?login():el('a','Return to Outreach',{href:'outreach.html'}));
 }
 async function request(run){
  const g=generation,client=auth.client,clientAuth=client.auth,actor=user?.id;let fenced=false;
  async function verifyCurrent(){
   if(g!==generation)throw Error('Retired request');
   if(window.ChampionLifeAuth!==auth||auth.client!==client||client.auth!==clientAuth){fail(401);throw Error('Staff connection changed')}
   let session;try{session=await auth.getSession()}catch(e){if(g===generation)fail(401);throw e}
   if(g!==generation)throw Error('Retired request');
   if(window.ChampionLifeAuth!==auth||auth.client!==client||client.auth!==clientAuth||session?.user?.id!==actor){fail(401);throw Error('Staff identity changed')}
   if(window.StaffWorkspace&&!window.StaffWorkspace.active())throw Error('Staff access unavailable');
  }
  if(window.StaffWorkspace&&!window.StaffWorkspace.active())throw Error('Staff access unavailable');
  try{await verifyCurrent();const r=await run();await verifyCurrent();fenced=true;
   if(r.error||r.status===401||r.status===403){if(r.status===401||r.status===403||r.error?.code==='42501')fail(r.status===401?401:403);else status.textContent='Unable to complete this request. Please refresh and try again.';throw Error()}return r.data;
  }catch(e){
   // Direct table operations bypass the shell RPC guard. Even a failed response
   // must verify current local identity before an uncertain-save UI can return.
   if(g===generation&&!fenced)await verifyCurrent();
   if(g===generation&&(e?.status===401||e?.status===403||e?.code==='42501'))fail(e.status===401?401:403);
   if(g===generation&&status)status.textContent='Unable to complete this request. Please refresh and try again.';throw e;
  }
 }
 const people=(action,payload)=>request(()=>auth.client.rpc('people_workspace',{p_org:org,p_action:action,p_payload:payload}));
 function button(label,action){const g=generation,b=el('button',label,{type:'button',class:'staff-action'});b.onclick=async()=>{if(g!==generation)return;b.disabled=true;try{await action()}catch{}finally{b.disabled=false}};return b}
 async function refreshPermissions(){const ctx=await request(()=>auth.client.rpc('staff_workspace_context',{}));grants=ctx.grants;updateNavigation();if(!can('people.read')){fail(403);throw Error()}}
 async function list(nextSearch=search){
  search=nextSearch;const g=++generation;content.replaceChildren();status.textContent='Loading…';await refreshPermissions();if(g!==generation)return;
  const rows=await people('list',{search,page});if(g!==generation)return;status.textContent=rows.length?'':'No matching contacts.\nTry a different name or check the selected organization.';status.className=rows.length?'staff-status':'staff-status staff-empty';
  const filter=el('form',null,{class:'staff-search'}),label=el('label','Search contacts'),input=el('input',null,{type:'search',maxlength:'100',placeholder:'Search by name, email or phone'}),submit=el('button','Search',{type:'submit',class:'staff-action'});input.value=search;label.append(input);filter.append(label,submit);filter.onsubmit=async e=>{e.preventDefault();if(g!==generation||submit.disabled||!root.contains(filter))return;submit.disabled=true;try{page=0;await list(input.value)}catch{}finally{submit.disabled=false}};content.append(filter);
  for(const p of rows.slice(0,25)){const card=el('article',null,{class:'staff-person-card'});card.append(el('h2',p.first_name+' '+p.last_name),el('p',(p.email||'')+' · '+(p.phone||'')),el('p',(p.relationships||[]).join(', ')),button('Review Person & follow-up',()=>detail(p.id)));content.append(card)}
  if(page>0)content.append(button('Previous',()=>{page--;return list(search)}));if(rows.length>25)content.append(button('Next',()=>{page++;return list(search)}));
 }
 function addTaskEditor(personId,g){
  const targetOrg=org,actor=user?.id,client=auth.client,clientAuth=client.auth,url=location.pathname+location.search;
  const card=el('article'),form=el('form'),titleLabel=el('label','Task title'),title=el('input',null,{type:'text',required:'',maxlength:'180'}),dueLabel=el('label','Due date (optional)'),due=el('input',null,{type:'date'}),submit=el('button','Add follow-up task',{type:'submit',class:'staff-action'});
  card.append(el('h4','New follow-up task'),el('p','Add an operational next step for this person. Creating a task does not send a message.'));
  titleLabel.append(title);dueLabel.append(due);form.append(titleLabel,dueLabel,submit);card.append(form);content.append(card);let pending=false,retired=false;
  const current=()=>{if(!retired&&(window.ChampionLifeAuth!==auth||auth.client!==client||client.auth!==clientAuth)){retired=true;title.value='';due.value='';if(g===generation&&root.contains(card))card.replaceChildren(el('p','Task editor closed because the staff connection changed. Reload to verify access.'))}return !retired&&g===generation&&org===targetOrg&&user?.id===actor&&url===location.pathname+location.search&&root.contains(form)&&(!window.StaffWorkspace||window.StaffWorkspace.active())};
  form.onsubmit=async event=>{
   event.preventDefault();if(pending||!current()||!form.reportValidity())return;
   const value=title.value.trim();if(!value||Array.from(value).length>180){status.textContent='Enter a task title using 1–180 characters.';title.focus();return}
   const payload={organization_id:targetOrg,person_id:personId,title:value,due_on:due.value||null};
   pending=true;submit.disabled=true;title.disabled=true;due.disabled=true;let submitted=false;
   try{
    await refreshPermissions();if(!current())return;
    if(!can('followup.read')||!can('followup.manage')){fail(403);return}
    const saved=await request(()=>{if(!current())throw Error();submitted=true;return client.from('followup_tasks').insert(payload).select('id').single()});
    if(!current())return;
    if(typeof saved?.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved.id))throw Error();
    await detail(personId);
   }catch{
    if(!current())return;
    if(submitted){
     // The existing INSERT has no idempotency key. Never replay an uncertain create.
     form.replaceChildren(el('p','The save could not be confirmed. It may have succeeded. Refresh this person’s tasks and check the list before adding another task.'),button('Refresh follow-up tasks',()=>{if(current())return detail(personId)}));
     status.textContent='Task save needs review.';
    }else status.textContent='Unable to verify access. Please try again.';
   }finally{if(current()&&!submitted){pending=false;submit.disabled=false;title.disabled=false;due.disabled=false}}
  };
 }
 function addTaskActions(card,task,personId,g,taskCursors){
  const targetOrg=org,actor=user?.id,client=auth.client,clientAuth=client.auth,url=location.pathname+location.search;
  const controls=el('div'),statusLabel=el('label','Status'),select=el('select'),dueLabel=el('label','Task due date'),due=el('input',null,{type:'date'});
  for(const value of ['open','completed','canceled']){const option=el('option',value,{value});option.selected=task.status===value;select.append(option)}
  due.value=task.due_on||'';statusLabel.append(select);dueLabel.append(due);
  const saveStatus=el('button','Save task status',{type:'button',class:'staff-action'}),saveDue=el('button','Save due date',{type:'button',class:'staff-action'}),clearDue=el('button','Remove due date',{type:'button',class:'staff-action'});
  controls.append(statusLabel,saveStatus,dueLabel,el('p','Change the date or choose Remove due date.'),saveDue,clearDue);card.append(controls);
  let pending=false,retired=false;
  const current=()=>{
   if(!retired&&(window.ChampionLifeAuth!==auth||auth.client!==client||client.auth!==clientAuth)){retired=true;select.value='';due.value='';if(g===generation&&root.contains(card))card.replaceChildren(el('p','Task editor closed because the staff connection changed. Reload to verify access.'))}
   return !retired&&g===generation&&org===targetOrg&&user?.id===actor&&url===location.pathname+location.search&&root.contains(card)&&(!window.StaffWorkspace||window.StaffWorkspace.active());
  };
  const review=message=>{
   controls.replaceChildren(el('p',message),button('Refresh follow-up tasks',()=>{if(current())return detail(personId,taskCursors)}));
   status.textContent='Task save needs review.';
  };
  async function save(field,removeDue=false){
   if(pending||!current())return;
   if(field==='due_on'&&!removeDue&&(!due.reportValidity()||(due.value&&!/^\d{4}-\d{2}-\d{2}$/.test(due.value)))){status.textContent='Enter a valid due date.';due.focus();return}
   const value=field==='due_on'?(due.value||null):select.value;
   if(field==='due_on'&&value===(task.due_on||null)){status.textContent='No task changes to save.';return}
   const payload={[field]:value};pending=true;for(const control of[select,due,saveStatus,saveDue,clearDue])control.disabled=true;let submitted=false;
   try{
    await refreshPermissions();if(!current())return;
    if(!can('followup.read')||!can('followup.manage')){fail(403);return}
    const saved=await request(()=>{if(!current())throw Error();submitted=true;return client.from('followup_tasks').update(payload).eq('organization_id',targetOrg).eq('person_id',personId).eq('id',task.id).eq('revision',task.revision).select('id').maybeSingle()});
    if(!current())return;
    if(!saved){
     await refreshPermissions();if(!current())return;if(!can('followup.read')||!can('followup.manage')){fail(403);return}
     review('Task changed or access was removed. Refresh the tasks before making another change.');return;
    }
    if(saved.id!==task.id)throw Error();
    await detail(personId,taskCursors);
   }catch{
    if(!current())return;
    if(submitted)review('The save could not be confirmed. It may have succeeded. Refresh the tasks and check the current date and status before making another change.');
    else status.textContent='Unable to verify access. Please try again.';
   }finally{if(current()&&!submitted){pending=false;for(const control of[select,due,saveStatus,saveDue,clearDue])control.disabled=false}}
  }
  saveStatus.onclick=()=>save('status');saveDue.onclick=()=>save('due_on');clearDue.onclick=()=>{if(pending||!current())return;due.value='';return save('due_on',true)};
 }
 async function detail(id,taskCursors=[]){
  const g=++generation;content.replaceChildren();status.textContent='Loading…';await refreshPermissions();if(g!==generation)return;
  const data=await people('detail',{person_id:id});if(g!==generation)return;status.textContent='';const p=data.person;
  content.append(button('Back to People',()=>list()),el('h2',p.first_name+' '+p.last_name),el('p',p.email||''),el('p',p.phone||''),el('h3','Organization relationships'));
  for(const r of data.relationships||[])content.append(el('p',r.relationship+(r.active?'':' (inactive)')));
  if(!can('followup.read'))return;
  const tasks=await request(()=>{let query=auth.client.from('followup_tasks').select('id,title,status,due_on,revision,created_at').eq('organization_id',org).eq('person_id',id).order('created_at',{ascending:false}).order('id',{ascending:false});const cursor=taskCursors.at(-1);if(cursor)query=query.or('created_at.lt.'+cursor.created_at+',and(created_at.eq.'+cursor.created_at+',id.lt.'+cursor.id+')');return query.limit(101)});if(g!==generation)return;
  // RLS-filtered empty data is not proof of continuing authority.
  await refreshPermissions();if(g!==generation)return;if(!can('followup.read')){fail(403);return}
  content.append(el('h3','Follow-up tasks'),el('p','Task page '+(taskCursors.length+1)),button('Refresh latest tasks',()=>detail(id)));if(can('followup.manage'))addTaskEditor(id,g);if(!tasks.length)content.append(el('p',taskCursors.length?'No tasks on this page. Return to newer tasks or refresh the latest tasks.':'No follow-up tasks.'));
  for(const task of tasks.slice(0,100)){const card=el('article');card.append(el('h4',task.title),el('p',task.status+' · '+(task.due_on||'No due date')));
   if(can('followup.manage'))addTaskActions(card,task,id,g,taskCursors);content.append(card);
  }
  if(taskCursors.length)content.append(button('Newer tasks',()=>detail(id,taskCursors.slice(0,-1))));
  if(tasks.length>100){const last=tasks[99];
   // Preserve PostgreSQL timestamp precision; accept only safe typed cursor values.
   if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last.id)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(last.created_at))content.append(button('Older tasks',()=>detail(id,[...taskCursors,{id:last.id,created_at:last.created_at}])));
   else status.textContent='Unable to load older tasks. Please refresh and try again.';
  }
 }
 async function boot(){const g=++generation;grants=[];content?.replaceChildren();root.replaceChildren();try{const verifiedUser=await auth?.getUser();if(g!==generation)return;user=verifiedUser;if(!user){root.append(login());return}
  status=el('p','Loading…',{role:'status',class:'staff-status'});content=el('div',null,{class:'staff-content'});root.append(status);const ctx=await request(()=>auth.client.rpc('staff_workspace_context',{}));if(g!==generation)return;grants=ctx.grants;updateNavigation();
  const choices=ctx.organizations.filter(o=>grants.some(x=>x.organization_id===o.id&&x.permission==='people.read'&&!x.department_ids));if(!choices.length){fail(403);return}
  const select=el('select',null,{'aria-label':'Organization'}),params=new URLSearchParams(location.search);for(const o of choices)select.append(el('option',o.name,{value:o.id}));if(choices.some(o=>o.id===params.get('org')))select.value=params.get('org');org=select.value;updateNavigation();
  select.onchange=()=>{if(window.StaffWorkspace){window.StaffWorkspace.navigate('staff-people.html?org='+encodeURIComponent(select.value));return}org=select.value;updateNavigation();resetList();list().catch(()=>{})};const organizationField=el('label','Organization',{class:'staff-organization'});organizationField.append(select);root.append(organizationField,content);const person=params.get('person');if(person&&/^[a-f0-9-]{36}$/i.test(person))await detail(person);else await list();
 }catch{if(g===generation)root.replaceChildren(el('p','Workspace unavailable. Please refresh and try again.',{role:'alert'}))}}
 window.addEventListener('staff-protected-clear',()=>{generation++;resetList();grants=[];org=null;content?.replaceChildren();content=null;root.replaceChildren();updateNavigation()});
 auth?.client.auth.onAuthStateChange((_event,session)=>{if(session?.user?.id!==user?.id){generation++;resetList();root.replaceChildren();grants=[];org=null;updateNavigation();setTimeout(boot,0)}});boot();
})();
