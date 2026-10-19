(() => {
 'use strict';const root=document.getElementById('staff-access-app'),auth=window.ChampionLifeAuth,el=window.OutreachUI.el;
 const profiles=[['Dave','Full Champion Life + full Outreach'],['Pastor Roddy','Full Champion Life + full Outreach'],['Tania','Full Champion Life + full Outreach'],['Kelsea','Full Outreach'],['Pastor Chris','Bessemer-only partner church; assigned records only'],['Huntsville pastor','Huntsville-only partner church; assigned records only']];
 async function boot(){
  const result=await auth.client.rpc('outreach_access_workspace',{p_action:'list',p_payload:{}});if(result.error)return;
  root.replaceChildren(el('p','ADMINISTRATION',{class:'staff-eyebrow'}),el('h1','Staff & Access'),el('p','Reviewed leadership profiles for one Champion Life platform. Real onboarding requires the separate release approval.'));
  const grid=el('div',null,{class:'staff-campaign-grid'});
  for(const[name,scope]of profiles){const card=el('article',null,{class:'staff-campaign-card'});card.append(el('h2',name),el('p',scope),el('span','Profile model',{class:'staff-pill'}));grid.append(card);}root.append(grid);
  root.append(el('p','Profile models create no account, invitation or permission grant. Finance and private pastoral authority remain explicit and scoped.',{class:'staff-note'}));
  const box=el('section',null,{class:'staff-overview-card',style:'margin-top:24px'});box.append(el('h2','Current assignments'));
  for(const u of result.data.users||[])box.append(el('p',u.email+' · '+(u.organizations||[]).map(o=>o.slug).join(', ')+' · '+(u.campaigns||[]).map(c=>c.name).join(', ')));
  if(!result.data.users?.length)box.append(el('p','No staff assignments to display.',{class:'staff-empty'}));root.append(box);
 }
 auth.getUser().then(u=>u?boot():window.StaffWorkspace.denied()).catch(()=>window.StaffWorkspace.denied());
})();
