import {runExternalWorker,boundedBody} from '../_shared/communications/activation.mjs';
import {rpc,enabled,runtime,resolve,user,cors} from '../_shared/communications/activation-service.ts';
Deno.serve(async(req:Request)=>{
 let headers;try{headers=cors(req);}catch{return new Response('Origin denied',{status:403});}if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(!enabled())return new Response('Disabled',{status:503,headers});if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers});
 try{const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');const u=await user(token),p=JSON.parse(await boundedBody(req));if(!/^[a-f0-9-]{36}$/.test(p.organization_id||'')||!/^[a-f0-9-]{36}$/.test(p.id||''))throw Error('Invalid scope');
  if(p.action==='verify'){
   const v=await rpc('verify_request',p.organization_id,{id:p.id},token);let result;try{result=await resolve(v.sender).verify();}catch{result={configured:false,verified:false};}
   return Response.json(await rpc('verify_result',p.organization_id,{id:p.id,revision:v.revision,actor:u.id,environment:v.environment,project_ref:v.project_ref,...result}),{headers});
  }
  if(p.action==='send_test'){
   const v=await rpc('test_dispatch_request',p.organization_id,{id:p.id,message_id:p.message_id},token);if(v.message_id!==p.message_id)throw Error('Test denied');
   await runExternalWorker(rpc,p.organization_id,resolve,{enabled:true,runtime:runtime(),messageId:p.message_id});
   return Response.json(await rpc('test_result',p.organization_id,{id:p.id,message_id:p.message_id},token),{headers});
  }throw Error('Unsupported action');
 }catch{return Response.json({error:'Provider action unavailable or denied'},{status:403,headers});}
});
