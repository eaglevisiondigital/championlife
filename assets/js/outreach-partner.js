/* Shared guest form: brand selects presentation/source only, never tenant authority. */
(() => {
 'use strict';
 if(window.OutreachPartner)return;
 const limits={'first-name':100,'last-name':100,email:254,'address-line-1':250,'address-line-2':250,city:100,'state-province':100,'postal-code':30,phone:60,'commitment-amount':20,'commitment-frequency':100};
 const template="<div class=\"outreach-partner-dialog\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"outreach-partner-title\"><div class=\"outreach-partner-head\"><img class=\"outreach-brand-logo\" src=\"/assets/images/logo-gold.png\" alt=\"Champion Life\"><span class=\"eyebrow\">Champion Life Outreach</span><h2 id=\"outreach-partner-title\">Become an Outreach Partner</h2><p>Thank you for helping us take the Gospel to cities and nations. Complete your partnership information below, then we\u2019ll take you directly to the secure outreach giving page.</p><button class=\"outreach-partner-close\" type=\"button\" aria-label=\"Close outreach partner form\" data-outreach-partner-close>\u00d7</button></div><form class=\"outreach-partner-form\" id=\"outreach-partner-form\" name=\"outreach-partner\" method=\"POST\"><p class=\"outreach-honeypot\"><label>Do not fill this out: <input name=\"bot-field\"></label></p><section class=\"outreach-form-section\"><h3>Your Information</h3><p>Tell us how to stay connected with you as an outreach partner.</p><div class=\"outreach-field-grid\"><label class=\"outreach-field\"><span>First Name *</span><input type=\"text\" name=\"first-name\" autocomplete=\"given-name\" required></label><label class=\"outreach-field\"><span>Last Name *</span><input type=\"text\" name=\"last-name\" autocomplete=\"family-name\" required></label><label class=\"outreach-field full\"><span>Email Address *</span><input type=\"email\" name=\"email\" autocomplete=\"email\" required></label><label class=\"outreach-field full\"><span>Street Address *</span><input type=\"text\" name=\"address-line-1\" autocomplete=\"address-line1\" required></label><label class=\"outreach-field full\"><span>Street Address Line 2</span><input type=\"text\" name=\"address-line-2\" autocomplete=\"address-line2\"></label></div><div class=\"outreach-field-grid three\" style=\"margin-top:16px\"><label class=\"outreach-field\"><span>City *</span><input type=\"text\" name=\"city\" autocomplete=\"address-level2\" required></label><label class=\"outreach-field\"><span>State / Province *</span><input type=\"text\" name=\"state-province\" autocomplete=\"address-level1\" required></label><label class=\"outreach-field\"><span>Postal / ZIP Code *</span><input type=\"text\" name=\"postal-code\" autocomplete=\"postal-code\" required></label></div><div class=\"outreach-field-grid\" style=\"margin-top:16px\"><label class=\"outreach-field\"><span>Phone Number *</span><input type=\"tel\" name=\"phone\" autocomplete=\"tel\" required></label></div></section><section class=\"outreach-form-section outreach-commitment\"><h3>Your Partnership Commitment</h3><p>Choose the recurring amount and schedule you plan to begin with.</p><div class=\"outreach-commitment-grid\"><label class=\"outreach-field\"><span>Commitment Amount *</span><span class=\"outreach-amount-wrap\"><b>$</b><input type=\"number\" name=\"commitment-amount\" min=\"1\" step=\"0.01\" inputmode=\"decimal\" required></span></label><label class=\"outreach-field\"><span>Commitment Frequency *</span><select name=\"commitment-frequency\" required><option value=\"\">Select frequency</option><option value=\"Weekly\">Weekly</option><option value=\"Bi-weekly\">Bi-weekly</option><option value=\"Monthly\">Monthly</option></select></label></div><p class=\"outreach-change-note\"><strong>This partnership amount can be changed at any time in the future.</strong> Your selection here simply tells Champion Life the partnership level you intend to begin with. Your actual giving is managed securely through the giving page.</p><p class=\"outreach-payment-note\">This is an intended commitment, not a payment or authorization to charge you. Submitting does not subscribe you to marketing messages.</p></section><div class=\"outreach-partner-actions\"><button class=\"btn gold\" type=\"submit\" id=\"outreach-partner-submit\">Submit & Continue to Give</button><button class=\"btn outreach-partner-cancel\" type=\"button\" data-outreach-partner-close>Cancel</button></div><div class=\"outreach-form-status\" id=\"outreach-partner-status\" role=\"status\" aria-live=\"polite\"></div></form></div>";
 let configPromise;
 function config(){
  if(Object.prototype.hasOwnProperty.call(window,'CHAMPION_LIFE_SUPABASE'))return Promise.resolve(window.CHAMPION_LIFE_SUPABASE);
  if(!configPromise)configPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/assets/js/supabase-config.js';s.onload=()=>resolve(window.CHAMPION_LIFE_SUPABASE);s.onerror=()=>{configPromise=null;reject(Error('Form service unavailable. Please try again.'))};document.head.append(s)});
  return configPromise;
 }
 function mount(host,requestedBrand='champion-life'){
  const brand=requestedBrand==='sowgo'?'sowgo':'champion-life',sow=brand==='sowgo';
  host.innerHTML=template;host.classList.add('outreach-brand-'+brand);
  const form=host.querySelector('form'),submit=form.querySelector('[type=submit]'),status=form.querySelector('[role=status]');
  if(sow){const logo=host.querySelector('.outreach-brand-logo');logo.src='/assets/images/sowgo-logo-light.png';logo.alt='SowGo';host.querySelector('.eyebrow').textContent='SowGo Outreach';form.querySelector('.outreach-change-note').lastChild.textContent=' Your selection here simply tells SowGo the partnership level you intend to begin with. Your actual giving is managed securely through the giving page.';}
  const label=sow?'Submit & Continue to Sow':'Submit & Continue to Give';submit.textContent=label;
  for(const[name,max]of Object.entries(limits)){const input=form.elements.namedItem(name);if(input.tagName==='INPUT'&&input.type!=='number')input.maxLength=max;}
  form.elements.namedItem('commitment-amount').max='9999999999.99';
  form.elements.namedItem('bot-field').tabIndex=-1;form.elements.namedItem('bot-field').autocomplete='off';
  let busy=false,requestKey=null,fingerprint=null;
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(busy||!form.reportValidity())return;busy=true;submit.disabled=true;submit.textContent='Submitting…';status.className='outreach-form-status is-working';status.textContent='Saving your partnership information…';
   try{
    const fields=Object.fromEntries(Object.keys(limits).map(k=>[k,form.elements.namedItem(k).value]));
    const payload={brand,source_path:location.pathname,fields};
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const storageKey='outreach-partner-replay:'+brand;
    try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved?.digest===digest&&/^[0-9a-f-]{36}$/i.test(saved.key)){requestKey=saved.key;fingerprint=digest}}catch{}
    if(fingerprint!==digest){requestKey=crypto.randomUUID();fingerprint=digest;}
    try{sessionStorage.setItem(storageKey,JSON.stringify({digest,key:requestKey}))}catch{}
    const cfg=await config();if(!cfg?.url||!cfg?.publishableKey)throw Error('Form service unavailable. Please try again later.');
    const response=await fetch(cfg.url+'/rest/v1/rpc/outreach_partner_submit',{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({p_data:{...payload,request_key:requestKey,bot_field:form.elements.namedItem('bot-field').value}})});
    const data=await response.json();if(!response.ok||data?.accepted!==true)throw Error('We could not save your information. Check the fields and try again. If this continues, please try later.');
    status.textContent='Thank you! Your commitment is saved. Continue to the secure outreach giving page.';
    const link=document.createElement('a');link.href='/outreach-giving.html';link.textContent=sow?'Continue to Sow':'Continue to Give';status.append(document.createElement('br'),link);
    setTimeout(()=>location.assign('/outreach-giving.html'),500);
   }catch(error){status.className='outreach-form-status is-error';status.textContent=error.message;busy=false;submit.disabled=false;submit.textContent=label;}
  });
  return form;
 }
 let modal,previousFocus;
 function open(){
  if(!modal){modal=document.createElement('div');modal.id='outreach-partner-modal';modal.className='outreach-partner-modal';mount(modal);document.body.append(modal);modal.querySelectorAll('[data-outreach-partner-close]').forEach(b=>b.addEventListener('click',close));modal.addEventListener('click',e=>{if(e.target===modal)close()});}
  previousFocus=document.activeElement;modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');document.body.classList.add('outreach-partner-modal-open');modal.querySelector('[name=first-name]').focus();
 }
 function close(){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('outreach-partner-modal-open');previousFocus?.focus();}
 document.addEventListener('keydown',e=>{if(!modal?.classList.contains('is-open'))return;if(e.key==='Escape')close();if(e.key==='Tab'){const items=[...modal.querySelectorAll('button:not(:disabled),input:not([type=hidden]),select,a[href]')].filter(n=>n.tabIndex>=0),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 window.OutreachPartner={mount,open};
 const root=document.getElementById('outreach-partner-root');if(root){mount(root,new URLSearchParams(location.search).get('brand'));root.querySelector('[role=dialog]').removeAttribute('role');root.querySelector('[aria-modal]').removeAttribute('aria-modal');}
})();
