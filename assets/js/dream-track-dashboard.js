(() => {
 const root=document.getElementById('dream-dashboard'),T=window.DreamTrack,auth=window.ChampionLifeAuth;if(!root||!T)return;let generation=0,userId=null;
 async function boot(){const g=++generation;root.replaceChildren();try{const user=await auth?.getUser();if(g!==generation)return;userId=user?.id;if(!user)return;const s=await T.rpc('dream_track',{p_action:'claim_pending',p_data:{}},user.id);if(g!==generation)return;T.courses(root,s);T.applicationNext?.(root,user.id);if(!s.enrolled)root.append(T.el('a','Join Dream Track',{href:'dream-track-access.html',class:'btn gold'}));}catch(_){if(g===generation)root.textContent='Dream Track is unavailable. Refresh to try again.';}}
 auth?.client.auth.onAuthStateChange((_e,s)=>{if(s?.user?.id!==userId){generation++;root.replaceChildren();setTimeout(boot,0)}});boot();
})();
