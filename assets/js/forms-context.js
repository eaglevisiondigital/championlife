/* Canonical Forms module context; reuses the existing Auth client, never creates identity. */
(() => {
 'use strict';
 const auth=window.ChampionLifeAuth, root=document.getElementById('forms-app');
 if(!auth?.client||!root)return;
 let principal=null,revision=0,sequence=0,context={user:null,forms:{organizations:[]}},closed=false;
 const initialClient=auth.client;
 const api=window.ChampionLifeFormsContext={get context(){return context},refresh,capture:()=>({revision,principal,auth,client:initialClient}),verify,verifyAuthority};
 function emit(){window.dispatchEvent(new CustomEvent('staff-workspace-context',{detail:context}));}
 function clear(){revision++;context={user:null,forms:{organizations:[]}};emit();root.replaceChildren(Object.assign(document.createElement('p'),{textContent:'Forms access is no longer available. Sign in with your authorized account.'}));}
 async function identity(){const result=await initialClient.auth.getUser();if(result.error)throw result.error;return result.data?.user||null;}
 async function verify(b){
  if(closed||b.revision!==revision||b.principal!==principal)return false;
  if(window.ChampionLifeAuth!==auth||auth.client!==initialClient){clear();return false;}
  let user;try{user=await identity()}catch{user=null;}
  if(closed||b.revision!==revision||b.principal!==principal)return false;
  if(!user?.id||user.id!==principal){principal=user?.id||null;clear();return false;}
  return true;
 }
 async function verifyAuthority(b){
  if(closed||!principal||b.principal!==principal)return false;
  if(window.ChampionLifeAuth!==auth||auth.client!==initialClient){clear();return false;}
  let user;try{user=await identity()}catch{if(b.principal===principal)clear();return false;}
  if(closed||b.principal!==principal)return false;
  if(window.ChampionLifeAuth!==auth||auth.client!==initialClient){clear();return false;}
  if(!user?.id||user.id!==principal){principal=user?.id||null;clear();return false;}
  return true;
 }
 async function refresh(){
  const request=++sequence;let user;
  try{user=await identity();if(request!==sequence||closed)return;
   if(!user){principal=null;clear();return;}
   if(principal!==user.id){principal=user.id;clear();}
   const binding=api.capture();const result=await initialClient.rpc('forms_workspace',{p_action:'context',p_org:null,p_payload:{}});
   const denied=result.error&&(['42501','PGRST301','PGRST302'].includes(result.error.code)||[401,403].includes(result.status));
   if(denied&&await verifyAuthority(binding)){clear();return;}
   if(request!==sequence||!await verify(binding))return;
   if(result.error)throw result.error;
   if(result.data?.capabilities?.profile!=='private_draft_v1')throw Error('Reviewed Forms capability profile unavailable');
   const next={user,forms:result.data};
   if(JSON.stringify(next)!==JSON.stringify(context)){revision++;context=next;emit();}
  }catch{if(request===sequence&&!closed)clear();}
 }
 initialClient.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'||(principal&&session?.user?.id!==principal)){sequence++;principal=session?.user?.id||null;clear();}
  // Never perform Auth I/O while its callback lock is held.
  setTimeout(refresh,0);
 });
 window.addEventListener('focus',refresh);
 window.addEventListener('pagehide',()=>{closed=true;sequence++;clear();});
 window.addEventListener('pageshow',e=>{if(e.persisted){closed=false;principal=null;clear();refresh();}});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){sequence++;clear();}else refresh();});
 setInterval(()=>{if(document.visibilityState==='visible')refresh()},30000);
 refresh();
})();
