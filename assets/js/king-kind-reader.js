/* King Kind - PDF.js reader. Production may ONLY load a private Supabase Storage signed URL after authenticated eligibility. */
(async()=>{
 'use strict';
 const byId=id=>document.getElementById(id);
 const status=byId('reader-status'),view=byId('reader-viewport'),wrap=byId('page-wrap');
 const canvas=byId('page-canvas'),ctx=canvas.getContext('2d',{alpha:false}),number=byId('page-number');
 const prev=byId('previous-page'),next=byId('next-page'),zoomIn=byId('zoom-in'),zoomOut=byId('zoom-out'),fullscreen=byId('fullscreen');
 const loginLink=byId('login-link'),failure=byId('access-error');
 let pdf=null,current=1,scale=1,renderToken=0,rendering=false,viewer=null,personKey='anonymous',paintChain=Promise.resolve();
 const htmlLang=document.documentElement.lang==='es';
 if(htmlLang){document.querySelector(".sidebar-note").textContent="Libro digital gratuito para quienes se registraron en el evento SowGo. La edición del libro está en inglés.";document.querySelector(".sidebar-bottom").textContent="Champion Life Church & SowGo · El amor de Dios nos impulsa a sembrar y a ir.";document.querySelector("#previous-page").textContent="‹ Atrás";document.querySelector("#next-page").textContent="Siguiente ›";document.querySelector("#fullscreen").textContent="Pantalla completa";document.querySelector(".bottom").textContent="Desliza para pasar las páginas • Usa las flechas del teclado • Tu página se recuerda en este dispositivo.";document.querySelector("#access-error strong").textContent="Solo para personas registradas.";document.querySelector("#access-error p").textContent="Inicia sesión con el correo que usaste al registrarte en Bessemer o Huntsville para leer tu regalo.";document.querySelector("#login-link").textContent="Iniciar sesión para leer King Kind";}
 const lang=(en,es)=>htmlLang?es:en;
 const notice=(msg,isError=false)=>{status.textContent=msg;status.classList.toggle('error',isError)};
 const bounds=(n,a,b)=>Math.max(a,Math.min(b,n));
 const pageKey=()=>`kingkind-reader-page-v1:${personKey}`;
 const save=()=>{try{localStorage.setItem(pageKey(),String(current))}catch{}};
 const breakVisible=(yes)=>{failure.hidden=!yes;document.getElementById('book-controls').classList.toggle('hidden',yes);};
 async function privateBook(){
   const auth=window.ChampionLifeAuth;
   if(!auth){throw new Error(lang('Sign-in service is unavailable.','El servicio de inicio de sesión no está disponible.'))}
   const {data:{user},error:authError}=await auth.client.auth.getUser();
   if(authError||!user||!user.email)throw new Error(lang('Sign in with the email you registered with to open this gift.','Inicia sesión con el correo electrónico que usaste al registrarte para abrir este regalo.'));
   personKey=user.id;
   // The bucket is private; SELECT RLS is limited to email-verified Bessemer/Huntsville registrants.
   const {data,error}=await auth.client.storage.from('king-kind-books').createSignedUrl('king-kind/king-kind-english.pdf',900);
   if(error||!data?.signedUrl)throw new Error(lang('The book is not available for this account yet. If you registered, sign in with that same email or contact the outreach team.','El libro aún no está disponible para esta cuenta. Si te registraste, inicia sesión con el mismo correo o comunícate con el equipo de alcance.'));
   const res=await fetch(data.signedUrl,{credentials:'omit',cache:'no-store'});
   if(!res.ok)throw new Error(lang('Book download is temporarily unavailable. Please try again.','La descarga del libro no está disponible en este momento. Inténtalo de nuevo.'));
   const bytes=await res.arrayBuffer();
   if(bytes.byteLength<100000||bytes.byteLength>30000000)throw new Error('Unexpected book file size');
   return new Uint8Array(bytes);
 }
 async function loadPDF(){return privateBook()}
 async function renderPage(){
   if(!pdf)return;
   const token=++renderToken; rendering=true;
   current=bounds(current,1,pdf.numPages);number.value=String(current);
   prev.disabled=current<=1;next.disabled=current>=pdf.numPages;
   const page=await pdf.getPage(current);if(token!==renderToken)return;
   // Responsive single page, with optional bounded zoom and sharp 2x raster.
   const base=page.getViewport({scale:1}),fit=Math.min(1.65,Math.max(.35,(view.clientWidth-24)/base.width));
   const factor=fit*scale,viewport=page.getViewport({scale:factor});
   const dpr=Math.min(2,window.devicePixelRatio||1),outputScale=Math.min(dpr,3500/viewport.width);
   canvas.width=Math.ceil(viewport.width*outputScale);canvas.height=Math.ceil(viewport.height*outputScale);
   canvas.style.width=`${Math.ceil(viewport.width)}px`;canvas.style.height=`${Math.ceil(viewport.height)}px`;
   wrap.style.width=canvas.style.width;wrap.style.height=canvas.style.height;
   await page.render({canvasContext:ctx,viewport,transform:outputScale!==1?[outputScale,0,0,outputScale,0,0]:null}).promise;
   if(token!==renderToken)return;
   save();viewer=page;rendering=false;
   notice(lang(`Page ${current} of ${pdf.numPages} · ${Math.round(scale*100)}%`,`Página ${current} de ${pdf.numPages} · ${Math.round(scale*100)}%`));
 }
 function render(){paintChain=paintChain.catch(()=>{}).then(renderPage).catch(err=>{rendering=false;notice(lang('Unable to display this page. Try again.','No se puede mostrar esta página. Inténtalo de nuevo.'),true);console.warn('PDF render error',err)});return paintChain}
 async function navigate(n){if(!pdf||rendering)return;current=bounds(n,1,pdf.numPages);await render()}
 prev.addEventListener('click',()=>navigate(current-1));next.addEventListener('click',()=>navigate(current+1));
 number.addEventListener('change',()=>navigate(Number.parseInt(number.value,10)||current));
 zoomIn.addEventListener('click',()=>{scale=bounds(scale+.2,.6,2.8);render()});
 zoomOut.addEventListener('click',()=>{scale=bounds(scale-.2,.6,2.8);render()});
 fullscreen.addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen?.();else view.requestFullscreen?.()});
 document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea'))return;if(['ArrowRight','PageDown'].includes(e.key)){e.preventDefault();navigate(current+1)}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();navigate(current-1)}});
 let start=null;view.addEventListener('touchstart',e=>{if(e.touches.length===1)start={x:e.touches[0].clientX,y:e.touches[0].clientY}}, {passive:true});
 view.addEventListener('touchend',e=>{if(!start||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;start=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5)navigate(current+(dx<0?1:-1))}, {passive:true});
 let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(()=>{if(pdf)render()},180)});
 try{
   notice(lang('Checking book access…','Verificando acceso al libro…'));
   const bytes=await loadPDF();
   notice(lang('Loading your book…','Cargando tu libro…'));
   const m=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
   m.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
   pdf=await m.getDocument({data:bytes}).promise;
   if(pdf.numPages!==83)throw Error('Unexpected book page count');
   try{current=bounds(Number(localStorage.getItem(pageKey()))||1,1,pdf.numPages)}catch{current=1}
   breakVisible(false); await render();
 }catch(err){console.warn('King Kind reader: book not opened',err.message);notice(err.message||lang('Unable to open the book.','No se pudo abrir el libro.'),true);breakVisible(true)}
})();
