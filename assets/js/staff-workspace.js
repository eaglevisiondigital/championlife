(() => {
 'use strict';
 if(!document.body.hasAttribute('data-staff-workspace'))return;
 if(!window.ChampionLifeAuth?.client)window.ChampionLifeAuth={getUser:async()=>null,getSession:async()=>null,signOut:async()=>{},client:{rpc:async()=>({data:null,error:{code:'42501',message:'Workspace unavailable'},status:403}),auth:{onAuthStateChange(){}}}};
 const auth=window.ChampionLifeAuth,el=window.OutreachUI.el;
 const page=location.pathname.split('/').pop().replace(/\.html$/,'')||'staff-home';
 const main=document.querySelector('main'),shell=el('div',null,{class:'staff-shell'});
 const sidebar=el('aside',null,{class:'staff-sidebar',id:'staff-navigation','aria-label':'Staff workspace navigation'});
 const skip=el('a','Skip to content',{href:'#staff-main',class:'staff-skip'});
 const brand=el('a',null,{href:'staff-home.html',class:'staff-brand','aria-label':'Champion Life staff home'});
 brand.append(el('img',null,{src:'assets/images/logo-gold.png',alt:'Champion Life Church'}));
 const nav=el('nav',null,{'aria-label':'Staff workspace'}),close=el('button','Close menu',{type:'button',class:'staff-close'});
 sidebar.append(brand,close,el('p','STAFF WORKSPACE',{class:'staff-eyebrow'}),nav,el('p','Powered by Kingdom Propel',{class:'staff-nav-status'}));
 const column=el('div',null,{class:'staff-column'}),top=el('header',null,{class:'staff-top'});
 const menu=el('button','Menu',{type:'button',class:'staff-menu','aria-controls':'staff-navigation','aria-expanded':'false'});
 const contextSelect=el('select',null,{'aria-label':'Platform context',class:'staff-campaign-select'});
 const campaignSelect=el('select',null,{'aria-label':'Current outreach campaign',class:'staff-campaign-select'});
 const context=el('div',null,{class:'staff-context'});context.append(contextSelect,campaignSelect);
 const session=el('div',null,{class:'staff-session-wrap'}),who=el('span','Checking session…',{class:'staff-user'}),role=el('span','',{class:'staff-role'});
 const signout=el('button','Sign out',{type:'button',class:'staff-button staff-session'}),identity=el('div',null,{class:'staff-identity'});identity.append(who,role);session.append(identity,signout);
 top.append(menu,context,session);main.classList.add('staff-main');main.id='staff-main';
 column.append(top,main);shell.append(sidebar,column);document.body.prepend(skip,shell);document.querySelector('.campaign-shell')?.remove();
 let epoch=0,refreshId=0,refreshing=false,state={user:null,staff:null,campaigns:[],registration:[],decisions:[],team:[],partners:[],selected:null,contexts:[],platform:'outreach'},version=null;
 const outreachItems=[['Outreach Home','staff-outreach-overview.html','outreach'],['Campaigns','staff-outreach-campaigns.html','campaigns'],['Decisions & Follow-Up','staff-outreach-decisions.html','decisions'],['Registration & Check-In','staff-outreach-registration.html','registration'],['Team & Travel','staff-outreach-team.html','team'],['Partner Churches','staff-outreach-partner-admin.html','partneradmin'],['Partner Follow-Up','staff-outreach-partner.html','partner'],['Event Day','staff-outreach-event-day.html','eventday'],['Giveaways','staff-outreach-prizes.html','prizes'],['Host & Preparation','staff-outreach-pre-event.html','preevent'],['Communications','staff-communications.html','communications'],['Outreach Giving','staff-outreach-giving.html','giving'],['Reports','staff-outreach-reports.html','reports'],['Settings','staff-outreach-settings.html','settings']];
 const championItems=[['Staff Home','staff-home.html','home'],['People & Follow-Up','staff-people.html','people'],['Staff & Access','staff-access.html','access'],['Outreach Home','staff-outreach-overview.html','outreach']];
 const navItems=[...championItems,...outreachItems];
 const activePath=href=>href.replace('.html','')===page;
 const orgFor=slug=>(state.staff?.organizations||[]).find(o=>o.slug===slug)?.id;
 const hasGrant=(p,slug)=>(state.staff?.grants||[]).some(g=>g.permission===p&&!g.department_ids&&(!slug||g.organization_id===orgFor(slug)));
 const campaignById=id=>state.campaigns.find(c=>c.id===id);
 function can(kind){
  if(!state.user)return false;
  if(kind==='home')return state.contexts.includes('champion');
  if(kind==='people')return hasGrant('people.read','champion-life');
  if(kind==='access')return hasGrant('staff.manage');
  if(kind==='partner')return state.partners.length>0;
  if(kind==='outreach')return state.contexts.includes('outreach');
  if(kind==='giving')return hasGrant('finance.read','sowgo');
  if(['settings','reports'].includes(kind))return state.campaigns.some(c=>c.modules.some(m=>['campaigns','decisions','registration','partneradmin'].includes(m)));
  return state.campaigns.some(c=>c.modules.includes(kind));
 }
 function href(base,kind){
  const c=campaignById(state.selected);
  return c&&(c.modules.includes(kind)||['reports','settings','giving'].includes(kind))?base+'?campaign='+encodeURIComponent(c.id):base;
 }
 function render(){
  nav.replaceChildren();
  for(const[label,base,kind]of(state.platform==='champion'?championItems:outreachItems)){
   if(!can(kind))continue;
   const a=el('a',label,{href:href(base,kind)});if(activePath(base))a.setAttribute('aria-current','page');nav.append(a);
  }
  if(!nav.children.length)nav.append(el('p','No staff sections are assigned.',{class:'staff-nav-status'}));
  contextSelect.replaceChildren();for(const c of state.contexts){const o=el('option',c==='champion'?'Champion Life':'Outreach / SowGo',{value:c});o.selected=c===state.platform;contextSelect.append(o);}
  contextSelect.hidden=!state.contexts.length;
  campaignSelect.replaceChildren(el('option','All outreach campaigns',{value:''}));
  for(const c of state.campaigns){const o=el('option',c.name,{value:c.id});o.selected=c.id===state.selected;campaignSelect.append(o);}
  campaignSelect.hidden=state.platform!=='outreach'||!state.campaigns.length;
  who.textContent=state.user?.email||'Signed out';role.textContent=state.role_label||'';signout.hidden=!state.user;
 }
 function denied(target=main,message='Your access has changed. Reopen a section using your current permissions.'){
  epoch++;target.replaceChildren();const box=el('section',null,{class:'staff-state',role:'status'});
  box.append(el('h1','Workspace access unavailable'),el('p',message),el('a','Return to Staff Home',{href:'staff-home.html',class:'staff-button gold'}));target.append(box);
  window.dispatchEvent(new CustomEvent('staff-protected-clear'));
 }
 // All module RPC responses share the same session epoch. A late response cannot
 // restore protected content after another request has established revocation.
 const rawRpc=auth.client.rpc.bind(auth.client);
 auth.client.rpc=async(...args)=>{
  const callEpoch=epoch,result=await rawRpc(...args);
  if(callEpoch!==epoch)return{data:null,error:{code:'42501',message:'Access changed'},status:403};
  if(result.error&&(result.error.code==='42501'||[401,403].includes(result.status)||[401,403].includes(result.error.status)))denied();
  return result;
 };
 async function refresh(){
  if(refreshing)return;refreshing=true;const request=++refreshId;
  try{
   const user=await auth.getUser();
   if(!user){if(state.user)denied(main,'Sign in to continue.');state={...state,user:null,staff:null,campaigns:[],registration:[],decisions:[],team:[],partners:[],contexts:[]};version=null;render();window.dispatchEvent(new CustomEvent('staff-workspace-context',{detail:state}));return;}
   const result=await auth.client.rpc('unified_outreach_context',{});if(request!==refreshId)return;
   if(result.error){denied();return;}
   const next=result.data;
   const [d,p]=await Promise.all([auth.client.rpc('outreach_decision_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}}),auth.client.rpc('outreach_partner_workspace',{p_action:'partners',p_partner:null,p_payload:{}})]);
   if(request!==refreshId)return;
   if(d.error||p.error){denied();return;}
   const changed=version&&version!==next.access_version;
   if(changed)denied();
   version=next.access_version;
   const campaigns=next.campaigns||[],requested=new URLSearchParams(location.search).get('campaign');
   let selected=requested&&campaigns.some(c=>c.id===requested)?requested:null,platform=page==='staff-home'||page==='staff-people'||page==='staff-access'?'champion':'outreach';
   try{const saved=sessionStorage.getItem('staff-current-campaign');if(!selected&&campaigns.some(c=>c.id===saved))selected=saved;}catch{}
   if(!selected&&campaigns.length===1)selected=campaigns[0].id;
   if(!next.contexts.includes(platform))platform=next.contexts[0]||'outreach';
   state={...next,user,campaigns,registration:campaigns.filter(c=>c.modules.includes('registration')),decisions:d.data||[],team:campaigns.filter(c=>c.modules.includes('team')),partners:p.data||[],selected,platform};
   render();window.dispatchEvent(new CustomEvent('staff-workspace-context',{detail:state}));
  }catch{denied(main,'The workspace could not verify your current access. Refresh to try again.');}finally{refreshing=false;}
 }
 function selectCampaign(id){state.selected=state.campaigns.some(c=>c.id===id)?id:null;try{if(state.selected)sessionStorage.setItem('staff-current-campaign',state.selected);else sessionStorage.removeItem('staff-current-campaign');}catch{}render();}
 campaignSelect.onchange=()=>{selectCampaign(campaignSelect.value);const item=navItems.find(([,base])=>activePath(base));if(item)location.href=href(item[1],item[2]);};
 contextSelect.onchange=()=>{location.href=contextSelect.value==='champion'?'staff-home.html':'staff-outreach-overview.html';};
 function closeMenu(){shell.classList.remove('is-menu-open');menu.setAttribute('aria-expanded','false');menu.focus();}
 menu.onclick=()=>{const open=shell.classList.toggle('is-menu-open');menu.setAttribute('aria-expanded',String(open));if(open)close.focus();};close.onclick=closeMenu;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&shell.classList.contains('is-menu-open'))closeMenu();});
 signout.onclick=async()=>{signout.disabled=true;denied(main,'Signing out…');try{await auth.signOut();location.href='discipleship-login.html?next=%2Fstaff-home.html';}catch{denied(main,'Sign out could not finish. Try Sign out again.');}finally{signout.disabled=false;}};
 auth.client.auth.onAuthStateChange((event,session)=>{if(state.user&&session?.user?.id!==state.user.id){refreshId++;denied(main,'Your session changed.');}setTimeout(refresh,0);});
 window.addEventListener('focus',refresh);setInterval(()=>{if(document.visibilityState!=='hidden')refresh();},15000);
 window.StaffWorkspace={get context(){return state;},state(target,title,message,label,url){target.replaceChildren();const box=el('section',null,{class:'staff-state'});box.append(el('h1',title),el('p',message));if(label&&url)box.append(el('a',label,{href:url,class:'staff-button gold'}));target.append(box);},refresh,can,href,campaignById,denied,selectCampaign};
 refresh();
})();
