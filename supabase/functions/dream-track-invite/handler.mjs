// Explicit JWT validation + guarded manager RPC. No service credentials reach clients.
export function createHandler({url,anonKey,serviceKey,fetcher=fetch,allowedOrigin='https://deploy-preview-2--championlifechurch.netlify.app'}) {
 return async request=>{
  const origin=request.headers.get('origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin!==allowedOrigin)return reply({error:'Origin not allowed'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  const bearer=request.headers.get('authorization');if(!bearer?.startsWith('Bearer '))return reply({error:'Sign in required'},401);
  let invite;
  try{
   const raw=await request.text();if(raw.length>2000)return reply({error:'Request too large'},413);const body=JSON.parse(raw);
   if(!/^[a-f0-9]{64}$/.test(body.token||''))return reply({error:'Invalid invitation'},400);
   const identity=await fetcher(url+'/auth/v1/user',{headers:{apikey:anonKey,Authorization:bearer}});if(!identity.ok)return reply({error:'Sign in required'},401);
   const prep=await fetcher(url+'/rest/v1/rpc/dream_track_admin',{method:'POST',headers:{apikey:anonKey,Authorization:bearer,'Content-Type':'application/json'},body:JSON.stringify({p_org:body.organization_id,p_action:'send',p_data:{invite_id:body.invite_id,token:body.token}})});
   if(!prep.ok)return reply({error:'Invitation not available or delivery already in progress'},403);invite=await prep.json();
   // Reuse configured Supabase Auth mail for both new and existing accounts.
   // Exact existing callback needs no Auth/SMTP changes; verified-email claim on My Discipleship resumes the invitation.
   const delivery=await fetcher(url+'/auth/v1/otp?redirect_to='+encodeURIComponent(allowedOrigin+'/discipleship-login.html'),{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({email:invite.recipient_email,create_user:true})});
   const receipt=await fetcher(url+'/rest/v1/rpc/course_invite_delivery',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_id:invite.id,p_delivery:invite.delivery_id,p_sent:delivery.ok})});
   if(!receipt.ok)return reply({error:'Delivery status could not be recorded. Refresh before resending.'},502);
   return delivery.ok?reply({status:'sent',send_status:'provider_accepted'}):reply({error:'Email provider did not accept the invitation. Use the copy-link fallback.',status:'failed'},502);
  }catch(_){
   if(invite)try{await fetcher(url+'/rest/v1/rpc/course_invite_delivery',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_id:invite.id,p_delivery:invite.delivery_id,p_sent:false})})}catch(_){}
   return reply({error:'Email delivery unavailable. Use the copy-link fallback.',status:'failed'},502);
  }
 };
}
