/* Minden assigned-decision view. Canonical decision authority only; no contact, export or writes. */
(()=>{'use strict';
 const root=document.getElementById('minden-decisions-app'),auth=window.ChampionLifeAuth;
 if(!root||!auth)return;
 let generation=0,retired=false;
 const el=(tag,value)=>{const node=document.createElement(tag);if(value!==undefined&&value!==null)node.textContent=String(value);return node};
 const clear=message=>root.replaceChildren(el('p',message));
 function removed(records){if(records.some(r=>[...r.removedNodes].some(n=>n===root||n.contains?.(root)))){retired=true;generation++;clear('This view has closed. Reopen Minden Decisions from a current staff session.');}}
 const observer=new MutationObserver(removed);observer.observe(document.documentElement,{childList:true,subtree:true});
 const current=g=>{removed(observer.takeRecords());return !retired&&root.isConnected&&g===generation;};
 async function boot(){
  if(retired)return;
  const g=++generation;clear('Checking assigned Minden decision access…');
  try{
   const client=auth.client,user=await auth.getUser();
   if(!current(g))return;
   if(!user||!client||client!==auth.client){clear('Sign in with your approved Champion Life staff account to continue.');return;}
   const context=await client.rpc('outreach_minden_decisions',{p_campaign:null});
   if(!current(g))return;
   if(context.error||context.data?.kind!=='minden-decision-context'||context.data.scope!=='assigned'||!context.data.campaign_id||!context.data.organization_id){clear('Assigned Minden decision access is unavailable. Registration access does not grant decision access.');return;}
   const actor=await auth.getUser();
   if(!current(g))return;
   if(!actor||actor.id!==user.id||client!==auth.client){clear('Session changed. Please sign in again.');return;}
   const result=await client.rpc('outreach_minden_decisions',{p_campaign:context.data.campaign_id});
   if(!current(g))return;
   if(result.error||result.data?.kind!=='minden-assigned-decisions'||result.data.campaign_id!==context.data.campaign_id||result.data.organization_id!==context.data.organization_id||!Array.isArray(result.data.registrations)){clear('Minden decision reporting is unavailable for this staff account.');return;}
   const now=await auth.getUser();if(!current(g))return;
   if(!now||now.id!==user.id||client!==auth.client){clear('Session changed. Please sign in again.');return;}
   root.replaceChildren();
   const intro=el('section');intro.className='campaign-heading';intro.append(el('h1','Minden Decisions & Free Book Follow-up'));
   intro.append(el('p','Only decision registrations assigned to your current account are shown. Family Fun Day registration, attendance, People and learner answers remain separate.'));
   intro.append(el('p','Assigned records shown: '+result.data.registrations.length+' (first page, up to 50). Contact, export and messaging access are not enabled.'));
   const refresh=el('button','Refresh assigned records');refresh.type='button';refresh.className='campaign-button';refresh.addEventListener('click',()=>{if(current(g)&&root.contains(refresh))boot()});intro.append(refresh);root.append(intro);
   if(!result.data.registrations.length){root.append(el('p','No assigned Minden decisions recorded.'));return;}
   for(const d of result.data.registrations){
    const card=el('article');card.className='campaign-panel';
    card.append(el('h2',d.name||'Assigned registration'),el('p','Decision: '+(d.decision||'Unknown')),el('p','Follow-up status: '+(d.status||'Unknown')));
    if(d.next_contact_on)card.append(el('p','Next review: '+d.next_contact_on));
    if(d.registered_at){const date=new Date(d.registered_at);if(Number.isFinite(date.getTime()))card.append(el('p','Submitted: '+date.toLocaleString('en-US',{timeZone:'America/Chicago'})+' CT'));}
    root.append(card);
   }
  }catch(_e){if(current(g))clear('Minden decision reporting is temporarily unavailable.');}
 }
 auth.client?.auth.onAuthStateChange(()=>{generation++;clear('Verifying your staff session…');setTimeout(boot,0)});
 window.addEventListener('focus',boot);
 window.addEventListener('pagehide',()=>{generation++;clear('Private view cleared. Reopen from your current staff session.');});
 window.addEventListener('pageshow',boot);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;clear('Private view cleared while this page is hidden.');}else boot();});
 boot();
})();
