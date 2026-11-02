(()=>{'use strict';
 const C=()=>window.CHAMPION_NMI_GIVING;
 let generation=0,knownUser;
 const changed=()=>Object.assign(Error('Giving session changed.'),{code:'SESSION_CHANGED'});
 async function readSession(auth){try{const value=auth?await auth.getSession():null;if(value?.error)throw changed();return value?.data?.session;}catch{throw changed();}}
 window.ChampionLifeAuth?.client?.auth.onAuthStateChange((event,session)=>{const id=session?.user?.id??null;if((event!=='INITIAL_SESSION'&&event!=='TOKEN_REFRESHED')||(knownUser!==undefined&&knownUser!==id))generation++;knownUser=id;});
 async function call(payload,{signal}={}){
  const c=C(),stamp=generation;
  if(c?.enabled!==true||c.project!==window.CHAMPION_LIFE_SUPABASE?.url||c.origin!==location.origin||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(c.project)||['exdocjbmylgxssanymjk','niyovbgoalulzkhbvebt','bkbmjisprwmkptywtmih'].includes(new URL(c.project).hostname.split('.')[0]))throw Error('Giving is unavailable.');
  const project=c.project,origin=c.origin,publicKey=window.CHAMPION_LIFE_SUPABASE.publishableKey;
  const headers={'Content-Type':'application/json',apikey:publicKey},auth=window.ChampionLifeAuth?.client?.auth;
  const session=await readSession(auth);knownUser=session?.user?.id??null;if(session?.expires_at!==undefined&&(!Number.isFinite(session.expires_at)||session.expires_at*1000<=Date.now()))throw changed();
  const unchanged=()=>stamp===generation&&!signal?.aborted&&C()?.enabled===true&&C().project===project&&C().origin===origin&&window.CHAMPION_LIFE_SUPABASE?.url===project&&window.CHAMPION_LIFE_SUPABASE?.publishableKey===publicKey;
  if(!unchanged())throw changed();
  if(session?.access_token)headers.Authorization='Bearer '+session.access_token;
  const r=await fetch(project+'/functions/v1/nmi-giving',{method:'POST',headers,body:JSON.stringify(payload),credentials:'omit',cache:'no-store',signal});
  const value=await r.json();
  const latest=await readSession(auth);
  if(!unchanged()||(session?.user?.id??null)!==(latest?.user?.id??null))throw changed();
  if([401,403].includes(r.status))throw changed();
  if(!r.ok)throw Error(value.status==='held'?'Giving is unavailable.':'We are confirming this result. Do not submit it again.');return value;
 }
 window.NmiGivingClient=Object.freeze({call,configuration:C,element:(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}});
})();
