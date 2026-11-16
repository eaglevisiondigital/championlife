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
 window.DreamTrack={el,button,rpc,time,courses};
})();
