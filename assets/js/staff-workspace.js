/* Shared shell over existing server-authorized workspaces; no new permission source. */
(() => {
 'use strict';
 const page=document.body.dataset.staffWorkspace,auth=window.ChampionLifeAuth;
 const main=document.getElementById('staff-main'),nav=document.getElementById('staff-navigation');
 const controls=document.getElementById('staff-context'),message=document.getElementById('staff-access-message');
 const sidebar=document.getElementById('staff-sidebar'),menu=document.getElementById('staff-menu');
 const el=(tag,text,attrs={})=>{const node=document.createElement(tag);if(text)node.textContent=text;for(const[k,v]of Object.entries(attrs))node.setAttribute(k,v);return node};
 const params=new URLSearchParams(location.search),originalRpc=auth?.client?.rpc?.bind(auth.client);
 const mobile=matchMedia('(max-width: 1023px)');
 let epoch=0,identity=null,active=false,stopped=false,checking=false,fingerprint='',timer;
 const denied=r=>[401,403].includes(r?.status)||[401,403].includes(r?.error?.status)||['42501','PGRST301','PGRST302','PGRST303'].includes(r?.error?.code);
 const reject=()=>({data:null,error:{code:'42501',message:'Staff access must be verified again.'},status:403});
 function drawer(open){sidebar.classList.toggle('staff-drawer-open',open);menu.setAttribute('aria-expanded',String(open));sidebar.inert=mobile.matches&&!open;document.querySelector('.staff-body').inert=mobile.matches&&open;if(open)sidebar.querySelector('a')?.focus()}
 function stop(reason){
  if(stopped)return;stopped=true;active=false;epoch++;clearInterval(timer);
  window.dispatchEvent(new Event('staff-protected-clear'));
  main.replaceChildren();main.hidden=true;nav.replaceChildren();controls.replaceChildren();controls.hidden=true;drawer(false);
  message.replaceChildren(el('span',reason+' '),el('a','Verify access again',{href:'staff-home.html'}),document.createTextNode(' · '),el('a','Sign in',{href:'discipleship-login.html?next=%2Fstaff-home.html'}));
 }
 function navigate(href){
  const url=new URL(href,location.href);
  if(url.origin!==location.origin||!['/staff-home.html','/staff-people.html','/staff-outreach-registration.html','/staff-outreach-partners.html'].includes(url.pathname))return;
  stop('Opening your selected workspace.');location.assign(url.href);
 }
 window.StaffWorkspace=Object.freeze({active:()=>active&&!stopped,navigate});
 menu.addEventListener('click',()=>drawer(menu.getAttribute('aria-expanded')!=='true'));
 sidebar.addEventListener('keydown',event=>{
  if(!mobile.matches)return;
  if(event.key==='Escape'){drawer(false);menu.focus()}
  if(event.key==='Tab'){
   const items=[...sidebar.querySelectorAll('a,button')].filter(n=>!n.hidden&&n.getClientRects().length),first=items[0],last=items.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
 });
 const close=el('button','Close menu',{type:'button',class:'staff-drawer-close'});close.onclick=()=>{drawer(false);menu.focus()};sidebar.prepend(close);
 mobile.addEventListener('change',()=>drawer(false));drawer(false);
 if(!auth?.client?.auth||!originalRpc){stop('Staff sign-in is unavailable.');return}
 // Intercept existing module RPCs. Captured controls cannot submit after invalidation.
 auth.client.rpc=async(...args)=>{
  const generation=epoch;if(!active||stopped)return reject();
  try{
   const session=await auth.getSession();
   if(generation!==epoch||stopped)return reject();
   if(session?.user?.id!==identity){stop('Your account changed.');return reject()}
   const result=await originalRpc(...args);
   if(generation!==epoch||stopped)return reject();
   if(denied(result)){stop('Access is no longer available.');return reject()}
   return result;
  }catch{if(generation===epoch)stop('Access could not be verified. Check your connection.');return reject()}
 };
 auth.client.auth.onAuthStateChange((event,session)=>{
  // Synchronous invalidation only: never await Auth while its callback holds a lock.
  if(event==='SIGNED_OUT'||(identity&&session?.user?.id!==identity))stop('Your staff session changed.');
 });
 window.addEventListener('staff-access-denied',()=>stop('Access is no longer available.'));
 document.getElementById('staff-logout').addEventListener('click',()=>stop('Signing out.'),{capture:true});
 window.addEventListener('pagehide',()=>stop('Verify access after returning to this page.'));
 window.addEventListener('pageshow',event=>{if(event.persisted){stop('Verify access after returning to this page.');location.reload()}});
 function link(text,href){const a=el('a',text,{href});if(new URL(href,location.href).pathname===location.pathname)a.setAttribute('aria-current','page');a.onclick=event=>{if(event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigate(href)}};return a}
 function show(snapshot){
  const orgs=snapshot.organizations, campaigns=snapshot.campaigns;
  const requested=params.get('context'),context=page==='people'?'church':page==='registration'?'outreach':requested||(orgs.length?'church':'outreach');
  if(!['church','outreach'].includes(context))throw Error('Invalid workspace');
  const choices=context==='church'?orgs:campaigns,key=context==='church'?'org':'campaign';
  const specified=params.get(key),selected=choices.find(x=>x.id===specified)||(!specified?choices[0]:null);
  if(!selected)throw Error('No authorized workspace');
  if(page!=='home'&&!specified){const url=new URL(location.href);url.searchParams.set(key,selected.id);history.replaceState(null,'',url.href)}
  nav.replaceChildren(link('Staff home','staff-home.html'));
  const href=context==='church'?'staff-people.html?org='+encodeURIComponent(selected.id):'staff-outreach-registration.html?campaign='+encodeURIComponent(selected.id);
  nav.append(link(context==='church'?'People & Follow-up':'Registration & Check-In',href));
  if(context==='church'&&snapshot.grants.some(g=>g.organization_id===selected.id&&g.permission==='outreach.view'&&!g.department_ids)&&snapshot.grants.some(g=>g.organization_id===selected.id&&g.permission==='finance.read'&&!g.department_ids)){const financial=link('Financial Outreach Review','staff-outreach-partners.html?org='+encodeURIComponent(selected.id));financial.id='financial-outreach-link';nav.append(financial)}
  const mode=el('select',null,{'aria-label':'Ministry context'});
  for(const[value,label,enabled]of[['church','Church',orgs.length],['outreach','Outreach',campaigns.length]])if(enabled)mode.append(el('option',label,{value}));mode.value=context;
  mode.onchange=()=>navigate('staff-home.html?context='+encodeURIComponent(mode.value));
  const select=el('select',null,{'aria-label':context==='church'?'Church organization':'Outreach campaign'});
  for(const item of choices)select.append(el('option',item.name,{value:item.id}));select.value=selected.id;
  select.onchange=()=>navigate((context==='church'?'staff-people.html?org=':'staff-outreach-registration.html?campaign=')+encodeURIComponent(select.value));
  const modeLabel=el('label','Workspace'),scopeLabel=el('label',context==='church'?'Organization':'Campaign');modeLabel.append(mode);scopeLabel.append(select);controls.replaceChildren(modeLabel,scopeLabel);controls.hidden=false;
  if(page==='home')document.getElementById('staff-home-links').replaceChildren(link(context==='church'?'Open People & Follow-up':'Open Registration & Check-In',href));
 }
 async function verify(initial=false){
  if(checking||stopped)return;checking=true;const generation=epoch;
  const watchdog=setTimeout(()=>stop('Access verification timed out. Please try again.'),10000);
  try{
   const result=await auth.client.auth.getUser();if(stopped||generation!==epoch)return;
   const user=result.data?.user;if(result.error||!user?.id||!user.email_confirmed_at||user.is_anonymous)throw Error('Verified sign-in required');
   if(identity&&identity!==user.id){stop('Your account changed.');return}identity=user.id;
   const [staff,registration]=await Promise.all([originalRpc('staff_workspace_context',{}),originalRpc('outreach_registration_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}})]);
   if(stopped||generation!==epoch)return;
   if(staff.error||registration.error||denied(staff)||denied(registration))throw Error('Permission discovery failed');
   const session=await auth.getSession();if(stopped||generation!==epoch)return;if(session?.user?.id!==identity)throw Error('Session changed');
   const grants=staff.data?.grants,organizations=staff.data?.organizations,campaigns=registration.data;
   if(!Array.isArray(grants)||!Array.isArray(organizations)||!Array.isArray(campaigns))throw Error('Invalid context');
   const snapshot={grants,organizations:organizations.filter(o=>grants.some(g=>g.organization_id===o.id&&g.permission==='people.read'&&!g.department_ids)),campaigns};
   const current=JSON.stringify(snapshot);
   if(!initial&&current!==fingerprint){stop('Your permissions changed. Verify access again.');return}
   if(initial){show(snapshot);fingerprint=current;active=true;main.hidden=false;message.textContent='';
    const modules={people:'assets/js/outreach-people.js',registration:'assets/js/outreach-registration-staff.js'};
    if(modules[page]){const script=el('script',null,{src:modules[page]});script.onerror=()=>stop('Workspace could not be loaded.');document.body.append(script)}
    timer=setInterval(()=>verify(),20000);
   }
  }catch{if(generation===epoch&&!stopped)stop('Staff access is unavailable or could not be verified.');}
  finally{clearTimeout(watchdog);checking=false}
 }
 window.addEventListener('focus',()=>verify());
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')verify()});
 verify(true);
})();
