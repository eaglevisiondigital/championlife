// Source-only acceptance binding. Reuses the shell's existing client and wrapped
// RPC; never creates a client, bypasses the shell, or changes provider permissions.
const PRODUCTION='exdocjbmylgxssanymjk';
const REF=/^[a-z]{20}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>Object.assign(new Error(code),{code});
const deny=()=>({data:null,error:{code:'42501'},status:403});

export function createIsolatedStaffSummaryAuth({auth,projectRef,supabaseUrl}={}){
 if(typeof projectRef!=='string'||projectRef.length!==20||!REF.test(projectRef)||
    projectRef===PRODUCTION||supabaseUrl!==`https://${projectRef}.supabase.co`)
  throw fail('ISOLATED_BACKEND_REQUIRED');
 const client=auth?.client;
 const assertPinned=()=>{
  if(client!==auth.client||client?.supabaseUrl!==supabaseUrl||
     client?.auth?.url!==supabaseUrl+'/auth/v1'||client?.rest?.url!==supabaseUrl+'/rest/v1')
   throw fail('BACKEND_PIN_MISMATCH');
 };
 assertPinned();
 if(typeof auth.getSession!=='function'||typeof client.auth.getUser!=='function'||
    typeof client.auth.onAuthStateChange!=='function'||typeof client.rpc!=='function')
  throw fail('APPROVED_STAFF_CLIENT_REQUIRED');
 const sessionKey=s=>s?.user?.id&&s?.access_token?JSON.stringify([s.user.id,s.access_token]):null;
 const verifiedUser=async()=>{
  try{
   assertPinned();
   const before=await auth.getSession(),key=sessionKey(before);
   if(!key)return deny();
   // Explicit token: provider verifies precisely the session we captured.
   const result=await client.auth.getUser(before.access_token);
   const after=await auth.getSession();assertPinned();
   if(result?.error||sessionKey(after)!==key||result?.data?.user?.id!==before.user.id||
      !result?.data?.user?.email_confirmed_at||result?.data?.user?.is_anonymous)
    return deny();
   return result;
  }catch{return deny()}
 };
 const rpc=async(name,args,options={})=>{
  try{
   assertPinned();
   if(name!=='outreach_registration_workspace'||!['context','list'].includes(args?.p_action)||
      typeof args?.p_campaign!=='string'||args.p_campaign.length!==36||!UUID.test(args.p_campaign)||
      !args?.p_payload||Object.keys(args.p_payload).length!==0||
      Object.keys(args).some(k=>!['p_action','p_campaign','p_payload'].includes(k))||
      options.signal?.aborted)return deny();
   const session=await auth.getSession(),key=sessionKey(session);
   if(!key||options.signal?.aborted)return deny();
   const check=await verifiedUser();
   if(check.error||sessionKey(await auth.getSession())!==key||options.signal?.aborted)return deny();
   assertPinned();
   // Preserve staff-workspace's intercepted RPC. Supabase builders use
   // abortSignal(), not a `signal` RPC option. The accepted shell returns a
   // Promise, so physical cancellation is unavailable there; never bypass it.
   let request=client.rpc(name,{p_action:args.p_action,p_campaign:args.p_campaign,p_payload:{}});
   if(typeof request?.abortSignal==='function'&&options.signal)
    request=request.abortSignal(options.signal);
   const result=await request;
   const after=await auth.getSession();assertPinned();
   if(options.signal?.aborted||sessionKey(after)!==key)return deny();
   return result;
  }catch{return deny()}
 };
 return Object.freeze({
  getSession:async()=>{assertPinned();return auth.getSession()},
  client:Object.freeze({rpc,auth:Object.freeze({
   getUser:verifiedUser,
   onAuthStateChange:callback=>{assertPinned();return client.auth.onAuthStateChange(callback)}
  })})
 });
}
