// Browser mount for the reviewed PR69 renderer, intentionally excluded from the
// public site manifest. A controlled browser can import this module to test the
// *actual frozen PR61 staff shell* against fictional Supabase HTTP/Auth fixtures.
// This module never creates a second Auth client, grants access or bypasses RLS.
import {createIsolatedStaffSummaryAuth} from './isolated-staff-summary-auth.mjs';
import {mountChurchOutreachSummaryView} from './church-outreach-summary-view.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid=v=>typeof v==='string'&&v.length===36&&UUID.test(v);
const denied=code=>Object.assign(new Error(code),{code});

export async function mountSummaryInVerifiedStaffWorkspace({
 window:win, root, autoRefresh=true, signal, isolatedBackend
}={}){
 if(signal?.aborted)throw denied('STALE_SCOPE');
 const doc=win?.document;
 if(!doc || !root || root.ownerDocument!==doc || !doc.getElementById('staff-main')?.contains(root))
  throw new TypeError('Mount target must be inside the verified staff workspace');
 const workspace=win.StaffWorkspace;
 const auth=isolatedBackend ? createIsolatedStaffSummaryAuth({...isolatedBackend,auth:win.ChampionLifeAuth}) : win.ChampionLifeAuth;
 const scopeSelect=()=>doc.querySelector('#staff-context select[aria-label="Outreach campaign"]');
 // PR61 populates this control only from server-returned campaign discovery.
 // Treat its options as a navigation hint, never a source of authorization.
 if(!workspace?.active?.()||!auth?.client?.auth||!scopeSelect()||
    !['home','registration'].includes(doc.body?.dataset.staffWorkspace))
  throw denied('STAFF_WORKSPACE_NOT_READY');
 let closed=false;
 const getAllowedCampaigns=()=>Array.from(scopeSelect()?.options??[])
   .map(option=>option.value).filter(isUuid);
 const view=mountChurchOutreachSummaryView({
  root,auth,workspace,eventTarget:win,getAllowedCampaigns
 });
 // Clear on a change BEFORE PR61's own select onchange navigates to another
 // workspace; do not fetch private data from a new URL during navigation.
 const control=scopeSelect();
 const onChange=()=>close();
 const onProtected=()=>close();
 control.addEventListener('change',onChange,{capture:true});
 win.addEventListener('staff-protected-clear',onProtected);
 win.addEventListener('pagehide',onProtected);
 signal?.addEventListener('abort',onProtected,{once:true});
 function close(){
  if(closed)return;
  closed=true;
  control.removeEventListener('change',onChange,{capture:true});
  win.removeEventListener('staff-protected-clear',onProtected);
  win.removeEventListener('pagehide',onProtected);
  signal?.removeEventListener('abort',onProtected);
  view.close();
 }
 try{
  const selected=control.value;
  if(!isUuid(selected)||!getAllowedCampaigns().includes(selected))
   throw denied('CAMPAIGN_NOT_ALLOWED');
  view.select(selected);
  if(autoRefresh)await view.refresh();
  if(closed)throw denied('STALE_SCOPE');
 }catch(error){
  close();
  throw denied(['CAMPAIGN_NOT_ALLOWED','STALE_SCOPE'].includes(error?.code)?error.code:'SUMMARY_UNAVAILABLE');
 }
 return Object.freeze({refresh:()=>closed?Promise.reject(denied('VIEW_CLOSED')):view.refresh(),close});
}
