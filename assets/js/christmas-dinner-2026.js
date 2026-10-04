/* Christmas Dinner 2026: registration capture only. Payment remains on GiveHub. */
(function () {
  'use strict';
  const PAYMENT_URL = 'https://www.community.givehub.com/forms/christmas26';
  const CLOSED = 'Online registration for the 2026 Champion Life Christmas Dinner is now closed.';
  const formatter = new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit'});
  function tierAt(date = new Date()) {
    const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type,p.value]));
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    if (day < '2026-10-04') return 'upcoming';
    if (day <= '2026-11-08') return 'early';
    if (day <= '2026-11-29') return 'regular';
    return 'closed';
  }
  const money = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
  const adultRate = tier => tier === 'early' ? 1000 : 1500;
  function ageRate(age, tier) {
    if (!/^\d+$/.test(String(age)) || Number(age)>120) throw Error('Enter a whole-number age from 0 to 120 for each family member.');
    return Number(age)<=5 ? 0 : Number(age)<=12 ? 500 : adultRate(tier);
  }
  function clean(value, max, label, required=true) {
    const text=String(value ?? '').trim();
    if ((required&&!text)||text.length>max||/[\u0000-\u001f\u007f]/.test(text)) throw Error(`Please check ${label}.`);
    return text;
  }
  function calculate(data, date=new Date(), strict=true) {
    const tier=tierAt(date);
    if(strict&&!['early','regular'].includes(tier)) throw Error(tier==='closed'?CLOSED:'Registration opens October 4, 2026.');
    const name=(v,label)=>strict?clean(v,100,label):String(v||'').trim();
    const attendees=[{role:'primary',first_name:name(data.primary_first_name,'your first name'),last_name:name(data.primary_last_name,'your last name'),age_on_event:null,price_cents:adultRate(tier)}];
    if(data.spouse_selected) attendees.push({role:'spouse',first_name:name(data.spouse_first_name,'your spouse’s first name'),last_name:name(data.spouse_last_name,'your spouse’s last name'),age_on_event:null,price_cents:adultRate(tier)});
    for(const person of data.family) {
      let price=null;try{price=ageRate(person.age,tier)}catch(error){if(strict)throw error}
      attendees.push({role:'family',first_name:name(person.first_name,'each family member’s first name'),last_name:name(person.last_name,'each family member’s last name'),age_on_event:price===null?null:Number(person.age),price_cents:price});
    }
    const cents=attendees.some(p=>p.price_cents===null)?null:attendees.reduce((sum,p)=>sum+p.price_cents,0);
    if(cents!==null&&!Number.isSafeInteger(cents))throw Error('Unable to calculate this registration total. Please check your attendees.');
    return {tier,attendees,cents};
  }
  const api={tierAt,ageRate,calculate,money,PAYMENT_URL};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof document==='undefined')return;
  const form=document.getElementById('christmas-registration');
  const fields=form?.querySelector('#christmas-fields');
  const status=document.getElementById('christmas-status');
  let busy=false,saved=false,lastTier=null,nextRow=0;
  const text=(selector,value)=>document.querySelectorAll(selector).forEach(node=>{node.textContent=value});
  function notice(value,error=false){if(!status)return;status.textContent=value;status.classList.toggle('is-error',error);}
  function read(){
    const value=name=>form.elements.namedItem(name).value;
    return {primary_first_name:value('primary_first_name'),primary_last_name:value('primary_last_name'),spouse_selected:form.elements.namedItem('spouse_selected').checked,spouse_first_name:value('spouse_first_name'),spouse_last_name:value('spouse_last_name'),family:[...form.querySelectorAll('[data-family-row]')].map(row=>({first_name:row.querySelector('[data-first]').value,last_name:row.querySelector('[data-last]').value,age:row.querySelector('[data-age]').value}))};
  }
  function update(){
    const tier=tierAt(),open=tier==='early'||tier==='regular';
    const heading=tier==='early'?'Early registration · through November 8':tier==='regular'?'Regular registration · through November 29':tier==='closed'?'Online registration closed':'Registration opens October 4';
    text('[data-tier-label]',heading);
    text('[data-current-pricing]',open?`Ages 13+: ${money(adultRate(tier))} · Ages 6–12: $5.00 · Ages 0–5: FREE`:tier==='closed'?CLOSED:'Early registration: ages 13+ $10 · ages 6–12 $5 · ages 0–5 FREE');
    document.querySelectorAll('[data-registration-cta]').forEach(link=>{link.textContent=open?'REGISTER FOR CHRISTMAS DINNER':'CHRISTMAS DINNER DETAILS'});
    if(!form)return;
    fields.disabled=!open||busy||saved;
    document.getElementById('christmas-submit').disabled=!open||busy||saved;
    document.getElementById('christmas-availability').hidden=open;
    document.getElementById('christmas-availability').textContent=tier==='closed'?CLOSED:'Online registration opens October 4, 2026.';
    if(lastTier&&lastTier!==tier&&!saved)notice(open?'Registration pricing has changed. Please review your updated total before submitting.':CLOSED);
    lastTier=tier;
    const data=read(),summary=calculate(data,new Date(),false),list=document.getElementById('christmas-summary');
    list.replaceChildren();
    summary.attendees.forEach((person,i)=>{
      const item=document.createElement('li'),copy=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('small'),price=document.createElement('b');
      name.textContent=[person.first_name,person.last_name].filter(Boolean).join(' ')||(i===0?'You':person.role==='spouse'?'Spouse':'Family member');
      detail.textContent=person.role==='primary'?'Adult / Youth · ages 13+':person.role==='spouse'?'Spouse · ages 13+':person.age_on_event===null?'Enter age on December 6':`Age ${person.age_on_event}`;
      price.textContent=person.price_cents===null?'—':person.price_cents===0?'FREE':money(person.price_cents);
      copy.append(name,detail);item.append(copy,price);list.append(item);
    });
    text('[data-primary-price]',money(adultRate(tier)));text('[data-spouse-price]',money(adultRate(tier)));
    form.querySelectorAll('[data-family-row]').forEach((row,index)=>{const person=summary.attendees[index+(data.spouse_selected?2:1)];row.querySelector('[data-row-price]').textContent=person.price_cents===null?'Enter age':person.price_cents===0?'FREE':money(person.price_cents)});
    const amount=summary.cents===null?'—':money(summary.cents);
    text('[data-total]',amount);text('[data-payment-amount]',summary.cents===null?'the calculated total':amount);
    text('[data-attendee-count]',`${summary.attendees.length} ${summary.attendees.length===1?'attendee':'attendees'}`);
    const announcement=document.getElementById('christmas-summary-announcement');
    const message=`${summary.attendees.length} attendees. ${summary.cents===null?'Enter a valid age for every family member.':`Registration total ${amount}.`}`;
    if(announcement.textContent!==message)announcement.textContent=message;
  }
  if(form){
    const spouse=form.elements.namedItem('spouse_selected');
    spouse.addEventListener('change',()=>{const panel=document.getElementById('christmas-spouse');panel.hidden=!spouse.checked;panel.querySelectorAll('input').forEach(input=>{input.required=spouse.checked;input.disabled=!spouse.checked});update();if(spouse.checked)form.elements.namedItem('spouse_first_name').focus()});
    document.getElementById('christmas-add').addEventListener('click',()=>{
      const row=document.getElementById('christmas-family-template').content.firstElementChild.cloneNode(true),id=++nextRow;
      row.querySelector('legend').textContent=`Child / Family Member ${id}`;
      row.querySelectorAll('input').forEach(input=>{const key=input.dataset.field;input.id=`christmas-member-${id}-${key}`;row.querySelector(`[data-label="${key}"]`).htmlFor=input.id});
      const remove=row.querySelector('button');remove.setAttribute('aria-label',`Remove child / family member ${id}`);
      remove.addEventListener('click',()=>{row.remove();update();document.getElementById('christmas-add').focus()});
      document.getElementById('christmas-family').append(row);update();row.querySelector('input').focus();
    });
    form.addEventListener('input',()=>update());
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy||saved)return;
      const priorTier=lastTier;update();
      if(!['early','regular'].includes(lastTier)||!form.reportValidity())return;
      if(priorTier!==lastTier){notice('Please review the updated registration total and submit again.');return;}
      try{
        const data=read(),summary=calculate(data);
        const email=clean(form.elements.email.value,254,'your email address'),phone=clean(form.elements.phone.value,40,'your phone number');
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Please enter a valid email address.');
        if(phone.replace(/\D/g,'').length<7)throw Error('Please enter a valid phone number.');
        const hidden={attendees_json:JSON.stringify(summary.attendees),attendee_count:String(summary.attendees.length),pricing_tier:summary.tier,calculated_total:(summary.cents/100).toFixed(2),submitted_at:new Date().toISOString(),source_page:location.origin+location.pathname};
        for(const [key,value]of Object.entries(hidden))form.elements.namedItem(key).value=value;
        // Build only the declared Netlify fields, from the same freshly validated calculation.
        const primary=summary.attendees[0],partner=summary.attendees.find(p=>p.role==='spouse');
        const payload={'form-name':'christmas-dinner-2026','bot-field':form.elements.namedItem('bot-field').value,primary_first_name:primary.first_name,primary_last_name:primary.last_name,email,phone,spouse_selected:String(data.spouse_selected),spouse_first_name:partner?.first_name||'',spouse_last_name:partner?.last_name||'',...hidden};
        busy=true;update();notice('Saving your family registration…');
        const response=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(payload).toString()});
        if(!response.ok)throw Error('capture');
        saved=true;busy=false;update();
        if(tierAt()==='closed'){notice('Your form was received, but online registration has now closed. Please contact Champion Life before making payment.');return;}
        notice(`Your registration has been received. Payment is not complete. Enter ${money(summary.cents)} on the secure payment page.`);
        const link=document.createElement('a');link.href=PAYMENT_URL;link.textContent='Continue to Christmas Dinner payment';status.append(document.createElement('br'),link);
        window.location.assign(PAYMENT_URL);
      }catch(error){busy=false;update();notice(error.message==='capture'||error instanceof TypeError?'We could not confirm your registration was saved. Your information is still here. Please check your connection and try again. You have not been sent to payment.':error.message,true)}
    });
  }
  update();
  // Recheck across Chicago midnight and when returning to a previously opened tab.
  setInterval(update,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});window.addEventListener('pageshow',()=>update());
})();
