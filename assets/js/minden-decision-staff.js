/* Minden-only follow-up desk. No direct table reads, exports, writes, or persisted PII. */
(()=>{'use strict';
 const root=document.getElementById('minden-decisions-app');
 const auth=window.ChampionLifeAuth;
 let generation=0;
 const el=(tag,value)=>{const node=document.createElement(tag);if(value!==undefined&&value!==null)node.textContent=String(value);return node};
 const clear=(message)=>{root.replaceChildren(el('p',message));};
 async function boot(){
  const g=++generation;clear('Checking Minden staff access…');
  try{
   const user=await auth?.getUser();
   if(g!==generation)return;
   if(!user||!auth?.client){clear('Sign in with your approved Champion Life staff account to continue.');return;}
   const campaigns=await auth.client.rpc('outreach_registration_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}});
   if(g!==generation)return;
   if(campaigns.error||!Array.isArray(campaigns.data)){clear('Minden staff access unavailable.');return;}
   const campaign=campaigns.data.find(x=>x.name==='Minden Family Fun Day Outreach');
   if(!campaign?.id){clear('You do not have Minden registration access.');return;}
   const result=await auth.client.rpc('outreach_minden_decisions',{p_campaign:campaign.id});
   if(g!==generation)return;
   if(result.error||result.data?.campaign!=='minden-family-fun-day'||!Array.isArray(result.data.decisions)){
    clear('Minden decision reporting is unavailable for this staff account.');return;
   }
   const now=await auth.getUser();if(g!==generation)return;
   if(!now||now.id!==user.id){clear('Session changed. Please sign in again.');return;}
   root.replaceChildren();
   const intro=el('section');intro.className='campaign-heading';intro.append(el('h1','Minden Decisions & Free Book Follow-up'));
   intro.append(el('p','This view shows only Minden decision forms. Family Fun Day preregistrations and attendance are managed separately in Registration & Check-In.'));
   intro.append(el('p','Decision records: '+result.data.total+' · Showing: '+result.data.shown));
   root.append(intro);
   if(!result.data.decisions.length){root.append(el('p','No Minden decisions recorded.'));return;}
   for(const d of result.data.decisions){
    const card=el('article');card.className='campaign-panel';
    card.append(el('h2',(d.first_name||'')+' '+(d.last_name||'')),el('p','Decision: '+(d.decision||'Unknown')));
    card.append(el('p','Email: '+(d.email||'')+' · Phone: '+(d.phone||'')));
    if(d.prayer_request)card.append(el('p','Prayer / follow-up request: '+d.prayer_request));
    if(d.created_at){const date=new Date(d.created_at);if(Number.isFinite(date.getTime()))card.append(el('p','Submitted: '+date.toLocaleString('en-US',{timeZone:'America/Chicago'})+' CT'));}
    root.append(card);
   }
  }catch(_e){if(g===generation)clear('Minden decision reporting is temporarily unavailable.');}
 }
 if(!root||!auth){return;}
 auth.client?.auth.onAuthStateChange(()=>{generation++;clear('Verifying your staff session…');setTimeout(boot,0)});
 window.addEventListener('focus',boot);
 boot();
})();
