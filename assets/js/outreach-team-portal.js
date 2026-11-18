/* Read-only recovery of PR6's own-trip flow. No signup, claiming or staff API. */
(() => {
 'use strict';
 const root=document.getElementById('outreach-team-portal'),auth=window.ChampionLifeAuth;
 if(!root)return;
 const account=document.getElementById('trip-account'),email=document.getElementById('trip-account-email'),logout=document.getElementById('trip-logout');
 const values=new URLSearchParams(location.search).getAll('campaign'),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 const campaign=values.length===1&&uuid.test(values[0])?values[0].toLowerCase():null;
 const next='/outreach-team.html'+(campaign?'?campaign='+campaign:''),login='outreach-login.html?next='+encodeURIComponent(next);
 let generation=0,currentUser=null,locked=false,signingOut=false,hiddenPage=false;
 const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
 const decision={applied:'Team Selection Pending',under_review:'Under Review',approved:'Approved to Serve',waitlisted:'Waitlisted',declined:'Not Selected',cancelled:'Cancelled'};
 const application={pending:'Received',under_review:'Under Review',waitlisted:'Waitlisted',not_selected:'Not Selected',cancelled:'Cancelled'};
 const blocked=s=>['cancelled','not_selected','waitlisted'].includes(s);
 const validDate=v=>typeof v==='string'&&v.length<=80&&Number.isFinite(Date.parse(v));
 const date=v=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))+' ('+Intl.DateTimeFormat().resolvedOptions().timeZone+')';
 function clear(){generation++;root.replaceChildren();}
 function identity(user){if(email)email.textContent=user?.email||'';if(account)account.hidden=!user;}
 function button(text,fn,primary=false){const n=el('button',text,{type:'button',class:primary?'trip-primary':''});n.onclick=async()=>{n.disabled=true;try{await fn()}finally{n.disabled=false}};return n;}
 function title(text){root.append(el('p','YOUR OUTREACH JOURNEY',{class:'trip-eyebrow'}),el('h1',text));}
 function eventLink(){clear();identity(null);title('Open Your Event Link');root.append(el('p','Ask the outreach team for your event link, then open it to view your own serving information.'));}
 function signedOut(){clear();identity(null);currentUser=null;title('Sign In to View Your Outreach Information');root.append(el('p','Use your existing verified account. The outreach team must have reviewed its connection to your participation record.'),el('a','Sign In',{href:login,class:'trip-button trip-primary'}));}
 function unavailable(){clear();title('Your outreach information is unavailable');root.append(el('p','Your account or event access may have changed. Contact the outreach team if you need help.'),el('a','Sign In',{href:login,class:'trip-button'}));}
 function failure(){clear();title('Your outreach information could not be confirmed');root.append(el('p','Your details are hidden. Check your connection and refresh to try again.'),button('Refresh My Information',refresh,true));}
 function empty(){title('Your Outreach Record');root.append(el('section',null,{class:'trip-card'}));root.lastChild.append(el('h2','No serving record is available for this event'),el('p','Ask the outreach team to review your existing application and verified account connection.'));root.append(button('Refresh My Information',refresh));}
 function validRows(data){return Array.isArray(data)&&data.length<=20&&data.every(r=>r&&r.campaign_id?.toLowerCase()===campaign&&typeof r.campaign==='string'&&r.campaign.length<=160&&Object.hasOwn(decision,r.status)&&Object.hasOwn(application,r.source_application_status)&&typeof r.travel_ready==='boolean'&&Array.isArray(r.travel)&&r.travel.length<=100);}
 function card(parent,heading){const n=el('section',null,{class:'trip-card'});n.append(el('h2',heading));parent.append(n);return n;}
 function tripConfirmed(row,t){return row.status==='approved'&&!blocked(row.source_application_status)&&row.travel_ready===true&&t?.state==='confirmed'&&t.itinerary_confirmed===true&&validDate(t.departure_at)&&typeof t.vehicle==='string'&&t.vehicle.trim()&&typeof t.departure_location==='string'&&t.departure_location.trim()&&typeof t.destination==='string'&&t.destination.trim();}
 function details(parent,label,value){const dl=parent.querySelector('dl')||parent.appendChild(el('dl'));dl.append(el('dt',label),el('dd',value));}
 function render(rows){
  if(!rows.length){empty();return;}
  title(rows[0].campaign);root.append(el('p','Your serving decision, attendance record and confirmed travel details.',{class:'trip-muted'}));
  for(const row of rows){
   const group=el('article');root.append(group);const status=card(group,'Your Serving Record'),effective=blocked(row.source_application_status)?application[row.source_application_status]:decision[row.status];
   status.append(el('span',effective,{class:'trip-badge'}));details(status,'Application Record',application[row.source_application_status]);
   details(status,blocked(row.source_application_status)?'Previous Team Decision':'Team Decision',decision[row.status]);
   if(blocked(row.source_application_status))status.append(el('p','Contact the outreach team before making travel plans.',{class:'trip-notice'}));
   else if(row.status!=='approved')status.append(el('p','Application receipt does not confirm team selection or travel.',{class:'trip-notice'}));
   const attendance=card(group,'Your Attendance History'),history=el('ol',null,{class:'trip-record'});history.append(el('li',validDate(row.checked_in_at)?'Checked In: '+date(row.checked_in_at):'Check-in has not been recorded.'),el('li',validDate(row.checked_in_at)&&validDate(row.attended_at)?'Attended: '+date(row.attended_at):'Attendance has not been recorded.'));attendance.append(history);
   const travel=card(group,'Your Travel Information'),confirmed=row.travel.filter(t=>tripConfirmed(row,t));
   if(!confirmed.length)travel.append(el('p',blocked(row.source_application_status)||row.status!=='approved'||!row.travel_ready?'Travel arrangements require outreach team review.':row.travel.some(t=>t?.state==='assigned')?'A seat has been reserved. Your itinerary is not confirmed.':'Your itinerary is not currently confirmed.',{class:'trip-notice'}),el('p','Travel details will appear here after the outreach team confirms them.'));
   else if(confirmed.length<row.travel.length)travel.append(el('p','Some travel arrangements are still awaiting confirmation. They are not part of the confirmed itinerary shown below.',{class:'trip-notice'}));
   for(const t of confirmed){const leg=el('section',null,{class:'trip-card trip-confirmed'});leg.append(el('h3',typeof t.leg==='string'?t.leg:'Confirmed Travel Leg'),el('span','Confirmed Itinerary',{class:'trip-badge'}));details(leg,'Vehicle',t.vehicle);details(leg,'Departure',date(t.departure_at));details(leg,'Meet At',t.departure_location);details(leg,'Destination',t.destination);travel.append(leg);}
  }
  root.append(button('Refresh My Information',refresh));
 }
 async function refresh(){
  if(!campaign){eventLink();return;}if(locked||signingOut||hiddenPage)return;
  const g=++generation;root.replaceChildren(el('p','Checking your current outreach information…',{role:'status'}));
  try{
   const user=await auth?.getUser();if(g!==generation)return;
   if(!user){signedOut();return;}currentUser=user.id;identity(user);
   const session=await auth.getSession();if(g!==generation)return;
   if(!session?.user||session.user.id!==currentUser){signedOut();return;}
   const result=await auth.client.rpc('outreach_team_own',{p_campaign:campaign});if(g!==generation||locked||hiddenPage)return;
   if(result.error?.code==='42501'||[401,403].includes(result.status)){unavailable();return;}
   if(result.error||!validRows(result.data))throw Error('Unavailable');
   const after=await auth.getSession();if(g!==generation||locked||hiddenPage)return;
   if(!after?.user||after.user.id!==currentUser){signedOut();return;}
   root.replaceChildren();render(result.data);
  }catch{if(g===generation&&!locked&&!hiddenPage)failure();}
 }
 async function signOut(){
  if(signingOut)return;locked=true;signingOut=true;clear();identity(null);if(logout)logout.disabled=true;title('Logging out…');
  try{const{error}=await auth.client.auth.signOut({scope:'local'});if(error||await auth.getSession())throw Error('Session remains');currentUser=null;signingOut=false;locked=false;signedOut();}
  catch{signingOut=false;clear();identity(null);title('Your outreach details are hidden');root.append(el('p','Log out could not be confirmed. Check your connection and try again.'),button('Try Log Out Again',signOut,true));}
  finally{if(logout)logout.disabled=false;}
 }
 logout?.addEventListener('click',signOut);
 auth?.client?.auth.onAuthStateChange((event,session)=>{if(locked||signingOut)return;if(event==='SIGNED_OUT'||(session?.user?.id||null)!==currentUser){clear();identity(null);currentUser=null;setTimeout(()=>{if(!locked&&!hiddenPage)refresh()},0)}});
 window.addEventListener('focus',()=>{if(campaign&&!hiddenPage&&!locked)refresh()});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){hiddenPage=true;clear();identity(null);}else{hiddenPage=false;if(!locked)refresh()}});
 window.addEventListener('pagehide',()=>{hiddenPage=true;clear();identity(null)});
 window.addEventListener('pageshow',event=>{if(event.persisted){clear();identity(null);location.reload()}});
 if(!campaign)eventLink();else refresh();
})();
