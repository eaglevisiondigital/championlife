const btn=document.querySelector('.menu-btn');const links=document.querySelector('.nav-links');if(btn&&links){btn.addEventListener('click',()=>links.classList.toggle('open'));links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')))}
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'none'}],{duration:650,easing:'ease-out',fill:'both'});io.unobserve(e.target)}}),{threshold:.12});document.querySelectorAll('.card,.split,.stat,.section h2').forEach(el=>io.observe(el));


// Water baptism interest form modal
(() => {
  const modal = document.getElementById('baptism-interest-form');
  if (!modal) return;
  const openButtons = document.querySelectorAll('[data-baptism-open]');
  const closeButtons = modal.querySelectorAll('[data-baptism-close]');
  const firstField = modal.querySelector('input[name="name"]');
  const openModal = () => { modal.classList.add('is-open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('baptism-modal-open'); setTimeout(() => firstField?.focus(), 50); };
  const closeModal = () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('baptism-modal-open'); };
  openButtons.forEach(button => button.addEventListener('click', openModal));
  closeButtons.forEach(button => button.addEventListener('click', closeModal));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });
})();

// Champion Life Sermon Notes experience
(() => {
  const SERMON_URL = 'sermon-notes.html';
  if (document.documentElement.dataset.sermonNotesReady === 'true') return;
  document.documentElement.dataset.sermonNotesReady = 'true';

  const css = `
    .sermon-home-strip{background:#0b0b0c;border-top:1px solid rgba(211,173,79,.25);border-bottom:1px solid rgba(211,173,79,.25)}
    .sermon-home-inner{min-height:92px;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 0}
    .sermon-home-copy{display:flex;align-items:center;gap:16px}
    .sermon-home-icon{width:50px;height:50px;flex:0 0 50px;border-radius:50%;display:grid;place-items:center;background:#d3ad4f;color:#111;font-size:23px;font-weight:900}
    .sermon-home-copy b{display:block;color:#fff;font-size:18px;margin-bottom:2px}
    .sermon-home-copy small{display:block;color:rgba(255,255,255,.68);font-size:13px}
    .sermon-home-link{display:inline-flex;align-items:center;gap:9px;padding:13px 18px;border-radius:999px;background:#d3ad4f;color:#111;font-weight:850;white-space:nowrap}
    .sermon-service-float{position:fixed;z-index:9999;right:20px;bottom:20px;display:flex;align-items:center;gap:10px;padding:14px 18px;border-radius:999px;background:#d3ad4f;color:#111!important;text-decoration:none;font-weight:900;box-shadow:0 14px 40px rgba(0,0,0,.28);border:1px solid rgba(0,0,0,.1)}
    .sermon-service-float:before{content:"📝";font-size:18px}
    @media(max-width:760px){
      .sermon-home-inner{align-items:stretch;flex-direction:column;gap:14px;padding:18px 0}
      .sermon-home-link{justify-content:center;width:100%}
      .sermon-service-float{left:16px;right:16px;bottom:16px;justify-content:center;padding:14px 16px}
    }
  `;
  const style = document.createElement('style');
  style.id = 'sermon-notes-global-styles';
  style.textContent = css;
  document.head.appendChild(style);

  const path = (window.location.pathname || '/').toLowerCase();
  const isHome = path === '/' || path.endsWith('/index.html');
  const isWatch = path.endsWith('/watch') || path.endsWith('/watch.html');
  const isSermonNotes = path.endsWith('/sermon-notes') || path.endsWith('/sermon-notes.html');

  // Permanent homepage quick access, separate from the existing 4-card quick grid.
  if (isHome && !document.querySelector('.sermon-home-strip')) {
    const quickbar = document.querySelector('.quickbar');
    if (quickbar) {
      const strip = document.createElement('section');
      strip.className = 'sermon-home-strip';
      strip.setAttribute('aria-label','Sermon Notes');
      strip.innerHTML = `
        <div class="container sermon-home-inner">
          <div class="sermon-home-copy">
            <span class="sermon-home-icon">✎</span>
            <span><b>Follow Along With Today’s Message</b><small>Open Pastor Roddy’s current sermon notes during service or revisit them during the week.</small></span>
          </div>
          <a class="sermon-home-link" href="${SERMON_URL}">Sermon Notes <span>→</span></a>
        </div>`;
      quickbar.insertAdjacentElement('afterend', strip);
    }
  }

  // Service-time shortcut across the website for people physically in the room.
  const chicagoParts = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone:'America/Chicago',
      weekday:'short',
      hour:'2-digit',
      minute:'2-digit',
      hour12:false
    }).formatToParts(new Date());
    const out = {};
    parts.forEach(p => out[p.type] = p.value);
    return out;
  };

  const duringServiceWindow = () => {
    const p = chicagoParts();
    const minutes = Number(p.hour) * 60 + Number(p.minute);
    // Available shortly before service and for a generous window after start.
    if (p.weekday === 'Sun') return minutes >= (10*60+15) && minutes <= (13*60);
    if (p.weekday === 'Wed') return minutes >= (18*60+15) && minutes <= (21*60);
    return false;
  };

  const updateFloatingShortcut = () => {
    let button = document.querySelector('.sermon-service-float');
    if (isSermonNotes || isWatch) {
      if (button) button.remove();
      return;
    }
    if (duringServiceWindow()) {
      if (!button) {
        button = document.createElement('a');
        button.className = 'sermon-service-float';
        button.href = SERMON_URL;
        button.textContent = 'Sermon Notes';
        button.setAttribute('aria-label',"Open today's sermon notes");
        document.body.appendChild(button);
      }
    } else if (button) {
      button.remove();
    }
  };

  updateFloatingShortcut();
  setInterval(updateFloatingShortcut, 60000);
})();

