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
    .watch-sermon-card{margin-top:22px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:center;padding:24px 30px;border-radius:22px;background:#f4f0e8;border:1px solid rgba(157,118,28,.24);box-shadow:0 14px 34px rgba(0,0,0,.09)}
    .watch-sermon-card .eyebrow{color:#9d761c;margin-bottom:5px}
    .watch-sermon-card h2{margin:0 0 7px;color:#111;font-size:clamp(24px,3vw,34px)}
    .watch-sermon-card p{margin:0;color:#605d56;line-height:1.55;max-width:760px}
    .watch-sermon-card .btn{white-space:nowrap}
    .sermon-service-float{position:fixed;z-index:9999;right:20px;bottom:20px;display:flex;align-items:center;gap:10px;padding:14px 18px;border-radius:999px;background:#d3ad4f;color:#111!important;text-decoration:none;font-weight:900;box-shadow:0 14px 40px rgba(0,0,0,.28);border:1px solid rgba(0,0,0,.1)}
    .sermon-service-float:before{content:"📝";font-size:18px}
    @media(max-width:760px){
      .sermon-home-inner{align-items:stretch;flex-direction:column;gap:14px;padding:18px 0}
      .sermon-home-link{justify-content:center;width:100%}
      .watch-sermon-card{grid-template-columns:1fr;padding:22px 20px}
      .watch-sermon-card .btn{width:100%}
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

  // Watch page: place Sermon Notes immediately beneath the player/chat area and before giving.
  if (isWatch && !document.querySelector('.watch-sermon-card')) {
    const giveCard = document.querySelector('.watch-give-card');
    const playerArea = document.querySelector('.watch-live-layout');
    const anchor = giveCard || playerArea;
    if (anchor) {
      const card = document.createElement('div');
      card.className = 'watch-sermon-card';
      card.innerHTML = `
        <div>
          <span class="eyebrow">Follow Along</span>
          <h2>Today’s Sermon Notes</h2>
          <p>Keep the message in front of you while you watch, then come back anytime during the week to review what was taught.</p>
        </div>
        <a class="btn gold" href="${SERMON_URL}">Open Sermon Notes</a>`;
      if (giveCard) giveCard.insertAdjacentElement('beforebegin', card);
      else playerArea.insertAdjacentElement('afterend', card);
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
