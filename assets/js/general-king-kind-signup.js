(() => {
  'use strict';
  const auth=window.ChampionLifeAuth;
  const byId=id=>document.getElementById(id);
  const loading=byId('loading'),signin=byId('signin'),register=byId('register'),
    success=byId('success'),message=byId('result'),submit=byId('submit'),emailText=byId('account-email');
  let currentUserId=null, generation=0, submitting=false;
  const hideProtected=()=>{register.hidden=true;success.hidden=true;emailText.textContent='';};
  const alertUser=text=>{message.hidden=!text;message.textContent=text||'';};
  function show(view){loading.hidden=view!=='loading';signin.hidden=view!=='signin';register.hidden=view!=='register';success.hidden=view!=='success';}
  async function refresh(){
    const token=++generation;
    hideProtected();alertUser('');show('loading');
    if(!auth?.client){show('signin');alertUser('Sign-in is unavailable. Please try again later.');return;}
    try{
      const {data,error}=await auth.client.auth.getUser();
      if(token!==generation)return;
      if(error||!data?.user?.id||!data.user.email){currentUserId=null;show('signin');return;}
      currentUserId=data.user.id;
      emailText.textContent=data.user.email;
      show('register');
    }catch(_){if(token===generation){currentUserId=null;show('signin');alertUser('Unable to verify your session. Please sign in again.');}}
  }
  register.addEventListener('submit',async event=>{
    event.preventDefault();
    if(submitting||!register.reportValidity()||!currentUserId)return;
    const requestedUser=currentUserId,token=generation;
    const first=byId('first').value.trim(),last=byId('last').value.trim();
    if(!first||!last||first.length>100||last.length>100){alertUser('Enter your first and last name.');return;}
    submitting=true;submit.disabled=true;alertUser('');
    try {
      const {data:check,error:checkError}=await auth.client.auth.getUser();
      if(checkError||check?.user?.id!==requestedUser){await refresh();throw Error('Your account changed. Sign in again before registering.');}
      const {data,error}=await auth.client.rpc('register_general_king_kind_resource',{p_first_name:first,p_last_name:last});
      if(error||data?.registered!==true)throw Error('Registration could not be completed. Please try again.');
      if(token!==generation||currentUserId!==requestedUser)return;
      const {data:confirm,error:confirmError}=await auth.client.auth.getUser();
      if(confirmError||confirm?.user?.id!==requestedUser){await refresh();return;}
      // Course enrollment is performed by the registration RPC in one transaction,
      // bound to auth.uid(). Never issue separate client-side writes after a response,
      // because the user may have changed accounts while the request was pending.
      if(token!==generation||currentUserId!==requestedUser)return;
      byId('first').value='';byId('last').value='';
      show('success');
    } catch(_e){
      if(token===generation&&currentUserId===requestedUser)alertUser('Unable to finish registration. Please check your connection and try again.');
    }finally{submitting=false;submit.disabled=false;}
  });
  const changeAccount=register.querySelector('a.action.secondary');
  changeAccount?.addEventListener('click',async event=>{
    event.preventDefault();
    ++generation;currentUserId=null;hideProtected();show('loading');
    try{await auth.client.auth.signOut({scope:'local'});}catch(_e){alertUser('Sign-out did not complete. Please try again.');show('signin');return;}
    location.assign(changeAccount.href);
  });
  if(auth?.client?.auth?.onAuthStateChange){
    auth.client.auth.onAuthStateChange((_event,session)=>{
      if(currentUserId && session?.user?.id!==currentUserId){
        ++generation;currentUserId=null;hideProtected();show('signin');alertUser('');
      }
    });
  }
  refresh();
})();
