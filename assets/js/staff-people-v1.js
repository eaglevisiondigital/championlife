/* People/Staff capability extension; authorization remains in guarded RPCs. */
(() => {
  window.ChampionPeopleV1 = ({auth,getContext,onAccountChange,onPortal,onRelated}) => {
    const root=document.getElementById('people-v1');
    const dialog=document.getElementById('people-v1-detail');
    let generation=0,detailGeneration=0,context=null,selected=null,page=0,tab='overview',busy=false;
    const labels={'people.read':'View people','people.update':'Edit contact details','people.create':'Add people','people.notes.view':'View restricted notes','people.notes.manage':'Manage restricted notes','staff.view':'View staff access','staff.manage':'Manage staff access (trusted provisioning)','finance.read':'View financial information','finance.configure':'Manage financial configuration','discipleship.read':'View discipleship progress'};
    const label=key=>labels[key]||key.replaceAll('.',' · ');
    const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==null)n.textContent=text;for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};
    const button=(text,action)=>{const n=el('button',text,{type:'button'});n.addEventListener('click',action);return n;};
    const field=(form,title,name,type='text',value='')=>{const wrap=el('label',title),input=el('input',null,{name,type});input.value=value||'';wrap.append(input);form.append(wrap);return input;};
    const choose=(form,title,name,options,multiple=false)=>{const wrap=el('label',title),select=el('select',null,{name});select.multiple=multiple;for(const [value,text] of options)select.append(el('option',text,{value}));wrap.append(select);form.append(wrap);return select;};
    const canGlobal=k=>context?.grants.some(g=>g.permission===k&&!g.department_ids);
    const finance=k=>k.startsWith('finance.');
    const relationships=['guest','attendee','member','volunteer','partner','outreach_participant','parent_guardian','youth_student','staff'];
    const filters=el('form',null,{class:'search-bar',role:'search'});
    field(filters,'Name, email or phone','search','search');
    choose(filters,'Relationship','relationship',[['','All relationships'],...relationships.map(k=>[k,k.replaceAll('_',' ')])]);
    const departments=choose(filters,'Department / ministry','department_id',[['','All permitted departments']]);
    choose(filters,'Portal account','portal',[['','All'],['active','Linked'],['inactive','Not linked']]);
    choose(filters,'Staff status','staff',[['','All'],['active','Active staff'],['inactive','Not active staff']]);
    const courseFilter=choose(filters,'Discipleship','course',[['','All permitted people'],['enrolled','Has course enrollment']]);
    filters.append(el('button','Apply filters',{type:'submit'}));
    const status=el('p','',{role:'status','aria-live':'polite'}),cards=el('div',null,{class:'module-grid'}),paging=el('div',null,{class:'pagination'});
    const previous=button('Previous',()=>{page=Math.max(0,page-1);load(false);}),next=button('Next',()=>{page++;load(false);});paging.append(previous,next);
    const templateArea=el('section');root.append(filters,status,cards,paging,templateArea);
    filters.addEventListener('submit',e=>{e.preventDefault();page=0;load(false);});
    const same=(token,org)=>token===generation&&!getContext().invalid&&getContext().organizationId===org;
    async function rpc(action,payload={},org=getContext().organizationId){const {data,error}=await auth.client.rpc('people_workspace',{p_org:org,p_action:action,p_payload:payload});if(error)throw error;return data;}
    function clear(){generation++;detailGeneration++;selected=null;context=null;cards.replaceChildren();templateArea.replaceChildren();status.textContent='';dialog.close();dialog.replaceChildren();busy=false;}
    async function load(reset=true){
      if(reset)page=0;const token=++generation,c=getContext(),org=c.organizationId;
      cards.replaceChildren();templateArea.replaceChildren();dialog.close();detailGeneration++;selected=null;previous.disabled=true;next.disabled=true;
      if(c.invalid)return;status.textContent='Loading your people…';
      try{
        const fresh=await rpc('context',{},org);if(!same(token,org))return;context=fresh;courseFilter.parentElement.hidden=!fresh.grants.some(g=>g.permission==='discipleship.read');
        const current=departments.value;departments.replaceChildren(el('option','All permitted departments',{value:''}),...fresh.departments.map(d=>el('option',d.name,{value:d.id})));departments.value=current;
        if(!departments.value)departments.value='';
        renderTemplateTools();
        const payload=Object.fromEntries(new FormData(filters));payload.page=page;
        const rows=await rpc('list',payload,org);if(!same(token,org))return;
        previous.disabled=page===0;next.disabled=rows.length<=25;status.textContent=`${Math.min(rows.length,25)} people · page ${page+1}`;
        for(const p of rows.slice(0,25)){
          const card=el('article',null,{class:'task-card'}),name=button(`${p.first_name} ${p.last_name}`,()=>open(p.id));name.className='person-name';card.append(name);
          card.append(el('p',[p.email,p.phone].filter(Boolean).join(' · ')||'No contact information'));
          card.append(el('p',[...p.relationships,...p.departments].join(' · ')||'No connections recorded'));
          card.append(el('small',[p.portal_active?'Portal linked':'No portal link',p.staff_active?'Active staff':'No active staff assignment'].join(' · ')));cards.append(card);
        }
      }catch(_){if(same(token,org)){cards.replaceChildren();templateArea.replaceChildren();context=null;status.textContent='People access is unavailable. Your permissions may have changed. Refresh to try again.';}}
    }
    function form(action,title,build,payload){
      const f=el('form',null,{class:'people-form'});f.append(el('h3',title));build(f);const save=el('button','Save',{type:'submit'});f.append(save);
      f.addEventListener('submit',async e=>{e.preventDefault();if(busy||!selected)return;await mutate(action,{person_id:selected.person.id,revision:selected.assignment?.revision||0,...payload(f)},save);});return f;
    }
    async function mutate(action,payload,save){
      const org=getContext().organizationId,person=selected?.person.id,token=detailGeneration;busy=true;save.disabled=true;
      const feedback=dialog.querySelector('[data-feedback]');feedback.textContent='Saving…';
      try{
        if((await auth.getUser())?.id!==getContext().user.id){onAccountChange();return;}
        if(token!==detailGeneration||getContext().invalid)return;
        await rpc(action,payload,org);if(token!==detailGeneration||getContext().organizationId!==org||getContext().invalid)return;
        await open(person,tab);
      }catch(error){if(token===detailGeneration){feedback.textContent='Not saved. Check your authority, scope and dates, then reload if the record changed.';}}
      finally{if(token===detailGeneration){busy=false;save.disabled=false;}}
    }
    async function open(personId,nextTab='overview'){
      const token=++detailGeneration,c=getContext(),org=c.organizationId;busy=false;selected=null;tab=nextTab;
      dialog.replaceChildren(button('Close',()=>{detailGeneration++;selected=null;dialog.close();}),el('p','Loading person…',{role:'status'}));if(!dialog.open)dialog.showModal();
      try{
        const data=await rpc('detail',{person_id:personId},org);
        if(token!==detailGeneration||c.invalid||getContext().organizationId!==org||getContext().invalid)return;selected=data;renderDetail();
      }catch(_){if(token===detailGeneration){dialog.replaceChildren(button('Close',()=>dialog.close()),el('p','This person is unavailable. Your access may have changed.',{role:'status'}));}}
    }
    dialog.addEventListener('cancel',()=>{detailGeneration++;selected=null;});
    function renderDetail(){
      const d=selected,p=d.person;dialog.replaceChildren(button('Close',()=>{detailGeneration++;selected=null;dialog.close();}),el('h2',`${p.first_name} ${p.last_name}`),el('p','',{role:'status','data-feedback':''}));
      const nav=el('nav',null,{'aria-label':'Person sections'});const tabs=['overview','connections','discipleship','activity'];if(d.can_staff)tabs.push('staff');if(!tabs.includes(tab))tab='overview';
      for(const name of tabs){const b=button(name==='staff'?'Staff Access':name[0].toUpperCase()+name.slice(1),()=>{tab=name;renderDetail();});b.setAttribute('aria-pressed',String(name===tab));nav.append(b);}dialog.append(nav);
      const section=el('section');dialog.append(section);
      if(tab==='overview'){
        section.append(el('p',p.email||'Email not provided'),el('p',p.phone||'Phone not provided'),el('p',d.relationships.filter(r=>r.active).map(r=>r.relationship.replaceAll('_',' ')).join(' · ')||'No relationship recorded'));
        if(canGlobal('people.read')&&onRelated)section.append(button('Contact history, households & follow-up',()=>onRelated({...p,organization_id:getContext().organizationId})));
        if(d.can_edit)section.append(form('update','Contact details',f=>{for(const [key,title] of [['first_name','First name'],['last_name','Last name'],['email','Email'],['phone','Phone']]){const i=field(f,title,key,key==='email'?'email':'text',p[key]);i.maxLength=key==='email'?320:key==='phone'?40:100;i.required=key.endsWith('name');}},f=>({...Object.fromEntries(new FormData(f)),updated_at:p.updated_at})));
      }else if(tab==='connections'){
        section.append(el('h3','Organization relationships'));
        for(const relation of d.account_relationships||[])section.append(el('p',relation.replaceAll('_',' ')+' · linked account affiliation'));
        for(const r of d.relationships){const line=el('p',`${r.relationship.replaceAll('_',' ')} · ${r.active?'Active':'Inactive'} · from ${new Date(r.effective_at).toLocaleDateString()}`);if(canGlobal('people.update'))line.append(button(r.active?'End relationship':'Restore relationship',e=>mutate('relationship',{person_id:p.id,id:r.id,active:!r.active},e.currentTarget)));section.append(line);}
        section.append(el('h3','Departments / ministries'));
        for(const dep of d.departments){const line=el('p',`${dep.name} · ${dep.active?'Active':'Inactive'}`);if(canGlobal('people.update'))line.append(button(dep.active?'Remove affiliation':'Restore affiliation',e=>mutate('affiliation',{person_id:p.id,department_id:dep.id,active:!dep.active},e.currentTarget)));section.append(line);}
        section.append(el('p',d.portal_active?'Reviewed portal account linked':'No active portal account link'));
        if(canGlobal('staff.manage')&&canGlobal('portal.manage')&&onPortal)section.append(button('Review portal account link',()=>onPortal({...p,organization_id:getContext().organizationId})));
        if(canGlobal('people.update')){
          section.append(form('relationship','Add relationship',f=>choose(f,'Relationship','relationship',relationships.map(k=>[k,k.replaceAll('_',' ')])),f=>Object.fromEntries(new FormData(f))));
          section.append(form('affiliation','Add department affiliation',f=>choose(f,'Department','department_id',context.departments.map(x=>[x.id,x.name])),f=>Object.fromEntries(new FormData(f))));
        }
      }else if(tab==='discipleship'){
        if(!d.discipleship)section.append(el('p','Progress requires a reviewed portal link and explicit discipleship access.'));
        else if(!d.discipleship.length)section.append(el('p','No enrollments recorded.'));
        else for(const c of d.discipleship){const card=el('article',null,{class:'task-card'});card.append(el('h3',c.title),el('p',`${c.lessons.filter(l=>l.status==='completed').length} of ${c.total_lessons} lessons completed`));for(const l of c.lessons)card.append(el('p',`Lesson ${l.number} · ${l.status.replaceAll('_',' ')}`));section.append(card);}
      }else if(tab==='activity'){
        section.append(el('p','Recorded contact and connection changes.'));
        for(const a of d.activity)section.append(el('p',`${new Date(a.created_at).toLocaleString()} · ${a.kind.replaceAll('_',' ')}`));if(!d.activity.length)section.append(el('p','No activity recorded.'));
      }else renderStaff(section);
    }
    function scopeFields(f){
      choose(f,'Scope','scope',[['organization','Whole organization'],['departments','Selected departments']]);
      choose(f,'Departments (select one or more for department scope)','department_ids',context.departments.map(d=>[d.id,d.name]),true);
      field(f,'Effective date (blank means now)','effective_at','datetime-local');field(f,'Expires (optional)','expires_at','datetime-local');field(f,'Reason (optional)','reason').maxLength=500;
    }
    const dated=f=>{const data=new FormData(f);return {department_ids:data.get('scope')==='departments'?data.getAll('department_ids'):null,effective_at:data.get('effective_at')?new Date(data.get('effective_at')).toISOString():null,expires_at:data.get('expires_at')?new Date(data.get('expires_at')).toISOString():null,reason:data.get('reason')||''};};
    function renderStaff(section){
      const d=selected,s=d.assignment;
      section.append(el('p',s?`Assignment ${s.active?'enabled':'disabled'} · effective ${new Date(s.effective_at).toLocaleString()}${s.expires_at?' · expires '+new Date(s.expires_at).toLocaleString():''}`:'No staff assignment.'));
      section.append(el('p','Staff status does not grant authority. Every capability must be explicitly granted.'));
      if(d.can_manage_staff&&canGlobal('staff.manage')){
        section.append(form('assignment','Staff assignment',f=>{choose(f,'Status','active',[['false','Disabled'],['true','Enabled']]).value=String(s?.active||false);field(f,'Effective','effective_at','datetime-local',s?.effective_at?localTime(s.effective_at):'');field(f,'Expires (optional)','expires_at','datetime-local',s?.expires_at?localTime(s.expires_at):'');field(f,'Internal reason','reason','text',s?.reason).maxLength=500;},f=>{const v=Object.fromEntries(new FormData(f));return {active:v.active==='true',effective_at:v.effective_at?new Date(v.effective_at).toISOString():null,expires_at:v.expires_at?new Date(v.expires_at).toISOString():null,reason:v.reason};}));
      }
      for(const isFinance of [false,true]){
        const block=el('section',null,{class:isFinance?'financial-access':'ordinary-access'});block.append(el('h3',isFinance?'Financial access — separately authorized':'Explicit permissions'));
        if(isFinance)block.append(el('p','Restricted financial information and configuration. Staff titles, membership and ministry service never provide this access.'));
        for(const g of (d.grants||[]).filter(g=>finance(g.permission)===isFinance)){
          const scope=g.department_ids?g.department_ids.map(id=>context.departments.find(x=>x.id===id)?.name||'Restricted department').join(', '):'Whole organization';
          const line=el('article',null,{class:'task-card'});line.append(el('p',`${label(g.permission)} · ${scope} · ${g.revoked_at?'Revoked':g.expires_at&&new Date(g.expires_at)<=new Date()?'Expired':'Granted'}`));
          if(g.expires_at)line.append(el('p','Expires '+new Date(g.expires_at).toLocaleString()));
          if(d.can_manage_staff&&!g.revoked_at&&g.permission!=='staff.manage')line.append(button('Revoke',e=>mutate('grant',{person_id:d.person.id,revision:s.revision,permission:g.permission,department_ids:g.department_ids,revoke:true},e.currentTarget)));block.append(line);
        }
        const owned=context.grants.filter(g=>finance(g.permission)===isFinance&&g.permission!=='staff.manage');
        if(d.can_manage_staff&&s&&owned.length)block.append(form('grant',isFinance?'Grant financial capability':'Grant or change capability',f=>{choose(f,'Capability','permission',owned.map(g=>[g.permission,label(g.permission)]));scopeFields(f);},f=>({permission:new FormData(f).get('permission'),...dated(f)})));
        section.append(block);
      }
      if(d.can_manage_staff&&s&&context.templates.length){
        section.append(form('role','Apply role template',f=>{choose(f,'Template','template_id',context.templates.map(t=>[t.id,t.name+(t.permissions.some(finance)?' — includes financial permissions':'')]));scopeFields(f);f.append(el('p','Templates apply explicit grants at the selected scope. Later template edits do not silently change existing access.'));},f=>({template_id:new FormData(f).get('template_id'),...dated(f)})));
        for(const template of context.templates.filter(t=>(d.grants||[]).some(g=>g.template_id===t.id&&!g.revoked_at)))section.append(button('Remove template grants: '+template.name,e=>mutate('remove_role',{person_id:d.person.id,revision:s.revision,template_id:template.id,department_ids:(d.grants||[]).find(g=>g.template_id===template.id&&!g.revoked_at)?.department_ids},e.currentTarget)));
      }
      section.append(el('h3','Access audit'));
      for(const e of d.audit||[]){const event=el('article',null,{class:'task-card'});event.append(el('p',`${new Date(e.created_at).toLocaleString()} · ${e.after_state.operation||'Access changed'} · ${e.actor_user_id===getContext().user.id?'You':'Authorized staff'}`));if(e.after_state.assignment)event.append(el('p',e.after_state.assignment.active?'Assignment enabled':'Assignment disabled'));for(const g of e.after_state.grants||[])event.append(el('p',`${label(g.permission)} · ${g.revoked_at?'revoked':'granted'} · ${g.department_ids?g.department_ids.map(id=>context.departments.find(x=>x.id===id)?.name||'Department').join(', '):'whole organization'}`));section.append(event);}
      if(!d.audit?.length)section.append(el('p','No audit entries available for your scope.'));
    }
    function localTime(value){const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
    function renderTemplateTools(){
      templateArea.replaceChildren();if(!canGlobal('staff.manage'))return;
      const details=el('details'),summary=el('summary','Role template configuration');details.append(summary,el('p','Bundles only; creating a template grants nobody access.'));
      for(const t of context.templates)details.append(el('p',`${t.name}: ${t.permissions.map(label).join(', ')}`));
      const f=el('form',null,{class:'people-form'});const templateSelect=choose(f,'Template','id',[['','New template'],...context.templates.map(t=>[t.id,t.name])]);field(f,'Template name','name').required=true;
      for(const financial of [false,true]){const box=el('fieldset',null,{class:financial?'financial-access':''});box.append(el('legend',financial?'Financial capabilities (explicit)':'Capabilities'));for(const g of context.grants.filter(g=>!g.department_ids&&g.permission!=='staff.manage'&&finance(g.permission)===financial)){const i=field(box,label(g.permission),'permissions','checkbox');i.value=g.permission;}f.append(box);}
      templateSelect.addEventListener('change',()=>{const t=context.templates.find(t=>t.id===templateSelect.value);f.elements.name.value=t?.name||'';for(const input of f.querySelectorAll('input[type=checkbox]'))input.checked=t?.permissions.includes(input.value)||false;});
      const save=el('button','Save template',{type:'submit'}),msg=el('p','',{role:'status'});f.append(save,msg);f.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;const token=generation,org=getContext().organizationId;try{const data=new FormData(f);await rpc('template',{id:data.get('id')||null,revision:context.templates.find(t=>t.id===data.get('id'))?.revision,name:data.get('name'),permissions:data.getAll('permissions')},org);if(same(token,org))await load(false);}catch(_){if(same(token,org))msg.textContent='Template not saved. Check your permissions and name.';}finally{save.disabled=false;}});details.append(f);templateArea.append(details);
    }
    return {load,clear,open};
  };
})();
