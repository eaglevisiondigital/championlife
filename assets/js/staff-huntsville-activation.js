/* Temporary reviewed control. The server, not this page, authorizes every assignment. */
(() => {
 'use strict';
 const owner='61a20d9f-3412-4852-b51f-d226c0045477';
 const campaign='338d0b6c-596e-43ea-9878-5b9baeb8aa24';
 const recipients=new Map([
  ['e251f6d2-d760-478f-acfa-526823ad1eb7',{name:'Pastor Roddy',role:'pastor_roddy'}],
  ['eae35d7d-2283-434d-8134-f8f12d404572',{name:'Tania',role:'internal_team'}],
  ['48d5098e-63b5-4a85-b06b-7a4c5b8318df',{name:'Kelsea',role:'outreach_coordinator'}]
 ]);
 const caps=['view','registration.view','registration.manage','registration.export','checkin.manage'];
 const client=window.ChampionLifeAuth?.client;
 const status=document.getElementById('activation-status'),actions=document.getElementById('activation-actions'),login=document.getElementById('activation-login'),results=document.getElementById('activation-results');
 const buttons=[...actions.querySelectorAll('button')],attempted=new Set();
 let halted=false,busy=false,epoch=0;
 const disable=()=>buttons.forEach(b=>{b.disabled=true});
 const stop=message=>{halted=true;epoch++;disable();actions.hidden=true;status.textContent=message};
 const verify=async()=>{
  if(location.origin!=='https://championlifefwb.com'||client?.supabaseUrl?.replace(/\/$/,'')!=='https://exdocjbmylgxssanymjk.supabase.co')throw Error('TARGET');
  const {data,error}=await client.auth.getUser();const u=data?.user;
  if(error||u?.id!==owner||u.email!=='dave@theboss.biz'||!u.email_confirmed_at||u.is_anonymous)throw Error('IDENTITY');
 };
 const enable=()=>buttons.forEach(b=>{b.disabled=halted||busy||attempted.has(b.dataset.recipient)});
 async function activate(target){
  if(halted||busy||attempted.has(target)||!recipients.has(target))return;
  busy=true;disable();const generation=epoch;
  try{
   await verify();if(halted||generation!==epoch)return;
   attempted.add(target);status.textContent='Saving one approved assignment…';
   const {data:r,error}=await client.rpc('provision_huntsville_staff_20261023',{p_target:target});
   if(halted||generation!==epoch)return;
   if(error){const code=String(error.code||'UNKNOWN').replace(/[^A-Z0-9_]/g,'').slice(0,20);stop('Server stopped the request ('+code+'). Independently verify state before any retry.');return;}
   if(!r?.saved||r.actor_user_id!==owner||r.user_id!==target||r.campaign_id!==campaign||r.role_key!==recipients.get(target).role||!/^[0-9a-f-]{36}$/.test(r.audit_id||'')||JSON.stringify(r.capabilities)!==JSON.stringify(caps))throw Error('RECEIPT');
   const line=document.createElement('li');line.textContent=recipients.get(target).name+': assignment saved; audit '+r.audit_id+'. Recipient login verification remains pending.';results.append(line);
   status.textContent='Assignment recorded. Continue only with the next approved person.';
  }catch{stop('Request could not be verified. Its outcome may be uncertain; stop for independent state verification.');}
  finally{busy=false;enable();}
 }
 buttons.forEach(b=>b.addEventListener('click',()=>activate(b.dataset.recipient)));
 if(client?.auth.onAuthStateChange)client.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'||(session?.user&&session.user.id!==owner)){
   results.replaceChildren();stop('Administrator session changed. Stop and verify any submitted assignment.');login.hidden=false;
  }
 });
 addEventListener('pagehide',()=>{results.replaceChildren();stop('Page closed. Verify submitted assignments before reopening.');});
 addEventListener('pageshow',event=>{if(event.persisted){results.replaceChildren();stop('Restored page disabled. Verify state before continuing.');}});
 const generation=epoch;
 verify().then(()=>{if(halted||generation!==epoch)return;actions.hidden=false;status.textContent='Verified independent administrator: dave@theboss.biz';enable();}).catch(()=>{stop('Verified independent owner sign-in required. No assignment submitted.');login.hidden=false;});
})();
