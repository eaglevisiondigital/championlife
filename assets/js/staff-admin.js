(() => {
  window.ChampionStaffAdmin = ({auth,getContext,onAccountChange}) => {
    const $=id=>document.getElementById(id);
    const labels={'portal.manage':'Manage participant portal content and access tags','tags.read':'View tags and departments','tags.manage':'Manage tags and departments','households.read':'View households','households.manage':'Manage households','people.read':'View people','people.create':'Add people','people.update':'Edit people','people.export':'Export people (future tool)','followup.read':'View follow-up','followup.manage':'Manage follow-up','discipleship.read':'View discipleship (future staff tool)','finance.read':'View giving and finance (restricted)','finance.configure':'Configure giving setup (administrator only)','care.read':'View restricted care (future tool)'};
    let generation=0,editToken=0,editing=null;
    function clear(){generation++;editToken++;editing=null;$('staff-list').replaceChildren();$('staff-events').replaceChildren();$('staff-editor').close();$('staff-form').reset();$('staff-permissions').replaceChildren();$('staff-status').textContent='';$('staff-save-status').textContent='';}
    function open(member=null){
      const c=getContext();if(c.invalid||!c.can('staff.manage'))return;
      editToken++;editing={organizationId:c.organizationId,member};$('staff-form').reset();
      $('staff-editor-title').textContent=member?'Edit staff access':'Add staff access';
      $('staff-email-label').hidden=!!member;$('staff-email').required=!member;$('staff-name').value=member?.display_name||'';
      $('staff-permissions').replaceChildren();
      for(const [permission,label] of Object.entries(labels)){
        if(!c.can(permission))continue;
        const wrapper=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=permission;input.checked=member?.permissions?.includes(permission)||false;wrapper.append(input,document.createTextNode(label));$('staff-permissions').append(wrapper);
      }
      // Do not silently drop permissions the acting administrator cannot delegate.
      const unsupported=(member?.permissions||[]).filter(p=>!c.can(p)||p==='staff.manage');
      $('staff-save').disabled=unsupported.length>0;
      $('staff-save-status').textContent=unsupported.length?'This account has permissions outside your authority. A trusted administrator must review it.':'';
      $('staff-editor').showModal();
    }
    async function load(){
      const c=getContext(),token=++generation;$('staff-list').replaceChildren();$('staff-events').replaceChildren();
      $('staff-add').hidden=c.invalid||!c.can('staff.manage');
      if(c.invalid||!c.can('staff.manage')){$('staff-status').textContent='Staff administration has not been assigned for this organization.';return;}
      $('staff-status').textContent='Loading your team...';
      try{
        const [directory,events]=await Promise.all([
          auth.client.rpc('list_staff_directory',{p_org:c.organizationId,p_for_assignment:false}),
          auth.client.from('organization_admin_events').select('actor_user_id,subject_id,after_state,created_at').eq('organization_id',c.organizationId).eq('kind','staff_access').order('created_at',{ascending:false}).limit(20)
        ]);
        if(token!==generation||getContext().invalid)return;
        if(directory.error||events.error)throw new Error('Unavailable');
        const members=directory.data||[];$('staff-status').textContent=members.length?members.length+' staff records.':'No staff directory records yet.';
        for(const member of members){
          const card=document.createElement('article');card.className='task-card';const name=document.createElement('h3');name.textContent=member.display_name;
          const permissions=document.createElement('p');permissions.textContent=member.permissions.length?member.permissions.map(p=>labels[p]||p).join(' · '):'Access removed';card.append(name,permissions);
          if(member.user_id!==c.user.id&&!member.permissions.includes('staff.manage')){const button=document.createElement('button');button.textContent='Edit access';button.addEventListener('click',()=>open(member));card.append(button);}
          $('staff-list').append(card);
        }
        for(const event of events.data||[]){const li=document.createElement('li');li.textContent=[new Date(event.created_at).toLocaleString(),event.after_state.display_name,(event.after_state.permissions||[]).map(p=>labels[p]||p).join(', ')||'Access removed'].join(' · ');$('staff-events').append(li);}
      }catch(_){if(token===generation&&!getContext().invalid)$('staff-status').textContent='Staff access could not be loaded. Refresh to try again.';}
    }
    $('staff-add').addEventListener('click',()=>open());$('staff-refresh').addEventListener('click',load);
    $('staff-cancel').addEventListener('click',()=>{editToken++;editing=null;$('staff-editor').close();});
    $('staff-editor').addEventListener('cancel',()=>{editToken++;editing=null;});
    $('staff-form').addEventListener('submit',async event=>{
      event.preventDefault();const c=getContext();if(!editing||c.invalid||!c.can('staff.manage')||$('staff-save').disabled)return;
      const snapshot=editing,token=editToken;const permissions=Array.from($('staff-permissions').querySelectorAll('input:checked'),input=>input.value);
      if(permissions.some(p=>['people.create','people.update','people.export','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage'].includes(p))&&!permissions.includes('people.read')){$('staff-save-status').textContent='Select View people for these permissions.';return;}
      if(permissions.includes('portal.manage')&&!permissions.includes('tags.read')){$('staff-save-status').textContent='Select View tags and departments for portal management.';return;}
      if(permissions.includes('finance.configure')&&!permissions.includes('finance.read')){$('staff-save-status').textContent='Select View giving and finance to configure giving.';return;}
      if(permissions.includes('tags.manage')&&!permissions.includes('tags.read')){$('staff-save-status').textContent='Select View tags and departments to manage tags.';return;}
      if(permissions.includes('households.manage')&&!permissions.includes('households.read')){$('staff-save-status').textContent='Select View households to manage households.';return;}
      if(permissions.includes('followup.manage')&&!permissions.includes('followup.read')){$('staff-save-status').textContent='Select View follow-up to manage follow-up.';return;}
      const args={p_org:snapshot.organizationId,p_target:snapshot.member?.user_id||null,p_email:snapshot.member?null:$('staff-email').value.trim(),p_name:$('staff-name').value.trim(),p_permissions:permissions,p_revision:snapshot.member?.revision||0};
      $('staff-save').disabled=true;$('staff-save-status').textContent='Saving access...';
      try{
        if((await auth.getUser())?.id!==c.user.id){onAccountChange();return;}
        if(token!==editToken||getContext().invalid)return;
        const {error}=await auth.client.rpc('set_staff_access',args);
        if(token!==editToken||getContext().invalid)return;
        if(error){$('staff-save-status').textContent='Access was not saved. Confirm a verified account, your permissions, and refresh if this record changed.';return;}
        $('staff-editor').close();editing=null;await load();
      }catch(_){if(token===editToken&&!getContext().invalid)$('staff-save-status').textContent='Access was not saved. Refresh before retrying.';}
      finally{if(token===editToken)$('staff-save').disabled=false;}
    });
    return {load,clear};
  };
})();
