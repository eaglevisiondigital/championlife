// Offline lifecycle tests. Auth, Storage, PDF renderer and hash responses are synthetic.
import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const source=read('assets/js/king-kind-reader.js');
const wait=ms=>new Promise(r=>setTimeout(r,ms)),flush=()=>wait(40),defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise}};
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
const d=new JSDOM(read('king-kind-reader.html'),{url:'https://reader.local.test',runScripts:'outside-only',pretendToBeVisual:true}),w=d.window,q=id=>w.document.getElementById(id);
const key='sb-synthetic-auth-auth-token',user={id:'a-fictional',email:'a@example.test',email_confirmed_at:'2026-01-01',is_anonymous:false};
let current={user,access_token:'fictional-A',expires_at:Date.now()/1000+600},events=[],locked=false,denied=false,authFailure=false,delayUser=null,delaySign=null,abortCount=0,signs=0,downloadCount=0,draws=0,destroyed=0,urls=new Set(),revokes=0;
const store=()=>current?w.localStorage.setItem(key,JSON.stringify(current)):w.localStorage.removeItem(key);
const change=s=>{current=s;store();locked=true;try{for(const f of events){const returned=f(s?'SIGNED_IN':'SIGNED_OUT',s);ok(!(returned instanceof Promise),'Auth listener returns synchronously')}}finally{locked=false}};
const session=()=>({user:{...user},access_token:'fictional-A',expires_at:Date.now()/1000+600});
const context={drawImage:()=>draws++,fillRect:()=>{}};w.HTMLCanvasElement.prototype.getContext=()=>context;
w.matchMedia=()=>({matches:false});w.AbortController=AbortController;
w.CHAMPION_LIFE_SUPABASE={url:'https://synthetic-auth.supabase.co'};
w.ChampionLifeAuth={client:{auth:{onAuthStateChange:f=>events.push(f),getSession:async()=>{assert.equal(locked,false,'no Auth method under callback lock');return{data:{session:current}}},getUser:async()=>{assert.equal(locked,false);const u=current?.user;if(delayUser){const p=delayUser;delayUser=null;await p.promise}return{data:{user:u},error:authFailure?Error('Auth failed'):null}}},storage:{from:()=>({createSignedUrl:async()=>{signs++;if(delaySign){const p=delaySign;delaySign=null;await p.promise}return denied?{error:Error('Denied')}:{data:{signedUrl:'https://fictional.invalid/private'}}}})}}};
w.fetch=async(_url,{signal})=>{signal.addEventListener('abort',()=>abortCount++);return{ok:true,arrayBuffer:async()=>new ArrayBuffer(100001)}};
Object.defineProperty(w.crypto,'subtle',{value:{digest:async()=>Uint8Array.from(Buffer.from('417f9faa7ff3945fdf4ff62931a233739856d03221c8429e21b768b221b94a54','hex')).buffer}});
w.__PDFModule={GlobalWorkerOptions:{},getDocument:()=>({destroy:async()=>destroyed++,promise:Promise.resolve({numPages:83,getPage:async()=>({getViewport:()=>({width:600,height:800}),render:()=>({promise:Promise.resolve(),cancel:()=>{}})})})})};
w.URL.createObjectURL=()=>{const v='blob:synthetic-'+(urls.size+1);urls.add(v);return v};w.URL.revokeObjectURL=u=>{urls.delete(u);revokes++};w.HTMLAnchorElement.prototype.click=()=>downloadCount++;
store();w.localStorage.setItem('unrelated','preserve');w.eval(source.replace("import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs')",'Promise.resolve(window.__PDFModule)'));await flush();
const ready=()=>ok(!q('book-license-ack').disabled&&!q('page-wrap').hidden,'eligible document visible after authorization');
const cleared=label=>ok(q('download-book').disabled&&q('book-license-ack').disabled&&!q('book-license-ack').checked&&q('page-wrap').hidden&&q('page-canvas').width===0&&q('page-canvas').height===0,label);
const ack=()=>{q('book-license-ack').checked=true;q('book-license-ack').dispatchEvent(new w.Event('change'))};
ready();ok(draws===1,'initial authorized page committed');ack();q('download-book').click();await flush();ok(downloadCount===1&&signs===2,'download requires fresh server eligibility');ok(urls.size===1,'personal-use blob URL tracked');
change(null);cleared('logout clears synchronously before callback returns');ok(urls.size===0&&revokes>0,'logout revokes retained blob URLs');ok(destroyed>0&&abortCount>0,'document destruction and fetch abort invoked');
q('download-book').dispatchEvent(new w.Event('click'));await flush();ok(downloadCount===1,'forced post-logout click denied');
change(session());await flush();ready();const aDraw=draws;
// Delayed A Auth response cannot overwrite independently authorized B.
const late=defer();delayUser=late;w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));await flush();
change({...session(),user:{...user,id:'b-fictional',email:'b@example.test'},access_token:'fictional-B'});await flush();ready();const bDraw=draws;late.resolve();await flush();ok(draws===bDraw&&bDraw>aDraw,'late old Auth response cannot paint or clear new account');
// Ineligible current account gets no document. Failure does not borrow prior eligibility.
denied=true;change(session());cleared('switch immediately locked');await flush();cleared('Storage denial remains locked');denied=false;
change(session());await flush();ready();authFailure=true;ack();q('download-book').click();await flush();cleared('Auth failure clears previously visible book');authFailure=false;
change(session());await flush();ready();
// Same UUID but changed token cannot use retained state before callback notification.
current={...current,access_token:'replacement'};store();ack();cleared('token replacement blocks synchronous acknowledgment');
change(session());await flush();ready();
w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));cleared('pagehide clears snapshot');change(session());await flush();cleared('Auth events cannot reopen suspended history snapshot');
w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));await flush();ready();
// Cross-tab storage invalidation is synchronous; only fresh provider checks can restore.
w.dispatchEvent(new w.StorageEvent('storage',{key}));cleared('storage event clears immediately');await flush();ready();
// Missing/malformed storage fails closed, but does not erase unrelated browser data.
w.localStorage.setItem(key,'invalid JSON');q('download-book').dispatchEvent(new w.Event('click'));cleared('malformed persisted session denied');
change({...session(),user:{...user,email_confirmed_at:null}});await flush();cleared('unverified identity denied');
change({...session(),user:{...user,is_anonymous:true}});await flush();cleared('anonymous identity denied');
change({...session(),expires_at:Date.now()/1000+0.2});await flush();ready();await wait(220);cleared('expiry clears without SDK event');
change(session());await flush();ready();
const lateSign=defer();delaySign=lateSign;ack();q('download-book').click();await flush();change(null);cleared('pending download canceled on logout');lateSign.resolve();await flush();ok(downloadCount===1,'late signed URL cannot release cached bytes');
ok(w.localStorage.getItem('unrelated')==='preserve','unrelated local storage preserved');
ok(!/\.from\(['"](?:profiles|outreach_registrations)|\.rpc\(|\.upload\(|\.update\(/.test(source),'reader adds no database mutations');
d.window.close();console.log(`${checks} reader live-session local security assertions passed (synthetic providers).`);
