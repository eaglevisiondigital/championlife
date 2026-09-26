(() => {
  window.ChampionPersonDetail = ({auth,getContext,onEdit,onFollowup,onUpdateTask}) => {
    const $=id=>document.getElementById(id);
    let selected=null,tab='contact',generation=0,taskPage=0;
    function clear(){generation++;selected=null;taskPage=0;$('person-detail').close();$('detail-name').textContent='Person';$('detail-contact').replaceChildren();$('detail-history').replaceChildren();$('detail-tasks').replaceChildren();$('detail-status').textContent='';}
    function current(token,org){const c=getContext();return token===generation&&!c.invalid&&c.organizationId===org&&$('person-detail').open;}
    function setTab(name){if(!['contact','history','tasks'].includes(name))return;tab=name;document.querySelectorAll('[data-person-tab]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.personTab===tab));});for(const name of ['contact','history','tasks'])$('detail-'+name+'-panel').hidden=name!==tab;load();}
    async function load(){
      const c=getContext(),token=++generation,org=c.organizationId;
      $('detail-contact').replaceChildren();$('detail-history').replaceChildren();$('detail-tasks').replaceChildren();$('detail-task-previous').disabled=true;$('detail-task-next').disabled=true;
      $('detail-edit').hidden=true;$('detail-followup').hidden=true;
      if(!selected||c.invalid||!c.can('people.read')){$('detail-status').textContent='Contact access is unavailable.';return;}
      $('detail-status').textContent='Loading record...';
      try{
        const {data:person,error}=await auth.client.from('organization_people').select('id,organization_id,first_name,last_name,email,phone,updated_at').eq('organization_id',org).eq('id',selected.id).maybeSingle();
        if(!current(token,org))return;
        if(error||!person){$('detail-name').textContent='Person';$('detail-status').textContent='This record is unavailable. Your access may have changed.';selected=null;return;}
        selected=person;$('detail-name').textContent=[person.first_name,person.last_name].join(' ');$('detail-edit').hidden=!c.can('people.update');$('detail-followup').hidden=!(c.can('followup.read')&&c.can('followup.manage'));
        if(tab==='contact'){
          for(const [label,value] of [['Email',person.email],['Phone',person.phone],['Updated',new Date(person.updated_at).toLocaleString()]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value||'Not provided';$('detail-contact').append(dt,dd);}
          $('detail-status').textContent='Contact details for the selected organization.';
        }else if(tab==='history'){
          const {data,error}=await auth.client.from('organization_admin_events').select('id,kind,actor_user_id,before_state,after_state,created_at').eq('organization_id',org).eq('subject_id',person.id).in('kind',['person_created','person_updated']).order('created_at',{ascending:false}).order('id').limit(30);
          if(!current(token,org))return;if(error)throw error;
          $('detail-status').textContent=data?.length?'Latest contact changes (up to 30).':'No recorded contact changes yet.';
          for(const event of data||[]){const li=document.createElement('li'),heading=document.createElement('strong');heading.textContent=[event.kind==='person_created'?'Contact added':'Contact updated',new Date(event.created_at).toLocaleString(),event.actor_user_id===c.user.id?'You':'Authorized staff'].join(' · ');li.append(heading);
            for(const [key,label] of [['first_name','First name'],['last_name','Last name'],['email','Email'],['phone','Phone']]){
              const before=event.before_state?.[key]||'',after=event.after_state?.[key]||'';if(before===after)continue;
              const change=document.createElement('p');change.textContent=label+': '+(before||'Not provided')+' → '+(after||'Not provided');li.append(change);
            }$('detail-history').append(li);
          }
        }else{
          if(!c.can('followup.read')){$('detail-status').textContent='Follow-up access has not been assigned.';return;}
          const {data,error}=await auth.client.from('followup_tasks').select('id,organization_id,person_id,title,status,due_on,assigned_user_id,revision').eq('organization_id',org).eq('person_id',person.id).order('created_at',{ascending:false}).order('id').range(taskPage*25,taskPage*25+25);
          if(!current(token,org))return;if(error)throw error;
          const tasks=(data||[]).slice(0,25);$('detail-status').textContent=tasks.length?'Follow-up for this person · page '+(taskPage+1):'No follow-up tasks on this page.';$('detail-task-previous').disabled=taskPage===0;$('detail-task-next').disabled=(data||[]).length<=25;
          for(const task of tasks){const article=document.createElement('article');article.className='task-card';const title=document.createElement('h3'),meta=document.createElement('p');title.textContent=task.title;meta.textContent=[task.status,task.due_on?'Due '+task.due_on:'No due date',task.assigned_user_id===c.user.id?'Assigned to me':task.assigned_user_id?'Assigned to staff':'Unassigned'].join(' · ');article.append(title,meta);
            if(c.can('followup.manage')){const button=document.createElement('button');button.textContent='Update task';button.addEventListener('click',()=>onUpdateTask({...task,person}));article.append(button);}$('detail-tasks').append(article);
          }
        }
      }catch(_){if(current(token,org))$('detail-status').textContent='Record could not be loaded. Refresh to try again.';}
    }
    function open(person){const c=getContext();if(c.invalid||!c.can('people.read'))return;selected={...person};taskPage=0;$('detail-name').textContent='Person';if(!$('person-detail').open)$('person-detail').showModal();setTab('contact');}
    document.querySelectorAll('[data-person-tab]').forEach(button=>button.addEventListener('click',()=>setTab(button.dataset.personTab)));
    $('detail-close').addEventListener('click',clear);$('person-detail').addEventListener('cancel',clear);$('detail-refresh').addEventListener('click',load);
    $('detail-edit').addEventListener('click',()=>{if(selected)onEdit(selected)});$('detail-followup').addEventListener('click',()=>{if(selected)onFollowup(selected)});
    $('detail-task-previous').addEventListener('click',()=>{if(taskPage>0)taskPage--;load();});$('detail-task-next').addEventListener('click',()=>{taskPage++;load();});
    return {open,clear,refresh:load,isOpen:()=>$('person-detail').open};
  };
})();
