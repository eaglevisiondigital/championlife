// Opt-in source-only mount INSIDE the accepted shared staff shell. No new login.
import {createSharedStaffBackend} from '../outreach/shared-staff-backend.mjs';
export function mountStaffPartnerIntakeReview({window:win,root,projectRef}={}){
 const doc=win?.document,main=doc?.getElementById('staff-main'),scope=doc?.querySelector('#staff-context select[aria-label="Church organization"]');
 if(!root || root.ownerDocument!==doc || !main?.contains(root) || main.hidden || !win.StaffWorkspace?.active() || !scope)throw Error('Authorized shared staff workspace required');
 const org=scope.value;let closed=false,generation=0,backend;
 const close=()=>{if(closed)return;closed=true;generation++;backend?.close();root.replaceChildren();root.remove();observer?.disconnect();doc.removeEventListener('change',closeOnContext,true);doc.removeEventListener('click',closeOnLogout,true);};
 const closeOnContext=e=>{if(e.target?.closest?.('#staff-context'))close();};
 const closeOnLogout=e=>{if(e.target?.closest?.('#staff-logout'))close();};
 let observer=null;
 const active=()=>!closed&&root.isConnected&&main.contains(root)&&!main.hidden&&win.StaffWorkspace.active()&&scope.isConnected&&scope.value===org;
 try{backend=createSharedStaffBackend({auth:win.ChampionLifeAuth,workspace:win.StaffWorkspace,eventTarget:win,projectRef,onClear:close});}catch(e){close();throw e;}
 // Auth registration may synchronously retire the consumer.
 if(closed){backend.close();throw Error('Staff access unavailable');}
 doc.addEventListener('change',closeOnContext,true);doc.addEventListener('click',closeOnLogout,true);
 observer=new win.MutationObserver(()=>{if(!active())close();});observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
 const el=(tag,text)=>{const n=doc.createElement(tag);n.textContent=text;return n;};
 async function refresh(){
  if(!active()){close();throw Error('Partner review unavailable');}const g=++generation;root.replaceChildren(el('p','Checking Partner intake review access…'));
  try{
   const records=await backend.readPartnerIntakes({organizationId:org});
   if(g!==generation||!active())throw Error('Unavailable');
   const heading=el('h2','Partner intake review'),notice=el('p','Financial intake review only. Assigned ministry Partner access is not installed.');
   const list=el('ul','');for(const row of records){const item=el('li',`${row.status} · ${row.sourceSite} · ${row.submittedAt}`);item.dataset.intakeId=row.id;list.append(item);}
   const open=el('a','Open authorized intake workspace');open.href='staff-outreach-partners.html?org='+encodeURIComponent(org);
   open.addEventListener('click',event=>{event.preventDefault();if(g!==generation||!active())return;const href=open.getAttribute('href');close();win.StaffWorkspace.navigate(href);});
   const retry=el('button','Refresh intake status');retry.type='button';retry.addEventListener('click',()=>{if(g===generation&&active())refresh().catch(()=>{});});
   root.replaceChildren(heading,notice,list,open,retry);return records.length;
  }catch{if(g===generation)close();throw Error('Partner review unavailable');}
 }
 return Object.freeze({refresh,close,active});
}
