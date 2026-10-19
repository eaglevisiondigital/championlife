(() => {
  'use strict';
  const root=document.getElementById('partner-admin'),auth=window.ChampionLifeAuth,el=window.OutreachUI.el,cfg=window.CHAMPION_LIFE_SUPABASE;
  let campaign=new URLSearchParams(location.search).get('campaign'),data=null;
  const btn=(label,fn,gold=false)=>{const b=el('button',label,{type:'button',class:'staff-button'+(gold?' gold':'')});b.onclick=fn;return b;};
  async function rpc(action,p={}){const r=await auth.client.rpc('outreach_partner_admin_workspace',{p_action:action,p_campaign:campaign,p_payload:p});if(r.error)throw r.error;return r.data;}
  function state(t,m){root.replaceChildren();const s=el('section',null,{class:'staff-state'});s.append(el('h1',t),el('p',m));root.append(s);}
  function field(parent,label,input){const l=el('label',label);l.append(input);parent.append(l);return input;}
  function metric(parent,label,value){const m=el('div',null,{class:'staff-metric'});m.append(el('span',label),el('strong',String(value??0)));parent.append(m);}
  async function choose(){
    const shell=window.StaffWorkspace?.context;
    const campaigns=(shell?.campaigns||[]).filter(c=>shell.staff?.grants?.some(g=>['staff.manage','outreach.manage'].includes(g.permission)&&!g.department_ids));
    root.replaceChildren(el('p','OUTREACH ADMINISTRATION',{class:'staff-eyebrow'}),el('h1','Partner Churches'),el('p','Choose the campaign to manage partner-church assignments.'));
    const g=el('div',null,{class:'staff-campaign-grid'});
    for(const c of campaigns){const card=el('article',null,{class:'staff-campaign-card'});card.append(el('h3',c.name),el('a','Manage partners',{href:'staff-outreach-partner-admin.html?campaign='+encodeURIComponent(c.id),class:'staff-button gold'}));g.append(card);}
    root.append(g);if(!campaigns.length)root.append(el('p','No campaigns are available to administer.',{class:'staff-empty'}));
  }
  async function render(){
    data=await rpc('list');
    root.replaceChildren(el('p','OUTREACH ADMINISTRATION',{class:'staff-eyebrow'}),el('h1','Partner Churches & Assignment'),el('p','Central leadership assigns each decision or household to an approved partner church. Partner churches cannot pull records from the campaign pool.'));

    const add=el('section',null,{class:'staff-overview-card'}),form=el('div',null,{class:'staff-form'}),name=el('input',null,{placeholder:'Church name'}),slug=el('input',null,{placeholder:'partner-church'});
    field(form,'Partner church name',name);field(form,'Short slug',slug);
    const save=btn('Add partner church',async()=>{save.disabled=true;try{await rpc('partner_save',{name:name.value,slug:slug.value});await render();}finally{save.disabled=false;}},true);
    add.append(el('h2','Add partner church'),form,save);root.append(add);

    for(const p of data.partners||[]){
      const card=el('section',null,{class:'staff-overview-card',style:'margin-top:18px'}),metrics=el('div',null,{class:'staff-metric-row'});
      for(const [l,v] of [['Assigned',p.assigned],['Open',p.open],['Completed',p.completed],['Needs follow-up',p.needs_followup]])metric(metrics,l,v);
      card.append(el('h2',p.name),el('p',p.active?'Active partner':'Inactive partner'),metrics);

      const uf=el('div',null,{class:'staff-form'}),email=el('input',null,{type:'email',placeholder:'pastor@example.com'}),caps=el('select',null,{multiple:'',size:'5'}),reason=el('textarea');
      for(const [v,l] of [['partner.view','View assigned records'],['partner.followup','Record follow-up'],['partner.assign_local','Assign within church'],['partner.export','Export assigned list'],['partner.pastoral_notes','Private pastoral notes']])caps.append(el('option',l,{value:v}));
      field(uf,'Staff email',email);field(uf,'Capabilities',caps);field(uf,'Grant reason',reason);
      const note=el('p','',{class:'staff-note',role:'status'});
      const grant=btn('Grant existing verified account',async()=>{
        if(!email.checkValidity()||!email.value.trim()||reason.value.trim().length<10){note.textContent='Enter a valid email and a grant reason of at least 10 characters.';return;}
        const selected=[...caps.selectedOptions].map(o=>o.value);if(!selected.includes('partner.view'))selected.unshift('partner.view');
        grant.disabled=true;
        try{
          await rpc('user_grant',{partner_church_id:p.id,email:email.value.trim().toLowerCase(),capabilities:selected,reason:reason.value.trim()});
          note.textContent='Campaign-scoped partner access applied.';
          await render();
        }catch(e){note.textContent=e.message||'Unable to grant partner access.';}finally{grant.disabled=false;}
      },true);
      card.append(el('h3','Partner users'),uf,grant,note);

      if(p.users?.length){
        const ul=el('div',null,{class:'staff-access-list'});
        for(const u of p.users){
          const row=el('article',null,{class:'staff-dashboard-item'}),txt=el('div'),actions=el('div',null,{class:'staff-form'}),why=el('input',null,{placeholder:'Revocation reason (10+ characters)'});
          txt.append(el('strong',u.email||u.user_id),el('p',u.capabilities.join(', ')));
          const revoke=btn('Revoke access',async()=>{if(why.value.trim().length<10)return;revoke.disabled=true;try{await rpc('user_revoke',{partner_church_id:p.id,user_id:u.user_id,reason:why.value.trim()});await render();}finally{revoke.disabled=false;}});
          actions.append(why,revoke);row.append(txt,actions);ul.append(row);
        }
        card.append(ul);
      }
      root.append(card);
    }

    const pool=el('section',null,{class:'staff-overview-card',style:'margin-top:18px'});
    pool.append(el('h2','Unassigned campaign records'),el('p','Assign only records that this partner church should receive.'));
    const partner=el('select');partner.append(el('option','Choose partner church',{value:''}));for(const p of data.partners||[])if(p.active)partner.append(el('option',p.name,{value:p.id}));
    const reason=el('textarea');reason.placeholder='Assignment reason (required, 10+ characters)';
    const assignmentControls=el('div',null,{class:'staff-form'});field(assignmentControls,'Partner church',partner);field(assignmentControls,'Assignment reason',reason);pool.append(assignmentControls);
    const records=el('div',null,{class:'staff-campaign-grid',style:'margin-top:16px'});
    const assign=async(type,id,button)=>{if(!partner.value||reason.value.trim().length<10)return;button.disabled=true;try{await rpc('assign',{partner_church_id:partner.value,subject_type:type,subject_id:id,reason:reason.value.trim()});await render();}finally{button.disabled=false;}};
    for(const r of data.unassigned_decisions||[]){const card=el('article',null,{class:'staff-campaign-card'}),b=btn('Assign to selected church',()=>assign('decision',r.id,b),true);card.append(el('p','Decision',{class:'staff-pill'}),el('h3',r.name),el('p',(r.decision||'').replaceAll('_',' ')),b);records.append(card);}
    for(const r of data.unassigned_households||[]){const card=el('article',null,{class:'staff-campaign-card'}),b=btn('Assign to selected church',()=>assign('household',r.id,b),true);card.append(el('p','Household',{class:'staff-pill'}),el('h3',r.name),el('p',r.reference||''),el('p','Partner users receive the registering adult/guardian contact. Minor direct-contact data is not exposed.'),b);records.append(card);}
    pool.append(records);if(!(data.unassigned_decisions?.length||data.unassigned_households?.length))pool.append(el('p','No unassigned campaign records.',{class:'staff-empty'}));root.append(pool);

    const assigned=el('section',null,{class:'staff-overview-card',style:'margin-top:18px'});
    assigned.append(el('h2','Current partner assignments'),el('p','Revoking an assignment removes partner access immediately without deleting the source registration, decision, or follow-up history.'));
    for(const a of data.assignments||[]){
      const row=el('article',null,{class:'staff-dashboard-item'}),txt=el('div'),controls=el('div',null,{class:'staff-form'}),why=el('input',null,{placeholder:'Revocation reason (10+ characters)'}),p=(data.partners||[]).find(x=>x.id===a.partner_church_id);
      txt.append(el('strong',a.subject?.name||'Assigned record'),el('p',(p?.name||'Partner church')+' · '+(a.subject?.kind||'record')));
      const revoke=btn('Revoke assignment',async()=>{if(why.value.trim().length<10)return;revoke.disabled=true;try{await rpc('revoke_assignment',{assignment_id:a.id,reason:why.value.trim()});await render();}finally{revoke.disabled=false;}});
      controls.append(why,revoke);row.append(txt,controls);assigned.append(row);
    }
    if(!(data.assignments||[]).length)assigned.append(el('p','No active partner assignments.',{class:'staff-empty'}));root.append(assigned);
  }
  async function boot(){try{const u=await auth.getUser();if(!u){state('Sign in required','Use an approved Champion Life administrator account.');return;}if(!campaign){setTimeout(()=>choose().catch(e=>state('Partner administration unavailable',e.message)),250);return;}await render();}catch(e){state('Partner administration unavailable',e.message||'Please refresh and try again.');}}
  boot();
})();