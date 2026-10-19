(() => {
 'use strict';const root=document.getElementById('staff-summary'),el=window.OutreachUI.el,auth=window.ChampionLifeAuth;
 const view=root.dataset.view;
 async function render(s){
  root.replaceChildren();if(!s?.user)return;
  const title={reports:'Outreach Reports',settings:'Outreach Settings',giving:'Outreach Giving'}[view];root.append(el('p','OUTREACH / SOWGO',{class:'staff-eyebrow'}),el('h1',title));
  if(view==='giving'){
   if(!window.StaffWorkspace.can('giving'))return window.StaffWorkspace.denied(root);
   const box=el('section',null,{class:'staff-overview-card'});box.append(el('h2','Campaign giving'),el('p','Use the existing Outreach giving destination. Native finance integration is managed in the separate Giving release.'),el('a','Open Outreach giving',{href:'https://www.community.givehub.com/forms/outreach-main-giving',class:'staff-button gold',target:'_blank',rel:'noopener noreferrer'}));root.append(box);return;
  }
  const campaigns=s.selected?s.campaigns.filter(c=>c.id===s.selected):s.campaigns;
  for(const c of campaigns){
   const box=el('section',null,{class:'staff-overview-card',style:'margin-bottom:20px'});box.append(el('h2',c.name));
   if(view==='settings'){
    box.append(el('p','Campaign status: '+c.status.replaceAll('_',' ')),el('p','Only assigned capabilities are available in each workspace.'));
    if(c.modules.includes('registration'))box.append(el('a','Registration settings & legal versions',{href:'staff-outreach-registration.html?campaign='+encodeURIComponent(c.id),class:'staff-button'}));
    if(c.modules.includes('partneradmin'))box.append(el('a','Partner access & assignments',{href:'staff-outreach-partner-admin.html?campaign='+encodeURIComponent(c.id),class:'staff-button'}));
    if(c.modules.includes('preevent'))box.append(el('a','Workflow & readiness',{href:'staff-outreach-pre-event.html?campaign='+encodeURIComponent(c.id),class:'staff-button'}));
   }else{
    if(c.modules.includes('decisions')){const r=await auth.client.rpc('outreach_decision_workspace',{p_action:'list',p_campaign:c.id,p_payload:{}});if(r.error)return;const summary=r.data.summary,row=el('div',null,{class:'staff-metric-row'});for(const[key,label]of [['total','Decisions'],['salvation','Salvations'],['rededication','Rededications'],['learn_more','Learn more'],['prayer_followup','Prayer follow-up'],['open_followup','Open follow-up']]){const metric=el('div',null,{class:'staff-metric'});metric.append(el('span',label),el('strong',String(summary[key]||0)));row.append(metric);}box.append(row);}
    if(c.modules.includes('registration'))box.append(el('a','Attendance totals & scoped CSV',{href:'staff-outreach-registration.html?campaign='+encodeURIComponent(c.id),class:'staff-button'}));
    if(c.modules.includes('partneradmin'))box.append(el('a','Partner follow-up reporting',{href:'staff-outreach-partner-admin.html?campaign='+encodeURIComponent(c.id),class:'staff-button'}));
   }
   root.append(box);
  }
  if(!campaigns.length)root.append(el('p','No campaigns are assigned to your current role.',{class:'staff-empty'}));
 }
 window.addEventListener('staff-workspace-context',e=>render(e.detail).catch(()=>window.StaffWorkspace.denied(root)));if(window.StaffWorkspace.context?.user)render(window.StaffWorkspace.context).catch(()=>window.StaffWorkspace.denied(root));
})();
