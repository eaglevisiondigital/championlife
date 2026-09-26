(() => {
  window.ChampionTags=({auth,getContext,onAccountChange})=>{
    const $=id=>document.getElementById(id),size=25;
    let generation=0,editToken=0,lookupToken=0,personToken=0,searchToken=0,page=0,personPage=0,editing=null,person=null,busy=false;
    const permitted=c=>!c.invalid&&c.can('people.read')&&c.can('tags.read');
    const manage=c=>permitted(c)&&c.can('tags.manage');
    const table=()=> $('tags-kind').value==='departments'?'organization_departments':'organization_tags';
    const escaped=s=>s.replace(/[\\%_]/g,'\\$&');
    const option=(select,value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);};
    function clear(){generation++;editToken++;lookupToken++;personToken++;searchToken++;page=0;personPage=0;editing=null;person=null;busy=false;
      for(const id of ['tags-list','person-tags-list','tag-department','tag-leader','person-tag-choice'])$(id).replaceChildren();
      for(const id of ['tags-status','person-tags-status','tag-save-status','tag-leader-status','tag-department-status','person-tag-search-status'])$(id).textContent='';
      $('person-tags-title').textContent='Person tags';$('tag-form').reset();$('person-tag-form').reset();$('tag-editor').close();$('person-tags-dialog').close();
    }
    async function load(){const c=getContext(),token=++generation;$('tags-list').replaceChildren();$('tags-add').hidden=!manage(c);$('tags-prev').disabled=true;$('tags-next').disabled=true;
      if(!permitted(c)){$('tags-status').textContent='Tag access has not been assigned.';return;}
      $('tags-status').textContent='Loading...';
      try{const {data,error}=await auth.client.from(table()).select('*').eq('organization_id',c.organizationId).eq('active',$('tags-filter').value==='true').order('name').order('id').range(page*size,page*size+size);
        if(token!==generation||getContext().invalid)return;if(error)throw error;
        $('tags-prev').disabled=page===0;$('tags-next').disabled=(data||[]).length<=size;$('tags-status').textContent=`Page ${page+1}. ${(data||[]).slice(0,size).length} records shown.`;
        for(const row of (data||[]).slice(0,size)){const card=document.createElement('article');card.className='task-card';const title=document.createElement('h3');title.textContent=row.name;card.append(title);
          const text=document.createElement('p');text.textContent=table()==='organization_tags'?row.task_title:(row.leader_user_id?'Leader assigned':'Leader not assigned');card.append(text);
          if(manage(c)){const b=document.createElement('button');b.textContent='Edit';b.addEventListener('click',()=>open(row));card.append(b);}$('tags-list').append(card);}
      }catch(_){if(token===generation&&!getContext().invalid)$('tags-status').textContent='Records could not load. Refresh to try again.';}
    }
    async function departments(){const c=getContext(),token=++lookupToken,edit=editToken;if(!editing)return;$('tag-department').replaceChildren();$('tag-department-status').textContent='Loading departments...';
      try{let q=auth.client.from('organization_departments').select('id,name').eq('organization_id',c.organizationId).eq('active',true);const term=$('tag-department-search').value.trim();if(term)q=q.ilike('name','%'+escaped(term)+'%');
        const {data,error}=await q.order('name').order('id').limit(50);if(token!==lookupToken||edit!==editToken||getContext().invalid)return;if(error)throw error;
        option($('tag-department'),'','Choose a department');for(const row of data||[])option($('tag-department'),row.id,row.name);
        if(editing.row?.department_id){if(!(data||[]).some(x=>x.id===editing.row.department_id))option($('tag-department'),editing.row.department_id,'Keep current department');$('tag-department').value=editing.row.department_id;}
        $('tag-department-status').textContent='Up to 50 active departments. Refine the search if needed.';
      }catch(_){if(token===lookupToken&&edit===editToken&&!getContext().invalid)$('tag-department-status').textContent='Departments could not load. Search again.';}
    }
    async function open(row=null){const c=getContext();if(!manage(c))return;const token=++editToken;lookupToken++;editing={row,table:table(),organizationId:c.organizationId};$('tag-form').reset();
      const isTag=editing.table==='organization_tags';$('tag-editor-title').textContent=(row?'Edit ':'Create ')+(isTag?'tag':'department');$('tag-name').value=row?.name||'';
      $('tag-department-fields').hidden=!isTag;$('tag-leader-fields').hidden=isTag;$('tag-department').required=isTag;$('tag-task-title').required=isTag;
      $('tag-task-title').value=row?.task_title||'Connect with this person';$('tag-due-days').value=row?.due_after_days??'';$('tag-active-label').hidden=!row;$('tag-active').value=String(row?.active??true);
      $('tag-save-status').textContent='';$('tag-save').disabled=false;$('tag-leader').replaceChildren();option($('tag-leader'),'','Unassigned');
      if(row?.leader_user_id){option($('tag-leader'),row.leader_user_id,'Keep current leader');$('tag-leader').value=row.leader_user_id;}
      $('tag-editor').showModal();if(isTag){departments();return;}
      $('tag-leader-status').textContent='Loading eligible staff...';
      if(!c.can('followup.read')){$('tag-leader-status').textContent='View follow-up access is required to browse eligible leaders. You can leave this unassigned.';return;}
      try{const {data,error}=await auth.client.rpc('list_staff_directory',{p_org:c.organizationId,p_for_assignment:true});if(token!==editToken||getContext().invalid)return;if(error)throw error;
        for(const member of data||[])if(member.user_id!==row?.leader_user_id)option($('tag-leader'),member.user_id,member.display_name);
        $('tag-leader-status').textContent='Leaders require contact and follow-up access. Assignment grants no additional access.';
      }catch(_){if(token===editToken&&!getContext().invalid)$('tag-leader-status').textContent='Staff could not load. Close and try again to choose a leader.';}
    }
    $('tag-form').addEventListener('submit',async e=>{e.preventDefault();const c=getContext();if(!editing||!manage(c)||$('tag-save').disabled)return;
      const snapshot=editing,token=editToken,isTag=snapshot.table==='organization_tags',values={name:$('tag-name').value.trim()};
      if(isTag){values.department_id=$('tag-department').value;values.task_title=$('tag-task-title').value.trim();values.due_after_days=$('tag-due-days').value===''?null:Number($('tag-due-days').value);
        if(!values.department_id||!values.task_title||(values.due_after_days!==null&&(!Number.isInteger(values.due_after_days)||values.due_after_days<0||values.due_after_days>365)))return;
      }else values.leader_user_id=$('tag-leader').value||null;
      if(!values.name)return;if(snapshot.row)values.active=$('tag-active').value==='true';$('tag-save').disabled=true;$('tag-save-status').textContent='Saving...';
      try{if((await auth.getUser())?.id!==c.user.id){onAccountChange();return;}if(token!==editToken||getContext().invalid)return;
        const q=snapshot.row?auth.client.from(snapshot.table).update(values).eq('organization_id',snapshot.organizationId).eq('id',snapshot.row.id).eq('revision',snapshot.row.revision):auth.client.from(snapshot.table).insert({...values,organization_id:snapshot.organizationId});
        const {data,error}=await q.select('id').maybeSingle();if(token!==editToken||getContext().invalid)return;if(error||!data)throw new Error('Not saved');
        $('tag-editor').close();editing=null;await load();
      }catch(_){if(token===editToken&&!getContext().invalid)$('tag-save-status').textContent='Not saved. Check the name, active department, eligible leader and your access. Refresh if someone changed this record.';}
      finally{if(token===editToken)$('tag-save').disabled=false;}
    });
    async function openPerson(row){if(!permitted(getContext()))return;personToken++;searchToken++;busy=false;person=row;personPage=0;$('person-tag-form').reset();$('person-tag-choice').replaceChildren();$('person-tag-search-status').textContent='';$('person-tags-title').textContent=[row.first_name,row.last_name,'tags'].join(' ');$('person-tags-dialog').showModal();await loadPerson();}
    async function loadPerson(){const c=getContext(),token=++personToken;if(!person||!permitted(c))return;$('person-tags-list').replaceChildren();$('person-tags-prev').disabled=true;$('person-tags-next').disabled=true;$('person-tag-form').hidden=!manage(c);$('person-tag-add').disabled=busy;$('person-tags-status').textContent='Loading tags...';
      try{const {data,error}=await auth.client.from('organization_person_tags').select('id,tag_id,active,revision,tag:organization_tags(name)').eq('organization_id',c.organizationId).eq('person_id',person.id).order('created_at').order('id').range(personPage*size,personPage*size+size);
        if(token!==personToken||getContext().invalid)return;if(error)throw error;$('person-tags-prev').disabled=personPage===0;$('person-tags-next').disabled=(data||[]).length<=size;
        $('person-tags-status').textContent=`Page ${personPage+1}. Removed tags remain in history. Automatic follow-up is not active yet.`;
        for(const row of (data||[]).slice(0,size)){const div=document.createElement('div');div.className='task-card';const text=document.createElement('p');text.textContent=(row.tag?.name||'Tag')+(row.active?'':' (removed)');div.append(text);
          if(manage(c)){const b=document.createElement('button');b.textContent=row.active?'Remove':'Restore';b.disabled=busy;b.addEventListener('click',()=>saveAssignment(row));div.append(b);}$('person-tags-list').append(div);}
      }catch(_){if(token===personToken&&!getContext().invalid)$('person-tags-status').textContent='Person tags could not load. Close and reopen to retry.';}
    }
    async function findTags(){const c=getContext(),token=++searchToken,pt=personToken;if(!person||!manage(c))return;$('person-tag-choice').replaceChildren();$('person-tag-search-status').textContent='Searching...';
      try{const {data,error}=await auth.client.from('organization_tags').select('id,name').eq('organization_id',c.organizationId).eq('active',true).ilike('name','%'+escaped($('person-tag-search').value.trim())+'%').order('name').order('id').limit(50);
        if(token!==searchToken||pt!==personToken||getContext().invalid)return;if(error)throw error;for(const row of data||[])option($('person-tag-choice'),row.id,row.name);
        $('person-tag-search-status').textContent='Up to 50 active tags. Refine the search if needed. Restore a removed tag from the list above.';
      }catch(_){if(token===searchToken&&pt===personToken&&!getContext().invalid)$('person-tag-search-status').textContent='Tags could not load. Try again.';}
    }
    async function saveAssignment(row=null){const c=getContext();if(!person||!manage(c)||busy)return;const snapshot=person,token=personToken,tag=$('person-tag-choice').value;if(!row&&!tag)return;busy=true;
      $('person-tag-add').disabled=true;$('person-tags-list').querySelectorAll('button').forEach(b=>b.disabled=true);$('person-tags-status').textContent='Saving...';
      try{if((await auth.getUser())?.id!==c.user.id){onAccountChange();return;}if(token!==personToken||getContext().invalid)return;
        const q=row?auth.client.from('organization_person_tags').update({active:!row.active}).eq('organization_id',c.organizationId).eq('person_id',snapshot.id).eq('id',row.id).eq('revision',row.revision):auth.client.from('organization_person_tags').insert({organization_id:c.organizationId,person_id:snapshot.id,tag_id:tag});
        const {data,error}=await q.select('id').maybeSingle();if(token!==personToken||getContext().invalid)return;if(error||!data)throw new Error('Not saved');busy=false;await loadPerson();
      }catch(_){if(token===personToken&&!getContext().invalid)$('person-tags-status').textContent='Tag not saved. It may already be assigned, archived, changed, or outside your access. Close and reopen before retrying.';}
      finally{if(token===personToken){busy=false;$('person-tag-add').disabled=false;$('person-tags-list').querySelectorAll('button').forEach(b=>b.disabled=false);}}
    }
    const closeEditor=()=>{editToken++;lookupToken++;editing=null;$('tag-editor').close();};
    const closePerson=()=>{personToken++;searchToken++;person=null;busy=false;$('person-tags-dialog').close();$('person-tags-list').replaceChildren();$('person-tag-choice').replaceChildren();};
    $('tag-cancel').addEventListener('click',closeEditor);$('tag-editor').addEventListener('cancel',closeEditor);$('person-tags-close').addEventListener('click',closePerson);$('person-tags-dialog').addEventListener('cancel',closePerson);
    $('tags-add').addEventListener('click',()=>open());$('tags-refresh').addEventListener('click',load);$('tag-find-department').addEventListener('click',departments);$('person-tag-find').addEventListener('click',findTags);$('person-tag-form').addEventListener('submit',e=>{e.preventDefault();saveAssignment();});
    for(const id of ['tags-kind','tags-filter'])$(id).addEventListener('change',()=>{page=0;load();});
    $('tags-prev').addEventListener('click',()=>{if(page>0)page--;load();});$('tags-next').addEventListener('click',()=>{page++;load();});
    $('person-tags-prev').addEventListener('click',()=>{if(busy)return;if(personPage>0)personPage--;loadPerson();});$('person-tags-next').addEventListener('click',()=>{if(busy)return;personPage++;loadPerson();});
    return {load,clear,openPerson};
  };
})();
