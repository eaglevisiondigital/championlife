(() => {
  'use strict';
  const form=document.getElementById('generalResourceForm'), card=document.getElementById('generalResourceCard');
  const msg=document.getElementById('resource-message'), submit=document.getElementById('resource-submit');
  const verification=document.getElementById('resource-verification'), switchPanel=document.getElementById('resource-switch');
  const codeForm=document.getElementById('resource-code-form'), resend=document.getElementById('resource-resend');
  const client=window.ChampionLifeAuth?.client;
  const account=document.getElementById('resource-account'), accountEmail=document.getElementById('resource-account-email');
  const callbackUrl=new URL(location.href), callbackHash=new URLSearchParams(callbackUrl.hash.slice(1));
  const callbackError=['error','error_code','error_description'].some(k=>callbackUrl.searchParams.has(k)||callbackHash.has(k));
  const callbackToken=callbackHash.get('access_token');
  const callbackPresent=callbackError||['access_token','refresh_token','token_hash','token','type','code'].some(k=>callbackUrl.searchParams.has(k)||callbackHash.has(k));
  let callbackBlocked=callbackError, initialized=false, pageActive=true;
  let activeUserId=null, busy=false, generation=0, pendingEmail='', lastSend=0, requestId=crypto.randomUUID();
  const email=()=>form.elements.namedItem('email').value.trim().toLowerCase();
  const tell=(text,error=false)=>{msg.textContent=text;msg.className='bes-form-msg show '+(error?'error':'success')};
  const setBusy=value=>{busy=value;submit.disabled=value;codeForm.querySelector('button').disabled=value;resend.disabled=value};
  const verified=u=>u?.id&&u.email_confirmed_at&&!u.is_anonymous;
  const user=async()=>{const r=await client.auth.getUser();if(r.error){if(r.error.name==='AuthSessionMissingError')return null;throw r.error;}return r.data?.user||null};
  function showAccount(u){
    account.hidden=!verified(u); accountEmail.textContent=verified(u)?`Currently signed in as ${u.email}`:'';
    switchPanel.hidden=!verified(u);
    document.getElementById('resource-switch-message').textContent='Use another email? Sign out before registering with it.';
  }
  function clearPrivate(){
    generation++;card.classList.remove('registered');showAccount(null);
    document.getElementById('generalResourceAccountNote').textContent='';verification.hidden=true;
    form.reset();document.getElementById('resource-code').value='';pendingEmail='';requestId=crypto.randomUUID();
  }
  function failedCallback(){
    callbackBlocked=true;card.classList.remove('registered');
    tell('That verification link is invalid, expired or already used. Your existing sign-in has not verified this request. Complete the form to request a new verification email.',true);
  }
  function scrubCallback(){
    const u=new URL(location.href);
    for(const k of ['error','error_code','error_description','access_token','refresh_token','token_hash','token','code','expires_in','expires_at','token_type','type'])u.searchParams.delete(k);
    if(callbackPresent)u.hash='';
    history.replaceState(null,'',u.pathname+u.search+u.hash);
  }
  const mismatch=u=>{
    showAccount(u);
    document.getElementById('resource-switch-message').textContent=`You are signed in as ${u.email}. Switch accounts to register ${email()}, or use your signed-in email.`;
    switchPanel.hidden=false;verification.hidden=true;
  };
  const accepted=(data,u)=>{
    if(data?.registered!==true||typeof data.reference!=='string'||!/^[a-f0-9-]{36}$/i.test(data.reference))throw Error('UNCONFIRMED');
    if(callbackBlocked)return;
    card.classList.add('registered');verification.hidden=true;showAccount(u);
    document.getElementById('generalResourceAccountNote').textContent=`Registered with verified email ${u.email}. Reference: ${data.reference}. Your book opens through the private reader; course enrollment and progress remain separate.`;
    // Sensitive optional fields are never persisted in browser storage.
    form.elements.namedItem('prayer').value='';document.getElementById('resource-code').value='';
  };
  async function send(){
    if(Date.now()-lastSend<60000){tell('Please wait a minute before requesting another verification email.',true);return}
    const target=email(),stamp=generation;
    lastSend=Date.now(); // Also throttle uncertain deliveries; never assume a failed response means no email.
    const r=await client.auth.signInWithOtp({email:target,options:{emailRedirectTo:location.origin+'/king-kind/',shouldCreateUser:true}});
    if(stamp!==generation)return;
    if(r.error){tell('We could not send verification. Please wait and try again. No resource registration has been confirmed.',true);return}
    lastSend=Date.now();pendingEmail=target;verification.hidden=false;
    tell('Verification requested. Check your inbox; your resource registration is not complete yet.');
  }
  async function register(){
    if(!initialized)return;
    const stamp=generation,u=await user();
    if(stamp!==generation)return;
    if(!verified(u)){await send();return}
    if(u.email.toLowerCase()!==email()){mismatch(u);return}
    if(callbackBlocked){await send();return}
    showAccount(u);
    const data=new FormData(form);
    const payload={request_id:requestId,name:String(data.get('name')||'').trim(),email:email(),phone:String(data.get('phone')||'').trim(),prayer:String(data.get('prayer')||'').trim(),interest:String(data.get('interest')||''),resource_consent:data.get('resource-consent')==='on',ministry_updates:data.get('updates')==='on',consent_version:'general-resources-v1'};
    const r=await client.rpc('general_resource_registration',{action:'register',payload});
    if(stamp!==generation)return;
    if(r.error){tell(r.error.code==='22023'?'Check your name, email, optional phone and required resource consent.':'Registration could not be confirmed. Your access is unchanged. Please try again; retries will not create a second registration.',true);return}
    const current=await user();if(stamp!==generation||!verified(current)||current.id!==u.id){tell('Your session changed. Sign in again to confirm access.',true);return}
    accepted(r.data,current);
  }
  async function guarded(work){if(busy||!initialized)return;setBusy(true);const stamp=generation;try{await work()}catch{if(stamp!==generation)return;clearPrivate();tell('We could not confirm completion. Check your connection and retry. No access is confirmed until verification and registration succeed.',true)}finally{setBusy(false)}}
  if(!client){submit.disabled=true;tell('Registration is temporarily unavailable. Please try again later.',true);return}
  form.addEventListener('submit',e=>{e.preventDefault();if(form.reportValidity())guarded(register)});
  resend.addEventListener('click',()=>{if(form.reportValidity())guarded(send)});
  codeForm.addEventListener('submit',e=>{e.preventDefault();if(!codeForm.reportValidity()||!form.reportValidity())return;guarded(async()=>{
    if(!pendingEmail||pendingEmail!==email()){tell('Your email changed. Request verification for the current email first.',true);return}
    const stamp=generation,r=await client.auth.verifyOtp({email:pendingEmail,token:document.getElementById('resource-code').value.trim(),type:'email'});
    if(stamp!==generation)return;
    if(r.error){tell('That code is invalid or expired. Check the latest email or request a new one.',true);return}
    const current=await user();
    if(!verified(current)||current.email.toLowerCase()!==pendingEmail||r.data?.user?.id!==current.id){failedCallback();return}
    callbackBlocked=false;await register();
  })});
  document.getElementById('resource-switch-button').addEventListener('click',()=>guarded(async()=>{
    clearPrivate(); // Clear before awaiting logout; a failed signout cannot show old resource state.
    const r=await client.auth.signOut({scope:'local'});
    if(r.error){showAccount(await user());tell('We could not sign out. Please try again; no registration was submitted for the other account.',true);return}
    activeUserId=null;lastSend=0;
    tell('Signed out. Submit the form to verify your registration email.');
  }));
  client.auth.onAuthStateChange?.((event,session)=>{
    const next=session?.user?.id||null,changed=activeUserId&&next!==activeUserId;
    activeUserId=next;
    if(event==='SIGNED_OUT'||changed){clearPrivate();tell('Your account changed. Verify your registration email before continuing.');}
  });
  window.addEventListener('pagehide',()=>{pageActive=false;clearPrivate()});
  window.addEventListener('pageshow',()=>{pageActive=true;if(initialized&&!busy)refresh()});
  async function refresh(){
    if(!pageActive)return;
    const stamp=generation;
    try{
      const u=await user();if(stamp!==generation)return;
      showAccount(u);activeUserId=u?.id||null;
      if(callbackBlocked){failedCallback();return}
      if(!verified(u)){card.classList.remove('registered');return}
      const r=await client.rpc('general_resource_registration',{action:'status',payload:{}});
      if(stamp!==generation)return;
      const current=await user();if(stamp!==generation||!verified(current)||current.id!==u.id){if(stamp===generation)clearPrivate();return}
      if(email()&&email()!==current.email.toLowerCase()){mismatch(current);return}
      if(!r.error&&r.data?.registered===true)accepted(r.data,current);
      else {card.classList.remove('registered');tell(`Signed in as ${u.email}. Complete the form to register for your resources.`)}
    }catch{if(stamp===generation){clearPrivate();tell('We could not verify your current session. Sign in again before accessing your resources.',true)}}
  }
  setBusy(true);
  (async()=>{
    try{
      const result=await client.auth.initialize();
      if(result?.error||callbackError)callbackBlocked=true;
      if(callbackPresent&&!callbackBlocked){
        const session=(await client.auth.getSession()).data?.session;
        // Current provider template returns an implicit token. Never treat an old session as callback proof.
        if(!callbackToken||session?.access_token!==callbackToken)callbackBlocked=true;
      }
    }catch{callbackBlocked=true}
    finally{scrubCallback();initialized=true;setBusy(false)}
    await refresh();
  })();
})();
