/* Staff-only session presentation. Uses the existing Supabase client. */
(() => {
 'use strict';
 const account=document.getElementById('staff-session');
 const email=document.getElementById('staff-session-email');
 const logout=document.getElementById('staff-logout');
 const message=document.getElementById('staff-session-message');
 const main=document.getElementById('staff-main');
 const auth=window.ChampionLifeAuth;
 if(!account||!email||!logout||!message||!main||!auth?.client?.auth)return;
 const login='discipleship-login.html?next=%2Fstaff-people.html';
 let currentId=null,revision=0,leaving=false,signingOut=false;
 // Detach module mounts, so pending responses can only update detached elements.
 function clearWorkspace(){
  main.replaceChildren();
  const financial=document.getElementById('financial-outreach-link');
  if(financial)financial.hidden=true;
 }
 function clearReturnHint(){try{sessionStorage.removeItem('championlife-auth-next')}catch{}}
 function leave(){
  if(leaving)return;
  leaving=true;revision++;clearWorkspace();email.textContent='';account.hidden=true;
  clearReturnHint();location.replace(login);
 }
 function display(user){
  currentId=user?.id||null;
  email.textContent=user?.email||'';
  account.hidden=!currentId;
 }
 const initial=++revision;
 auth.getUser().then(user=>{if(initial===revision&&!signingOut&&!leaving)display(user)}).catch(()=>{if(initial===revision)display(null)});
 auth.client.auth.onAuthStateChange((event,session)=>{
  revision++;
  if(signingOut||leaving)return;
  if(event==='SIGNED_OUT'||(currentId&&session?.user?.id!==currentId)){
   clearWorkspace();email.textContent='';account.hidden=true;
   // Never call another Supabase auth method inside its auth-state callback.
   setTimeout(leave,0);return;
  }
  display(session?.user);
 });
 logout.addEventListener('click',async()=>{
  if(signingOut||leaving)return;
  signingOut=true;revision++;logout.disabled=true;logout.textContent='Logging out…';
  clearWorkspace();message.textContent='Logging out of this browser session…';
  try{
   const {error}=await auth.client.auth.signOut({scope:'local'});
   if(error)throw error;
   // Do not claim success if the client still holds an active session.
   if(await auth.getSession())throw Error('Session remains active');
   leave();
  }catch{
   message.textContent='Log out could not be completed. Your workspace is hidden. Check your connection and try Log Out again.';
   logout.disabled=false;logout.textContent='Log Out';signingOut=false;
  }
 });
 // Clear before the browser can retain a back/forward-cache snapshot.
 window.addEventListener('pagehide',()=>{
  revision++;clearWorkspace();email.textContent='';account.hidden=true;main.hidden=true;
 });
 window.addEventListener('pageshow',event=>{
  if(event.persisted){clearWorkspace();main.hidden=true;location.reload()}
 });
})();
