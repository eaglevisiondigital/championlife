(() => {
 window.ChampionHouseholds=({auth,getContext,onAccountChange})=>{
  const $=id=>document.getElementById(id);let generation=0,editorToken=0,searchToken=0,page=0,memberPage=0,selected=null,editing=null;
  const allowed=()=>{const c=getContext();return !c.invalid&&c.can('people.read')&&c.can('households.read');};
  const manage=()=>allowed()&&getContext().can('households.manage');
  const current=(token,org)=>token===generation&&!getContext().invalid&&getContext().organizationId===org;
  function clear(){generation++;editorToken++;searchToken++;page=0;memberPage=0;selected=null;editing=null;for(const id of ['house-list','house-members','house-history','house-person-options'])$(id).replaceChildren();$('house-editor').close();$('house-form').reset();$('house-member-add').disabled=false;$('house-detail').hidden=true;$('house-status').textContent='';$('house-member-status').textContent='';$('house-search').value='';$('house-title').textContent='Household';}
  async function load(){
   const c=getContext(),token=++generation;searchToken++;selected=null;$('house-detail').hidden=true;$('house-list').replaceChildren();$('house-add').hidden=!manage();$('house-previous').disabled=true;$('house-next').disabled=true;
   if(!allowed()){$('house-status').textContent='Household access has not been assigned.';return;}$('house-status').textContent='Loading households...';
   try{const {data,error}=await auth.client.from('households').select('id,organization_id,name,status,revision').eq('organization_id',c.organizationId).eq('status',$('house-filter').value).order('name').order('id').range(page*25,page*25+25);if(!current(token,c.organizationId))return;if(error)throw error;
    $('house-status').textContent=data?.length?'Households · page '+(page+1):'No households match this view.';$('house-previous').disabled=page===0;$('house-next').disabled=(data||[]).length<=25;
    for(const h of (data||[]).slice(0,25)){const button=document.createElement('button');button.className='quick-card';button.textContent=h.name;button.addEventListener('click',()=>{memberPage=0;detail(h.id)});$('house-list').append(button);}
   }catch(_){if(current(token,c.organizationId))$('house-status').textContent='Households could not load. Refresh to retry.';}
  }
  async function detail(id){
   const c=getContext(),token=++generation;selected=null;$('house-member-add').disabled=false;$('house-member-form').hidden=true;$('house-edit').hidden=true;searchToken++;$('house-detail').hidden=false;$('house-members').replaceChildren();$('house-history').replaceChildren();$('house-person-options').replaceChildren();$('house-search').value='';$('house-member-status').textContent='Loading household...';$('house-member-previous').disabled=true;$('house-member-next').disabled=true;
   try{const {data:h,error}=await auth.client.from('households').select('id,organization_id,name,status,revision').eq('organization_id',c.organizationId).eq('id',id).maybeSingle();if(!current(token,c.organizationId))return;if(error||!h)throw new Error('Unavailable');selected=h;$('house-title').textContent=h.name;$('house-edit').hidden=!manage();$('house-member-form').hidden=!manage()||h.status!=='active';
    const [members,events]=await Promise.all([
     auth.client.from('household_members').select('id,person_id,relationship,active,revision,person:organization_people(first_name,last_name)').eq('organization_id',c.organizationId).eq('household_id',id).order('created_at').order('id').range(memberPage*25,memberPage*25+25),
     auth.client.from('organization_admin_events').select('kind,created_at,after_state').eq('organization_id',c.organizationId).eq('subject_id',id).in('kind',['household_created','household_updated','household_member_added','household_member_updated']).order('created_at',{ascending:false}).limit(20)
    ]);if(!current(token,c.organizationId))return;if(members.error||events.error)throw new Error('Unavailable');
    $('house-member-status').textContent=h.status==='archived'?'Archived. Restore this household to change members.':'Relationships organize contacts. They do not grant login, consent or pickup authority.';
    $('house-member-previous').disabled=memberPage===0;$('house-member-next').disabled=(members.data||[]).length<=25;
    for(const m of (members.data||[]).slice(0,25)){
     const card=document.createElement('article');card.className='task-card';const name=document.createElement('h3');name.textContent=m.person?[m.person.first_name,m.person.last_name].join(' '):'Contact unavailable';const label=document.createElement('p');label.textContent=m.relationship+' · '+(m.active?'Active':'Removed');card.append(name,label);
     if(manage()&&h.status==='active'){
      const relationship=document.createElement('select');relationship.setAttribute('aria-label','Relationship for '+name.textContent);for(const value of ['adult','child','other']){const o=document.createElement('option');o.value=value;o.textContent=value;relationship.append(o);}relationship.value=m.relationship;
      const save=document.createElement('button');save.textContent='Save relationship';save.addEventListener('click',()=>changeMember(m,{relationship:relationship.value},save));
      const toggle=document.createElement('button');toggle.textContent=m.active?'Remove':'Restore';toggle.addEventListener('click',()=>changeMember(m,{active:!m.active},toggle));card.append(relationship,save,toggle);
     }$('house-members').append(card);
    }
    for(const event of events.data||[]){const li=document.createElement('li');const state=event.after_state;li.textContent=[new Date(event.created_at).toLocaleString(),event.kind.replaceAll('_',' '),state.name||state.relationship,state.status||(state.active?'active':'removed')].join(' · ');$('house-history').append(li);}
   }catch(_){if(current(token,c.organizationId)){selected=null;$('house-title').textContent='Household unavailable';$('house-member-form').hidden=true;$('house-edit').hidden=true;$('house-member-status').textContent='The record or your access changed. Refresh to retry.';}}
  }
  async function changeMember(member,values,button){
   const c=getContext(),h=selected,token=generation;if(!manage()||!h||button.disabled)return;button.disabled=true;
   try{if((await auth.getUser())?.id!==c.user.id){onAccountChange();return;}if(!current(token,c.organizationId))return;
    const {data,error}=await auth.client.from('household_members').update(values).eq('organization_id',c.organizationId).eq('household_id',h.id).eq('id',member.id).eq('revision',member.revision).select('id').maybeSingle();if(!current(token,c.organizationId))return;if(error||!data)throw new Error('Conflict');await detail(h.id);
   }catch(_){if(current(token,c.organizationId))$('house-member-status').textContent='Change not saved. Refresh before retrying; access or the record may have changed.';}finally{button.disabled=false;}
  }
  function open(h=null){if(!manage())return;editorToken++;editing=h?{...h}:{organization_id:getContext().organizationId};$('house-name').value=h?.name||'';$('house-state').value=h?.status||'active';$('house-state-label').hidden=!h;$('house-save-status').textContent='';$('house-save').disabled=false;$('house-editor').showModal();}
  $('house-form').addEventListener('submit',async e=>{e.preventDefault();if(!manage()||!editing||$('house-save').disabled)return;const c=getContext(),h={...editing},token=editorToken,name=$('house-name').value.trim();if(!name)return;$('house-save').disabled=true;
   try{if((await auth.getUser())?.id!==c.user.id){onAccountChange();return;}if(token!==editorToken||c.organizationId!==getContext().organizationId)return;
    const query=h.id?auth.client.from('households').update({name,status:$('house-state').value}).eq('organization_id',c.organizationId).eq('id',h.id).eq('revision',h.revision):auth.client.from('households').insert({organization_id:c.organizationId,name});const {data,error}=await query.select('id').maybeSingle();if(token!==editorToken||getContext().invalid)return;if(error||!data)throw new Error('Conflict');$('house-editor').close();editing=null;await load();
   }catch(_){if(token===editorToken&&!getContext().invalid)$('house-save-status').textContent='Household was not saved. Refresh before retrying.';}finally{if(token===editorToken)$('house-save').disabled=false;}
  });
  $('house-person-search').addEventListener('click',async()=>{const c=getContext(),h=selected,token=++searchToken,text=$('house-search').value.trim();$('house-person-options').replaceChildren();if(!manage()||!h||text.length<2){$('house-member-status').textContent='Enter at least two letters of the last name.';return;}
   try{const {data,error}=await auth.client.from('organization_people').select('id,first_name,last_name').eq('organization_id',c.organizationId).ilike('last_name','%'+text.replace(/[\\%_]/g,'\\$&')+'%').order('last_name').order('id').limit(20);if(token!==searchToken||getContext().invalid||selected?.id!==h.id)return;if(error)throw error;for(const p of data||[]){const o=document.createElement('option');o.value=p.id;o.textContent=p.first_name+' '+p.last_name;$('house-person-options').append(o);}$('house-member-status').textContent=data?.length?'Choose a contact. Up to 20 matches shown; narrow your search if needed.':'No contacts match. Add the person in People first.';
   }catch(_){if(token===searchToken)$('house-member-status').textContent='Contact search failed. Try again.';}
  });
  $('house-member-form').addEventListener('submit',async e=>{e.preventDefault();const c=getContext(),h=selected,token=generation,person=$('house-person-options').value;if(!manage()||!h||!person||$('house-member-add').disabled)return;$('house-member-add').disabled=true;
   try{if((await auth.getUser())?.id!==c.user.id){onAccountChange();return;}if(!current(token,c.organizationId))return;const {error}=await auth.client.from('household_members').insert({organization_id:c.organizationId,household_id:h.id,person_id:person,relationship:$('house-relationship').value});if(!current(token,c.organizationId))return;if(error)throw error;memberPage=0;await detail(h.id);
   }catch(_){if(current(token,c.organizationId))$('house-member-status').textContent='Member not added. If already listed as removed, use Restore. Otherwise refresh and check access.';}finally{if(current(token,c.organizationId))$('house-member-add').disabled=false;}
  });
  $('house-add').addEventListener('click',()=>open());$('house-edit').addEventListener('click',()=>open(selected));$('house-refresh').addEventListener('click',load);$('house-filter').addEventListener('change',()=>{page=0;load()});
  $('house-cancel').addEventListener('click',()=>{editorToken++;editing=null;$('house-editor').close()});$('house-editor').addEventListener('cancel',()=>{editorToken++;editing=null});
  $('house-previous').addEventListener('click',()=>{if(page>0)page--;load()});$('house-next').addEventListener('click',()=>{page++;load()});
  $('house-member-previous').addEventListener('click',()=>{if(selected){if(memberPage>0)memberPage--;detail(selected.id)}});$('house-member-next').addEventListener('click',()=>{if(selected){memberPage++;detail(selected.id)}});
  return {load,clear};
 };
})();
