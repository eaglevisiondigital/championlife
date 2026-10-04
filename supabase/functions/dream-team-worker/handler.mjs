const ACCEPTANCE='https://bkbmjisprwmkptywtmih.supabase.co';
export function createWorker({url,serviceKey,anonKey,workerSecret,renderPdf,fetcher=fetch,log=()=>{}}){
 return async request=>{
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(url!==ACCEPTANCE)return reply({error:'Acceptance only'},403);
  if(!workerSecret||workerSecret.length<32||request.method!=='POST'||request.headers.get('authorization')!=='Bearer '+workerSecret)return reply({error:'Worker authorization required'},403);
  const rpc=async(action,data={})=>{const r=await fetcher(url+'/rest/v1/rpc/dream_team_worker',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_data:data})});if(!r.ok)throw Error('Queue operation failed');return r.json()};let job;
  try{job=await rpc('claim');if(!job)return reply({status:'idle'});let result='failed',sha256;
   if(job.kind==='pdf'){const started=performance.now();const stage=name=>log({component:'dream-team-pdf',stage:name,elapsed_ms:Math.round(performance.now()-started)});stage('job_claimed');const bytes=await renderPdf(job.snapshot,stage);sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');stage('hash_ready');const r=await fetcher(url+'/storage/v1/object/dream-team-private/'+job.object_path,{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/pdf','x-upsert':'false'},body:bytes});result=r.ok?'accepted':'failed';stage(r.ok?'upload_accepted':'upload_failed');}
   else if(job.email){const suffix=job.kind==='online_email'?'&source=online':'&source=invitation',callback='https://deploy-preview-2--championlifechurch.netlify.app/discipleship-login.html?next=%2Fdream-team-application.html'+suffix;const r=await fetcher(url+'/auth/v1/otp?redirect_to='+encodeURIComponent(callback),{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({email:job.email,create_user:false})});result=r.ok?'accepted':'failed';}
   await rpc('receipt',{id:job.id,lease:job.lease,status:result,sha256});return reply({status:result});
  }catch(_){if(job)try{await rpc('receipt',{id:job.id,lease:job.lease,status:'unknown'})}catch(_){}return reply({error:'Worker operation unresolved; inspect restricted job status before retrying.'},502);}
 };
}
