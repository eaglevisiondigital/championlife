(() => {
  'use strict';
  const root=document.getElementById('staff-dashboard'),shell=window.StaffWorkspace,el=window.OutreachUI.el;
  if(!root||!shell)return;
  const view=root.dataset.view||'home';
  function metric(parent,label,value){const c=el('div',null,{class:'staff-metric'});c.append(el('span',label),el('strong',String(value??0)));parent.append(c);}
  function button(href,label,primary=false){return el('a',label,{href,class:'staff-button'+(primary?' gold':'')});}
  function campaignCard(c,s){
    const card=el('article',null,{class:'staff-campaign-card'});
    card.append(el('p',(c.status||'').replaceAll('_',' '),{class:'staff-pill'}),el('h3',c.name),el('p',[c.city,c.state_province,c.country].filter(Boolean).join(', ')));
    const metrics=el('div',null,{class:'staff-metric-row'});
    const d=s.decisions.find(x=>x.id===c.id),r=s.registration.find(x=>x.id===c.id),partnerRows=s.partners.filter(x=>x.campaign_id===c.id);
    if(d){metric(metrics,'Decisions',d.decision_count);metric(metrics,'Salvations',d.salvation_count);metric(metrics,'Follow-up',d.followup_count);}
    if(r){metric(metrics,'Family registration','Available');}
    if(s.team.some(x=>x.id===c.id))metric(metrics,'Team & travel','Available');
    if(partnerRows.length)metric(metrics,'Partner churches',partnerRows.length);
    card.append(metrics);
    const actions=el('div',null,{class:'staff-campaign-actions'});
    if(d)actions.append(button('staff-outreach-decisions.html?campaign='+encodeURIComponent(c.id),'Decisions',true));
    if(r)actions.append(button('staff-outreach-registration.html?campaign='+encodeURIComponent(c.id),'Registration'));
    if(s.team.some(x=>x.id===c.id))actions.append(button('staff-outreach-team.html?campaign='+encodeURIComponent(c.id),'Team & Travel'));
    if(partnerRows.length){const p=partnerRows[0];actions.append(button('staff-outreach-partner.html?partner='+encodeURIComponent(p.id),'Partner Follow-Up',!d&&!r));}
    if(c.public_page)actions.append(button(c.public_page,'Public page'));
    card.append(actions);return card;
  }
  function render(s){
    root.replaceChildren();
    if(!s?.user){
      const p=el('section',null,{class:'staff-state'});p.append(el('h1','Staff sign-in required'),el('p','Sign in with your approved Champion Life staff account.'),button('discipleship-login.html?next=%2Fstaff-home.html','Sign in',true));root.append(p);return;
    }
    const hero=el('section',null,{class:'staff-overview-hero'});
    const primary=el('div',null,{class:'staff-overview-card hero'});
    primary.append(el('p',view==='outreach'?'OUTREACH OPERATIONS':'CHAMPION LIFE STAFF',{class:'staff-eyebrow'}),el('h1',view==='outreach'?'Outreach Command Center':'Welcome to your workspace'),el('p',view==='outreach'?'Campaigns, people, team travel, family registration and discipleship follow-up in one place.':'Use one secure login for every Champion Life and Outreach area you are authorized to access.'));
    const summary=el('div',null,{class:'staff-overview-card'}),m=el('div',null,{class:'staff-metric-row'});
    metric(m,'Campaigns',s.campaigns.length);metric(m,'Decision campaigns',s.decisions.length);metric(m,'Registration campaigns',s.registration.length);metric(m,'Team/Travel',s.team.length);metric(m,'Partner access',s.partners.length);summary.append(el('h2','Your current access'),m);
    hero.append(primary,summary);root.append(hero);
    const heading=el('div',null,{class:'staff-dashboard-heading'});heading.append(el('p','AUTHORIZED CAMPAIGNS',{class:'staff-eyebrow'}),el('h2','Outreach campaigns'));root.append(heading);
    const grid=el('div',null,{class:'staff-campaign-grid'});
    for(const c of s.campaigns)grid.append(campaignCard(c,s));
    if(!s.campaigns.length)grid.append(el('p','No outreach campaigns are assigned to this account.',{class:'staff-empty'}));
    root.append(grid);
    const tools=el('section',null,{class:'staff-overview-card',style:'margin-top:24px'});tools.append(el('h2','Quick access'));
    const actions=el('div',null,{class:'staff-campaign-actions'});
    if(shell.can('people'))actions.append(button('staff-people.html','People & Follow-Up'));
    if(shell.can('access'))actions.append(button('staff-access.html','Staff & Access'));
    if(shell.can('decisions'))actions.append(button('staff-outreach-decisions.html','Decisions & Follow-Up'));
    if(shell.can('registration'))actions.append(button('staff-outreach-registration.html','Registration & Check-In'));
    if(shell.can('team'))actions.append(button('staff-outreach-team.html','Team & Travel'));
    if(shell.can('partner'))actions.append(button('staff-outreach-partner.html','Partner Follow-Up'));
    if(shell.can('partneradmin'))actions.append(button('staff-outreach-partner-admin.html','Partner Churches'));
    tools.append(actions);root.append(tools);
  }
  window.addEventListener('staff-workspace-context',e=>render(e.detail));
  if(shell.context?.user)render(shell.context);
})();