/* Shared staff shell. Navigation is a current server projection, never authorization. */
(() => {
  'use strict';
  if (!document.body.hasAttribute('data-staff-workspace')) return;
  const el = window.OutreachUI.el, auth = window.ChampionLifeAuth;
  const page = location.pathname.split('/').pop().replace(/\.html$/, '');
  let selected = new URLSearchParams(location.search).get('campaign');
  const configuration = [
    { id: 'home', label: 'HOME', children: [{ label: 'Staff Dashboard', href: 'staff-home.html', capability: 'workspace' }] },
    { id: 'outreach', label: 'OUTREACH', children: [
      { label: 'Outreach Overview', href: 'staff-outreach-overview.html', capability: 'outreach' },
      { label: 'Opportunities & Pre-Event', href: 'staff-outreach-pre-event.html', capability: 'preevent' },
      { label: 'Campaigns', href: 'staff-outreach-campaigns.html', capability: 'campaigns' },
      { label: 'Partner Intakes', href: 'staff-outreach-partners.html', capability: 'partners' },
      { label: 'People & Follow-Up', href: 'staff-people.html', capability: 'people' }
    ] },
    { id: 'operations', label: 'EVENT OPERATIONS', children: [
      { label: 'Team & Travel', href: 'staff-outreach-team.html', capability: 'team' },
      { label: 'Registration & Check-In', href: 'staff-outreach-registration.html', capability: 'registration' },
      { label: 'Prize Operations', href: 'staff-outreach-prizes.html', capability: 'prizes' },
      { label: 'Event Day Command Center', href: 'staff-outreach-event-day.html', capability: 'eventday' }
    ] }
    // Future authorized destinations extend this configuration; no placeholder links.
  ];
  const original = document.querySelector('main');
  const shell = el('div', null, { class: 'staff-shell' });
  const sidebar = el('aside', null, { class: 'staff-sidebar', id: 'staff-navigation', 'aria-label': 'Staff workspace navigation' });
  const brand = el('a', null, { href: 'staff-home.html', class: 'staff-brand', 'aria-label': 'Champion Life Staff Dashboard' });
  brand.append(el('img', null, { src: 'assets/images/logo-gold.png', alt: 'Champion Life Church' }));
  const close = el('button', 'Close menu', { type: 'button', class: 'staff-close' });
  const nav = el('nav', null, { 'aria-label': 'Staff Workspace' });
  const foot = el('div', null, { class: 'staff-sidebar-foot' });
  foot.append(el('strong', 'Global Propel'), el('small', 'Powered by Kingdom Propel'));
  sidebar.append(brand, el('p', 'STAFF WORKSPACE', { class: 'staff-eyebrow' }), close, nav, foot);
  const backdrop = el('button', null, { type: 'button', class: 'staff-backdrop', 'aria-label': 'Close navigation', tabindex: '-1' });
  const column = el('div', null, { class: 'staff-column' });
  const top = el('header', null, { class: 'staff-top' });
  const menu = el('button', 'Menu', { type: 'button', class: 'staff-menu', 'aria-controls': 'staff-navigation', 'aria-expanded': 'false' });
  const crumb = el('span', 'CHAMPION LIFE · STAFF WORKSPACE', { class: 'staff-eyebrow' });
  const signout = el('button', 'Sign out', { type: 'button', class: 'staff-session', hidden: '' });
  top.append(menu, crumb, signout);
  original.classList.add('staff-main'); original.id = 'staff-main'; original.tabIndex = -1;
  const skip = el('a', 'Skip to workspace', { href: '#staff-main', class: 'staff-skip' });
  column.append(top, original); shell.append(sidebar, backdrop, column); document.body.prepend(skip, shell);
  document.querySelector('.campaign-shell')?.remove();
  let snapshot = null, epoch = 0, busy = false, again = false, open = false, expanded = {};
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
  const matches = item => item.href.replace(/\.html$/, '') === page;
  const rowsFor = (s, capability) => selected ? (s[capability] || []).filter(c => c.id === selected) : s[capability] || [];
  const hasGrant = (s, permission) => (s.staff?.grants || []).some(g => g.permission === permission && !g.department_ids);
  function allowed(s, capability) {
    if (!s?.user) return false;
    if (capability === 'partners') return hasGrant(s, 'outreach.view');
    if (capability === 'people') return hasGrant(s, 'people.read');
    if (capability === 'workspace') return (s.staff?.grants || []).length > 0 || s.organizations.length > 0 || ['campaigns','preevent','team','registration','prizes','eventday'].some(k => (s[k] || []).length);
    if (capability === 'outreach') return s.organizations.length > 0 || ['campaigns','preevent','team','registration','prizes','eventday'].some(k => rowsFor(s,k).length);
    if (capability === 'preevent') return s.organizations.length > 0 || rowsFor(s,capability).length > 0;
    if (capability === 'campaigns') return s.organizations.length > 0 || rowsFor(s,capability).length > 0;
    return rowsFor(s,capability).length > 0;
  }
  function href(item, s = snapshot) {
    const rows = rowsFor(s,item.capability);
    if (selected && rows.length && !['workspace','outreach','people','partners'].includes(item.capability)) return item.href + '?campaign=' + encodeURIComponent(selected);
    if (item.capability === 'team' && rows.length) return item.href + '?campaign=' + encodeURIComponent(rows[0].id);
    return item.href;
  }
  function render(s) {
    nav.replaceChildren(); signout.hidden = !s?.user;
    if (!s) { nav.append(el('p', 'Checking access…', { class: 'staff-nav-status', role: 'status' })); return; }
    for (const group of configuration) {
      const items = group.children.filter(item => allowed(s,item.capability)); if (!items.length) continue;
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
  async function read(name, action, payload = {}, campaign = null) {
    const args = name === 'staff_workspace_context' ? {} : { p_action: action, p_campaign: campaign, p_payload: payload };
    const r = await auth.client.rpc(name,args);
    if (r.error) {
      if (['42501','PGRST202','42883'].includes(r.error.code) || [401,403].includes(r.status)) return null;
      throw Error('Workspace access could not be checked.');
    }
    return r.data;
  }
  async function discover(user) {
    const [staff,core,campaigns,preevent,registration,prizes,eventday] = await Promise.all([
      read('staff_workspace_context'), read('outreach_campaign_workspace','context'), read('outreach_campaign_workspace','list'),
      read('outreach_pre_event_workspace','campaigns'),read('outreach_registration_workspace','campaigns'),
      read('outreach_prize_workspace','campaigns'),read('outreach_event_day_workspace','campaigns')
    ]);
    const team = [];
    const candidates = selected ? (campaigns || []).filter(c => c.id === selected) : campaigns || [];
    // Bound discovery concurrency; server's exact team/travel projection avoids role inference.
    for (let i=0;i<candidates.length;i+=4) {
      await Promise.all(candidates.slice(i,i+4).map(async c => {
        const r = await auth.client.rpc('outreach_team_access',{p_campaign:c.id});
        if (!r.error && Array.isArray(r.data) && r.data.some(k => ['team.view','travel.view'].includes(k))) team.push(c);
      }));
    }
    team.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
    return { user,staff,organizations:core?.organizations || [],campaigns:campaigns || [],preevent:preevent || [],registration:registration || [],prizes:prizes || [],eventday:eventday || [],team,
      available:{campaigns:campaigns!==null,preevent:preevent!==null,registration:registration!==null,prizes:prizes!==null,eventday:eventday!==null} };
  }
  function publish(s) { snapshot=s; render(s); window.dispatchEvent(new CustomEvent('staff-workspace-context',{detail:s})); }
  async function refresh() {
    if (busy) { again=true; return; }
    busy=true; const g=++epoch;
    try {
      const user=await auth?.getUser();
      if (!user || user.is_anonymous) { if(g===epoch)publish({user:null,organizations:[]}); return; }
      const s=await discover(user), current=await auth.getUser();
      if(g!==epoch || current?.id!==user.id) return;
      publish(s);
    } catch { if(g===epoch) { publish({user:null,organizations:[]}); nav.replaceChildren(el('p','Access check unavailable. Refresh to try again.',{class:'staff-nav-status',role:'status'})); } }
    finally { busy=false; if(again) { again=false; setTimeout(refresh,0); } }
  }
  signout.onclick = async () => { signout.disabled=true; try { await auth.signOut(); } catch { top.querySelector('[role=alert]')?.remove(); top.append(el('p','Unable to sign out. Please try again.',{role:'alert'})); } finally { signout.disabled=false; } };
  auth?.client.auth.onAuthStateChange((_event,session) => {
    if(session?.user?.id!==snapshot?.user?.id) { epoch++; publish({user:null,organizations:[]}); setTimeout(refresh,0); }
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
  function denied(root,message='Your current role does not include access to this section.') {
    const card=state(root,'Access unavailable',message,'Return to Staff Dashboard','staff-home.html');
    if(root.id!=='staff-dashboard')refresh();
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
  window.StaffWorkspace={configuration,allowed,href,refresh,denied,state,selectCampaign(id) { selected=id; if(snapshot)render(snapshot); },get context(){return snapshot;}};
  render(null); refresh();
})();
