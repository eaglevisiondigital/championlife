(() => {
 'use strict';const form=document.getElementById('minden-form'),status=document.getElementById('minden-status'),submit=document.getElementById('minden-submit'),challenge=document.getElementById('minden-challenge'),cfg=window.CHAMPION_LIFE_SUPABASE;if(!form)return;
 let token='',widget,busy=false,requestKey=crypto.randomUUID(),snapshot;
 const phone=form.elements.namedItem('phone'),phoneError=document.getElementById('phone-error');
 function validPhone(){const value=phone.value.trim(),valid=!value||(/^[+0-9(). -]+$/.test(value)&&value.replace(/\D/g,'').length>=7&&value.replace(/\D/g,'').length<=15);phone.setCustomValidity(valid?'':'Please enter a valid phone number.');phoneError.hidden=valid;return valid}
 phone.addEventListener('input',validPhone);
 if(!cfg?.url||!cfg?.outreachSiteKey){status.textContent='Applications are temporarily unavailable. Please try again later.';return;}
 window.mindenTurnstileReady=()=>{try{widget=window.turnstile.render(challenge,{sitekey:cfg.outreachSiteKey,action:'minden_volunteer',size:'compact',callback:t=>{token=t;submit.disabled=false;status.textContent='Ready to submit your application.'},'expired-callback':()=>{token='';submit.disabled=true;status.textContent='Please complete the security check again.'},'error-callback':()=>{token='';submit.disabled=true;status.textContent='Security check unavailable. Please reload and try again.'}})}catch{status.textContent='Security check unavailable. Please reload and try again.'}};
 const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=mindenTurnstileReady';script.async=true;script.onerror=()=>{status.textContent='Security check unavailable. Please reload and try again.'};document.head.append(script);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!validPhone()||!form.reportValidity())return;if(!token){status.textContent='Please complete the security check.';return;}
  const data=new FormData(form),payload={};for(const key of['first_name','last_name','email','phone','attendance','rv_experience','travel_choice','passenger_names','additional_information'])payload[key]=data.get(key)||null;
  const serialized=JSON.stringify(payload);if(snapshot&&snapshot!==serialized)requestKey=crypto.randomUUID();snapshot=serialized;payload.request_key=requestKey;
  busy=true;submit.disabled=true;submit.textContent='Sending application…';status.textContent='Saving your application…';
  try{
   const response=await fetch(cfg.url+'/functions/v1/outreach-volunteer-submit',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.publishableKey},body:JSON.stringify({payload,turnstile_token:token,bot_field:data.get('bot_field')||''}),signal:AbortSignal.timeout(35000)});
   const receipt=await response.json();if(!response.ok||receipt.accepted!==true||!/^V-[A-F0-9]{16}$/.test(receipt.reference))throw Error(receipt.message||'Your application was not confirmed. Check your connection and try again. Please keep this tab open.');
   form.replaceChildren();const heading=document.createElement('h3');heading.textContent='Application received';const reference=document.createElement('p');reference.className='receipt';reference.textContent='Reference: '+receipt.reference;const message=document.createElement('p');message.textContent='Pending team selection. We will contact you once the team has been picked. If you previously applied, this is your original receipt; your submitted answers have not been replaced.';const email=document.createElement('p');email.textContent=receipt.confirmation==='accepted'?'Your confirmation has been accepted by our email provider. Check your inbox.':'Your application is saved. Email confirmation is awaiting delivery; please do not submit another application.';form.append(heading,reference,message,email);form.setAttribute('tabindex','-1');form.focus();if(widget!==undefined)window.turnstile.remove(widget);
  }catch(error){status.textContent=error.name==='TimeoutError'?'Your application may have been saved. Keep this tab open and try again to receive the same receipt.':error.message;submit.textContent='Submit volunteer application';}
  finally{busy=false;token='';if(form.contains(submit)){submit.disabled=true;if(widget!==undefined)window.turnstile.reset(widget)}}
 });
})();
