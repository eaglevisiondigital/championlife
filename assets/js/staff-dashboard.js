(() => {
  'use strict';
  const root=document.getElementById('staff-dashboard'),shell=window.StaffWorkspace,el=window.OutreachUI.el;
  if(!root||!shell)return;
  const overview=root.dataset.view==='staff-outreach-overview';
  function panel(title,wide=false){const p=el('section',null,{class:'staff-dashboard-panel'+(wide?' wide':'')});p.append(el('h2',title));root.querySelector('.staff-dashboard-grid').append(p);return p;}
  const item=(p,title,description,href,label='Open')=>{const row=el('article',null,{class:'staff-dashboard-item'}),text=el('div');text.append(el('h3',title),el('p',description));row.append(text,el('a',label,{href,class:'campaign-button'}));p.append(row);};
  const date=c=>c.event_start?new Date(c.event_start).toLocaleString(undefined,{timeZone:c.timezone||undefined,dateStyle:'medium',timeStyle:'short'}):'Date to be confirmed';
  function metrics(p,values){const grid=el('div',null,{class:'staff-dashboard-metrics'});for(const[label,value]of values){if(!Number.isFinite(value))continue;const c=el('div',null,{class:'staff-dashboard-metric'});c.append(el('span',label),el('strong',String(value)));grid.append(c);}p.append(grid);}
  function render(s){
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
      const p=panel('My work'),tools=shell.configuration.flatMap(g=>g.children).filter(i=>shell.allowed(s,i.capability)&&!['workspace','outreach'].includes(i.capability));
      const grid=el('div',null,{class:'staff-quick-actions'});p.classList.add('wide');
      for(const t of tools){const a=el('a',t.label,{href:shell.href(t,s),class:'campaign-button'});a.append(el('small',t.capability==='preevent'?'Review assigned tasks and preparation.':'Open your authorized workspace.'));grid.append(a);}p.append(grid);
      if(!tools.length)p.append(el('p','No tools are assigned to your current role.',{class:'staff-empty'}));
      if(s.available.preevent&&s.preevent.length){const p=panel('Your outreach work');for(const c of s.preevent.slice(0,4))item(p,c.name,`${c.workflow_percent}% preparation complete · ${c.overdue} overdue campaign tasks`,'staff-outreach-pre-event.html?campaign='+encodeURIComponent(c.id),'Review');}
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
    if(overview){const p=panel('Program tools');for(const t of shell.configuration.find(g=>g.id==='outreach').children.filter(i=>i.capability!=='outreach'&&shell.allowed(s,i.capability)))item(p,t.label,'Open your authorized outreach workspace.',shell.href(t,s));}
  }
  window.addEventListener('staff-workspace-context',e=>render(e.detail));
  if(shell.context)render(shell.context);
})();
