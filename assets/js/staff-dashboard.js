(() => {
  'use strict';
  const root=document.getElementById('staff-dashboard'),shell=window.StaffWorkspace,el=window.OutreachUI.el;
  if(!root||!shell)return;
  const overview=root.dataset.view==='staff-outreach-overview',auth=window.ChampionLifeAuth;
  let generation=0;
  const active=c=>['approved','preparing','registration_open','ready','scheduled','rescheduled'].includes(c.status);
  const taskStates=new Set(['ready','overdue','blocked','awaiting_configuration','awaiting_reconfirmation']);
  function panel(title,wide=false){const p=el('section',null,{class:'staff-dashboard-panel'+(wide?' wide':'')});p.append(el('h2',title));root.querySelector('.staff-dashboard-grid').append(p);return p;}
  const item=(p,title,description,href,label='Open')=>{const row=el('article',null,{class:'staff-dashboard-item'}),text=el('div');text.append(el('h3',title),el('p',description));row.append(text,el('a',label,{href,class:'campaign-button'}));p.append(row);};
  const date=c=>c.event_start?new Date(c.event_start).toLocaleString(undefined,{timeZone:c.timezone||undefined,dateStyle:'medium',timeStyle:'short'}):'Date to be confirmed';
  function metrics(p,values){const grid=el('div',null,{class:'staff-dashboard-metrics'});for(const[label,value]of values){if(!Number.isFinite(value))continue;const c=el('div',null,{class:'staff-dashboard-metric'});c.append(el('span',label),el('strong',String(value)));grid.append(c);}p.append(grid);}
  async function personalWork(p,s,g){
    if(!s.available.preevent||!shell.allowed(s,'preevent')){p.append(el('p','Open your assigned workspace to review available work.',{class:'staff-empty'}));return;}
    const status=el('p','Checking your preparation tasks…',{role:'status'});p.append(status);
    const campaigns=s.preevent.filter(active),tasks=[];
    try{
      // Existing guarded Phase F reads; no role-based inference of personal assignments.
      for(let i=0;i<campaigns.length;i+=4){
        const results=await Promise.all(campaigns.slice(i,i+4).map(async c=>{
          const r=await auth.client.rpc('outreach_pre_event_workspace',{p_action:'context',p_campaign:c.id,p_payload:{}});
          if(r.error||r.data?.campaign?.id!==c.id||!Array.isArray(r.data.steps))throw Error();
          return {campaign:r.data.campaign,steps:r.data.steps};
        }));
        if(g!==generation)return;
        for(const result of results)if(active(result.campaign))for(const t of result.steps){
          if(t.assigned_user_id!==s.user.id)continue;
          if(!taskStates.has(t.state)&&!['completed','not_applicable'].includes(t.state))throw Error();
          if(taskStates.has(t.state))tasks.push({campaign:result.campaign,task:t});
        }
      }
      // Revalidate the projection before treating an empty result as continuing access.
      const check=await auth.client.rpc('outreach_pre_event_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}});
      if(g!==generation)return;
      if(check.error||!Array.isArray(check.data))throw Error();
      const ids=rows=>rows.filter(active).map(c=>c.id).sort().join(',');
      if(ids(check.data)!==ids(s.preevent)){shell.refresh();return;}
      const session=await auth.getSession();if(g!==generation)return;
      if(session?.user?.id!==s.user.id){shell.refresh();return;}
      status.remove();
      p.append(el('p','Preparation tasks assigned directly to you, within your current outreach access.'));
      metrics(p,[['Active preparation tasks',tasks.length],['Overdue preparation tasks',tasks.filter(x=>x.task.state==='overdue').length]]);
      if(!tasks.length)p.append(el('p','No active preparation tasks are assigned to you in your current outreach scope.',{class:'staff-empty'}));
      tasks.sort((a,b)=>(a.task.due_at?Date.parse(a.task.due_at):Infinity)-(b.task.due_at?Date.parse(b.task.due_at):Infinity));
      for(const {campaign:c,task:t} of tasks.slice(0,4))item(p,t.definition?.title||'Preparation task',c.name+' · '+t.state.replaceAll('_',' '),'staff-outreach-pre-event.html?campaign='+encodeURIComponent(c.id),'Review');
    }catch{
      if(g!==generation)return;
      status.textContent='Your preparation tasks could not be checked. Open Pre-Event to review your work.';
      status.classList.add('staff-empty');
    }
  }
  function render(s){
    const g=++generation;
    root.replaceChildren();
    if(!s?.user){shell.state(root,'Sign in to continue','Sign in with your approved staff account.','Sign in','discipleship-login.html?next='+encodeURIComponent('/'+root.dataset.view+'.html'));return;}
    if(!shell.allowed(s,'workspace')||(overview&&!shell.allowed(s,'outreach'))){shell.denied(root);return;}
    const header=el('header',null,{class:'staff-dashboard-heading'});
    header.append(el('p',overview?'GLOBAL PROPEL · OUTREACH':'CHAMPION LIFE · YOUR WORKSPACE',{class:'staff-eyebrow'}),el('h1',overview?'Outreach Overview':'Staff Dashboard'),el('p',overview?'See the campaigns and communities within your current outreach access.':'Welcome back. Pick up your work and prepare for what’s next.'));
    root.append(header,el('div',null,{class:'staff-dashboard-grid'}));
    if(overview){
      if(s.available.campaigns&&shell.allowed(s,'campaigns')){
        const p=panel('Outreach snapshot',true),rows=s.campaigns;
        metrics(p,[['Campaigns in your scope',rows.length],['Communities',new Set(rows.map(c=>[c.country,c.state_province,c.city].join('/'))).size],['Countries',new Set(rows.map(c=>c.country).filter(Boolean)).size]]);
      }
      if(s.available.preevent&&s.preevent.length){const p=panel('Preparation & readiness');metrics(p,[['Campaigns preparing',s.preevent.filter(c=>!c.ready&&!['closed','cancelled','completed'].includes(c.status)).length],['Overdue campaign tasks',s.preevent.reduce((n,c)=>n+Number(c.overdue||0),0)]]);p.append(el('p','Counts cover the campaigns you can view.'));item(p,'Preparation board','Review workflow, agreements, documents and training.','staff-outreach-pre-event.html');}
      if(s.available.campaigns&&s.campaigns.some(c=>c.summary)){
        const p=panel('Decisions & follow-up'),total=k=>s.campaigns.every(c=>Number.isFinite(c.summary?.[k]))?s.campaigns.reduce((n,c)=>n+c.summary[k],0):NaN;
        metrics(p,[['Recorded decisions',total('decisions')],['Follow-up needed',total('followup_needed')],['Active discipleship',total('discipleship_active')]]);
        item(p,'Campaign follow-up','Existing campaign decisions and Getting a Grip progress.','staff-outreach-campaigns.html');
      }
    }else{
      personalWork(panel('My work'),s,g);
      if(shell.allowed(s,'outreach')){
        const p=panel('Outreach snapshot'),rows=new Map();
        for(const key of ['campaigns','preevent','registration','prizes','eventday'])if(s.available[key])for(const c of s[key])rows.set(c.id,c);
        const available=['campaigns','preevent','registration','prizes','eventday'].some(key=>s.available[key]);
        const current=[...rows.values()].filter(active),values=[];
        if(available)values.push(['Active campaigns',current.length],['Upcoming campaigns',current.filter(c=>c.event_start&&new Date(c.event_start)>=new Date()).length]);
        if(s.available.preevent&&shell.allowed(s,'preevent')&&s.preevent.filter(active).every(c=>typeof c.ready==='boolean'))values.push(['Campaigns with blockers',s.preevent.filter(c=>active(c)&&!c.ready).length]);
        metrics(p,values);p.append(el('p','Counts cover the outreach campaigns you can access.'));
        const next=current.filter(c=>c.event_start&&new Date(c.event_start)>=new Date()).sort((a,b)=>new Date(a.event_start)-new Date(b.event_start))[0];
        if(next)item(p,'Next outreach: '+next.name,date(next),'staff-outreach-overview.html','Overview');
        else item(p,'Outreach Overview','Explore campaign readiness and program details.','staff-outreach-overview.html','View overview');
      }
      if(shell.allowed(s,'people')){
        const p=panel('People & Follow-Up');
        item(p,'Organization contacts','Review the contacts and follow-up available to your staff role.','staff-people.html','Review contacts');
      }
    }
    const merged=new Map();for(const key of ['campaigns','preevent','registration','prizes','eventday','team'])for(const c of s[key]||[])merged.set(c.id,{...merged.get(c.id),...c});
    const upcoming=[...merged.values()].filter(c=>c.event_start&&new Date(c.event_start)>=new Date()&&!['closed','cancelled','completed','postponed'].includes(c.status)).sort((a,b)=>new Date(a.event_start)-new Date(b.event_start));
    const next=panel(overview?'Upcoming outreaches':'Upcoming');
    for(const c of upcoming.slice(0,4)){
      const type=['preevent','campaigns','registration','prizes','eventday','team'].find(k=>(s[k]||[]).some(x=>x.id===c.id));
      const entry=shell.configuration.flatMap(g=>g.children).find(i=>i.capability===type);
      item(next,c.name,date(c),entry.href+'?campaign='+encodeURIComponent(c.id),'View');
    }
    if(!upcoming.length)next.append(el('p','No upcoming outreaches are available in your current scope.',{class:'staff-empty'}));
    if(!overview){
      const p=panel('Quick actions',true),tools=shell.configuration.flatMap(g=>g.children).filter(i=>shell.allowed(s,i.capability)&&!['workspace','outreach'].includes(i.capability)),grid=el('div',null,{class:'staff-quick-actions'});
      for(const t of tools){const a=el('a',t.label,{href:shell.href(t,s),class:'campaign-button'});a.append(el('small',t.capability==='preevent'?'Review campaign tasks and preparation.':'Open your authorized workspace.'));grid.append(a);}p.append(grid);
      if(!tools.length)p.append(el('p','No tools are assigned to your current role.',{class:'staff-empty'}));
    }
    if(overview){const p=panel('Program tools');for(const t of shell.configuration.find(g=>g.id==='outreach').children.filter(i=>i.capability!=='outreach'&&shell.allowed(s,i.capability)))item(p,t.label,'Open your authorized outreach workspace.',shell.href(t,s));}
  }
  window.addEventListener('staff-workspace-context',e=>render(e.detail));
  if(shell.context)render(shell.context);
})();
