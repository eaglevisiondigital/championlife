(() => {
 'use strict';
 const root=document.getElementById('outreach-intakes'),auth=window.ChampionLifeAuth,{el}=window.PropelEvents;
 let user,org,context,generation=0,offset=0,status,content;
 const can=key=>context?.grants.some(g=>g.organization_id===org&&g.permission===key&&!g.department_ids);
 async function rpc(name,args){const g=generation,session=await auth.getSession();if(!session||session.user.id!==user?.id)throw Error('Sign in again.');const {data,error}=await auth.client.rpc(name,args);if(g!==generation)throw Error('Workspace changed.');if(error)throw Error(error.message);return data;}
 const intake=(action,data={})=>rpc('outreach_partner_workspace',{p_org:org,p_action:action,p_data:data});
 function button(label,action){const g=generation,b=el('button',label,{type:'button'});b.onclick=async()=>{b.disabled=true;try{await action()}catch(e){if(g===generation)status.textContent=e.message}finally{b.disabled=false}};return b;}
 function field(label){const l=el('label',label),i=el('input',null,{type:'search',maxlength:'100'});l.append(i);return {l,i};}
 async function list(){generation++;content.replaceChildren();status.textContent='Loading…';const rows=await intake('list',{offset});status.textContent=rows.length?'':'No outreach partner intakes.';
 for(const r of rows){const card=el('article');card.append(el('h2',r.first_name+' '+r.last_name),el('p',r.email+' · '+r.phone),el('p',`${r.source_site} · ${new Date(r.submitted_at).toLocaleString()} · ${r.status}`),el('p',`Intended commitment: $${r.commitment_amount} · ${r.commitment_frequency}`),el('p','Follow-up: '+(r.followup_status||'Not created or not accessible')),button('Review intake',()=>detail(r.id)));content.append(card);}
 content.append(button('Previous',()=>{offset=Math.max(0,offset-50);return list()}),button('Next',()=>{offset+=50;return list()}));}
 async function detail(id){generation++;content.replaceChildren();status.textContent='Loading…';const r=await intake('detail',{id});status.textContent='';content.append(button('Back to intakes',list),el('h2','Partner intake · '+r.status));
 const labels={'first-name':'First Name','last-name':'Last Name',email:'Email Address','address-line-1':'Street Address','address-line-2':'Street Address Line 2',city:'City','state-province':'State / Province','postal-code':'Postal / ZIP Code',phone:'Phone Number','commitment-amount':'Commitment Amount','commitment-frequency':'Commitment Frequency'};
 for(const[k,label]of Object.entries(labels))content.append(el('p',label+': '+(r.raw_submission[k]||'—')));
 content.append(el('p',`Source: ${r.source_site} · ${r.source_path}`),el('p','This commitment is not payment authorization, verified account ownership or marketing consent.'));
 const act=async(action,data={})=>{await intake(action,{id,revision:r.revision,...data});await detail(id)};
 if(can('outreach.manage'))content.append(button('Mark reviewed',()=>act('review')));
 if(r.person_id){if(can('people.read'))content.append(el('a','Open Person / follow-up tasks',{href:'staff-people.html?person='+encodeURIComponent(r.person_id)}));if(can('outreach.manage')&&can('followup.manage')&&can('followup.read')&&can('people.read')&&!r.followup_task_id)content.append(button('Create follow-up task',()=>act('followup')));}
 else if(can('outreach.manage')&&can('people.read')&&can('people.update')){
  content.append(el('h3','Review contact identity'),el('p','Search and verify the contact before linking. Linking establishes a SowGo partner relationship only.'));
  const find=field('Search existing contacts'),results=el('div');find.i.value=r.raw_submission.email;
  content.append(find.l,button('Search People',async()=>{const g=generation,rows=await rpc('people_workspace',{p_org:org,p_action:'list',p_payload:{search:find.i.value,offset:0}});if(g!==generation)return;results.replaceChildren();for(const p of rows)results.append(el('p',`${p.first_name} ${p.last_name} · ${p.email||''} · ${p.phone||''}`),button('Link reviewed contact',async()=>{if(confirm('Confirm you reviewed this identity and want to establish the SowGo partner relationship?'))await act('link',{person_id:p.id})}));if(!rows.length)results.append(el('p','No matching contacts.'));}),results);
  if(can('people.create'))content.append(button('Create contact after review',async()=>{if(confirm('Confirm you checked for an existing contact. Create a new SowGo contact and partner relationship?'))await act('create_contact')}));
 }
 content.append(el('h3','Review history'));for(const h of r.history)content.append(el('p',`${h.action} · ${new Date(h.occurred_at).toLocaleString()}`));
 }
 async function boot(){generation++;root.replaceChildren();user=await auth?.getUser();if(!user){root.append(el('a','Sign in to your workspace',{href:'discipleship-login.html?next=%2Fstaff-outreach-partners.html'}));return;}
 status=el('p',null,{role:'status'});content=el('div');root.append(status);
 try{context=await rpc('staff_workspace_context',{});const orgs=context.organizations.filter(o=>context.grants.some(g=>g.organization_id===o.id&&g.permission==='outreach.view'&&!g.department_ids));if(!orgs.length){status.textContent='Organization-wide outreach access has not been assigned.';return;}const select=el('select',null,{'aria-label':'Organization'});for(const o of orgs)select.append(el('option',o.name,{value:o.id}));org=select.value;select.onchange=()=>{org=select.value;offset=0;list().catch(e=>status.textContent=e.message)};root.append(select,content);await list();}catch(e){status.textContent=e.message;}}
 auth?.client.auth.onAuthStateChange((_e,s)=>{if(s?.user?.id!==user?.id){generation++;root.replaceChildren();setTimeout(boot,0)}});boot();
})();
