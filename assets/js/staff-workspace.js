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
 let epoch=0,identity=null,active=false,stopped=false,verification=null,fingerprint='',timer;
 const destinations=new Set(),client=auth?.client;
 const communicationPages=[['overview','Communications Overview','staff-communications.html','communications.view'],['campaign','Campaign Communications','staff-campaign-communications.html','communications.send'],['templates','Communication Templates','staff-communication-templates.html','communications.templates.view'],['activity','Delivery Activity','staff-communication-activity.html','communications.delivery.view']];
 const communicationView=document.getElementById('communications-app')?.dataset.view;
 const communicationPage=communicationPages.find(row=>row[0]===communicationView);
 const communicationHistory=communicationView==='campaign'&&params.has('person');
 const communicationAllowed=row=>row.permissions.includes(communicationPage[3])||(communicationHistory&&row.permissions.includes('communications.delivery.view'));
 const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
 const communicationKeys=new Set(['view','send','bulk_send','templates.view','templates.manage','delivery.view','providers.view','providers.manage','providers.test','providers.enable'].map(k=>'communications.'+k));
 function communicationContext(data){
  if(!data||!Array.isArray(data.organizations)||!Array.isArray(data.campaigns)||(data.external_delivery_enabled!==undefined&&typeof data.external_delivery_enabled!=='boolean'))throw Error('Invalid communications context');
  const rows=(items,campaign)=>{const ids=new Set();return items.map(row=>{
   if(!row||!uuid(row.id)||ids.has(row.id)||typeof row.name!=='string'||!row.name||!Array.isArray(row.permissions)||!row.permissions.length||new Set(row.permissions).size!==row.permissions.length||row.permissions.some(key=>!communicationKeys.has(key))||(campaign?!uuid(row.organization_id):row.organization_id!==undefined&&row.organization_id!==row.id))throw Error('Invalid communications scope');
   ids.add(row.id);return{id:row.id,name:row.name,...(campaign?{organization_id:row.organization_id}:{}),permissions:[...row.permissions]};
  })};
  return{organizations:rows(data.organizations,false),campaigns:rows(data.campaigns,true),external_delivery_enabled:data.external_delivery_enabled===true};
 }
 const communicationEntries=(snapshot,id,campaign=false)=>(snapshot.communications[campaign?'campaigns':'organizations'].find(row=>row.id===id)?.permissions||[]).flatMap(permission=>communicationPages.filter(row=>row[3]===permission).map(([,label,path])=>[label,path+'?'+(campaign?'campaign':'organization')+'='+encodeURIComponent(id)]));

 const orgPermission=(grants,id,key)=>grants.some(g=>g.organization_id===id&&g.permission===key&&!g.department_ids);
 const formsKeys=['forms.read','forms.create','forms.edit'];
 const dreamKeys=['dream_team.application.read','dream_team.application.restricted','people.read','followup.read'];
 function modules(snapshot,id){const result=[];
  if(orgPermission(snapshot.grants,id,'people.read'))result.push(['People & Follow-up','staff-people.html?org='+encodeURIComponent(id)]);
  if(snapshot.grants.some(g=>g.organization_id===id&&['events.view','events.manage'].includes(g.permission)&&(g.department_ids==null||Array.isArray(g.department_ids)&&g.department_ids.length)))result.push(['Church Events','staff-events.html?org='+encodeURIComponent(id)]);
  if(snapshot.forms.some(o=>o.id===id))result.push(['Forms','staff-forms.html?organization='+encodeURIComponent(id)]);
  if(dreamKeys.every(key=>orgPermission(snapshot.grants,id,key)))result.push(['Dream Team & Manual Follow-up','staff-dream-team-manual.html?org='+encodeURIComponent(id)]);
  result.push(...communicationEntries(snapshot,id));
  if(orgPermission(snapshot.grants,id,'outreach.view')&&orgPermission(snapshot.grants,id,'finance.read'))result.push(['Financial Outreach Review','staff-outreach-partners.html?org='+encodeURIComponent(id)]);
  return result;
 }
 const denied=r=>[401,403].includes(r?.status)||[401,403].includes(r?.error?.status)||['42501','PGRST301','PGRST302','PGRST303'].includes(r?.error?.code);
 const reject=()=>({data:null,error:{code:'42501',message:'Staff access must be verified again.'},status:403});
 // Discovery arrays are unordered sets. Canonicalize comparison, not display order.
 const canonical=value=>Array.isArray(value)?value.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
 function drawer(open){sidebar.classList.toggle('staff-drawer-open',open);menu.setAttribute('aria-expanded',String(open));sidebar.inert=mobile.matches&&!open;document.querySelector('.staff-body').inert=mobile.matches&&open;if(open)sidebar.querySelector('a')?.focus()}
 function stop(reason){
  if(stopped)return;stopped=true;active=false;epoch++;clearInterval(timer);
  window.dispatchEvent(new Event('staff-protected-clear'));
  const displayedIdentity=document.getElementById('staff-session-email');if(displayedIdentity)displayedIdentity.textContent='';
  destinations.clear();main.replaceChildren();main.hidden=true;nav.replaceChildren();controls.replaceChildren();controls.hidden=true;drawer(false);
  message.replaceChildren(el('span',reason+' '),el('a','Verify access again',{href:'staff-home.html'}),document.createTextNode(' · '),el('a','Sign in',{href:'discipleship-login.html?next=%2Fstaff-home.html'}));
 }
 async function navigate(href){
  const url=new URL(href,location.href),target=url.href;
  if(!active||stopped||url.origin!==location.origin||!destinations.has(target))return;
  await verify();if(!active||stopped||!destinations.has(target))return;
  stop('Opening your selected workspace.');location.assign(target);
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
   const guardedRegistration=args[0]==='outreach_registration_workspace'&&['checkin','reverse','update','attendee_add','attendee_update','sign','waiver_correct','walkup'].includes(args[1]?.p_action);
   let result;
   if(guardedRegistration){
    const veto=args[2]?.staffDispatchCurrent;
    if(typeof veto!=='function'||typeof auth.dispatchGuardedRpc!=='function'||typeof session.access_token!=='string'||!session.access_token)return reject();
    const {staffDispatchCurrent,...options}=args[2];
    result=await auth.dispatchGuardedRpc(args[0],args[1],options,()=>generation===epoch&&active&&!stopped&&window.ChampionLifeAuth===auth&&auth.client===client&&veto()===true,session.access_token);
   }else result=await originalRpc(...args);
   if(generation!==epoch||stopped)return reject();
   if(denied(result)){stop('Access is no longer available.');return reject()}
   if(args[0]==='communications_workspace'&&args[1]?.p_action==='context'&&!result.error)result.data=communicationContext(result.data);
   const latest=await client.auth.getUser();if(generation!==epoch||stopped)return reject();
   const currentSession=await auth.getSession();if(generation!==epoch||stopped)return reject();
   if(window.ChampionLifeAuth!==auth||auth.client!==client||latest.error||latest.data?.user?.id!==identity||!latest.data.user.email_confirmed_at||latest.data.user.is_anonymous||currentSession?.user?.id!==identity){stop('Your staff session changed.');return reject()}
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
 function link(text,href){destinations.add(new URL(href,location.href).href);const a=el('a',text,{href});if(new URL(href,location.href).pathname===location.pathname)a.setAttribute('aria-current','page');a.onclick=event=>{if(!a.isConnected||!active||stopped){event.preventDefault();return}if(event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigate(href)}};return a}
 function show(snapshot){
  const communication=page==='communications';
  if(communication&&!communicationPage)throw Error('Invalid communications page');
  const orgs=communication?snapshot.communications.organizations.filter(communicationAllowed):snapshot.organizations;
  const campaigns=communication?snapshot.communications.campaigns.filter(communicationAllowed):page==='registration'?snapshot.registration:snapshot.campaigns;
  for(const key of ['context','org','organization','campaign','person'])if(params.getAll(key).length>1||(params.has(key)&&!params.get(key)))throw Error('Invalid workspace selection');
  if(communication&&params.has('person')&&!uuid(params.get('person')))throw Error('Invalid person selection');
  if(communication&&(params.has('org')||(params.has('organization')&&params.has('campaign'))))throw Error('Invalid communications selection');
  const requested=params.get('context'),context=page==='people'?'church':page==='registration'?'outreach':communication?(params.has('campaign')?'outreach':params.has('organization')?'church':requested||(orgs.length?'church':'outreach')):requested||(orgs.length?'church':'outreach');
  if(communication&&requested&&requested!==context)throw Error('Conflicting communications context');
  if(!['church','outreach'].includes(context))throw Error('Invalid workspace');
  const choices=context==='church'?orgs:campaigns,key=context==='church'?(communication?'organization':'org'):'campaign';
  const specified=params.get(key),selected=choices.find(x=>x.id===specified)||(!specified?choices[0]:null);
  if(!selected)throw Error('No authorized workspace');
  if(page==='home'){const route=new URL(location.pathname,location.origin);route.searchParams.set('context',context);route.searchParams.set(key,selected.id);history.replaceState(null,'',route.href)}
  else if(!specified){const url=new URL(location.href);url.searchParams.set(key,selected.id);history.replaceState(null,'',url.href)}
  nav.replaceChildren(link('Staff home','staff-home.html'));
  const entries=context==='church'?modules(snapshot,selected.id):[...(snapshot.registration.some(row=>row.id===selected.id)?[['Registration & Check-In','staff-outreach-registration.html?campaign='+encodeURIComponent(selected.id)]]:[]),...communicationEntries(snapshot,selected.id,true)];
  for(const [label,href]of entries){const item=link(label,href);if(label==='Financial Outreach Review')item.id='financial-outreach-link';nav.append(item)}
  const mode=el('select',null,{'aria-label':'Ministry context'});
  for(const[value,label,enabled]of[['church','Church',orgs.length],['outreach','Outreach',campaigns.length]])if(enabled){mode.append(el('option',label,{value}));destinations.add(new URL('staff-home.html?context='+value,location.href).href)}mode.value=context;
  mode.onchange=()=>{if(mode.isConnected)navigate('staff-home.html?context='+encodeURIComponent(mode.value))};
  const select=el('select',null,{'aria-label':context==='church'?'Church organization':'Outreach campaign'});
  const scopeRoute=id=>communication?(communicationHistory&&!choices.find(row=>row.id===id)?.permissions.includes('communications.send')?'staff-communication-activity.html':communicationPage[2])+'?'+key+'='+encodeURIComponent(id):page==='home'?'staff-home.html?context='+context+'&'+key+'='+encodeURIComponent(id):(context==='church'?'staff-people.html?org=':'staff-outreach-registration.html?campaign=')+encodeURIComponent(id);
  for(const item of choices){select.append(el('option',item.name,{value:item.id}));destinations.add(new URL(scopeRoute(item.id),location.href).href)}select.value=selected.id;
  select.onchange=()=>{if(select.isConnected)navigate(scopeRoute(select.value))};
  const modeLabel=el('label','Workspace'),scopeLabel=el('label',context==='church'?'Organization':'Campaign');modeLabel.append(mode);scopeLabel.append(select);controls.replaceChildren(modeLabel,scopeLabel);controls.hidden=false;
  if(page==='home')document.getElementById('staff-home-links').replaceChildren(...entries.map(([label,href])=>link('Open '+label,href)));
 }
 function verify(initial=false){
  if(stopped)return Promise.resolve();if(verification)return verification;
  verification=verifyNow(initial).finally(()=>{verification=null});return verification;
 }
 async function verifyNow(initial=false){
  const generation=epoch;
  const watchdog=setTimeout(()=>stop('Access verification timed out. Please try again.'),10000);
  try{
   if(window.ChampionLifeAuth!==auth||auth.client!==client)throw Error('Authentication client changed');
   const result=await client.auth.getUser();if(stopped||generation!==epoch)return;
   const user=result.data?.user;if(result.error||!user?.id||!user.email_confirmed_at||user.is_anonymous)throw Error('Verified sign-in required');
   if(identity&&identity!==user.id){stop('Your account changed.');return}identity=user.id;
   const discover=async(...args)=>{
    const response=await originalRpc(...args);
    // Process each denial immediately; a pending sibling must not retain access.
    if(response.error||denied(response)){
     if(generation===epoch&&!stopped)stop('Access is no longer available.');
     throw Error('Permission discovery failed');
    }
    return response;
   };
   const optionalForms=async()=>{
    let response;try{response=await originalRpc('forms_workspace',{p_action:'context',p_org:null,p_payload:{}})}catch(error){if(denied({error,status:error?.status})){if(generation===epoch&&!stopped)stop('Access is no longer available.');throw error}return []}
    if(denied(response)){if(generation===epoch&&!stopped)stop('Access is no longer available.');throw Error('Forms access denied')}
    if(!response||response.error||response.data?.capabilities?.profile!=='private_draft_v1'||!Array.isArray(response.data.organizations))return [];
    // Keep only authorized organization navigation; never retain scoped form IDs/names.
    return response.data.organizations.filter(o=>o&&typeof o.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o.id)&&typeof o.name==='string'&&(Array.isArray(o.permissions)&&o.permissions.some(k=>formsKeys.includes(k))||Array.isArray(o.scoped_forms)&&o.scoped_forms.some(f=>f&&Array.isArray(f.permissions)&&f.permissions.some(k=>formsKeys.includes(k))))).map(o=>({id:o.id,name:o.name}));
   };
   const optionalCommunications=async()=>{
    let response;try{response=await originalRpc('communications_workspace',{p_action:'context',p_campaign:null,p_payload:{}})}catch(error){if(denied({error,status:error?.status})){if(generation===epoch&&!stopped)stop('Access is no longer available.');throw error}return{organizations:[],campaigns:[]}}
    if(denied(response)){if(generation===epoch&&!stopped)stop('Access is no longer available.');throw Error('Communications access denied')}
    if(!response||response.error)return{organizations:[],campaigns:[]};
    return communicationContext(response.data);
   };
   const [staff,registration,forms,communications]=await Promise.all([discover('staff_workspace_context',{}),discover('outreach_registration_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}}),optionalForms(),optionalCommunications()]);
   if(stopped||generation!==epoch)return;
   if(staff.error||registration.error||denied(staff)||denied(registration))throw Error('Permission discovery failed');
   const latest=await client.auth.getUser();if(stopped||generation!==epoch)return;
   if(window.ChampionLifeAuth!==auth||auth.client!==client||latest.error||latest.data?.user?.id!==identity||!latest.data.user.email_confirmed_at||latest.data.user.is_anonymous)throw Error('Session changed');
   const currentSession=await auth.getSession();if(stopped||generation!==epoch)return;
   if(window.ChampionLifeAuth!==auth||auth.client!==client||currentSession?.user?.id!==identity)throw Error('Session changed');
   const grants=staff.data?.grants,organizations=staff.data?.organizations,campaigns=registration.data;
   if(!Array.isArray(grants)||!Array.isArray(organizations)||!Array.isArray(campaigns))throw Error('Invalid context');
   const snapshot={grants,forms,communications,registration:campaigns,campaigns:[...new Map([...campaigns,...communications.campaigns].map(c=>[c.id,c])).values()],organizations:[]};
   const byId=new Map([...organizations,...forms,...communications.organizations].map(o=>[o.id,{id:o.id,name:o.name}]));
   snapshot.organizations=[...byId.values()].filter(o=>page==='people'?orgPermission(grants,o.id,'people.read'):modules(snapshot,o.id).length>0);
   const current=JSON.stringify(canonical(snapshot));
   if(!initial&&current!==fingerprint){stop('Your permissions changed. Verify access again.');return}
   if(initial){show(snapshot);fingerprint=current;active=true;main.hidden=false;message.textContent='';
    const modules={people:'assets/js/outreach-people.js',registration:'assets/js/outreach-registration-staff.js',communications:'assets/js/communications.js'};
    if(modules[page]){const script=el('script',null,{src:modules[page]});script.onerror=()=>stop('Workspace could not be loaded.');document.body.append(script)}
    timer=setInterval(()=>verify(),20000);
   }
  }catch{if(generation===epoch&&!stopped)stop('Staff access is unavailable or could not be verified.');}
  finally{clearTimeout(watchdog)}
 }
 window.addEventListener('focus',()=>verify());
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')verify()});
 verify(true);
})();
