/* Source-only Minden assigned decision review. No contacts, messages or grants. */
(()=>{'use strict';
 const root=document.getElementById('minden-decisions-app'),auth=window.ChampionLifeAuth,campaign='d26b8337-d215-42d3-ac3b-c771f7f07db7';
 if(!root||!auth)return;
 let generation=0,retired=false,actor=null,context=null,expiryTimer,id=0,view='list',page=0;
 const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x),label=x=>String(x??'').replaceAll('_',' ').replace(/\b[a-z]/g,c=>c.toUpperCase());
 const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n};
 function clear(message){generation++;context=null;clearTimeout(expiryTimer);root.replaceChildren();if(message)root.append(el('p',message,{role:'alert'}));}
 function retirement(records){if(records.some(r=>[...r.removedNodes].some(n=>n===root||n.contains?.(root)))){retired=true;clear();}}
 function current(g){retirement(observer.takeRecords());return !retired&&root.isConnected&&g===generation;}
 const can=cap=>context?.capabilities.includes(cap);
 function denied(){clear('Minden decision access is unavailable. Registration or owner access does not grant decision authority.');root.append(el('a','Sign In',{href:'outreach-login.html?next='+encodeURIComponent(location.pathname+location.search)}));}
 function message(text){let n=root.querySelector('[data-message]');if(!n){n=el('p','',{role:'alert','data-message':''});root.prepend(n)}n.textContent=text;}
 async function rpc(action,payload={},g=generation){
  const started=performance.now(),client=auth.client,user=await auth.getUser();if(!current(g))throw Object.assign(Error(),{stale:true});if(!client||!user||user.id!==actor){denied();throw Object.assign(Error(),{stale:true})}
  const result=await client.rpc('campaign_decision_foundation',{p_action:action,p_org:action==='context'?null:context?.organization_id,p_campaign:campaign,p_payload:payload});
  if(!current(g))throw Object.assign(Error(),{stale:true});const now=await auth.getUser();if(!current(g))throw Object.assign(Error(),{stale:true});
  if(!now||now.id!==actor||client!==auth.client){denied();throw Object.assign(Error(),{stale:true})}
  if(result.error||[401,403].includes(result.status)){if(result.error?.code==='42501'||[401,403].includes(result.status)){denied();throw Object.assign(Error(),{stale:true})}throw Object.assign(Error(),{code:result.error?.code})}
  if(action!=='assignment_save'&&action!=='followup_save'&&(result.data?.campaign_id!==campaign||!uuid(result.data?.organization_id)||(context&&result.data.organization_id!==context.organization_id))){denied();throw Object.assign(Error(),{stale:true})}
  if(result.data?.access_expires_at)armExpiry({...result.data,expires_at:result.data.access_expires_at},g,performance.now()-started);
  return result.data;
 }
 function button(text,fn){const g=generation,b=el('button',text,{type:'button'});b.onclick=async()=>{if(!current(g)||!root.contains(b))return;b.disabled=true;try{await fn()}catch(e){if(!e.stale&&current(g))message(e.code==='40001'?'This record changed. Refresh and review its current assignment.':'The result could not be confirmed. Refresh to review before making another change.')}finally{if(current(g))b.disabled=false}};return b;}
 function panel(title){const p=el('section',null,{class:'team-card'});p.append(el('h2',title));root.append(p);return p;}
 function field(form,text,type='text',attrs={}){const key='minden-decision-control-'+(++id),wrap=el('div',null,{class:'team-field'}),l=el('label',text,{for:key}),input=el('input',null,{id:key,type,...attrs});wrap.append(l,input);form.append(wrap);return input;}
 function select(form,text,options){const key='minden-decision-control-'+(++id),wrap=el('div',null,{class:'team-field'}),l=el('label',text,{for:key}),input=el('select',null,{id:key,required:''});for(const[value,text]of options)input.append(el('option',text,{value}));wrap.append(l,input);form.append(wrap);return input;}
 function saveForm(parent,submit,action,build){
  const g=generation,form=el('form',null,{class:'team-form'}),save=el('button',submit,{type:'submit'});let pending=null,busy=false;parent.append(form);
  form.onsubmit=async e=>{e.preventDefault();if(!current(g)||!root.contains(form)||busy||!form.reportValidity())return;
   if(!pending){try{pending={...build(),request_id:crypto.randomUUID()}}catch{message('Review the required fields and finite expiry before saving.');return;}}busy=true;save.disabled=true;
   try{await rpc(action,pending,g);if(current(g))await boot();}
   catch(error){if(!error.stale&&current(g)){if(error.code==='40001'||error.code==='23505'){form.replaceChildren(el('p','This request conflicts with current state. Refresh and review before another change.',{role:'alert'}));}else{for(const input of form.querySelectorAll('input,select'))input.disabled=true;save.textContent='Retry the Same Request';message('The result could not be confirmed. Retry preserves the same request; refresh before making a different change.');}}}
   finally{busy=false;if(current(g))save.disabled=false}
  };form.finish=()=>form.append(save);return form;
 }
 function header(){root.replaceChildren();root.append(el('p','OUTREACH OPERATIONS',{class:'eyebrow'}),el('h1','Minden Decisions'),el('p','Decision review, Family Fun Day attendance and volunteer Team records remain separate. Contact, export and messaging are not enabled.'));
  const nav=el('nav',null,{class:'team-tabs','aria-label':'Decision Views'});if(can('decisions.read'))nav.append(button('My Assigned Decisions',()=>{view='list';page=0;return boot()}));if(can('decisions.assign'))nav.append(button('Assignment Review',()=>{view='queue';return boot()}));nav.append(button('Refresh',boot));root.append(nav);
 }
 async function showList(g){const result=await rpc('list',{page},g);if(!current(g))return;if(!Array.isArray(result.registrations)||result.registrations.length>50)throw Error();const p=panel('My Assigned Decisions');
  p.append(el('p','Only records assigned to your current verified account are shown.'));if(!result.registrations.length)p.append(el('p','No current assigned decisions.'));
  for(const r of result.registrations){if(!uuid(r.registration_id)||typeof r.name!=='string'||!Number.isInteger(r.revision))throw Error();const card=el('article',null,{class:'team-card'});card.append(el('h3',r.name),el('p','Decision: '+label(r.decision)),el('p','Follow-Up Status: '+label(r.status)),button('Review Decision',()=>showDetail(r.registration_id)));p.append(card);}
  if(page>0)p.append(button('Previous Page',()=>{page--;return boot()}));if(result.registrations.length===50)p.append(button('Next Page',()=>{page++;return boot()}));
 }
 async function showDetail(registration){const g=++generation;clearTimeout(expiryTimer);root.replaceChildren(el('p','Checking current decision access…',{role:'status'}));try{
  const fresh=await rpc('context',{},g);if(!current(g))return;context=fresh;armExpiry(fresh,g,0);const r=await rpc('detail',{registration_id:registration},g);if(!current(g))return;
  if(r.registration_id!==registration||typeof r.name!=='string'||!Number.isInteger(r.revision)||r.contact_allowed!==false)throw Error();header();const p=panel(r.name);p.append(el('p','Decision: '+label(r.decision)),el('p','Follow-Up Status: '+label(r.status)));
  if(can('followup.manage')&&r.followup_allowed===true){let state,date;const form=saveForm(p,'Save Follow-Up Review','followup_save',()=>({registration_id:registration,revision:r.revision,status:state.value,next_contact_on:date.value||null}));state=select(form,'Follow-Up Status',['new','needs_contact','attempted','connected','in_progress','completed','declined'].map(v=>[v,label(v)]));state.value=r.status;date=field(form,'Next Review Date','date');date.value=r.next_contact_on||'';form.finish();}
  else p.append(el('p','Follow-up changes are unavailable without current consent and explicit assigned authority.'));
 }catch(e){if(!e.stale&&current(g)){denied()}}}
 async function showQueue(g){const result=await rpc('queue',{},g);if(!current(g))return;if(!Array.isArray(result.queue)||result.queue.length>50)throw Error();const p=panel('Unassigned Decision References');p.append(el('p','References and submission times only. Review independent staff identity and finite authority before assigning.'));
  for(const r of result.queue){if(!uuid(r.registration_id)||!Number.isFinite(Date.parse(r.registered_at)))throw Error();const card=el('article',null,{class:'team-card'});card.append(el('p',r.registration_id),el('p',new Date(r.registered_at).toLocaleString()),button('Review Assignment',()=>showAssignment(r.registration_id)));p.append(card);}if(!result.queue.length)p.append(el('p','No unassigned references.'));
  const form=el('form',null,{class:'team-form'}),input=field(form,'Exact Decision Reference','text',{required:'',maxlength:36,pattern:'[a-fA-F0-9-]{36}'}),submit=el('button','Review Exact Assignment',{type:'submit'});form.append(submit);form.onsubmit=e=>{e.preventDefault();if(current(g)&&root.contains(form)&&form.reportValidity()&&uuid(input.value.trim()))showAssignment(input.value.trim())};p.append(form);
 }
 async function showAssignment(registration){const g=++generation;clearTimeout(expiryTimer);root.replaceChildren(el('p','Checking current assignment authority…',{role:'status'}));try{
  context=await rpc('context',{},g);if(!current(g))return;armExpiry(context,g,0);const row=await rpc('assignment_get',{registration_id:registration},g),choices=await rpc('assignees',{},g);if(!current(g))return;
  if(row.registration_id!==registration||!Number.isInteger(row.revision)||!Array.isArray(choices.assignees)||choices.assignees.some(x=>!uuid(x.user_id)||!Number.isFinite(Date.parse(x.expires_at))))throw Error();header();const p=panel('Review Assignment');p.append(el('p','Decision Reference: '+registration),el('p','Current Staff Reference: '+(row.assigned_user_id||'Unassigned')),el('p','This operation assigns a record only. It creates no account, grant, identity link or message.'));
  let action,target,expiry,reason,confirm;const form=saveForm(p,'Save Assignment Review','assignment_save',()=>{if(!confirm.checked)throw Error();return{registration_id:registration,revision:row.revision,assigned_user_id:action.value==='revoke'?null:target.value,expires_at:action.value==='revoke'?null:new Date(expiry.value).toISOString(),reason:reason.value.trim()}});
  action=select(form,'Assignment Action',[['','Choose…'],['assign','Assign or Reassign'],['revoke','Revoke Assignment']]);target=select(form,'Independently Verified Staff Reference',[['','Choose…'],...choices.assignees.map(x=>[x.user_id,x.user_id+' · Expires '+new Date(x.expires_at).toLocaleString()])]);expiry=field(form,'Finite Assignment Expiry','datetime-local',{required:''});reason=field(form,'Review Reason','text',{required:'',minlength:10,maxlength:500});confirm=field(form,'I independently reviewed the exact decision reference, staff identity and authority','checkbox',{required:''});action.addEventListener('change',()=>{target.required=expiry.required=action.value!=='revoke';target.disabled=expiry.disabled=action.value==='revoke'});form.finish();
 }catch(e){if(!e.stale&&current(g))denied()}}
 function armExpiry(data,g,elapsed){const span=Date.parse(data.expires_at)-Date.parse(data.server_time)-elapsed;if(!Number.isFinite(span)||span<=0)throw Error();expiryTimer=setTimeout(()=>{if(current(g))clear('Your current decision access has expired. Refresh to verify access again.');},Math.min(span,2147483647));}
 async function boot(){if(retired)return;clear();const g=generation,started=performance.now();root.append(el('p','Checking current assigned decision access…',{role:'status'}));try{
  const user=await auth.getUser();if(!current(g))return;if(!user){denied();return;}actor=user.id;const data=await rpc('context',{},g);if(!current(g))return;
  if(data.scope!=='assigned'||!Array.isArray(data.capabilities)||data.capabilities.length===0||data.capabilities.some(x=>!['decisions.read','followup.manage','decisions.assign'].includes(x)))throw Error();context=data;armExpiry(data,g,performance.now()-started);if(view==='list'&&!can('decisions.read'))view='queue';if(view==='queue'&&!can('decisions.assign'))view='list';header();if(view==='list')await showList(g);else await showQueue(g);
 }catch(e){if(!e.stale&&current(g))denied()}}
 const observer=new MutationObserver(retirement);observer.observe(document.documentElement,{childList:true,subtree:true});
 auth.client?.auth.onAuthStateChange(()=>{clear();setTimeout(boot,0)});window.addEventListener('pagehide',()=>clear());window.addEventListener('pageshow',boot);window.addEventListener('focus',boot);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();else boot()});boot();
})();
