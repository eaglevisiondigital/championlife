(() => {
  'use strict';
  const root=document.getElementById('outreach-decisions'),auth=window.ChampionLifeAuth,el=window.OutreachUI.el;
  let campaign=new URLSearchParams(location.search).get('campaign'),ctx=null,current=null,search='';
  async function rpc(action,p={}){const r=await auth.client.rpc('outreach_decision_workspace',{p_action:action,p_campaign:campaign||null,p_payload:p});if(r.error)throw r.error;return r.data;}
  const btn=(label,fn,gold=false)=>{const b=el('button',label,{type:'button',class:'staff-button'+(gold?' gold':'')});b.onclick=fn;return b;};
  function state(t,m){root.replaceChildren();const p=el('section',null,{class:'staff-state'});p.append(el('h1',t),el('p',m));root.append(p);}
  async function choose(){
    const rows=await auth.client.rpc('outreach_decision_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}});
    if(rows.error)throw rows.error;
    root.replaceChildren(el('p','OUTREACH',{class:'staff-eyebrow'}),el('h1','Decisions & Follow-Up'),el('p','Choose a campaign to review salvation, rededication, prayer and discipleship follow-up.'));
    const g=el('div',null,{class:'staff-campaign-grid'});for(const c of rows.data||[]){const card=el('article',null,{class:'staff-campaign-card'}),m=el('div',null,{class:'staff-metric-row'});metric(m,'Decisions',c.decision_count);metric(m,'Salvations',c.salvation_count);metric(m,'Rededications',c.rededication_count);card.append(el('h3',c.name),m,el('a','Open campaign',{href:'staff-outreach-decisions.html?campaign='+encodeURIComponent(c.id),class:'staff-button gold'}));g.append(card);}root.append(g);
  }
  function metric(p,l,v){const c=el('div',null,{class:'staff-metric'});c.append(el('span',l),el('strong',String(v??0)));p.append(c);}
  async function list(){
    ctx=await rpc('context');const data=await rpc('list',{search});current=null;root.replaceChildren();
    root.append(el('p','OUTREACH · DECISIONS',{class:'staff-eyebrow'}),el('h1',ctx.campaign.name),el('p','Salvation, rededication, prayer and next-step follow-up from the campaign decision page.'));
    const metrics=el('div',null,{class:'staff-metric-row'});for(const [k,l] of [['total','Total decisions'],['salvation','Salvations'],['rededication','Rededications'],['learn_more','Learn more'],['prayer_followup','Prayer follow-up'],['open_followup','Open follow-up']])metric(metrics,l,data.summary[k]);root.append(metrics);
    const tools=el('div',null,{class:'staff-toolbar'}),label=el('label','Search'),input=el('input',null,{type:'search',placeholder:'Name, email, phone or decision'});input.value=search;label.append(input);tools.append(label,btn('Search',()=>{search=input.value.trim();list().catch(showError);},true));root.append(tools);
    const table=el('table',null,{class:'staff-table'}),head=el('tr');for(const h of ['Name','Decision','Contact','Follow-up','Registered',''])head.append(el('th',h));table.append(head);
    for(const r of data.registrations){const tr=el('tr');tr.append(el('td',r.name),el('td',r.decision.replaceAll('_',' ')),el('td',(r.phone||'')+'\n'+(r.email||'')),el('td',r.followup_status.replaceAll('_',' ')),el('td',new Date(r.created_at).toLocaleString()),el('td'));tr.lastChild.append(btn('Open',()=>detail(r.id)));table.append(tr);}root.append(table);if(!data.registrations.length)root.append(el('p','No matching registrations.',{class:'staff-empty'}));
  }
  async function detail(id){
    const d=await rpc('detail',{registration_id:id});current=d;root.replaceChildren(el('p','OUTREACH · DECISION FOLLOW-UP',{class:'staff-eyebrow'}),el('h1',d.first_name+' '+d.last_name));
    root.append(btn('← Back to campaign',()=>list().catch(showError)));
    const info=el('div',null,{class:'staff-detail-grid'});for(const [l,v] of [['Decision',d.decision.replaceAll('_',' ')],['Email',d.email],['Phone',d.phone],['Registered',new Date(d.created_at).toLocaleString()],['Consent',d.consent?'Yes':'No'],['Prayer request',d.prayer_request||'None']]){const box=el('div');box.append(el('small',l),el('strong',v));info.append(box);}const card=el('section',null,{class:'staff-detail'});card.append(info);root.append(card);
    if(ctx.capabilities.includes('decision.manage')){const form=el('section',null,{class:'staff-overview-card',style:'margin-top:18px'}),f=el('div',null,{class:'staff-form'}),status=el('select');for(const v of ['new','contacting','connected','discipleship','closed']){const o=el('option',v.replaceAll('_',' '),{value:v});o.selected=v===d.followup_status;status.append(o);}const sl=el('label','Follow-up status');sl.append(status);const notes=el('textarea');notes.value=d.notes||'';const nl=el('label','Shared ministry notes');nl.append(notes);const worker=el('select');worker.append(el('option','Unassigned',{value:''}));for(const w of ctx.workers||[]){const o=el('option',w.label,{value:w.id});o.selected=w.id===d.assigned_user_id;worker.append(o);}const wl=el('label','Assigned follow-up worker');wl.append(worker);f.append(sl,wl,nl);const save=btn('Save follow-up',async()=>{save.disabled=true;try{await rpc('save',{registration_id:id,status:status.value,notes:notes.value,assigned_user_id:worker.value,revision:d.revision});await detail(id);}finally{save.disabled=false;}},true);form.append(el('h2','Follow-up management'),f,save);root.append(form);}
  }
  function showError(e){state('Workspace unavailable',e?.message||'Please refresh and try again.');}
  async function boot(){try{const u=await auth.getUser();if(!u){state('Sign in required','Use your approved staff account.');return;}if(!campaign){await choose();return;}await list();}catch(e){showError(e);}}
  boot();
})();