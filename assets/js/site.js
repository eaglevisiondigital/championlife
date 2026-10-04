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

// Shared outreach intake; giving destinations remain unchanged.
(() => {
 if(document.documentElement.dataset.outreachPartnerReady==='true')return;
 document.documentElement.dataset.outreachPartnerReady='true';let loading;
 function open(){if(window.OutreachPartner){window.OutreachPartner.open();return;}if(!loading)loading=new Promise((resolve,reject)=>{const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/css/outreach-partner.css';document.head.append(css);const js=document.createElement('script');js.src='/assets/js/outreach-partner.js';js.onload=resolve;js.onerror=reject;document.head.append(js)});loading.then(()=>window.OutreachPartner.open()).catch(()=>{location.href='/outreach-partner.html?brand=champion-life'});}
 document.addEventListener('click',e=>{const link=e.target.closest('a,button');if(!link)return;const href=String(link.getAttribute('href')||''),label=(link.textContent||'').trim().toLowerCase();if(href.includes('form.jotform.com/ChampionLife/outreach-partnership')||/become (an )?(outreach )?partner/.test(label)||/sign up.*donate now/.test(label)||link.matches('[data-outreach-partner-open]')){e.preventDefault();open();}});
 document.querySelectorAll('a').forEach(link=>{const text=(link.textContent||'').trim().toLowerCase(),onOutreach=/\/outreach(?:\.html)?$/.test(location.pathname.toLowerCase());if(/support outreach|give to outreach|outreach giving|donate to outreach/.test(text)||(onOutreach&&/^donate$/.test(text))){link.setAttribute('href','/outreach-giving.html');link.removeAttribute('target')}});
})();

// Champion Life Daily Supplements global navigation
(() => {
  const href='daily-supplements.html';
  const nav=document.querySelector('.nav-links');
  if(nav && !nav.querySelector('a[href*="daily-supplements"]')){
    const link=document.createElement('a');link.href=href;link.textContent='Supplements';link.className='supplements-global-link';
    const watch=[...nav.querySelectorAll('a')].find(a=>(a.textContent||'').trim()==='Watch');
    watch ? watch.insertAdjacentElement('afterend',link) : nav.appendChild(link);
  }
  const footerCols=[...document.querySelectorAll('.footer-column')];
  const explore=footerCols.find(col=>((col.querySelector('h4')?.textContent)||'').trim()==='Explore');
  if(explore && !explore.querySelector('a[href*="daily-supplements"]')){
    const link=document.createElement('a');link.href=href;link.textContent='Daily Supplements';
    const ministries=[...explore.querySelectorAll('a')].find(a=>(a.textContent||'').trim()==='Ministries');
    ministries ? ministries.insertAdjacentElement('afterend',link) : explore.appendChild(link);
  }
  if(!document.getElementById('supplements-global-nav-style')){
    const s=document.createElement('style');s.id='supplements-global-nav-style';s.textContent='@media (min-width:981px) and (max-width:1180px){.supplements-global-link{display:none!important}}';document.head.appendChild(s);
  }
})();

// Lockliel discipleship attribution
(() => {
  const path = (location.pathname || '').toLowerCase();
  const isDiscipleship =
    path.includes('getting-a-grip') ||
    path.includes('discipleship-login') ||
    path.includes('my-discipleship') ||
    path.includes('/stlucia');

  if (!isDiscipleship || document.querySelector('.lockliel-powered')) return;

  const footer = document.querySelector('.footer');
  if (!footer) return;

  const wrap = document.createElement('section');
  wrap.className = 'lockliel-powered';
  wrap.setAttribute('aria-label','Discipleship powered by Lockliel');
  wrap.innerHTML = `
    <a class="lockliel-powered-link" href="https://www.lockliel.com" target="_blank" rel="noopener">
      <span class="lockliel-powered-ghost" aria-hidden="true">LOCKLIEL</span>
      <img class="lockliel-powered-logo" src="/assets/images/lockliel-powered-logo.webp" alt="Lockliel">
      <span class="lockliel-powered-copy">
        <small>Discipleship powered by</small>
        <strong>Lockliel</strong>
        <em>Reach. Teach. Train. Disciple.</em>
      </span>
      <span class="lockliel-powered-arrow" aria-hidden="true">↗</span>
    </a>
  `;

  const style = document.createElement('style');
  style.id = 'lockliel-powered-style';
  style.textContent = `
    .lockliel-powered{position:relative;overflow:hidden;background:#080a0d;border-top:1px solid rgba(255,255,255,.06)}
    .lockliel-powered-link{position:relative;display:flex;align-items:center;justify-content:center;gap:14px;min-height:104px;padding:20px 24px;color:#fff;text-decoration:none;isolation:isolate}
    .lockliel-powered-link:hover .lockliel-powered-logo{transform:translateY(-1px) scale(1.03)}
    .lockliel-powered-link:hover .lockliel-powered-arrow{transform:translate(2px,-2px)}
    .lockliel-powered-ghost{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:-1;font-size:clamp(4rem,11vw,8rem);font-weight:950;letter-spacing:.05em;color:#fff;opacity:.025;white-space:nowrap;pointer-events:none}
    .lockliel-powered-logo{width:52px;height:52px;object-fit:cover;border-radius:13px;box-shadow:0 10px 28px rgba(0,0,0,.28);transition:.2s ease}
    .lockliel-powered-copy{display:grid;line-height:1.05}
    .lockliel-powered-copy small{font-size:.67rem;letter-spacing:.12em;text-transform:uppercase;color:#9ea5ad;font-weight:850;margin-bottom:4px}
    .lockliel-powered-copy strong{font-size:1.08rem;color:#fff}
    .lockliel-powered-copy em{font-style:normal;font-size:.72rem;color:#62c7e8;margin-top:5px;letter-spacing:.03em}
    .lockliel-powered-arrow{font-size:1rem;color:#62c7e8;transition:.2s ease;margin-left:2px}
    @media(max-width:650px){
      .lockliel-powered-link{min-height:92px;padding:17px 18px;gap:11px}
      .lockliel-powered-logo{width:46px;height:46px;border-radius:12px}
      .lockliel-powered-copy strong{font-size:1rem}
      .lockliel-powered-copy em{font-size:.68rem}
      .lockliel-powered-ghost{font-size:4.4rem}
    }
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  footer.parentNode.insertBefore(wrap, footer);
})();
