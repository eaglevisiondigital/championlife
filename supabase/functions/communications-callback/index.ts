import {verifyCallback} from '../_shared/communications/providers.mjs';
import {service,enabled} from '../_shared/communications/service.ts';
Deno.serve(async(request:Request)=>{
 if(!enabled())return new Response('Disabled',{status:503});
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 try{if(Number(request.headers.get('content-length')||0)>8192)throw Error('Too large');const reader=request.body?.getReader();if(!reader)throw Error('Missing body');const chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw Error('Too large');}chunks.push(value);}const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}const raw=new TextDecoder('utf-8',{fatal:true}).decode(data);
 const event=await verifyCallback(raw,request.headers,Deno.env.get('COMMUNICATIONS_CALLBACK_SECRET'));return Response.json(await service(event.action,event.organization,event.payload));}catch{return Response.json({error:'Callback rejected'},{status:400});}
});
