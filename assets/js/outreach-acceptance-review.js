(() => {
  'use strict';
  const ACCEPTANCE={
    url:'https://niyovbgoalulzkhbvebt.supabase.co',
    key:'sb_publishable_iLqCqzZuXRp5hoY777V-JQ_hCuorFHA'
  };
  const client=window.supabase.createClient(ACCEPTANCE.url,ACCEPTANCE.key,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const state={session:null,decisions:[],registrations:[],partners:[],campaigns:[],currentCampaign:null,currentPartner:null};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const msg=(text,type='ok')=>{const n=$('#acceptance-message');n.className=type==='error'?'acceptance-error':'acceptance-ok';n.textContent=text;n.hidden=false;};
  async function rpc(fn,args){const r=await client.rpc(fn,args);if(r.error)throw r.error;return r.data;}
  async function loadContext(){
    const [dec,reg,partners]=await Promise.all([
      rpc('outreach_decision_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}}).catch(()=>[]),
      rpc('outreach_registration_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}}).catch(()=>[]),
      rpc('outreach_partner_workspace',{p_action:'partners',p_partner:null,p_payload:{}}).catch(()=>[])
    ]);
    state.decisions=dec||[];state.registrations=reg||[];state.partners=partners||[];
    const map=new Map();
    for(const c of [...state.decisions,...state.registrations])map.set(c.id,{...map.get(c.id),...c});
    for(const p of state.partners)map.set(p.campaign_id,{...map.get(p.campaign_id),id:p.campaign_id,name:p.campaign_name,status:p.campaign_status});
    state.campaigns=[...map.values()].sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    renderOverview();
    renderCampaignSelectors();
  }
  function renderOverview(){
    const root=$('#overview-campaigns');root.innerHTML='';
    for(const c of state.campaigns){
      const d=state.decisions.find(x=>x.id===c.id),r=state.registrations.find(x=>x.id===c.id),p=state.partners.filter(x=>x.campaign_id===c.id);
      const card=document.createElement('article');card.className='acceptance-card';
      card.innerHTML='<span class="acceptance-badge">'+esc((c.status||'campaign').replaceAll('_',' '))+'</span><h2>'+esc(c.name)+'</h2><p class="acceptance-muted">'+esc([c.city,c.state_province].filter(Boolean).join(', '))+'</p><div class="staff-metric-row"></div>';
      const metrics=card.querySelector('.staff-metric-row');
      const add=(l,v)=>{const x=document.createElement('div');x.className='staff-metric';x.innerHTML='<span>'+esc(l)+'</span><strong>'+esc(v)+'</strong>';metrics.append(x);};
      if(d){add('Decisions',d.decision_count??0);add('Salvations',d.salvation_count??0);add('Follow-up',d.followup_count??0);}
      if(r)add('Family registration','Available');
      if(p.length)add('Partner churches',p.length);
      root.append(card);
    }
    if(!state.campaigns.length)root.innerHTML='<p>No campaigns available to this acceptance user.</p>';
  }
  function renderCampaignSelectors(){
    for(const id of ['decision-campaign','admin-campaign']){
      const sel=$('#'+id);sel.innerHTML='';
      for(const c of state.campaigns){const o=document.createElement('option');o.value=c.id;o.textContent=c.name;sel.append(o);}
    }
    const ps=$('#partner-select');ps.innerHTML='';
    for(const p of state.partners){const o=document.createElement('option');o.value=p.id;o.textContent=p.campaign_name+' · '+p.name;ps.append(o);}
  }
  async function renderDecisions(){
    const campaign=$('#decision-campaign').value;if(!campaign)return;
    const data=await rpc('outreach_decision_workspace',{p_action:'list',p_campaign:campaign,p_payload:{search:$('#decision-search').value.trim()}});
    const metrics=$('#decision-metrics');metrics.innerHTML='';
    for(const [l,v] of [['Total',data.summary.total],['Salvations',data.summary.salvation],['Rededications',data.summary.rededication],['Learn more',data.summary.learn_more],['Prayer follow-up',data.summary.prayer_followup],['Open follow-up',data.summary.open_followup]]){
      const x=document.createElement('div');x.className='staff-metric';x.innerHTML='<span>'+esc(l)+'</span><strong>'+esc(v)+'</strong>';metrics.append(x);
    }
    const list=$('#decision-list');list.innerHTML='';
    for(const r of data.registrations||[]){
      const x=document.createElement('article');x.className='acceptance-record';
      x.innerHTML='<h3>'+esc(r.name)+'</h3><span class="acceptance-badge">'+esc((r.decision||'').replaceAll('_',' '))+'</span><p>'+esc(r.phone||'')+' · '+esc(r.email||'')+'</p><p class="acceptance-muted">Follow-up: '+esc((r.followup_status||'new').replaceAll('_',' '))+'</p>';
      list.append(x);
    }
    if(!data.registrations?.length)list.innerHTML='<p>No matching decision records.</p>';
  }
  async function renderPartnerAdmin(){
    const campaign=$('#admin-campaign').value;if(!campaign)return;
    try{
      const data=await rpc('outreach_partner_admin_workspace',{p_action:'list',p_campaign:campaign,p_payload:{}});
      const list=$('#partner-admin-list');list.innerHTML='';
      for(const p of data.partners||[]){
        const x=document.createElement('article');x.className='acceptance-record';
        x.innerHTML='<h3>'+esc(p.name)+'</h3><p>'+esc(p.assigned??0)+' assigned · '+esc(p.open??0)+' open · '+esc(p.completed??0)+' completed · '+esc(p.needs_followup??0)+' need follow-up</p><p class="acceptance-muted">'+esc((p.users||[]).map(u=>u.email).filter(Boolean).join(', ')||'No partner users yet')+'</p>';
        list.append(x);
      }
      $('#unassigned-count').textContent=String((data.unassigned_decisions?.length||0)+(data.unassigned_households?.length||0));
      $('#active-assignment-count').textContent=String(data.assignments?.length||0);
      if(!data.partners?.length)list.innerHTML='<p>No partner churches configured for this campaign.</p>';
    }catch(e){$('#partner-admin-list').innerHTML='<div class="acceptance-error">'+esc(e.message)+'</div>';}
  }
  async function renderPartner(){
    const partner=$('#partner-select').value;if(!partner)return;
    try{
      const [ctx,data]=await Promise.all([
        rpc('outreach_partner_workspace',{p_action:'context',p_partner:partner,p_payload:{}}),
        rpc('outreach_partner_workspace',{p_action:'list',p_partner:partner,p_payload:{}})
      ]);
      $('#partner-heading').textContent=ctx.partner.name+' · '+ctx.campaign.name;
      const m=$('#partner-metrics');m.innerHTML='';
      for(const [l,v] of [['Assigned',data.summary.assigned],['Open',data.summary.open],['Completed',data.summary.completed],['Needs follow-up',data.summary.needs_followup]]){
        const x=document.createElement('div');x.className='staff-metric';x.innerHTML='<span>'+esc(l)+'</span><strong>'+esc(v)+'</strong>';m.append(x);
      }
      const list=$('#partner-records');list.innerHTML='';
      for(const a of data.assignments||[]){
        const s=a.subject||{},x=document.createElement('article');x.className='acceptance-record';
        x.innerHTML='<h3>'+esc(s.name||'Assigned record')+'</h3><span class="acceptance-badge">'+esc(s.kind||'record')+'</span><p>'+esc(s.phone||'')+' · '+esc(s.email||'')+'</p><p class="acceptance-muted">Status: '+esc(a.latest_followup?.status||'new')+'</p>'+(s.kind==='household'?'<p class="acceptance-muted">Guardian/adult contact only. Minors are not direct contacts.</p>':'');
        list.append(x);
      }
      if(!data.assignments?.length)list.innerHTML='<p>No records assigned to this partner church.</p>';
    }catch(e){$('#partner-records').innerHTML='<div class="acceptance-error">'+esc(e.message)+'</div>';}
  }
  function activateTab(name){
    $$('.acceptance-tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===name)));
    $$('.acceptance-section').forEach(s=>s.classList.toggle('active',s.id==='tab-'+name));
    if(name==='decisions')renderDecisions().catch(e=>msg(e.message,'error'));
    if(name==='partners')renderPartner().catch(e=>msg(e.message,'error'));
    if(name==='admin')renderPartnerAdmin().catch(e=>msg(e.message,'error'));
  }
  async function boot(){
    const {data:{session}}=await client.auth.getSession();state.session=session;
    $('#login-card').hidden=!!session;$('#workspace').hidden=!session;
    if(session){$('#signed-in').textContent=session.user.email||'Acceptance user';await loadContext();activateTab('overview');}
  }
  $('#send-link').onclick=async()=>{
    const email=$('#acceptance-email').value.trim().toLowerCase();if(!email)return;
    $('#send-link').disabled=true;
    try{
      const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.href.split('#')[0]}});
      if(error)throw error;msg('Secure acceptance sign-in email sent. Open it on this device and return here.');
    }catch(e){msg(e.message,'error');}finally{$('#send-link').disabled=false;}
  };
  $('#sign-out').onclick=async()=>{await client.auth.signOut();location.reload();};
  $$('.acceptance-tabs button').forEach(b=>b.onclick=()=>activateTab(b.dataset.tab));
  $('#decision-load').onclick=()=>renderDecisions().catch(e=>msg(e.message,'error'));
  $('#decision-campaign').onchange=()=>renderDecisions().catch(e=>msg(e.message,'error'));
  $('#partner-select').onchange=()=>renderPartner().catch(e=>msg(e.message,'error'));
  $('#admin-campaign').onchange=()=>renderPartnerAdmin().catch(e=>msg(e.message,'error'));
  client.auth.onAuthStateChange(()=>setTimeout(()=>boot().catch(e=>msg(e.message,'error')),0));
  boot().catch(e=>msg(e.message,'error'));
})();