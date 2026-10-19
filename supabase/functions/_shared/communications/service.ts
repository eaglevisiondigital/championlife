// Fixed project RPC and service credentials stay server-side. Never return upstream error bodies.
export async function service(action: string, organization: string, payload: unknown = {}) {
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url))throw Error('Service configuration unavailable');
  const response=await fetch(url+'/rest/v1/rpc/communications_service',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_organization:organization,p_payload:payload})});
  if(!response.ok)throw Error('Communications operation failed');return response.json();
}
export function enabled(){return Deno.env.get('COMMUNICATIONS_ACCEPTANCE_ENABLED')==='true'&&Deno.env.get('SUPABASE_URL')==='https://bkbmjisprwmkptywtmih.supabase.co';}
export function constantTime(a:string,b:string){const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]||0)^(y[i]||0);return d===0;}
