// Source-only integration entrypoint. Not imported by public HTML or allowlisted.
// Reuses the existing shell principal, backend checks and renderer. It has no
// credentials, backend URL, Auth constructor, permissions or mutation capability.
import {mountSummaryInVerifiedStaffWorkspace} from './church-outreach-summary-staff-mount.mjs';

const installations=new WeakMap();
const failure=code=>Object.assign(new Error(code),{code});

export function installStaffOutreachSummary({window:win}={}){
 if(!win?.document||typeof win.MutationObserver!=='function')
  throw new TypeError('A browser window is required');
 // A module is installed once per document. A stopped instance is not restarted:
 // returning from history or changing identity requires the shell's fresh page.
 if(installations.has(win.document))return installations.get(win.document);
 const doc=win.document,abort=new win.AbortController();
 let phase='waiting',root=null,view=null,observer=null,authSubscription=null;
 const dispose=()=>{
  observer?.disconnect();observer=null;
  authSubscription?.unsubscribe?.();authSubscription=null;
  for(const event of ['staff-protected-clear','staff-access-denied','pagehide'])
   win.removeEventListener(event,close);
  doc.removeEventListener('click',onClick,true);
  doc.removeEventListener('change',onChange,true);
 };
 function close(){
  if(phase==='closed')return;
  phase='closed';abort.abort();dispose();
  try{view?.close()}finally{view=null;root?.remove();root=null}
 }
 function onClick(event){if(event.target?.closest?.('#staff-logout'))close()}
 function onChange(event){if(event.target?.closest?.('#staff-context'))close()}
 function subscribeAuth(){
  if(authSubscription)return;
  const auth=win.ChampionLifeAuth?.client?.auth;
  if(typeof auth?.onAuthStateChange!=='function')return;
  let result;
  try{result=auth.onAuthStateChange(event=>{
   // No awaited Auth call inside an Auth callback; never create a second client.
   if(event==='SIGNED_OUT')close();
  })}catch{close();return}
  const candidate=result?.data?.subscription??result?.subscription;
  if(!candidate||typeof candidate.unsubscribe!=='function'){close();return}
  // A provider can synchronously emit SIGNED_OUT while registering the callback.
  if(phase==='closed')candidate.unsubscribe();else authSubscription=candidate;
 }
 function inspect(){
  if(phase==='closed')return;
  subscribeAuth();
  if(phase==='closed')return;
  const main=doc.getElementById('staff-main');
  if(phase==='mounting'||phase==='ready'){
   if(!win.StaffWorkspace?.active?.()||!root?.isConnected||main?.hidden)close();
   return;
  }
  // Church and the future Partner context have separate authorized modules.
  // Absence of the accepted Outreach control is not a reason to fabricate one.
  const mode=doc.querySelector('#staff-context select[aria-label="Ministry context"]');
  const campaign=doc.querySelector('#staff-context select[aria-label="Outreach campaign"]');
  if(!win.StaffWorkspace?.active?.()||!main||main.hidden||
     !['home','registration'].includes(doc.body?.dataset.staffWorkspace)||
     mode?.value!=='outreach'||!campaign)return;
  phase='mounting';
  root=doc.createElement('section');
  root.setAttribute('data-staff-outreach-summary','');
  main.append(root);
  mountSummaryInVerifiedStaffWorkspace({window:win,root,signal:abort.signal}).then(result=>{
   if(phase==='closed'){result.close();return}
   view=result;phase='ready';inspect();
  }).catch(()=>{
   // The shell owns the generic denied/connection message; do not surface raw
   // backend errors, retain totals, or silently retry a failed authorization.
   close();
  });
 }
 const handle=Object.freeze({
  state:()=>phase,
  async refresh(){
   if(phase!=='ready'||!view)throw failure('SUMMARY_NOT_READY');
   try{return await view.refresh()}catch{close();throw failure('SUMMARY_UNAVAILABLE')}
  },
  close
 });
 installations.set(doc,handle);
 for(const event of ['staff-protected-clear','staff-access-denied','pagehide'])
  win.addEventListener(event,close);
 doc.addEventListener('click',onClick,true);
 doc.addEventListener('change',onChange,true);
 observer=new win.MutationObserver(inspect);
 observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,
  attributeFilter:['hidden','data-staff-workspace']});
 inspect();
 return handle;
}
