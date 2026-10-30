/* King Kind - PDF.js reader. Production may ONLY load a private Supabase Storage signed URL after authenticated eligibility. */
(async()=>{
 'use strict';
 const byId=id=>document.getElementById(id);
 const status=byId('reader-status'),view=byId('reader-viewport'),wrap=byId('page-wrap');
 const canvas=byId('page-canvas'),ctx=canvas.getContext('2d',{alpha:false}),number=byId('page-number');
 const prev=byId('previous-page'),next=byId('next-page'),zoomIn=byId('zoom-in'),zoomOut=byId('zoom-out'),fullscreen=byId('fullscreen');
 const mobilePrev=byId('mobile-previous'),mobileNext=byId('mobile-next'),mobilePage=byId('mobile-page'),fitWidth=byId('fit-width'),mobileFit=byId('mobile-fit-width');
 const loginLink=byId('login-link'),failure=byId('access-error');
 const licenseAck=byId('book-license-ack'),downloadButton=byId('download-book');
 let pdf=null,current=1,scale=1,renderToken=0,rendering=false,personKey='anonymous',paintChain=Promise.resolve(),downloadBlob=null;
 let generation=0,binding=null,controller=null,loadingTask=null,renderTask=null,expiryTimer=null,restartTimer=null,loadTimer=null,downloadTimer=null,downloading=false,suspended=false;
 const auth=window.ChampionLifeAuth,objectURLs=new Set();
 const sessionKey=(()=>{try{return `sb-${new URL(window.CHAMPION_LIFE_SUPABASE.url).hostname.split('.')[0]}-auth-token`}catch{return null}})();
 const htmlLang=document.documentElement.lang==='es';
 if(htmlLang){document.querySelector(".sidebar-note").textContent="Libro digital gratuito para quienes se registraron en el evento SowGo. La edición del libro está en inglés.";document.querySelector(".sidebar-bottom").textContent="Champion Life Church & SowGo · El amor de Dios nos impulsa a sembrar y a ir.";document.querySelector("#previous-page").textContent="‹ Atrás";document.querySelector("#next-page").textContent="Siguiente ›";mobilePrev.textContent="‹ Atrás";mobileNext.textContent="Siguiente ›";mobileFit.textContent="Ajustar";fitWidth.textContent="Ajustar ancho";document.querySelector("#fullscreen").textContent="Pantalla completa";document.querySelector(".bottom").textContent="Desliza para pasar las páginas • Usa las flechas del teclado • Tu página se recuerda en este dispositivo.";document.querySelector("#access-error strong").textContent="Solo para personas registradas.";document.querySelector("#access-error p").textContent="Inicia sesión con el correo verificado para los recursos King Kind o con el que usaste al registrarte en Bessemer o Huntsville.";document.querySelector("#login-link").textContent="Iniciar sesión para leer King Kind";}
 if(htmlLang){document.querySelector('.reader-license-copy').innerHTML='<strong>Regalo solo para uso personal.</strong> Este libro digital se entrega gratuitamente a quienes se registraron y cumplen los requisitos. Puedes descargar una copia para leerla personalmente. No puedes volver a publicarlo, redistribuirlo, compartirlo, reenviarlo, subirlo a internet, venderlo ni distribuir el libro o el PDF, total o parcialmente, sin autorización previa por escrito del titular de los derechos.';document.querySelector('.license-check span').textContent='Entiendo y acepto que no puedo volver a publicar ni distribuir este libro.';downloadButton.textContent='Descargar PDF para uso personal';document.querySelector('.reader-license').setAttribute('aria-label','Condiciones de uso personal del libro digital');}
 const lang=(en,es)=>htmlLang?es:en;
 const notice=(msg,isError=false)=>{status.textContent=msg;status.classList.toggle('error',isError)};
 const bounds=(n,a,b)=>Math.max(a,Math.min(b,n));
 const pageKey=()=>`kingkind-reader-page-v1:${personKey}`;
 const save=()=>{try{localStorage.setItem(pageKey(),String(current))}catch{}};
 const breakVisible=(yes)=>{failure.hidden=!yes;document.getElementById('book-controls').classList.toggle('hidden',yes);document.querySelector('.mobile-page-controls').hidden=yes;};
 // Persisted state is only an immediate invalidation hint, never authorization.
 // The network-verified user and private Storage policy remain authoritative.
 function persisted(){try{return JSON.parse(localStorage.getItem(sessionKey))}catch{return null}}
 function sameSession(a,b){return !!(a&&b&&a.user?.id===b.user?.id&&a.access_token===b.access_token&&a.expires_at===b.expires_at&&a.expires_at*1000>Date.now())}
 function alive(g){return g===generation&&!suspended&&!document.hidden}
 function permitted(g=generation){return alive(g)&&binding&&sameSession(binding,persisted())}
 function check(g,session){if(!alive(g)||(session&&!sameSession(session,persisted())))throw Error('SESSION_CHANGED')}
 function quiet(action){try{Promise.resolve(action()).catch(()=>{})}catch{}}
 function invalidate(){
   ++generation; ++renderToken;
   clearTimeout(restartTimer);clearTimeout(expiryTimer);clearTimeout(loadTimer);clearTimeout(downloadTimer);
   controller?.abort();controller=null;
   const oldRender=renderTask,oldLoad=loadingTask,oldPDF=pdf;
   renderTask=null;loadingTask=null;pdf=null;downloadBlob=null;binding=null;personKey='anonymous';
   rendering=false;downloading=false;paintChain=Promise.resolve();current=1;scale=1;
   licenseAck.checked=false;licenseAck.disabled=true;downloadButton.disabled=true;
   wrap.hidden=true;canvas.width=0;canvas.height=0;canvas.style.width='';canvas.style.height='';
   wrap.style.width='';wrap.style.height='';number.value='';mobilePage.textContent='';
   for(const control of[prev,next,mobilePrev,mobileNext,number,zoomIn,zoomOut,fitWidth,mobileFit,fullscreen])control.disabled=true;
   breakVisible(true);notice(lang('Sign in to verify book access.','Inicia sesión para verificar el acceso al libro.'));
   for(const url of objectURLs)URL.revokeObjectURL(url);objectURLs.clear();
   quiet(()=>oldRender?.cancel());
   // LoadingTask.destroy owns document/worker destruction, including in-flight loads.
   quiet(()=>oldLoad?.destroy ? oldLoad.destroy() : oldPDF?.destroy?.());
 }
 function fail(g,error){if(g!==generation)return;invalidate();notice(error?.message==='SESSION_CHANGED'?lang('Your session changed. Verify access again.','Tu sesión cambió. Verifica el acceso nuevamente.'):lang('Book access could not be verified. Sign in again or reload to retry.','No se pudo verificar el acceso al libro. Inicia sesión nuevamente o recarga para intentarlo.'),true)}
 async function verifiedSession(g,expected){
   check(g,expected);
   if(!auth)throw Error('SIGN_IN_REQUIRED');
   const {data:initial,error:firstError}=await auth.client.auth.getSession();check(g,expected);
   const session=initial?.session;
   if(firstError||!session||!sameSession(session,persisted())||(expected&&!sameSession(session,expected)))throw Error('SESSION_CHANGED');
   const {data,error}=await auth.client.auth.getUser();check(g,session);
   const user=data?.user;
   if(error||!user?.id||!user.email||!user.email_confirmed_at||user.is_anonymous||user.id!==session.user.id)throw Error('SIGN_IN_REQUIRED');
   const {data:latest,error:latestError}=await auth.client.auth.getSession();check(g,session);
   if(latestError||!sameSession(session,latest?.session))throw Error('SESSION_CHANGED');
   return session;
 }
 async function authorize(g,session){
   const {data,error}=await auth.client.storage.from('king-kind-books').createSignedUrl('king-kind/king-kind-english.pdf',900);
   check(g,session);
   if(error||!data?.signedUrl)throw Error('BOOK_ACCESS_DENIED');
   return data.signedUrl;
 }
 async function privateBook(g,session,signal){
   const url=await authorize(g,session);
   const res=await fetch(url,{credentials:'omit',cache:'no-store',signal});check(g,session);
   if(!res.ok)throw Error('BOOK_DOWNLOAD_FAILED');
   const bytes=await res.arrayBuffer();check(g,session);
   if(bytes.byteLength<100000||bytes.byteLength>30000000)throw Error('Unexpected book file size');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');check(g,session);
   if(digest!=='417f9faa7ff3945fdf4ff62931a233739856d03221c8429e21b768b221b94a54')throw Error('Book integrity check failed');
   return new Uint8Array(bytes);
 }
 licenseAck.addEventListener('change',()=>{
   if(!permitted()){invalidate();return}
   downloadButton.disabled=!(pdf&&downloadBlob&&licenseAck.checked&&!downloading);
 });
 downloadButton.addEventListener('click',async()=>{
   if(!permitted()){invalidate();return}
   if(!pdf||!downloadBlob||!licenseAck.checked||downloading)return;
   const g=generation,owner=binding;downloading=true;downloadButton.disabled=true;
   downloadTimer=setTimeout(()=>fail(g,Error('TIMEOUT')),15000);
   try{
     // Recheck identity AND current server-side eligibility before releasing retained bytes.
     await verifiedSession(g,owner);await authorize(g,owner);await verifiedSession(g,owner);
     check(g,owner);if(!permitted(g)||!licenseAck.checked||!downloadBlob)throw Error('SESSION_CHANGED');
     const url=URL.createObjectURL(downloadBlob),anchor=document.createElement('a');objectURLs.add(url);
     anchor.href=url;anchor.download='King-Kind-Pastor-Roddy-Shaffer-Personal-Use.pdf';
     document.body.append(anchor);anchor.click();anchor.remove();
     setTimeout(()=>{URL.revokeObjectURL(url);objectURLs.delete(url)},60000);
     notice(lang('Your personal-use download has started. Do not share or distribute the file.','Comenzó la descarga para uso personal. No compartas ni distribuyas el archivo.'));
   }catch(error){fail(g,error)}finally{if(g===generation){clearTimeout(downloadTimer);downloading=false;downloadButton.disabled=!licenseAck.checked||!permitted(g)}}
 });
 async function renderPage(g){
   if(g!==generation)return;
   if(!permitted(g)){invalidate();return}if(!pdf)return;
   const doc=pdf;
   // Reserve the visible mobile controls below the actual reading area. The
   // sidebar/toolbar may wrap differently across phones; do not guess their height.
   if(window.matchMedia('(max-width:800px), (max-width:1000px) and (max-height:500px)').matches){
    const nav=document.querySelector('.mobile-page-controls').getBoundingClientRect();
    view.style.height=`${Math.max(140,nav.top-view.getBoundingClientRect().top-10)}px`;
   }else view.style.height='';
   const token=++renderToken; rendering=true;
   current=bounds(current,1,pdf.numPages);number.value=String(current);
   prev.disabled=current<=1;next.disabled=current>=pdf.numPages;
   mobilePrev.disabled=current<=1;mobileNext.disabled=current>=pdf.numPages;mobilePage.textContent=`${current} / ${pdf.numPages}`;
   const page=await doc.getPage(current);if(token!==renderToken||!permitted(g))return;
   // Responsive single page, with optional bounded zoom and sharp 2x raster.
   const base=page.getViewport({scale:1}),fit=Math.min(1.65,Math.max(.35,(view.clientWidth-24)/base.width));
   const factor=fit*scale,viewport=page.getViewport({scale:factor});
   const dpr=Math.min(2,window.devicePixelRatio||1),outputScale=Math.min(dpr,3500/viewport.width);
   // Paint into a detached canvas: a cancelled/late renderer cannot repaint the visible book.
   const staged=document.createElement('canvas');staged.width=Math.ceil(viewport.width*outputScale);staged.height=Math.ceil(viewport.height*outputScale);
   const task=page.render({canvasContext:staged.getContext('2d',{alpha:false}),viewport,transform:outputScale!==1?[outputScale,0,0,outputScale,0,0]:null});renderTask=task;
   await task.promise;
   if(token!==renderToken||!permitted(g))return;
   renderTask=null;canvas.width=staged.width;canvas.height=staged.height;
   ctx.drawImage(staged,0,0);canvas.style.width=`${Math.ceil(viewport.width)}px`;canvas.style.height=`${Math.ceil(viewport.height)}px`;
   wrap.style.width=canvas.style.width;wrap.style.height=canvas.style.height;wrap.hidden=false;
   save();rendering=false;
   notice(lang(`Page ${current} of ${pdf.numPages} · ${Math.round(scale*100)}%`,`Página ${current} de ${pdf.numPages} · ${Math.round(scale*100)}%`));
 }
 function render(){const g=generation;paintChain=paintChain.catch(()=>{}).then(()=>renderPage(g)).catch(error=>fail(g,error));return paintChain}
 async function navigate(n){if(!permitted()){invalidate();return}if(!pdf||rendering)return;const target=bounds(n,1,pdf.numPages);if(target!==current){current=target;view.scrollTop=0;view.scrollLeft=0;}await render()}
 prev.addEventListener('click',()=>navigate(current-1));next.addEventListener('click',()=>navigate(current+1));
 mobilePrev.addEventListener('click',()=>navigate(current-1));mobileNext.addEventListener('click',()=>navigate(current+1));
 number.addEventListener('change',()=>navigate(Number.parseInt(number.value,10)||current));
 zoomIn.addEventListener('click',()=>{scale=bounds(scale+.2,.6,2.8);render()});
 zoomOut.addEventListener('click',()=>{scale=bounds(scale-.2,.6,2.8);render()});
 const fitToWidth=()=>{scale=1;view.scrollLeft=0;view.scrollTop=0;render()};
 fitWidth.addEventListener('click',fitToWidth);mobileFit.addEventListener('click',fitToWidth);
 fullscreen.addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen?.();else view.requestFullscreen?.()});
 document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea'))return;if(['ArrowRight','PageDown'].includes(e.key)){e.preventDefault();navigate(current+1)}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();navigate(current-1)}});
 let start=null;view.addEventListener('touchstart',e=>{if(e.touches.length===1)start={x:e.touches[0].clientX,y:e.touches[0].clientY}}, {passive:true});
 view.addEventListener('touchend',e=>{if(!start||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;start=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5)navigate(current+(dx<0?1:-1))}, {passive:true});
 let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(()=>{if(pdf)render()},180)});
 async function openBook(g){
   if(!alive(g))return;
   loadTimer=setTimeout(()=>fail(g,Error('TIMEOUT')),60000);
   try{
     notice(lang('Checking book access…','Verificando acceso al libro…'));
     const session=await verifiedSession(g);check(g,session);
     binding=session;personKey=session.user.id;controller=new AbortController();
     expiryTimer=setTimeout(()=>{if(g===generation)invalidate()},Math.min(900000,session.expires_at*1000-Date.now()));
     const bytes=await privateBook(g,session,controller.signal);check(g,session);
     const m=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');check(g,session);
     m.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
     // Blob snapshots bytes before PDF.js transfers the original buffer to its worker.
     const blob=new Blob([bytes],{type:'application/pdf'}),task=m.getDocument({data:bytes});loadingTask=task;
     const doc=await task.promise;
     if(!alive(g)||!sameSession(session,persisted())){quiet(()=>task.destroy?.());fail(g,Error('SESSION_CHANGED'));return}
     if(doc.numPages!==83)throw Error('Unexpected book page count');
     pdf=doc;downloadBlob=blob;
     try{current=bounds(Number(localStorage.getItem(pageKey()))||1,1,pdf.numPages)}catch{current=1}
     for(const control of[number,zoomIn,zoomOut,fitWidth,mobileFit,fullscreen])control.disabled=false;
     breakVisible(false);await render();check(g,session);
     if(!pdf)throw Error('SESSION_CHANGED');
     licenseAck.disabled=false;downloadButton.disabled=true;clearTimeout(loadTimer);
   }catch(error){fail(g,error)}
 }
 function restart(){invalidate();const g=generation;if(!suspended&&!document.hidden)restartTimer=setTimeout(()=>openBook(g),0)}
 // Never await/call SDK Auth methods inside this callback: it runs under the SDK lock.
 // Clearing is synchronous; verification is deferred to a later task, after lock release.
 invalidate();
 auth?.client.auth.onAuthStateChange(()=>restart());
 window.addEventListener('storage',event=>{if(event.key===null||event.key===sessionKey)restart()});
 document.addEventListener('visibilitychange',()=>{suspended=document.hidden;if(suspended)invalidate();else restart()});
 window.addEventListener('pagehide',()=>{suspended=true;invalidate()});
 window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;restart()}});
 // Covers unavailable Auth and initial subscriptions without relying on callback delivery.
 const initial=generation;restartTimer=setTimeout(()=>openBook(initial),0);
})();
