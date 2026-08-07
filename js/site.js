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
