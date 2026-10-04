(() => {
 'use strict';
 const root=document.getElementById('outreach-people'),auth=window.ChampionLifeAuth,{el}=window.OutreachUI;
 let generation=0,user,org,grants=[],content,status,page=0;
 const can=k=>grants.some(g=>g.organization_id===org&&g.permission===k&&!g.department_ids);
 const login=()=>el('a','Sign in to your workspace',{href:'discipleship-login.html?next=%2Fstaff-people.html'});
 function fail(code){
  generation++;grants=[];org=null;content?.replaceChildren();content=null;
  root.replaceChildren(el('p',code===401?'Your session has expired. Sign in to continue.':'Your access is no longer available. Contact an administrator if you believe you should still have access.',{role:'alert'}));
  root.append(code===401?login():el('a','Return to Outreach Partner Review',{href:'staff-outreach-partners.html'}));
 }
 async function request(run){
  const g=generation;
  try{const session=await auth.getSession();if(g!==generation)throw Error();if(!session||session.user.id!==user?.id){fail(401);throw Error()}
   const r=await run();if(g!==generation)throw Error();if(r.error||r.status===401||r.status===403){if(r.status===401||r.status===403||r.error?.code==='42501')fail(r.status===401?401:403);else status.textContent='Unable to complete this request. Please refresh and try again.';throw Error()}return r.data;
  }catch(e){if(g===generation&&status)status.textContent='Unable to complete this request. Please refresh and try again.';throw e}
 }
 const people=(action,payload)=>request(()=>auth.client.rpc('people_workspace',{p_org:org,p_action:action,p_payload:payload}));
 function button(label,action){const g=generation,b=el('button',label,{type:'button'});b.onclick=async()=>{if(g!==generation)return;b.disabled=true;try{await action()}catch{}finally{b.disabled=false}};return b}
 async function refreshPermissions(){const ctx=await request(()=>auth.client.rpc('staff_workspace_context',{}));grants=ctx.grants;if(!can('people.read')){fail(403);throw Error()}}
 async function list(search=''){
  const g=++generation;content.replaceChildren();status.textContent='Loading…';await refreshPermissions();if(g!==generation)return;
  const rows=await people('list',{search,page});if(g!==generation)return;status.textContent=rows.length?'':'No matching contacts.';
  const label=el('label','Search contacts'),input=el('input',null,{type:'search',maxlength:'100'});input.value=search;label.append(input);content.append(label,button('Search',()=>{page=0;return list(input.value)}));
  for(const p of rows.slice(0,25)){const card=el('article');card.append(el('h2',p.first_name+' '+p.last_name),el('p',(p.email||'')+' · '+(p.phone||'')),el('p',(p.relationships||[]).join(', ')),button('Review Person & follow-up',()=>detail(p.id)));content.append(card)}
  if(page>0)content.append(button('Previous',()=>{page--;return list(search)}));if(rows.length>25)content.append(button('Next',()=>{page++;return list(search)}));
 }
 async function detail(id){
  const g=++generation;content.replaceChildren();status.textContent='Loading…';await refreshPermissions();if(g!==generation)return;
  const data=await people('detail',{person_id:id});if(g!==generation)return;status.textContent='';const p=data.person;
  content.append(button('Back to People',()=>list()),el('h2',p.first_name+' '+p.last_name),el('p',p.email||''),el('p',p.phone||''),el('h3','Organization relationships'));
  for(const r of data.relationships||[])content.append(el('p',r.relationship+(r.active?'':' (inactive)')));
  if(!can('followup.read'))return;
  const tasks=await request(()=>auth.client.from('followup_tasks').select('id,title,status,due_on,revision').eq('organization_id',org).eq('person_id',id).order('created_at',{ascending:false}).limit(100));if(g!==generation)return;
  // RLS-filtered empty data is not proof of continuing authority.
  await refreshPermissions();if(g!==generation)return;if(!can('followup.read')){fail(403);return}
  content.append(el('h3','Follow-up tasks'));if(!tasks.length)content.append(el('p','No follow-up tasks.'));
  for(const task of tasks){const card=el('article');card.append(el('h4',task.title),el('p',task.status+' · '+(task.due_on||'No due date')));
   if(can('followup.manage')){const label=el('label','Status'),select=el('select');for(const value of ['open','completed','canceled']){const option=el('option',value,{value});option.selected=task.status===value;select.append(option)}label.append(select);card.append(label,button('Save task status',async()=>{
    await refreshPermissions();if(g!==generation)return;if(!can('followup.manage')){fail(403);return}
    const saved=await request(()=>auth.client.from('followup_tasks').update({status:select.value}).eq('organization_id',org).eq('person_id',id).eq('id',task.id).eq('revision',task.revision).select('id').maybeSingle());
    if(g!==generation)return;if(!saved){await refreshPermissions();status.textContent='Task changed or access was removed. Refresh before retrying.';content.replaceChildren();return}await detail(id);
   }))}content.append(card);
  }
 }
 async function boot(){const g=++generation;grants=[];content?.replaceChildren();root.replaceChildren();try{user=await auth?.getUser();if(g!==generation)return;if(!user){root.append(login());return}
  status=el('p','Loading…',{role:'status'});content=el('div');root.append(status);const ctx=await request(()=>auth.client.rpc('staff_workspace_context',{}));if(g!==generation)return;grants=ctx.grants;
  const choices=ctx.organizations.filter(o=>grants.some(x=>x.organization_id===o.id&&x.permission==='people.read'&&!x.department_ids));if(!choices.length){fail(403);return}
  const select=el('select',null,{'aria-label':'Organization'}),params=new URLSearchParams(location.search);for(const o of choices)select.append(el('option',o.name,{value:o.id}));if(choices.some(o=>o.id===params.get('org')))select.value=params.get('org');org=select.value;
  select.onchange=()=>{org=select.value;page=0;list().catch(()=>{})};root.append(select,content);const person=params.get('person');if(person&&/^[a-f0-9-]{36}$/i.test(person))await detail(person);else await list();
 }catch{if(g===generation)root.replaceChildren(el('p','Workspace unavailable. Please refresh and try again.',{role:'alert'}))}}
 auth?.client.auth.onAuthStateChange((_event,session)=>{if(session?.user?.id!==user?.id){generation++;root.replaceChildren();grants=[];org=null;setTimeout(boot,0)}});boot();
})();