// Champion Life Outreach Partner modal + outreach giving routing
(() => {
  if (document.documentElement.dataset.outreachPartnerReady === 'true') return;
  document.documentElement.dataset.outreachPartnerReady = 'true';
  const OUTREACH_GIVING_URL = '/outreach-giving.html';
  const css = `body.outreach-partner-modal-open{overflow:hidden}.outreach-partner-modal{position:fixed;inset:0;z-index:12000;display:none;align-items:flex-start;justify-content:center;padding:24px;background:rgba(0,0,0,.82);backdrop-filter:blur(8px);overflow:auto}.outreach-partner-modal.is-open{display:flex}.outreach-partner-dialog{width:min(880px,100%);margin:auto;border-radius:26px;overflow:hidden;background:#fff;color:#111;box-shadow:0 34px 90px rgba(0,0,0,.48);border:1px solid rgba(255,255,255,.14)}.outreach-partner-head{position:relative;padding:28px 32px;background:#090a0c;color:#fff;border-bottom:1px solid rgba(211,173,79,.34)}.outreach-partner-head .eyebrow{color:#d3ad4f}.outreach-partner-head h2{margin:8px 52px 8px 0;font-size:clamp(30px,5vw,48px);line-height:1.02}.outreach-partner-head p{margin:0;max-width:680px;color:#c6c7cb;line-height:1.55}.outreach-partner-close{position:absolute;right:20px;top:20px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:#15171b;color:#fff;font-size:26px;line-height:1;cursor:pointer}.outreach-partner-form{padding:30px 32px}.outreach-form-section{margin-bottom:28px}.outreach-form-section h3{margin:0 0 5px;font-size:21px}.outreach-form-section>p{margin:0 0 18px;color:#666;line-height:1.5}.outreach-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.outreach-field-grid.three{grid-template-columns:1.3fr 1fr .8fr}.outreach-field{display:grid;gap:7px}.outreach-field.full{grid-column:1/-1}.outreach-field span{font-size:13px;font-weight:850;color:#242424}.outreach-field input,.outreach-field select{width:100%;height:49px;padding:0 13px;border-radius:10px;border:1px solid #cfcfcf;background:#fff;color:#111;font:inherit;outline:none}.outreach-field input:focus,.outreach-field select:focus{border-color:#b78d2d;box-shadow:0 0 0 3px rgba(211,173,79,.16)}.outreach-commitment{padding:22px;border-radius:18px;background:#f5f2eb;border:1px solid #e0d8c7}.outreach-commitment-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.outreach-amount-wrap{position:relative}.outreach-amount-wrap b{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:18px}.outreach-amount-wrap input{padding-left:31px}.outreach-change-note{margin:16px 0 0!important;padding:13px 15px;border-radius:11px;background:#fff;color:#4e4b45!important;border-left:4px solid #d3ad4f;font-size:14px}.outreach-partner-actions{display:flex;align-items:center;gap:13px;flex-wrap:wrap;margin-top:24px}.outreach-partner-actions button{border:0;cursor:pointer}.outreach-partner-cancel{background:transparent!important;border:1px solid #bbb!important;color:#333!important}.outreach-form-status{display:none;margin-top:14px;padding:12px 14px;border-radius:10px;font-size:14px;line-height:1.45}.outreach-form-status.is-error{display:block;background:#fff0f0;color:#7c1d1d;border:1px solid #efc4c4}.outreach-form-status.is-working{display:block;background:#f5f2eb;color:#66531f;border:1px solid #e5d59f}.outreach-honeypot{position:absolute!important;clip:rect(0 0 0 0)!important;width:1px!important;height:1px!important;overflow:hidden!important}@media(max-width:700px){.outreach-partner-modal{padding:0;align-items:stretch}.outreach-partner-dialog{margin:0;width:100%;border-radius:0;min-height:100vh}.outreach-partner-head{padding:24px 20px}.outreach-partner-form{padding:24px 18px 36px}.outreach-field-grid,.outreach-field-grid.three,.outreach-commitment-grid{grid-template-columns:1fr}.outreach-partner-actions{display:grid;grid-template-columns:1fr}.outreach-partner-actions .btn{width:100%}}`;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  const modal=document.createElement('div');modal.className='outreach-partner-modal';modal.id='outreach-partner-modal';modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<div class="outreach-partner-dialog" role="dialog" aria-modal="true" aria-labelledby="outreach-partner-title"><div class="outreach-partner-head"><span class="eyebrow">Champion Life Outreach</span><h2 id="outreach-partner-title">Become an Outreach Partner</h2><p>Thank you for helping us take the Gospel to cities and nations. Complete your partnership information below, then we’ll take you directly to the secure outreach giving page.</p><button class="outreach-partner-close" type="button" aria-label="Close outreach partner form" data-outreach-partner-close>×</button></div><form class="outreach-partner-form" id="outreach-partner-form" name="outreach-partner" method="POST" data-netlify="true" netlify-honeypot="bot-field"><input type="hidden" name="form-name" value="outreach-partner"><input type="hidden" name="source-page" id="outreach-partner-source" value=""><p class="outreach-honeypot"><label>Do not fill this out: <input name="bot-field"></label></p><section class="outreach-form-section"><h3>Your Information</h3><p>Tell us how to stay connected with you as an outreach partner.</p><div class="outreach-field-grid"><label class="outreach-field"><span>First Name *</span><input type="text" name="first-name" autocomplete="given-name" required></label><label class="outreach-field"><span>Last Name *</span><input type="text" name="last-name" autocomplete="family-name" required></label><label class="outreach-field full"><span>Email Address *</span><input type="email" name="email" autocomplete="email" required></label><label class="outreach-field full"><span>Street Address *</span><input type="text" name="address-line-1" autocomplete="address-line1" required></label><label class="outreach-field full"><span>Street Address Line 2</span><input type="text" name="address-line-2" autocomplete="address-line2"></label></div><div class="outreach-field-grid three" style="margin-top:16px"><label class="outreach-field"><span>City *</span><input type="text" name="city" autocomplete="address-level2" required></label><label class="outreach-field"><span>State / Province *</span><input type="text" name="state-province" autocomplete="address-level1" required></label><label class="outreach-field"><span>Postal / ZIP Code *</span><input type="text" name="postal-code" autocomplete="postal-code" required></label></div><div class="outreach-field-grid" style="margin-top:16px"><label class="outreach-field"><span>Phone Number *</span><input type="tel" name="phone" autocomplete="tel" required></label></div></section><section class="outreach-form-section outreach-commitment"><h3>Your Partnership Commitment</h3><p>Choose the recurring amount and schedule you plan to begin with.</p><div class="outreach-commitment-grid"><label class="outreach-field"><span>Amount *</span><span class="outreach-amount-wrap"><b>$</b><input type="number" name="commitment-amount" min="1" step="0.01" inputmode="decimal" required></span></label><label class="outreach-field"><span>Frequency *</span><select name="commitment-frequency" required><option value="">Select frequency</option><option value="Weekly">Weekly</option><option value="Bi-weekly">Bi-weekly</option><option value="Monthly">Monthly</option></select></label></div><p class="outreach-change-note"><strong>This partnership amount can be changed at any time in the future.</strong> Your selection here simply tells Champion Life the partnership level you intend to begin with. Your actual giving is managed securely through the giving page.</p></section><div class="outreach-partner-actions"><button class="btn gold" type="submit" id="outreach-partner-submit">Submit & Continue to Give</button><button class="btn outreach-partner-cancel" type="button" data-outreach-partner-close>Cancel</button></div><div class="outreach-form-status" id="outreach-partner-status" role="status" aria-live="polite"></div></form></div>`;
  document.body.appendChild(modal);
  const form=modal.querySelector('#outreach-partner-form'),sourceField=modal.querySelector('#outreach-partner-source'),status=modal.querySelector('#outreach-partner-status'),submit=modal.querySelector('#outreach-partner-submit');
  const openModal=()=>{sourceField.value=window.location.href;modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');document.body.classList.add('outreach-partner-modal-open');setTimeout(()=>modal.querySelector('input[name="first-name"]')?.focus(),80)};
  const closeModal=()=>{modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('outreach-partner-modal-open');status.className='outreach-form-status';status.textContent=''};
  modal.querySelectorAll('[data-outreach-partner-close]').forEach(el=>el.addEventListener('click',closeModal));modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('is-open'))closeModal()});
  document.addEventListener('click',e=>{const link=e.target.closest('a,button');if(!link)return;const href=String(link.getAttribute('href')||''),label=(link.textContent||'').trim().toLowerCase();const oldPartnerUrl=href.includes('form.jotform.com/ChampionLife/outreach-partnership');const partnerLabel=/become (an )?(outreach )?partner/.test(label)||/sign up.*donate now/.test(label);if(oldPartnerUrl||partnerLabel||link.matches('[data-outreach-partner-open]')){e.preventDefault();openModal();}});
  document.querySelectorAll('a').forEach(link=>{const text=(link.textContent||'').trim().toLowerCase();const onOutreach=/\/outreach(?:\.html)?$/.test(window.location.pathname.toLowerCase());if(/support outreach|give to outreach|outreach giving|donate to outreach/.test(text)||(onOutreach&&/^donate$/.test(text))){link.setAttribute('href',OUTREACH_GIVING_URL);link.removeAttribute('target')}});
  form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;submit.disabled=true;submit.textContent='Submitting…';status.className='outreach-form-status is-working';status.textContent='Saving your partnership information…';try{const body=new URLSearchParams(new FormData(form)).toString();const response=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(!response.ok)throw new Error('Could not submit');status.textContent='Thank you! Taking you to the secure outreach giving page…';setTimeout(()=>{window.location.href=OUTREACH_GIVING_URL},500)}catch(err){status.className='outreach-form-status is-error';status.textContent='We could not submit the form. Please check your connection and try again.';submit.disabled=false;submit.textContent='Submit & Continue to Give'}});
})();
