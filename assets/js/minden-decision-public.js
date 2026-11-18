/* Protected decision submission. Status is a receipt capability; no email/PII lookup. */
(async()=>{
 'use strict';
 const $=id=>document.getElementById(id),form=$('decision-form'),fields=$('decision-fields'),submit=$('decision-submit'),check=$('decision-check'),retry=$('decision-retry'),status=$('decision-status');
 const es=document.documentElement.lang==='es',t=(a,b)=>es?b:a,key='minden-decision-receipt-v2',cfg=window.MINDEN_DECISION_CONFIG;
 let policy=null,challenge=null,token='',pending=null,frozen=null,busy=false,active=false;
 const show=message=>{status.textContent=message};
 const persist=()=>{sessionStorage.setItem(key,JSON.stringify(pending))};
 const accepted=data=>{pending.state='ACCEPTED';persist();fields.disabled=true;check.hidden=true;retry.hidden=true;$('decision-receipt').hidden=false;$('decision-receipt').querySelector('code').textContent=data.receipt;show(t('Your decision was saved. Keep your receipt ID. No email was sent by this form.','Tu decisión se guardó. Conserva el ID del comprobante. Este formulario no envió ningún correo.'))};
 const unknown=()=>{pending.state='UNKNOWN';persist();fields.disabled=true;check.hidden=false;retry.hidden=!frozen;show(t('The result is not confirmed. Check this submission before trying again. Do not start another submission.','El resultado no está confirmado. Consulta este envío antes de reintentar. No inicies otro envío.'))};
 const call=async(action,payload)=>{
  const response=await fetch(cfg.projectUrl+'/functions/v1/minden-decision-submit',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(16000),body:JSON.stringify({action,request_id:pending.id,receipt_secret:pending.secret,...(payload?{payload,turnstile_token:token,website:''}:{})})});
  const data=await response.json();
  if(response.ok&&data.state==='ACCEPTED'&&data.receipt===pending.id&&Number.isFinite(Date.parse(data.accepted_at)))return accepted(data);
  if(response.ok&&data.state==='REJECTED'){pending.state='REJECTED';persist();fields.disabled=true;check.hidden=true;retry.hidden=true;show(t('This submission was rejected and was not saved. Reload to review the current permissions before making a new submission.','Este envío fue rechazado y no se guardó. Recarga la página para revisar los permisos actuales antes de realizar un nuevo envío.'));return}
  if(data.state==='CONFLICT')show(t('This receipt belongs to a different submission. Keep the receipt and ask the outreach team for help.','Este comprobante corresponde a otro envío. Consérvalo y pide ayuda al equipo de alcance.'));
  else unknown();
 };
 const transact=async(action,payload)=>{
  if(busy)return;busy=true;submit.disabled=true;check.disabled=true;retry.disabled=true;
  try{await call(action,payload)}catch{unknown()}
  finally{busy=false;check.disabled=false;retry.disabled=false;token='';if(challenge!==null)window.turnstile?.reset(challenge)}
 };
 const refreshGuardian=()=>{const guardian=form.elements.subject_kind.value==='guardian';$('guardian-field').hidden=!guardian;$('guardian-attestation').hidden=!guardian;form.elements.guardian_name.required=guardian;form.elements.guardian_attested.required=guardian;if(!guardian){form.elements.guardian_name.value='';form.elements.guardian_attested.checked=false}};
 form.elements.subject_kind.addEventListener('change',refreshGuardian);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||pending||!active||!token||!form.reportValidity()||form.elements.website.value)return;
  const v=name=>form.elements[name].value,yes=name=>form.elements[name].checked;
  frozen=Object.freeze({first_name:v('first_name').trim(),last_name:v('last_name').trim(),email:v('email').trim().toLowerCase(),phone:v('phone').trim(),decision:v('decision'),prayer_request:v('prayer_request'),policy_id:policy.policy_id,locale:es?'es':'en',subject_kind:v('subject_kind'),guardian_name:v('guardian_name').trim(),processing_consent:yes('processing_consent'),resource_consent:yes('resource_consent'),followup_consent:yes('followup_consent'),adult_attested:yes('adult_attested'),guardian_attested:yes('guardian_attested')});
  const bytes=crypto.getRandomValues(new Uint8Array(32));pending={id:crypto.randomUUID(),secret:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),state:'UNKNOWN'};
  // Persist receipt capability BEFORE network I/O. Never store name, email, phone or prayer text.
  try{persist()}catch{pending=null;frozen=null;show(t('This browser cannot retain a submission receipt. Enable storage before submitting.','Este navegador no puede conservar el comprobante. Habilita el almacenamiento antes de enviar.'));return}
  fields.disabled=true;await transact('submit',frozen);
 });
 check.addEventListener('click',()=>pending&&transact('status'));
 retry.addEventListener('click',()=>{if(!pending||!frozen||busy||!token)return show(t('Complete a new security check before retrying the same submission.','Completa una nueva verificación de seguridad antes de reintentar el mismo envío.'));transact('submit',frozen)});
 try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved&&/^[0-9a-f-]{36}$/.test(saved.id)&&/^[0-9a-f]{64}$/.test(saved.secret)&&['UNKNOWN','ACCEPTED'].includes(saved.state))pending=saved}catch{show(t('Stored receipt is unavailable. Do not resubmit an earlier unconfirmed decision.','El comprobante guardado no está disponible. No vuelvas a enviar una decisión sin confirmar.'));return}
 $('decision-revoke').addEventListener('submit',async event=>{event.preventDefault();const f=event.currentTarget,out=$('revoke-status'),button=f.querySelector('button');button.disabled=true;try{if(!f.elements.resource.checked&&!f.elements.followup.checked)throw Error('select');const{data,error}=await window.ChampionLifeAuth.client.rpc('minden_decision_revoke',{p_request:f.elements.receipt.value.trim(),p_resource:f.elements.resource.checked,p_followup:f.elements.followup.checked});if(error||!data?.revoked)throw Error('denied');out.textContent=t('Selected permissions were withdrawn.','Se retiraron los permisos seleccionados.')}catch{out.textContent=t('Sign in with the submitted email and check your receipt ID. No permission change is confirmed.','Inicia sesión con el correo proporcionado y verifica el ID del comprobante. No se confirmó ningún cambio.')}finally{button.disabled=false}});
 try{
  if(!cfg||cfg.enabled!==true||cfg.origin!==location.origin||cfg.projectUrl!==window.CHAMPION_LIFE_SUPABASE?.url||!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(cfg.projectUrl)||!cfg.turnstileSiteKey||/^[123]x0+/.test(cfg.turnstileSiteKey))throw Error('closed');
  if(location.hostname!=='championlifefwb.com'&&new URL(cfg.projectUrl).hostname==='exdocjbmylgxssanymjk.supabase.co')throw Error('preview');
  if(pending){unknown();await transact('status');return}
  const{data,error}=await window.ChampionLifeAuth.client.rpc('minden_decision_config');if(error||!data?.enabled||!data.policy_id)throw Error('closed');policy=data;
  for(const span of document.querySelectorAll('[data-policy]')){const copy=policy.copy?.[es?'es':'en']?.[span.dataset.policy];if(typeof copy!=='string'||copy.length<12)throw Error('policy');span.textContent=copy}
  $('guardian-option').disabled=!policy.allow_guardian;
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;
  script.onload=()=>{challenge=window.turnstile.render('#decision-challenge',{sitekey:cfg.turnstileSiteKey,action:'minden_decision',callback:value=>{token=value;submit.disabled=!!pending||busy;retry.disabled=busy},'expired-callback':()=>{token='';submit.disabled=true},'error-callback':()=>{token='';submit.disabled=true}});fields.disabled=false;active=true;refreshGuardian();show(t('Review the current permissions and complete the security check.','Revisa los permisos actuales y completa la verificación de seguridad.'))};
  script.onerror=()=>show(t('The security check is unavailable. Please return later.','La verificación de seguridad no está disponible. Vuelve más adelante.'));document.head.append(script);
 }catch{fields.disabled=true;show(t('Decision registration is not open. Existing volunteer signup is available separately.','El registro de decisiones no está abierto. La solicitud de voluntariado está disponible por separado.'))}
})();
