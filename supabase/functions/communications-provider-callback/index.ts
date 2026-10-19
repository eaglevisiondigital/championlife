import {boundedBody,verifiedProviderEvent} from '../_shared/communications/activation.mjs';
import {rpc,enabled,registry,runtime} from '../_shared/communications/activation-service.ts';
// Populated only with an explicitly selected vendor's audited verifier. SMTP has no webhook.
const verifiers:Record<string,Function>={};
Deno.serve(async(req:Request)=>{if(!enabled())return new Response('Disabled',{status:503});if(req.method!=='POST')return new Response('Method not allowed',{status:405});let scope;try{
 const profileId=new URL(req.url).searchParams.get('profile');if(!/^[a-f0-9-]{36}$/.test(profileId||''))throw Error('Invalid profile');
 const b=registry()[profileId!];const rt=runtime();if(!b||b.environment!==rt.environment||b.project_ref!==rt.project_ref)throw Error('Profile unavailable');scope={organization:b.organization_id,id:profileId};
 const profile=await rpc('profile',scope.organization,{id:profileId});const e=await verifiedProviderEvent(await boundedBody(req),req.headers,profile,b,verifiers[b.provider]);
 return Response.json(await rpc(e.action,scope.organization,{id:profileId,...e.payload}));
 }catch{if(scope)try{await rpc('callback_rejected',scope.organization,{id:scope.id});}catch{}return Response.json({error:'Callback rejected'},{status:400});}});
