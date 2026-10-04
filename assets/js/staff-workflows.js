(() => {
  window.ChampionWorkflows=({auth,getContext,onAccountChange,onTask})=>{
    const $=id=>document.getElementById(id),size=25;
    let generation=0,ruleToken=0,historyToken=0,actionToken=0,page=0,rule=null,busy=false;
    const canRead=c=>!c.invalid&&['people.read','tags.read','followup.read'].every(p=>c.can(p));
    const canManage=c=>canRead(c)&&c.can('tags.manage')&&c.can('followup.manage');
    const canConfigure=c=>canManage(c)&&c.can('staff.manage');
    const reasons={assignment_removed:'Tag was removed',assignment_superseded:'A newer assignment replaced this one',already_processed:'This person already received follow-up for this tag',workflow_paused:'Workflow or department is paused',department_changed:'The tag now belongs to another department',leader_unavailable:'Department leader is missing or no longer eligible',task_creation_failed:'Task could not be created; review configuration and retry',staff_dismissed:'Dismissed by authorized staff'};
    function clear(){generation++;ruleToken++;historyToken++;actionToken++;page=0;rule=null;busy=false;$('workflow-list').replaceChildren();$('workflow-history').replaceChildren();$('workflow-rule-form').reset();$('workflow-rule-dialog').close();$('workflow-history-dialog').close();for(const id of ['workflow-status','workflow-rule-summary','workflow-rule-status','workflow-history-status'])$(id).textContent='';$('workflow-rule-title').textContent='Tag workflow';}
    function button(label,action,parent){const b=document.createElement('button');b.textContent=label;b.disabled=busy;b.addEventListener('click',action);parent.append(b);}
    async function load(){const c=getContext(),token=++generation;$('workflow-list').replaceChildren();$('workflow-prev').disabled=true;$('workflow-next').disabled=true;
      if(!canRead(c)){$('workflow-status').textContent='People, tag and follow-up viewing access are required.';return;}$('workflow-status').textContent='Loading workflows...';
      try{let q=auth.client.from('tag_workflow_runs').select('id,organization_id,person_id,task_id,status,reason,attempts,revision,created_at,due_on,task_title,rule_snapshot,person:organization_people(first_name,last_name),notifications:tag_workflow_notifications(status)').eq('organization_id',c.organizationId);
        const filter=$('workflow-filter').value;if(['needs_review','task_created','skipped','dismissed'].includes(filter))q=q.eq('status',filter);
        const {data,error}=await q.order('created_at',{ascending:false}).order('id').range(page*size,page*size+size);
        if(token!==generation||getContext().invalid)return;if(error)throw error;$('workflow-prev').disabled=page===0;$('workflow-next').disabled=(data||[]).length<=size;
        $('workflow-status').textContent=`Page ${page+1}. ${(data||[]).slice(0,size).length} runs shown. Email delivery is not active.`;
        for(const run of (data||[]).slice(0,size)){const card=document.createElement('article');card.className='task-card';const title=document.createElement('h3');title.textContent=run.rule_snapshot?.tag_name||'Tag workflow';const person=document.createElement('p');person.textContent=run.person?[run.person.first_name,run.person.last_name].join(' '):'Organization contact';
          const detail=document.createElement('p');detail.textContent=[run.status.replace(/_/g,' '),reasons[run.reason]||'',run.task_title,run.due_on?'Due '+run.due_on:'No due date','Attempts: '+run.attempts].filter(Boolean).join(' · ');
          const notifications=Array.isArray(run.notifications)?run.notifications:run.notifications?[run.notifications]:[];
          const mail=document.createElement('p');mail.textContent=notifications.some(n=>n.status==='held')?'Leader email: held, not sent':notifications.length?'Leader email: canceled':'No email request created';
          const actions=document.createElement('div');actions.className='actions';button('History',()=>history(run),actions);
          if(run.task_id)button('Open task',()=>openTask(run),actions);
          if(canManage(c)&&run.status==='needs_review'){button('Retry routing',()=>resolve(run,'retry'),actions);button('Dismiss',()=>resolve(run,'dismiss'),actions);}
          if(canManage(c)&&notifications.some(n=>n.status==='held'))button('Cancel held email',()=>resolve(run,'cancel_email'),actions);
          card.append(title,person,detail,mail,actions);$('workflow-list').append(card);}
      }catch(_){if(token===generation&&!getContext().invalid)$('workflow-status').textContent='Workflows could not load. Refresh to try again.';}
    }
    async function openRule(tag){const c=getContext();if(!canConfigure(c))return;const token=++ruleToken;rule=null;$('workflow-rule-title').textContent='Workflow: '+tag.name;$('workflow-rule-summary').textContent='Loading the latest rule...';$('workflow-rule-status').textContent='';$('workflow-rule-save').disabled=true;$('workflow-rule-dialog').showModal();
      try{const {data,error}=await auth.client.from('organization_tags').select('id,name,revision,workflow_enabled,workflow_timezone,workflow_reentry,task_title,due_after_days,department:organization_departments(name,leader_user_id,active)').eq('organization_id',c.organizationId).eq('id',tag.id).maybeSingle();
        if(token!==ruleToken||getContext().invalid)return;if(error||!data)throw new Error('Unavailable');rule={...data,organizationId:c.organizationId};$('workflow-rule-enabled').checked=data.workflow_enabled;$('workflow-rule-timezone').value=data.workflow_timezone;$('workflow-rule-reentry').value=data.workflow_reentry;
        $('workflow-rule-summary').textContent=[data.department?.name||'Department unavailable',data.department?.leader_user_id?'Leader assigned':'No leader assigned','Task: '+data.task_title,data.due_after_days===null?'No due date':'Due '+data.due_after_days+' days after assignment'].join(' · ');$('workflow-rule-save').disabled=false;
      }catch(_){if(token===ruleToken&&!getContext().invalid)$('workflow-rule-status').textContent='Rule could not load. Close and try again.';}
    }
    $('workflow-rule-form').addEventListener('submit',async e=>{e.preventDefault();const c=getContext();if(!rule||!canConfigure(c)||$('workflow-rule-save').disabled)return;const snapshot=rule,token=ruleToken;
      const args={p_org:snapshot.organizationId,p_tag:snapshot.id,p_revision:snapshot.revision,p_enabled:$('workflow-rule-enabled').checked,p_timezone:$('workflow-rule-timezone').value.trim(),p_reentry:$('workflow-rule-reentry').value};$('workflow-rule-save').disabled=true;$('workflow-rule-status').textContent='Saving...';
      try{if((await auth.getUser())?.id!==c.user.id){onAccountChange();return;}if(token!==ruleToken||getContext().invalid)return;const {error}=await auth.client.rpc('configure_tag_workflow',args);
        if(token!==ruleToken||getContext().invalid)return;if(error)throw error;$('workflow-rule-dialog').close();rule=null;document.dispatchEvent(new Event('champion-workflow-rule-saved'));
      }catch(_){if(token===ruleToken&&!getContext().invalid)$('workflow-rule-status').textContent='Not saved. Verify an eligible leader, active department, valid timezone, task title of at most 180 characters and current administrator access. Reload if the rule changed.';}
      finally{if(token===ruleToken)$('workflow-rule-save').disabled=false;}
    });
    async function resolve(run,action){const c=getContext();if(!canManage(c)||busy)return;const token=++actionToken;busy=true;$('workflow-list').querySelectorAll('button').forEach(b=>b.disabled=true);$('workflow-status').textContent='Updating workflow...';
      try{if((await auth.getUser())?.id!==c.user.id){onAccountChange();return;}if(token!==actionToken||getContext().invalid)return;
        const {error}=await auth.client.rpc('resolve_tag_workflow',{p_org:c.organizationId,p_run:run.id,p_revision:run.revision,p_action:action});
        if(token!==actionToken||getContext().invalid)return;if(error)throw error;busy=false;await load();
      }catch(_){if(token===actionToken&&!getContext().invalid)$('workflow-status').textContent='Workflow not updated. Refresh to check its current state and your access.';}
      finally{if(token===actionToken){busy=false;$('workflow-list').querySelectorAll('button').forEach(b=>b.disabled=false);}}
    }
    async function history(run){const c=getContext(),token=++historyToken;if(!canRead(c))return;$('workflow-history').replaceChildren();$('workflow-history-status').textContent='Loading history...';$('workflow-history-dialog').showModal();
      try{const {data,error}=await auth.client.from('tag_workflow_events').select('action,details,created_at').eq('organization_id',c.organizationId).eq('run_id',run.id).order('created_at',{ascending:false}).order('id').limit(30);
        if(token!==historyToken||getContext().invalid)return;if(error)throw error;$('workflow-history-status').textContent='Most recent 30 actions.';
        for(const event of data||[]){const li=document.createElement('li');li.textContent=[new Date(event.created_at).toLocaleString(),event.action.replace(/_/g,' '),event.details?.status?.replace(/_/g,' '),reasons[event.details?.reason]||''].filter(Boolean).join(' · ');$('workflow-history').append(li);}
      }catch(_){if(token===historyToken&&!getContext().invalid)$('workflow-history-status').textContent='History could not load.';}
    }
    async function openTask(run){const c=getContext(),token=generation;if(!canRead(c))return;
      try{const {data,error}=await auth.client.from('followup_tasks').select('id,organization_id,person_id,title,status,due_on,assigned_user_id,revision,person:organization_people(first_name,last_name)').eq('organization_id',c.organizationId).eq('id',run.task_id).maybeSingle();
        if(token!==generation||getContext().invalid)return;if(error||!data)throw new Error('Unavailable');if(c.can('followup.manage'))onTask(data);else $('workflow-status').textContent='You have view-only follow-up access. Task: '+data.title+' ('+data.status+').';
      }catch(_){if(token===generation&&!getContext().invalid)$('workflow-status').textContent='Task could not load. Refresh to try again.';}
    }
    const closeRule=()=>{ruleToken++;rule=null;$('workflow-rule-dialog').close();};const closeHistory=()=>{historyToken++;$('workflow-history-dialog').close();$('workflow-history').replaceChildren();};
    $('workflow-rule-cancel').addEventListener('click',closeRule);$('workflow-rule-dialog').addEventListener('cancel',closeRule);$('workflow-history-close').addEventListener('click',closeHistory);$('workflow-history-dialog').addEventListener('cancel',closeHistory);
    $('workflow-filter').addEventListener('change',()=>{if(busy)return;page=0;load();});$('workflow-refresh').addEventListener('click',()=>{if(!busy)load();});$('workflow-prev').addEventListener('click',()=>{if(busy)return;if(page>0)page--;load();});$('workflow-next').addEventListener('click',()=>{if(busy)return;page++;load();});
    return {load,clear,openRule};
  };
})();
