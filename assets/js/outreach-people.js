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
  const g=generation;
  if(window.StaffWorkspace&&!window.StaffWorkspace.active())throw Error("Staff access unavailable");
  try{const session=await auth.getSession();if(g!==generation)throw Error();if(!session||session.user.id!==user?.id){fail(401);throw Error()}
   if(window.StaffWorkspace&&!window.StaffWorkspace.active())throw Error("Staff access unavailable");const r=await run();if(g!==generation)throw Error();if(r.error||r.status===401||r.status===403){if(r.status===401||r.status===403||r.error?.code==='42501')fail(r.status===401?401:403);else status.textContent='Unable to complete this request. Please refresh and try again.';throw Error()}return r.data;
  }catch(e){if(g===generation&&status)status.textContent='Unable to complete this request. Please refresh and try again.';throw e}
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
 function addTaskHistory(card,task,personId,g){
  const targetOrg=org,actor=user?.id,client=auth.client,clientAuth=client.auth,url=location.pathname+location.search;
  const show=el('button','View task history',{type:'button',class:'staff-action'}),hide=el('button','Hide task history',{type:'button',class:'staff-action'}),output=el('div');
  hide.hidden=true;card.append(show,hide,output);let sequence=0,pending=false,retired=false;
  const current=token=>{
   if(window.ChampionLifeAuth!==auth||auth.client!==client||client.auth!==clientAuth){retired=true;output.replaceChildren();show.disabled=true;hide.hidden=true}
   return !retired&&token===sequence&&g===generation&&org===targetOrg&&user?.id===actor&&url===location.pathname+location.search&&root.contains(card)&&(!window.StaffWorkspace||window.StaffWorkspace.active());
  };
  const verify=async token=>{if(!current(token))return false;const session=await auth.getSession();if(!current(token))return false;if(session?.user?.id!==actor){fail(401);return false}return true};
  hide.onclick=()=>{if(!current(sequence))return;sequence++;pending=false;output.replaceChildren();hide.hidden=true;show.disabled=false};
  show.onclick=async()=>{
   if(pending||!current(sequence))return;pending=true;show.disabled=true;hide.hidden=false;const token=++sequence;
   const panel=el('section',null,{role:'region','aria-label':'Recent task history'});panel.append(el('p','Loading task history…'));output.replaceChildren(panel);
   try{
    if(!await verify(token))return;await refreshPermissions();if(!current(token))return;if(!can('followup.read')){fail(403);return}
    // Bind the visible card back to its current canonical Person and organization.
    const bound=await request(()=>client.from('followup_tasks').select('id').eq('organization_id',targetOrg).eq('person_id',personId).eq('id',task.id).maybeSingle());
    if(!await verify(token))return;if(bound?.id!==task.id)throw Error();
    const rows=await request(()=>client.from('followup_task_events').select('id,organization_id,task_id,occurred_at,action,before_status:before_state->>status,after_status:after_state->>status,before_due:before_state->>due_on,after_due:after_state->>due_on,before_revision:before_state->revision,after_revision:after_state->revision').eq('organization_id',targetOrg).eq('task_id',task.id).order('occurred_at',{ascending:false}).order('id',{ascending:false}).limit(51));
    if(!await verify(token))return;await refreshPermissions();if(!await verify(token))return;if(!can('followup.read')){fail(403);return}
    const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    const date=v=>v===null||(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);
    const state=v=>['open','completed','canceled'].includes(v),seen=new Set();
    if(!Array.isArray(rows)||rows.length>51)throw Error();
    for(const r of rows){
     if(!r||!uuid(r.id)||seen.has(r.id)||r.organization_id!==targetOrg||r.task_id!==task.id||typeof r.occurred_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(r.occurred_at)||!Number.isFinite(Date.parse(r.occurred_at))||!state(r.after_status)||!date(r.before_due)||!date(r.after_due)||!Number.isSafeInteger(r.after_revision)||r.after_revision<1)throw Error();
     if(r.action==='created'){if(r.before_status!==null||r.before_due!==null||r.before_revision!==null||r.after_revision!==1||r.after_status!=='open')throw Error()}
     else if(r.action!=='updated'||!state(r.before_status)||!Number.isSafeInteger(r.before_revision)||r.before_revision<1||r.after_revision!==r.before_revision+1)throw Error();
     seen.add(r.id);
    }
    const list=el('ol'),due=v=>v||'No due date';
    for(const r of rows.slice(0,50)){
     const parts=[new Date(r.occurred_at).toLocaleString(),'Revision '+r.after_revision];
     if(r.action==='created')parts.push('Task created','Status: '+r.after_status,'Due date: '+due(r.after_due));
     else{if(r.before_status!==r.after_status)parts.push('Status: '+r.before_status+' → '+r.after_status);if(r.before_due!==r.after_due)parts.push('Due date: '+due(r.before_due)+' → '+due(r.after_due));if(parts.length===2)parts.push('Task updated; status and due date unchanged.')}
     list.append(el('li',parts.join(' · ')));
    }
    panel.replaceChildren(el('h5','Recent task history'),el('p',rows.length>50?'Latest 50 changes. Earlier history is not shown.':rows.length?'Most recent changes for this task.':'No task history is available.'),list);
   }catch{
    if(await verify(token).catch(()=>false))panel.replaceChildren(el('p','Task history is unavailable. Hide it and try again.'));
   }finally{if(current(token)){pending=false;show.disabled=false}}
  };
 }
 function addTaskActions(card,task,personId,g,taskCursors,taskStatus){
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
   controls.replaceChildren(el('p',message),button('Refresh follow-up tasks',()=>{if(current())return detail(personId,taskCursors,taskStatus)}));
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
    await detail(personId,taskCursors,taskStatus);
   }catch{
    if(!current())return;
    if(submitted)review('The save could not be confirmed. It may have succeeded. Refresh the tasks and check the current date and status before making another change.');
    else status.textContent='Unable to verify access. Please try again.';
   }finally{if(current()&&!submitted){pending=false;for(const control of[select,due,saveStatus,saveDue,clearDue])control.disabled=false}}
  }
  saveStatus.onclick=()=>save('status');saveDue.onclick=()=>save('due_on');clearDue.onclick=()=>{if(pending||!current())return;due.value='';return save('due_on',true)};
 }
 async function detail(id,taskCursors=[],taskStatus='all'){
  if(!['all','open','completed','canceled'].includes(taskStatus))return;
  const g=++generation,detailOrg=org,detailActor=user?.id,detailClient=auth.client,detailAuth=detailClient.auth,detailUrl=location.pathname+location.search;
  const current=()=>{
   if(g!==generation)return false;
   if(window.ChampionLifeAuth!==auth||auth.client!==detailClient||detailClient.auth!==detailAuth||org!==detailOrg||user?.id!==detailActor||location.pathname+location.search!==detailUrl||(window.StaffWorkspace&&!window.StaffWorkspace.active())){generation++;content?.replaceChildren();status.textContent='Task view closed because the staff context changed. Reload to verify access.';return false}
   return true;
  };
  try{
  content.replaceChildren();status.textContent='Loading…';await refreshPermissions();if(!current())return;
  const data=await people('detail',{person_id:id});if(!current())return;status.textContent='';const p=data.person;
  content.append(button('Back to People',()=>list()),el('h2',p.first_name+' '+p.last_name),el('p',p.email||''),el('p',p.phone||''),el('h3','Organization relationships'));
  for(const r of data.relationships||[])content.append(el('p',r.relationship+(r.active?'':' (inactive)')));
  if(!can('followup.read'))return;
  const tasks=await request(()=>{if(!current())throw Error();let query=detailClient.from('followup_tasks').select('id,title,status,due_on,revision,created_at').eq('organization_id',org).eq('person_id',id).order('created_at',{ascending:false}).order('id',{ascending:false});if(taskStatus!=='all')query=query.eq('status',taskStatus);const cursor=taskCursors.at(-1);if(cursor)query=query.or('created_at.lt.'+cursor.created_at+',and(created_at.eq.'+cursor.created_at+',id.lt.'+cursor.id+')');return query.limit(101)});if(!current())return;
  // RLS-filtered empty data is not proof of continuing authority.
  await refreshPermissions();if(!current())return;if(!can('followup.read')){fail(403);return}
  const taskFilter=el('select',null,{'aria-label':'Filter follow-up tasks'}),taskFilterLabel=el('label','Task status filter');
  for(const [value,label] of [['all','All tasks'],['open','Open tasks'],['completed','Completed tasks'],['canceled','Canceled tasks']]){const option=el('option',label,{value});option.selected=value===taskStatus;taskFilter.append(option)}
  const filterOrg=org,filterActor=user?.id,filterClient=auth.client,filterAuth=filterClient.auth,filterUrl=location.pathname+location.search;
  taskFilter.onchange=()=>{
   if(g!==generation||!root.contains(taskFilter))return;
   if(window.ChampionLifeAuth!==auth||auth.client!==filterClient||filterClient.auth!==filterAuth||org!==filterOrg||user?.id!==filterActor||location.pathname+location.search!==filterUrl||(window.StaffWorkspace&&!window.StaffWorkspace.active())){taskFilterLabel.replaceChildren(el('p','Task filter closed because the staff context changed. Reload to verify access.'));return}
   detail(id,[],taskFilter.value).catch(()=>{});
  };taskFilterLabel.append(taskFilter);
  content.append(el('h3','Follow-up tasks'),taskFilterLabel,el('p','Task page '+(taskCursors.length+1)),button('Refresh latest tasks',()=>detail(id,[],taskStatus)));if(can('followup.manage'))addTaskEditor(id,g);if(!tasks.length)content.append(el('p',taskCursors.length?'No tasks on this page. Return to newer tasks or refresh the latest tasks.':taskStatus==='all'?'No follow-up tasks.':'No '+taskStatus+' follow-up tasks.'));
  for(const task of tasks.slice(0,100)){const card=el('article');card.append(el('h4',task.title),el('p',task.status+' · '+(task.due_on||'No due date')));
   if(can('followup.manage'))addTaskActions(card,task,id,g,taskCursors,taskStatus);addTaskHistory(card,task,id,g);content.append(card);
  }
  if(taskCursors.length)content.append(button('Newer tasks',()=>detail(id,taskCursors.slice(0,-1),taskStatus)));
  if(tasks.length>100){const last=tasks[99];
   // Preserve PostgreSQL timestamp precision; accept only safe typed cursor values.
   if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last.id)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(last.created_at))content.append(button('Older tasks',()=>detail(id,[...taskCursors,{id:last.id,created_at:last.created_at}],taskStatus)));
   else status.textContent='Unable to load older tasks. Please refresh and try again.';
  }
  }finally{current()}
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
