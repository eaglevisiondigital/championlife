import {runWorker,acceptanceSink} from '../_shared/communications/providers.mjs';
import {service,enabled,constantTime} from '../_shared/communications/service.ts';
const sink=acceptanceSink();
Deno.serve(async(request:Request)=>{
 if(!enabled())return new Response('Disabled',{status:503});
 const key=Deno.env.get('COMMUNICATIONS_WORKER_SECRET')||'';
 if(key.length<32||!constantTime(request.headers.get('authorization')||'','Bearer '+key))return new Response('Unauthorized',{status:401});
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 try{const p=await request.json();if(!/^[a-f0-9-]{36}$/.test(p.organization_id))throw Error('Invalid organization');return Response.json(await runWorker(service,p.organization_id,sink,{enabled:true}));}catch{return Response.json({error:'Communications worker failed'},{status:400});}
});
