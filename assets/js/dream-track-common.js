(() => {
 'use strict';
 const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const button=(text,fn)=>{const b=el('button',text,{type:'button',class:'btn gold'});b.addEventListener('click',fn);return b;};
 async function rpc(name,args,userId){
  const session=await window.ChampionLifeAuth?.getSession();if(!session||session.user.id!==userId)throw Error('Account changed. Sign in again.');
  const cfg=window.CHAMPION_LIFE_SUPABASE;
  const res=await fetch(cfg.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(args)});
  const data=await res.json();if(!res.ok||data?.error)throw Error(data?.error||data?.message||'Could not save. Please try again.');return data;
 }
 const time=v=>{v=Math.floor(v);return Math.floor(v/60)+':'+String(v%60).padStart(2,'0');};
 function courses(root,state){root.replaceChildren(el('p',state.status,{class:'dream-state'}));const grid=el('div',null,{class:'dream-cards'});root.append(grid);
  for(const l of state.lessons){const c=el('article',null,{class:'dream-card'});c.append(el('h3',`${l.number}. ${l.title}`),el('p',l.status==='completed'?`Passed · ${l.mastered*5}%`:l.unlocked?`${l.mastered*5}% mastered · ${Math.floor(l.watched_percent)}% watched`:'Locked'));
   if(l.unlocked)c.append(el('a',l.status==='completed'?'Review lesson':'Continue lesson',{href:`dream-track-${l.number}.html`,class:'btn gold'}));grid.append(c);
  }
 }
 function invitationLanding(root,state){
  if(!state.enrolled)throw Error('No active Dream Track invitation was found for this account. Sign in with the invited email address or ask your inviter for a new link.');
  const card=el('section',null,{class:'dream-card dream-enrollment','aria-labelledby':'dream-enrollment-title'});
  const completed=state.status==='Dream Track Completed';
  const onlineComplete=state.status==='ONLINE COURSEWORK COMPLETE – FINAL MEETING REQUIRED';
  card.append(el('p','DREAM TRACK',{class:'eyebrow'}),el('h2',completed?'Dream Track completed.':onlineComplete?'Your online coursework is complete.':'You’re enrolled in Dream Track.',{id:'dream-enrollment-title'}));
  if(completed)card.append(el('p','You’ve completed your Dream Track journey and final meeting. Your achievement is saved to your account.'));
  else if(onlineComplete)card.append(el('p','You’ve finished all seven lessons. Your final meeting is the next step.'));
  else{
   const current=[...state.lessons].sort((a,b)=>a.number-b.number).find(l=>l.unlocked&&l.status!=='completed'&&Number.isInteger(l.number)&&l.number>=1&&l.number<=7);
   if(!current)throw Error('Your next lesson is not available yet. Open Dream Track to check your progress.');
   const started=current.number>1||current.watched_percent>0||current.mastered>0||current.resume_seconds>0||current.last_activity;
   card.append(el('p',started?'Your progress is saved. Continue your Dream Track journey.':'Your Dream Track journey is ready to begin.'),el('p',`Lesson ${current.number} — ${current.title}`),el('a',started?'RESUME DREAM TRACK':'START DREAM TRACK',{href:`dream-track-${current.number}.html`,class:'btn gold'}));
  }
  if(completed||onlineComplete)card.append(el('a','Review Dream Track',{href:'dream-track.html',class:'btn gold'}));
  const actions=el('div',null,{class:'dream-enrollment-actions'}),secondary=el('p',null,{class:'dream-enrollment-secondary'});
  secondary.append(el('a','Go to My Discipleship',{href:'my-discipleship.html',class:'btn'}));actions.append(card.lastElementChild,secondary);card.append(actions);
  root.replaceChildren(card);
 }
 window.DreamTrack={el,button,rpc,time,courses,invitationLanding};
})();
