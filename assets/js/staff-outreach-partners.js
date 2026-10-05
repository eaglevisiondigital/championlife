(() => {
 'use strict';
 const root=document.getElementById('outreach-intakes'),workspace=document.querySelector('.partner-workspace'),auth=window.ChampionLifeAuth,{el}=window.OutreachUI;
 let user,org,context,generation=0,offset=0,status,content;
 const can=key=>context?.grants.some(g=>g.organization_id===org&&g.permission===key&&!g.department_ids);
 const signIn=()=>el('a','Sign in to your workspace',{href:'discipleship-login.html?next=%2Fstaff-outreach-partners.html'});
 function failure(code,reason){
  if(code!==401&&code!==403){
   status.className=reason==='possible_contact_match'?'partner-workspace-notice':'';
   status.setAttribute('role','alert');
   status.textContent=reason==='possible_contact_match'?'Possible existing contact found. Review the matching person and link this intake to the correct existing contact instead of creating a duplicate.':'Unable to load Outreach Partner Intakes. Please try again.';
   return;
  }
  // Drop protected UI/closures and invalidate every pending request after access is denied.
  generation++;context=null;org=null;offset=0;content?.replaceChildren();content=null;
  workspace?.classList.toggle('is-denied',code===403);
  status=el('p',code===403?'Your access to Outreach Partner Intakes is no longer available.':'Your session has expired. Sign in to continue.',{role:'alert'});
  if(code===403){
   status.className='partner-access-denied__message';
   const panel=el('section',null,{class:'partner-access-denied','aria-labelledby':'partner-access-denied-title'}),brand=el('div',null,{class:'partner-access-denied__brand'});
   brand.append(el('img',null,{src:'assets/images/logo-gold.png',alt:'Champion Life'}));
   panel.append(brand,el('p','Staff Access',{class:'partner-access-denied__eyebrow'}),el('h2','Outreach Partner Access Removed',{id:'partner-access-denied-title'}),status,el('p','If you believe you should still have access, contact an administrator.',{class:'partner-access-denied__help'}),el('a','Return to Staff Home',{href:'staff-people.html',class:'partner-access-denied__cta'}));
   root.replaceChildren(panel);
  } else root.replaceChildren(status,signIn());
 }
 async function rpc(name,args){const g=generation;try{
  const session=await auth.getSession();if(g!==generation)throw Error('Workspace changed.');
  if(!session||session.user.id!==user?.id)throw Object.assign(Error('Session expired.'),{status:401});
  const {data,error,status:code}=await auth.client.rpc(name,args);
  if(g!==generation)throw Error('Workspace changed.');
  if(error||code===401||code===403){
   const reason=name==='outreach_partner_workspace'&&args?.p_action==='create_contact'&&error?.code==='P0001'&&error?.message==='Possible existing contact; search and review before linking'?'possible_contact_match':null;
   throw Object.assign(Error('Request failed.'),{status:code,reason});
  }
  return data;
 }catch(error){if(g===generation)failure(error.status,error.reason);throw error;}}
 const intake=(action,data={})=>rpc('outreach_partner_workspace',{p_org:org,p_action:action,p_data:data});
 function button(label,action){const g=generation,b=el('button',label,{type:'button'});b.onclick=async()=>{if(g!==generation)return;b.disabled=true;try{await action()}catch{/* rpc displays errors for the active request, including navigation to a new generation. */}finally{b.disabled=false}};return b;}
 function field(label){const l=el('label',label),i=el('input',null,{type:'search',maxlength:'100'});l.append(i);return {l,i};}
 async function list(){const g=++generation;content.replaceChildren();status.className='';status.setAttribute('role','status');status.textContent='Loading…';const rows=await intake('list',{offset});if(g!==generation)return;status.textContent=rows.length?'':'No outreach partner intakes.';
 for(const r of rows){const card=el('article');card.append(el('h2',r.first_name+' '+r.last_name),el('p',r.email+' · '+r.phone),el('p',`${r.source_site} · ${new Date(r.submitted_at).toLocaleString()} · ${r.status}`),el('p',`Intended commitment: $${r.commitment_amount} · ${r.commitment_frequency}`),el('p','Follow-up: '+(r.followup_status||'Not created or not accessible')),button('Review intake',()=>detail(r.id)));content.append(card);}
 content.append(button('Previous',()=>{offset=Math.max(0,offset-50);return list()}),button('Next',()=>{offset+=50;return list()}));}
 async function detail(id){const g=++generation;content.replaceChildren();status.className='';status.setAttribute('role','status');status.textContent='Loading…';const r=await intake('detail',{id});if(g!==generation)return;status.textContent='';content.append(button('Back to intakes',list),el('h2','Partner intake · '+r.status));
 const labels={'first-name':'First Name','last-name':'Last Name',email:'Email Address','address-line-1':'Street Address','address-line-2':'Street Address Line 2',city:'City','state-province':'State / Province','postal-code':'Postal / ZIP Code',phone:'Phone Number','commitment-amount':'Commitment Amount','commitment-frequency':'Commitment Frequency'};
 for(const[k,label]of Object.entries(labels))content.append(el('p',label+': '+(r.raw_submission[k]||'—')));
 content.append(el('p',`Source: ${r.source_site} · ${r.source_path}`),el('p','This commitment is not payment authorization, verified account ownership or marketing consent.'));
 const act=async(action,data={})=>{await intake(action,{id,revision:r.revision,...data});await detail(id)};
 if(can('outreach.manage'))content.append(button('Mark reviewed',()=>act('review')));
 if(r.person_id){if(can('people.read'))content.append(el('a','Open Person / follow-up tasks',{href:'staff-people.html?person='+encodeURIComponent(r.person_id)+'&org='+encodeURIComponent(org)}));if(can('outreach.manage')&&can('followup.manage')&&can('followup.read')&&can('people.read')&&!r.followup_task_id)content.append(button('Create follow-up task',()=>act('followup')));}
 else if(can('outreach.manage')&&can('people.read')&&can('people.update')){
  content.append(el('h3','Review contact identity'),el('p','Search and verify the contact before linking. Linking establishes a SowGo partner relationship only.'));
  const find=field('Search existing contacts'),results=el('div');find.i.value=r.raw_submission.email;
  content.append(find.l,button('Search People',async()=>{const g=generation,rows=await rpc('people_workspace',{p_org:org,p_action:'list',p_payload:{search:find.i.value,offset:0}});if(g!==generation)return;results.replaceChildren();for(const p of rows)results.append(el('p',`${p.first_name} ${p.last_name} · ${p.email||''} · ${p.phone||''}`),button('Link reviewed contact',async()=>{if(confirm('Confirm you reviewed this identity and want to establish the SowGo partner relationship?'))await act('link',{person_id:p.id})}));if(!rows.length)results.append(el('p','No matching contacts.'));}),results);
  if(can('people.create'))content.append(button('Create contact after review',async()=>{if(confirm('Confirm you checked for an existing contact. Create a new SowGo contact and partner relationship?'))await act('create_contact')}));
 }
 content.append(el('h3','Review history'));for(const h of r.history)content.append(el('p',`${h.action} · ${new Date(h.occurred_at).toLocaleString()}`));
 }
 async function boot(){const g=++generation;workspace?.classList.remove('is-denied');root.replaceChildren();content?.replaceChildren();content=null;context=null;org=null;offset=0;const nextUser=await auth?.getUser();if(g!==generation)return;user=nextUser;if(!user){root.append(signIn());return;}
 status=el('p',null,{role:'status'});content=el('div');root.append(status);
 try{const nextContext=await rpc('staff_workspace_context',{});if(g!==generation)return;context=nextContext;const orgs=context.organizations.filter(o=>context.grants.some(g=>g.organization_id===o.id&&g.permission==='outreach.view'&&!g.department_ids));if(!orgs.length){failure(403);return;}const select=el('select',null,{'aria-label':'Organization'});for(const o of orgs)select.append(el('option',o.name,{value:o.id}));org=select.value;select.onchange=()=>{org=select.value;offset=0;list().catch(()=>{/* rpc handles the active failure. */})};root.append(select,content);await list();}catch{/* rpc handles the active failure. */}}
 auth?.client.auth.onAuthStateChange((_e,s)=>{if(s?.user?.id!==user?.id){generation++;root.replaceChildren();setTimeout(boot,0)}});boot();
})();
