(() => {
 window.ChampionPersonDreamTeam=async({root,person,context,auth,current,onFollowup})=>{
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};const section=el('section');root.append(section);const heading=el('h3','Actions'),bar=el('div');bar.className='dt-actionbar';section.append(heading,bar);
  const digits=(person.phone||'').replace(/[^0-9+]/g,'');if(context.can('communications.send')&&/^\+?[0-9]{7,15}$/.test(digits)){const call=el('a','Call');call.href='tel:'+digits;bar.append(call);}else {const call=el('button','Call unavailable');call.disabled=true;bar.append(call);}
  for(const label of ['Text','Email','Send video']){const b=el('button',label+' — not connected');b.disabled=true;bar.append(b);}if(context.can('followup.read')&&context.can('followup.manage')){const b=el('button','Create task');b.addEventListener('click',()=>{if(current())onFollowup(person)});bar.append(b);}
  const {data,error}=await auth.client.rpc('dream_team_person',{p_org:context.organizationId,p_person:person.id});if(!current()||!section.isConnected)return;if(error){section.append(el('p','Dream Team summary is unavailable.'));return;}
  section.append(el('h3','Dream Team'));const a=data.application,t=data.dream_track;section.append(el('p',t?.badge_awarded_at?'Dream Track completed':t?.online_completed_at?'Online coursework complete · Final meeting required':'Dream Track online coursework not yet complete'));
  section.append(el('p',a?a.status.replaceAll('_',' ')+' · Placement '+a.placement_status:'Application not yet available'));
  for(const [label,key] of [['Available','available_at'],['Invited','invited_at'],['Submitted','submitted_at'],['Decision','decision_at']])if(a?.[key])section.append(el('p',label+': '+new Date(a[key]).toLocaleString()));
  if(context.can('dream_team.application.read')){const link=el('a',a?'Open Dream Team workspace':'Enable Dream Team Application');link.href='staff-dream-team.html'+(a?'?application='+encodeURIComponent(a.id):'?person='+encodeURIComponent(person.id));section.append(link);}
  section.append(el('h4','Milestones'));for(const e of data.timeline)section.append(el('p',new Date(e.at).toLocaleString()+' · '+e.type.replaceAll('.',' ').replaceAll('_',' ')));
 };
})();
