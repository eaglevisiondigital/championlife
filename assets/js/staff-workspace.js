/* Shared staff shell. Navigation is a current server projection, never authorization. */
(() => {
  'use strict';
  if (!document.body.hasAttribute('data-staff-workspace')) return;
  const el = window.OutreachUI.el, auth = window.ChampionLifeAuth;
  const page = location.pathname.split('/').pop().replace(/\.html$/, '');
  let selected = new URLSearchParams(location.search).get('campaign');
  const configuration = [
    {id:'home',label:'HOME',children:[{label:'Staff Dashboard',href:'staff-home.html',capability:'home'}]},
    {id:'people',label:'PEOPLE',children:[{label:'People & Follow-Up',href:'staff-people.html',capability:'people'},{label:'Staff & Access',href:'staff-access.html',capability:'access'}]},
    {id:'outreach',label:'OUTREACH',children:[
      {label:'Outreach Home',href:'staff-outreach-overview.html',capability:'outreach'},
      {label:'Campaigns',href:'staff-outreach-campaigns.html',capability:'campaigns'},
      {label:'Decisions & Follow-Up',href:'staff-outreach-decisions.html',capability:'decisions'},
      {label:'Registration & Check-In',href:'staff-outreach-registration.html',capability:'registration'},
      {label:'Team & Travel',href:'staff-outreach-team.html',capability:'team'},
      {label:'Partner Churches',href:'staff-outreach-partner-admin.html',capability:'partneradmin'},
      {label:'Partner Follow-Up',href:'staff-outreach-partner.html',capability:'partner'},
      {label:'Host & Preparation',href:'staff-outreach-pre-event.html',capability:'preevent'},
      {label:'Event Day',href:'staff-outreach-event-day.html',capability:'eventday'},
      {label:'Giveaways',href:'staff-outreach-prizes.html',capability:'prizes'},
      {label:'Outreach Giving',href:'staff-outreach-giving.html',capability:'giving'},
      {label:'Reports',href:'staff-outreach-reports.html',capability:'reports'},
      {label:'Settings',href:'staff-outreach-settings.html',capability:'settings'}]},
    {id:'communications',label:'COMMUNICATIONS',children:[
      {label:'Communications',href:'staff-communications.html',capability:'commview'},
      {label:'Campaign Communications',href:'staff-campaign-communications.html',capability:'commsend'},
      {label:'Templates',href:'staff-communication-templates.html',capability:'commtemplates'},
      {label:'Delivery Activity',href:'staff-communication-activity.html',capability:'commdelivery'},
      {label:'Provider Settings',href:'staff-communication-providers.html',capability:'commproviders'}]}
    ,{ id: 'giving', label: 'GIVING / FINANCE', children: [
      {label:'Overview',href:'staff-giving-overview.html',capability:'financereports'},
      {label:'Gifts',href:'staff-giving-gifts.html',capability:'financegifts'},
      {label:'Manual Entry',href:'staff-giving-manual.html',capability:'financeentryonly'},
      {label:'Donors',href:'staff-giving-donors.html',capability:'financegifts'},
      {label:'Funds',href:'staff-giving-funds.html',capability:'financefunds'},
      {label:'Pledges',href:'staff-giving-pledges.html',capability:'financepledges'},
      {label:'Recurring Giving',href:'staff-giving-recurring.html',capability:'financerecurring'},
      {label:'Batches & Reconciliation',href:'staff-giving-batches.html',capability:'financebatches'},
      {label:'Merchant Configuration',href:'staff-giving-merchants.html',capability:'financemerchants'},
      {label:'Native Providers',href:'staff-payment-providers.html',capability:'paymentsview'},
      {label:'Routing Matrix',href:'staff-payment-routing.html',capability:'paymentsview'},
      {label:'Payment Methods',href:'staff-payment-methods.html',capability:'paymentsview'},
      {label:'Payment Operations',href:'staff-payment-operations.html',capability:'paymentsview'},
      {label:'My Payment Work',href:'staff-payment-work.html',capability:'paymentsview'},
      {label:'Payment Issues',href:'staff-payment-issues.html',capability:'paymentsview'},
      {label:'Recurring Operations',href:'staff-payment-recurring.html',capability:'paymentsview'},
      {label:'Payment Transactions',href:'staff-payment-transactions.html',capability:'paymentsview'},
      {label:'Reports',href:'staff-giving-reports.html',capability:'financereports'},
      {label:'Leadership Dashboard',href:'staff-giving-pastor.html',capability:'financereports'},
      {label:'Statements',href:'staff-giving-statements.html',capability:'financestatements'}
    ] }
    ,{id:'forms',label:'FORMS',children:[{label:'Forms',href:'staff-forms.html',capability:'formsread'},{label:'Form Builder',href:'staff-form-builder.html',capability:'formsedit'},{label:'Submissions',href:'staff-form-submissions.html',capability:'formssubmissions'}]}
    // Future authorized destinations extend this configuration; no placeholder links.
  ];
  // Injected from the reviewed public build manifest. Raw source fails closed.
  const publishedRoutes = /* GATE0_ROUTES */ [];
  const attribution = Object.freeze({
    label: 'Powered By', logo: 'assets/images/kingdom-propel-logo.png', href: 'https://kingdompropel.com',
    alt: 'Kingdom Propel by EagleVision', accessibleLabel: 'Powered by Kingdom Propel — opens KingdomPropel.com in a new tab'
  });
  const original = document.querySelector('main');
  const shell = el('div', null, { class: 'staff-shell' });
  const sidebar = el('aside', null, { class: 'staff-sidebar', id: 'staff-navigation', 'aria-label': 'Staff workspace navigation' });
  const brand = el('a', null, { href: 'staff-home.html', class: 'staff-brand', 'aria-label': 'Champion Life Staff Dashboard' });
  brand.append(el('img', null, { src: 'assets/images/logo-gold.png', alt: 'Champion Life Church' }));
  const close = el('button', 'Close menu', { type: 'button', class: 'staff-close' });
  const nav = el('nav', null, { 'aria-label': 'Staff Workspace' });
  const foot = el('a', null, { class: 'staff-sidebar-foot', href: attribution.href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': attribution.accessibleLabel });
  foot.append(el('span', attribution.label), el('img', null, { src: attribution.logo, alt: attribution.alt, width: '180', height: '60' }));
  sidebar.append(brand, el('p', 'STAFF WORKSPACE', { class: 'staff-eyebrow' }), close, nav, foot);
  const backdrop = el('button', null, { type: 'button', class: 'staff-backdrop', 'aria-label': 'Close navigation', tabindex: '-1' });
  const column = el('div', null, { class: 'staff-column' });
  const top = el('header', null, { class: 'staff-top' });
  const menu = el('button', 'Menu', { type: 'button', class: 'staff-menu', 'aria-controls': 'staff-navigation', 'aria-expanded': 'false' });
  const crumb = el('span', 'CHAMPION LIFE · STAFF WORKSPACE', { class: 'staff-eyebrow' });
  const signout = el('button', 'Sign out', { type: 'button', class: 'staff-session', hidden: '' });
  const contextSelect=el('select',null,{'aria-label':'Platform context',class:'staff-campaign-select'});
  const campaignSelect=el('select',null,{'aria-label':'Current outreach campaign',class:'staff-campaign-select'});
  const contextBar=el('div',null,{class:'staff-context'});contextBar.append(contextSelect,campaignSelect);
  top.append(menu, crumb, contextBar, signout);
  original.classList.add('staff-main'); original.id = 'staff-main'; original.tabIndex = -1;
  const skip = el('a', 'Skip to workspace', { href: '#staff-main', class: 'staff-skip' });
  column.append(top, original); shell.append(sidebar, backdrop, column); document.body.prepend(skip, shell);
  document.querySelector('.campaign-shell')?.remove();
  let snapshot = null, accessVersion=null, responseEpoch=0, epoch = 0, busy = false, again = false, open = false, expanded = {};
  const seenDenials = new WeakSet();
  try { const saved=JSON.parse(localStorage.getItem('staff-nav-groups-v1') || '{}'); if(saved && typeof saved==='object' && !Array.isArray(saved))expanded=saved; } catch { /* Optional preference only. */ }
  const mobile = () => matchMedia('(max-width: 1023px)').matches;
  function drawer(value) {
    open = value; shell.classList.toggle('is-menu-open', value); menu.setAttribute('aria-expanded', String(value));
    sidebar.inert = mobile() && !value; column.inert = mobile() && value;
    if (value) close.focus(); else menu.focus();
  }
  sidebar.inert = mobile();
  menu.onclick = () => drawer(!open); close.onclick = backdrop.onclick = () => drawer(false);
  window.addEventListener('resize', () => { sidebar.inert = mobile() && !open; column.inert = mobile() && open; });
  shell.addEventListener('keydown', e => {
    if (!open || !mobile()) return;
    if (e.key === 'Escape') { e.preventDefault(); drawer(false); }
    if (e.key === 'Tab') {
      const items = [...sidebar.querySelectorAll('a,button')].filter(n => !n.hidden && !n.closest('[hidden]'));
      const first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  const matches = item => item.href.replace(/\.html$/, '') === page || item.href==='staff-giving-reports.html'&&['staff-giving-report','staff-giving-summary','staff-giving-fund-report','staff-giving-donor-report','staff-giving-pledge-report','staff-giving-mid-report','staff-giving-reconciliation-report'].includes(page) || item.href==='staff-giving-statements.html'&&page==='staff-giving-statement';
  const rowsFor = (s, capability) => selected ? (s[capability] || []).filter(c => c.id === selected) : s[capability] || [];
  const hasGrant = (s, permission) => (s.staff?.grants || []).some(g => g.permission === permission && !g.department_ids);
  function allowed(s, capability) {
    if (!s?.user) return false;
    if(capability==='paymentsview')return(s.payments?.organizations||[]).some(o=>o.permissions.includes('payments.view'));
    if(capability==='workspace'&&(s.payments?.organizations||[]).length)return true;
    const formsKeys={formsread:'forms.read',formsedit:'forms.edit',formssubmissions:'forms.submissions.read'};
    if(formsKeys[capability])return (s.forms?.organizations||[]).some(o=>o.permissions.includes(formsKeys[capability])||(o.scoped_forms||[]).some(f=>f.permissions.includes(formsKeys[capability])));
    if(capability==='workspace'&&(s.forms?.organizations||[]).length)return true;
    if(capability==='financeentryonly')return (s.giving?.organizations||[]).some(o=>o.permissions.includes('finance.gifts.create')&&!o.permissions.includes('finance.gifts.read'));
    const financeKeys={financestatements:'finance.statements.generate',financereports:'finance.reports.read',financegifts:'finance.gifts.read',financecreate:'finance.gifts.create',financeentryonly:'finance.gifts.create',financefunds:'finance.read',financepledges:'finance.pledges.read',financerecurring:'finance.recurring.read',financebatches:'finance.reconciliation.read',financemerchants:'finance.merchant.configure'};
    if(financeKeys[capability])return (s.giving?.organizations||[]).some(o=>o.permissions.includes(financeKeys[capability]));
    if(capability==='workspace'&&(s.giving?.organizations||[]).length)return true;
    const commKeys={commview:'communications.view',commsend:'communications.send',commtemplates:'communications.templates.view',commdelivery:'communications.delivery.view',commproviders:'communications.providers.view'};
    if(commKeys[capability])return (s.communications?.organizations||[]).some(o=>o.permissions.includes(commKeys[capability]))||(s.communications?.campaigns||[]).some(c=>(!selected||c.id===selected)&&c.permissions.includes(commKeys[capability]));
    const staffGrants=s.staff?.grants||[],campaigns=(s.campaigns||[]).filter(c=>!selected||c.id===selected);
    if(capability==='home'||capability==='workspace')return staffGrants.length>0||s.campaigns.length>0||['giving','forms','payments','communications'].some(k=>(s[k]?.organizations||[]).length>0);
    if(capability==='people')return staffGrants.some(g=>g.permission==='people.read');
    if(capability==='access')return hasGrant(s,'staff.manage');
    if(capability==='outreach')return s.campaigns.length>0;
    if(capability==='giving'){const org=(s.staff?.organizations||[]).find(o=>o.slug==='sowgo');return org&&staffGrants.some(g=>g.organization_id===org.id&&g.permission==='finance.read'&&!g.department_ids);}
    if(['reports','settings'].includes(capability))return campaigns.some(c=>c.modules.some(m=>['campaigns','decisions','registration','partneradmin'].includes(m)));
    return campaigns.some(c=>c.modules.includes(capability));
  }

  function href(item, s = snapshot) {
    if(item.capability.startsWith('payments')){const requested=new URLSearchParams(location.search).get('organization');const scopes=(s.payments?.organizations||[]).filter(o=>o.permissions.includes('payments.view'));const chosen=scopes.find(o=>o.id===requested)||scopes[0];return item.href+(chosen?'?organization='+encodeURIComponent(chosen.id):'');}
    if(item.capability.startsWith('forms')){const org=new URLSearchParams(location.search).get('organization');const scopes=(s.forms?.organizations||[]).filter(o=>allowed({user:s.user,forms:{organizations:[o]}},item.capability));const chosen=scopes.find(o=>o.id===org)||scopes[0];return item.href+(chosen?'?organization='+encodeURIComponent(chosen.id):'');}
    if(item.capability.startsWith('finance')){const org=new URLSearchParams(location.search).get('organization');const scopes=s.giving?.organizations||[];const candidates=scopes.filter(o=>allowed({user:s.user,giving:{organizations:[o]}},item.capability));const chosen=candidates.find(o=>o.id===org)||candidates[0];return item.href+(chosen?'?organization='+encodeURIComponent(chosen.id):'');}
    if(item.capability==='partner'){
      const candidates=(s.partners||[]).filter(p=>!selected||p.campaign_id===selected);
      const requested=new URLSearchParams(location.search).get('partner');
      const chosen=candidates.find(p=>p.id===requested)||candidates[0];
      return item.href+(chosen?'?partner='+encodeURIComponent(chosen.id):'');
    }
    const rows=(s.campaigns||[]).filter(c=>(!selected||c.id===selected)&&c.modules.includes(item.capability));
    const chosen=rows.find(c=>c.id===selected)||rows[0];
    if(chosen&&!['home','people','access'].includes(item.capability))return item.href+'?campaign='+encodeURIComponent(chosen.id);
    if(selected&&['reports','settings'].includes(item.capability)&&s.campaigns.some(c=>c.id===selected))return item.href+'?campaign='+encodeURIComponent(selected);
    return item.href;
  }

  function render(s) {
    nav.replaceChildren(); signout.hidden = !s?.user;
    if (!s) { nav.append(el('p', 'Checking access…', { class: 'staff-nav-status', role: 'status' })); return; }
    contextSelect.replaceChildren();
    for(const value of s.contexts||[]){const o=el('option',value==='champion'?'Champion Life':'Outreach / SowGo',{value});o.selected=value===s.platform;contextSelect.append(o);}
    contextSelect.hidden=!(s.contexts||[]).length;
    campaignSelect.replaceChildren(el('option','All authorized campaigns',{value:''}));
    for(const c of s.campaigns||[]){const o=el('option',c.name,{value:c.id});o.selected=c.id===selected;campaignSelect.append(o);}
    campaignSelect.hidden=!(s.campaigns||[]).length;
    for (const group of configuration) {
      const items = group.children.filter(item => publishedRoutes.includes(item.href) && allowed(s,item.capability)); if (!items.length) continue;
      const active = items.some(matches), section = el('section', null, { class: 'staff-group' + (active ? ' is-active' : ''), 'data-group': group.id });
      const button = el('button', group.label, { type: 'button', class: 'staff-group-toggle', 'aria-controls': 'staff-group-' + group.id, 'aria-expanded': String(active || expanded[group.id] !== false) });
      const children = el('div', null, { id: 'staff-group-' + group.id, class: 'staff-children' });
      children.hidden = !(active || expanded[group.id] !== false);
      button.onclick = () => {
        children.hidden = !children.hidden; button.setAttribute('aria-expanded', String(!children.hidden)); expanded[group.id] = !children.hidden;
        try { localStorage.setItem('staff-nav-groups-v1',JSON.stringify(expanded)); } catch { /* Navigation works without storage. */ }
      };
      for (const item of items) {
        const a = el('a',item.label,{href:href(item,s),'data-capability':item.capability});
        if (matches(item)) a.setAttribute('aria-current','page'); children.append(a);
      }
      section.append(button,children); nav.append(section);
    }
    if (!nav.children.length) nav.append(el('p', 'No staff sections assigned.', { class: 'staff-nav-status' }));
  }
  const empty=()=>({user:null,staff:null,organizations:[],campaigns:[],registration:[],decisions:[],team:[],partners:[],contexts:[],selected:null});
  async function discover(user) {
    const r=await auth.client.rpc('shared_platform_context',{});
    if(r.error||!r.data)throw Error('Access check failed');
    const raw=r.data,outreach=raw.outreach||{},campaigns=outreach.campaigns||[];
    const requested=new URLSearchParams(location.search).get('campaign');
    if(requested&&!selected)selected=requested;
    if(!campaigns.some(c=>c.id===selected))selected=null;
    if(!selected&&campaigns.length===1)selected=campaigns[0].id;
    const contexts=[...(outreach.contexts||[])];
    if((raw.staff?.grants||[]).length||['giving','forms','payments'].some(k=>(raw[k]?.organizations||[]).length))if(!contexts.includes('champion'))contexts.unshift('champion');
    return {...empty(),...raw,...outreach,staff:raw.staff,user,campaigns,contexts,selected,
      platform:page.startsWith('staff-outreach')?'outreach':'champion',
      registration:campaigns.filter(c=>c.modules.includes('registration')),team:campaigns.filter(c=>c.modules.includes('team')),
      decisions:raw.decisions||[],partners:raw.partners||[]};
  }
  // In-flight business requests must never restore data after a scope/session loss.
  const originalRpc=auth.client.rpc.bind(auth.client);
  auth.client.rpc=async(...args)=>{
    const before=responseEpoch,r=await originalRpc(...args);
    if(before!==responseEpoch)return{data:null,error:{code:'42501',message:'Access changed'},status:403};
    if(r.error&&(r.error.code==='42501'||[401,403].includes(r.status))){clearProtected();publish(empty());if(args[0]!=='shared_platform_context')setTimeout(refresh,0);}
    return r;
  };
  function clearProtected(){responseEpoch++;original.replaceChildren();window.dispatchEvent(new CustomEvent('staff-protected-clear'));}

  function publish(s) { snapshot=s; render(s); window.dispatchEvent(new CustomEvent('staff-workspace-context',{detail:s})); }
  async function refresh() {
    if (busy) { again=true; return; }
    busy=true; const g=++epoch;
    try {
      const user=await auth?.getUser();
      if (!user || user.is_anonymous) { if(g===epoch){clearProtected();accessVersion=null;publish(empty());} return; }
      const s=await discover(user), current=await auth.getUser();
      if(g!==epoch || current?.id!==user.id) return;
      const fingerprint=JSON.stringify({...s,user:{id:user.id}});
      if(accessVersion&&accessVersion!==fingerprint)clearProtected();
      accessVersion=fingerprint;publish(s);
    } catch { if(g===epoch) { clearProtected();publish(empty()); nav.replaceChildren(el('p','Access check unavailable. Refresh to try again.',{class:'staff-nav-status',role:'status'})); } }
    finally { busy=false; if(again) { again=false; setTimeout(refresh,0); } }
  }
  signout.onclick = async () => { signout.disabled=true; clearProtected();publish(empty());try { await auth.signOut(); } catch { top.querySelector('[role=alert]')?.remove(); top.append(el('p','Unable to sign out. Please try again.',{role:'alert'})); } finally { signout.disabled=false; } };
  auth?.client.auth.onAuthStateChange((_event,session) => {
    if(session?.user?.id!==snapshot?.user?.id) { epoch++;clearProtected();accessVersion=null;publish(empty()); setTimeout(refresh,0); }
  });
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
  setInterval(()=>{if(document.visibilityState==='visible')refresh();},20000);
  function state(root, title, message, action, target) {
    const card=el('section',null,{class:'staff-state',role:'status'});
    card.append(el('p','STAFF WORKSPACE',{class:'staff-eyebrow'}),el('h2',title),el('p',message));
    if(action)card.append(el('a',action,{href:target,class:'campaign-button campaign-gold'}));
    root.replaceChildren(card); return card;
  }
  function denied(root=original,message='Your current role does not include access to this section.') {
    responseEpoch++;const card=state(root,'Access unavailable',message,'Return to Staff Dashboard','staff-people.html');
    // Page-local denials must not form a refresh/denial event loop.
    return card;
  }
  // Skin existing accepted module states without rewriting their copy, clearing, or request flow.
  const observer=new MutationObserver(()=>{
    for(const n of original.querySelectorAll('.campaign-denied,.pre-denied,.ops-denied,.partner-access-denied')) {
      n.classList.add('staff-state');
      if(!seenDenials.has(n)) { seenDenials.add(n); refresh(); }
    }
    for(const heading of original.querySelectorAll('h1')) {
      if(/^Choose (?:an outreach |a )?campaign$/i.test(heading.textContent.trim()) && !heading.nextElementSibling?.classList.contains('staff-campaign-choice')) {
        heading.after(el('p','Select an available campaign below. If none are listed, contact your coordinator about campaign access.',{class:'staff-empty staff-campaign-choice'}));
      }
    }
    for(const n of original.querySelectorAll('p')) {
      if(n.closest('.staff-state'))continue;
      if(/^(No (campaign|household|outreach partner intake|matching contact|follow-up task|applicant|active opportunit|event|prize|eligible)|Choose an outreach campaign)/i.test(n.textContent.trim())) n.classList.add('staff-empty');
      n.classList.toggle('staff-loading',n.getAttribute('role')==='status' && /Loading|Checking/i.test(n.textContent));
    }
  });
  observer.observe(original,{subtree:true,childList:true,characterData:true});
  function selectCampaign(id){selected=(snapshot?.campaigns||[]).some(c=>c.id===id)?id:null;if(snapshot){snapshot={...snapshot,selected};render(snapshot);}}
  campaignSelect.onchange=()=>{selectCampaign(campaignSelect.value);const item=configuration.flatMap(g=>g.children).find(matches);if(item&&allowed(snapshot,item.capability))location.href=href(item,snapshot);};
  contextSelect.onchange=()=>{const target=contextSelect.value==='outreach'?'staff-outreach-overview.html':'staff-home.html';if(publishedRoutes.includes(target))location.href=target;};
  window.StaffWorkspace={get context(){return snapshot;},state,denied,refresh,can:k=>allowed(snapshot,k),href:(base,kind)=>href({href:base,capability:kind},snapshot),campaignById:id=>(snapshot?.campaigns||[]).find(c=>c.id===id),selectCampaign};
  render(null);refresh();
})();
