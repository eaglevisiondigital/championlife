export function createDocuments({url,anonKey,serviceKey,fetcher=fetch,origin='https://deploy-preview-2--championlifechurch.netlify.app'}){
 return async request=>{
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store, private','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const fail=status=>new Response('Document unavailable',{status,headers});
  if(url!=='https://bkbmjisprwmkptywtmih.supabase.co'||request.headers.get('origin')!==origin)return fail(403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});if(request.method!=='POST')return fail(405);
  try{const raw=await request.text();if(raw.length>200)return fail(413);const {id}=JSON.parse(raw);if(!/^[a-f0-9-]{36}$/.test(id||''))return fail(400);const bearer=request.headers.get('authorization');if(!bearer?.startsWith('Bearer '))return fail(401);
   const identity=await fetcher(url+'/auth/v1/user',{headers:{apikey:anonKey,Authorization:bearer}});if(!identity.ok)return fail(401);
   const access=await fetcher(url+'/rest/v1/rpc/dream_team_document',{method:'POST',headers:{apikey:anonKey,Authorization:bearer,'Content-Type':'application/json'},body:JSON.stringify({p_id:id})});if(!access.ok)return fail(403);const {path}=await access.json();if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.pdf$/.test(path))return fail(403);
   const file=await fetcher(url+'/storage/v1/object/dream-team-private/'+path,{headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey}});if(!file.ok)return fail(404);
   return new Response(file.body,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Champion-Life-Dream-Team-Application.pdf"'}});
  }catch(_){return fail(502);}
 };
}
