(() => {
  'use strict';
  if (!document.body.hasAttribute('data-staff-workspace')) return;
  const auth=window.ChampionLifeAuth,el=window.OutreachUI.el;
  const page=location.pathname.split('/').pop().replace(/\.html$/,'')||'staff-home';
  const main=document.querySelector('main');
  const shell=el('div',null,{class:'staff-shell'});
  const sidebar=el('aside',null,{class:'staff-sidebar',id:'staff-navigation','aria-label':'Staff workspace navigation'});
  const brand=el('a',null,{href:'staff-home.html',class:'staff-brand','aria-label':'Champion Life staff home'});
  brand.append(el('img',null,{src:'assets/images/logo-gold.png',alt:'Champion Life Church'}));
  const nav=el('nav',null,{'aria-label':'Staff workspace'});
  sidebar.append(brand,el('p','STAFF WORKSPACE',{class:'staff-eyebrow'}),nav);
  const column=el('div',null,{class:'staff-column'});
  const top=el('header',null,{class:'staff-top'});
  const menu=el('button','Menu',{type:'button',class:'staff-menu','aria-controls':'staff-navigation','aria-expanded':'false'});
  const context=el('div',null,{class:'staff-context'});
  const campaignSelect=el('select',null,{'aria-label':'Current outreach campaign',class:'staff-campaign-select'});
  const session=el('div',null,{class:'staff-session-wrap'});
  const who=el('span','Checking session…',{class:'staff-user'});
  const signout=el('button','Sign out',{type:'button',class:'staff-session'});
  session.append(who,signout);context.append(campaignSelect);
  top.append(menu,el('span','CHAMPION LIFE · STAFF',{class:'staff-eyebrow'}),context,session);
  main.classList.add('staff-main');main.id='staff-main';
  column.append(top,main);shell.append(sidebar,column);document.body.prepend(shell);
  document.querySelector('.campaign-shell')?.remove();
  let state={user:null,staff:null,campaigns:[],registration:[],decisions:[],team:[],partners:[],selected:null};
  const navItems=[
    ['Staff Home','staff-home.html','home'],
    ['Outreach Overview','staff-outreach-overview.html','outreach'],
    ['Decisions & Follow-Up','staff-outreach-decisions.html','decisions'],
    ['Team & Travel','staff-outreach-team.html','team'],
    ['Registration & Check-In','staff-outreach-registration.html','registration'],
    ['People & Follow-Up','staff-people.html','people'],
    ['Partner Follow-Up','staff-outreach-partner.html','partner'],
    ['Partner Churches','staff-outreach-partner-admin.html','partneradmin'],
    ['Staff & Access','staff-access.html','access']
  ];
  const activePath=href=>href.replace('.html','')===page;
  const hasGrant=p=>(state.staff?.grants||[]).some(g=>g.permission===p&&!g.department_ids);
  const campaignById=id=>state.campaigns.find(c=>c.id===id);
  function can(kind){
    if(!state.user)return false;
    if(kind==='home')return true;
    if(kind==='people')return hasGrant('people.read');
    if(kind==='access')return hasGrant('staff.manage');
    if(kind==='partner')return state.partners.length>0;
    if(kind==='partneradmin')return hasGrant('staff.manage')||hasGrant('outreach.manage');
    if(kind==='decisions')return state.decisions.length>0;
    if(kind==='registration')return state.registration.length>0;
    if(kind==='team')return state.team.length>0;
    if(kind==='outreach')return state.campaigns.length>0||hasGrant('outreach.view');
    return false;
  }
  function href(base,kind){
    const id=state.selected;
    if(id&&['decisions','registration','team'].includes(kind)){
      const rows=kind==='decisions'?state.decisions:kind==='registration'?state.registration:state.team;
      if(rows.some(c=>c.id===id))return base+'?campaign='+encodeURIComponent(id);
    }
    return base;
  }
  function renderNav(){
    nav.replaceChildren();
    for(const [label,base,kind] of navItems){
      if(!can(kind))continue;
      const a=el('a',label,{href:href(base,kind)});
      if(activePath(base))a.setAttribute('aria-current','page');
      nav.append(a);
    }
    if(!nav.children.length)nav.append(el('p','No staff sections are assigned.',{class:'staff-nav-status'}));
  }
  function renderCampaigns(){
    campaignSelect.replaceChildren(el('option','All outreach campaigns',{value:''}));
    for(const c of state.campaigns){
      const o=el('option',c.name,{value:c.id});
      o.selected=c.id===state.selected;campaignSelect.append(o);
    }
    campaignSelect.hidden=!state.campaigns.length;
  }
  async function rpc(name,args){
    const r=await auth.client.rpc(name,args);
    if(r.error){
      if(['42501','42883','PGRST202'].includes(r.error.code)||[401,403].includes(r.status))return null;
      throw r.error;
    }
    return r.data;
  }
  async function refresh(){
    const user=await auth?.getUser();
    if(!user){state={user:null,staff:null,campaigns:[],registration:[],decisions:[],team:[],partners:[],selected:null};who.textContent='Signed out';renderNav();renderCampaigns();window.dispatchEvent(new CustomEvent('staff-workspace-context',{detail:state}));return;}
    const [staff,regCandidates,dec,partners]=await Promise.all([
      rpc('staff_workspace_context',{}),
      rpc('outreach_registration_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}}),
      rpc('outreach_decision_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}}),
      rpc('outreach_partner_workspace',{p_action:'partners',p_partner:null,p_payload:{}})
    ]);
    const reg=[];
    for(const candidate of regCandidates||[]){
      const ctx=await rpc('outreach_registration_workspace',{p_action:'context',p_campaign:candidate.id,p_payload:{}});
      if(ctx?.settings?.campaign_id)reg.push(candidate);
    }
    const map=new Map();
    for(const c of [...reg,...(dec||[])])map.set(c.id,{...map.get(c.id),...c});
    for(const p of partners||[])map.set(p.campaign_id,{...map.get(p.campaign_id),id:p.campaign_id,name:p.campaign_name,status:p.campaign_status});
    const campaigns=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
    const team=[];
    for(const c of campaigns){
      const caps=await rpc('outreach_team_access',{p_campaign:c.id});
      if(Array.isArray(caps)&&caps.some(x=>['team.view','team.manage','travel.view','travel.manage'].includes(x)))team.push(c);
    }
    const requested=new URLSearchParams(location.search).get('campaign');
    let selected=requested&&campaigns.some(c=>c.id===requested)?requested:null;
    if(!selected){try{const saved=sessionStorage.getItem('staff-current-campaign');if(saved&&campaigns.some(c=>c.id===saved))selected=saved;}catch{}}
    state={user,staff:staff||{grants:[]},campaigns,registration:reg||[],decisions:dec||[],team,partners:partners||[],selected};
    who.textContent=user.email||'Staff user';renderCampaigns();renderNav();
    window.dispatchEvent(new CustomEvent('staff-workspace-context',{detail:state}));
  }
  campaignSelect.onchange=()=>{
    state.selected=campaignSelect.value||null;
    try{if(state.selected)sessionStorage.setItem('staff-current-campaign',state.selected);else sessionStorage.removeItem('staff-current-campaign');}catch{}
    renderNav();
    const item=navItems.find(([,base])=>activePath(base));
    if(item&&['decisions','registration','team'].includes(item[2])&&state.selected){
      location.href=href(item[1],item[2]);
    }
  };
  signout.onclick=async()=>{signout.disabled=true;try{await auth.signOut();location.href='discipleship-login.html?next=%2Fstaff-home.html';}finally{signout.disabled=false;}};
  menu.onclick=()=>{const open=shell.classList.toggle('is-menu-open');menu.setAttribute('aria-expanded',String(open));};
  auth?.client.auth.onAuthStateChange(()=>setTimeout(refresh,0));
  window.addEventListener('focus',()=>refresh().catch(()=>{}));
  window.StaffWorkspace={get context(){return state;},refresh,can,href,campaignById};
  refresh().catch(()=>{who.textContent='Workspace unavailable';});
})();