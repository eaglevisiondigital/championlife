// Test-only initiation observation. Never attach a handler to the original fetch promise.
export function installInitiation(target, record, documentState, accounts) {
 const original=target.fetch;
 const own=(object,key)=>{const d=object&&Object.getOwnPropertyDescriptor(object,key);return d&&Object.hasOwn(d,'value')?d.value:undefined};
 function fetch(...args) {
  try {
   if(typeof args[0]==='string') {
    const url=new URL(args[0]);
    if(url.origin==='https://synthetic-modules.supabase.co'&&['/auth/v1/user','/rest/v1/rpc/forms_workspace'].includes(url.pathname)) {
     const method=own(args[1],'method'),headers=own(args[1],'headers');let authorization;
     // Only known fixture headers are inspected; no arbitrary accessor/string coercion.
     if(headers instanceof Headers)authorization=Headers.prototype.get.call(headers,'authorization');
     else authorization=own(headers,'authorization')??own(headers,'Authorization');
     let principal='unavailable';
     if(typeof authorization==='string') {
      try {const encoded=authorization.split(' ')[1].split('.')[1];const sub=JSON.parse(atob(encoded.replace(/-/g,'+').replace(/_/g,'/'))).sub;principal=sub===accounts.a?'account-A':sub===accounts.b?'account-B':'other'}catch{}
     }
     // Keep fixed synthetic app and exact SDK source locations only, not arbitrary error text.
     const stack=String(new Error().stack||'').split('\n').filter(line=>/https:\/\/(module-cycle8\.invalid\/assets\/js\/|cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.118\.0)/.test(line)).map(line=>line.replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g,'$1').slice(0,500)).slice(0,15);
     record({kind:'fetch-start',time:Date.now(),path:url.pathname,method:typeof method==='string'&&/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(method)?method:'unspecified',principal,...documentState(),stack});
    }
   }
  }catch{/* Observation must never replace the original result or synchronous error. */}
  return Reflect.apply(original,this,args);
 }
 target.fetch=fetch;
 return {original,installed:fetch};
}
