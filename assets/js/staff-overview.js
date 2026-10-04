(() => {
  window.ChampionStaffOverview=({auth,getContext,onTask})=>{
    const $=id=>document.getElementById(id);let generation=0;
    function clear(){generation++;for(const id of ['overview-people','overview-open','overview-overdue'])$(id).textContent='';$('overview-tasks').replaceChildren();$('overview-status').textContent='';}
    async function load(){
      clear();const token=generation,c=getContext();if(c.invalid)return;
      const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
      $('overview-status').textContent='Loading today’s workspace...';
      const hasTasks=c.can('people.read')&&c.can('followup.read');
      try{
        const people=c.can('people.read')?auth.client.from('organization_people').select('id',{count:'exact',head:true}).eq('organization_id',c.organizationId):Promise.resolve({restricted:true});
        const countTasks=()=>auth.client.from('followup_tasks').select('id',{count:'exact',head:true}).eq('organization_id',c.organizationId).eq('assigned_user_id',c.user.id).eq('status','open');
        const [p,open,overdue,tasks]=await Promise.all([
          people,
          hasTasks?countTasks():Promise.resolve({restricted:true}),
          hasTasks?countTasks().lt('due_on',today):Promise.resolve({restricted:true}),
          hasTasks?auth.client.from('followup_tasks').select('id,organization_id,person_id,title,status,due_on,assigned_user_id,revision,person:organization_people(first_name,last_name)').eq('organization_id',c.organizationId).eq('assigned_user_id',c.user.id).eq('status','open').order('due_on',{ascending:true,nullsFirst:false}).order('id').limit(5):Promise.resolve({data:[]})
        ]);
        if(token!==generation||getContext().invalid)return;
        const count=(element,result)=>{$(element).textContent=result.restricted?'No access':result.error||!Number.isInteger(result.count)?'Unavailable':String(result.count);};
        count('overview-people',p);count('overview-open',open);count('overview-overdue',overdue);
        for(const task of tasks.error?[]:tasks.data||[]){
          const item=document.createElement('li'),title=document.createElement('strong'),meta=document.createElement('span');title.textContent=task.title;
          meta.textContent=[task.person?[task.person.first_name,task.person.last_name].join(' '):'Organization contact',task.due_on?'Due '+task.due_on:'No due date'].join(' · ');item.append(title,meta);
          if(c.can('followup.manage')){const button=document.createElement('button');button.textContent='Update';button.addEventListener('click',()=>onTask(task));item.append(button);}$('overview-tasks').append(item);
        }
        const failed=[p,open,overdue,tasks].some(result=>result.error);
        $('overview-status').textContent=failed?'Some information could not load. Refresh to retry.':!hasTasks?'Follow-up access is not assigned for this organization.':tasks.data?.length?'Your next five open tasks, ordered by due date. Overdue counts use today on this device ('+today+').':'You have no open tasks assigned in this organization.';
      }catch(_){if(token===generation&&!getContext().invalid){for(const id of ['overview-people','overview-open','overview-overdue'])$(id).textContent='Unavailable';$('overview-status').textContent='The overview could not load. Refresh to try again.';}}
    }
    $('overview-refresh').addEventListener('click',load);return {load,clear};
  };
})();
