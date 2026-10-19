(()=>{'use strict';
 const C=()=>window.CHAMPION_NMI_GIVING;
 async function call(payload){const c=C();if(!c?.enabled||c.project!==window.CHAMPION_LIFE_SUPABASE?.url||c.origin!==location.origin||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(c.project)||['exdocjbmylgxssanymjk','niyovbgoalulzkhbvebt','bkbmjisprwmkptywtmih'].includes(new URL(c.project).hostname.split('.')[0]))throw Error('Giving is unavailable.');
  const headers={'Content-Type':'application/json',apikey:window.CHAMPION_LIFE_SUPABASE.publishableKey};
  const a=window.ChampionLifeAuth?.client;if(a){const {data}=await a.auth.getSession();if(data?.session?.access_token)headers.Authorization='Bearer '+data.session.access_token;}
  const r=await fetch(c.project+'/functions/v1/nmi-giving',{method:'POST',headers,body:JSON.stringify(payload),credentials:'omit',cache:'no-store'});const value=await r.json();if(!r.ok)throw Error(value.status==='held'?'Giving is unavailable.':'We are confirming this result. Do not submit it again.');return value;}
 window.NmiGivingClient=Object.freeze({call,configuration:C,element:(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}});
})();
