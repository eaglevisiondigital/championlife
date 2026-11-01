// Source-only shared login integration. Existing RPCs remain authoritative.
// No client constructor, credentials, grant, mutation, direct table or new schema.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = x => typeof x === 'string' && x.length === 36 && UUID.test(x);
const error = () => Object.assign(new Error('Staff access unavailable; verify again.'), {code: 'STAFF_UNAVAILABLE'});
const canonical = v => Array.isArray(v) ? v.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v;
const key = s => uuid(s?.user?.id) && typeof s.access_token === 'string' && s.access_token ? JSON.stringify([s.user.id,s.access_token]) : null;
const label = x => typeof x === 'string' && x.length <= 200 ? x : '';

export function createSharedStaffBackend({auth, workspace, eventTarget, projectRef, onClear = ()=>{}} = {}) {
  const client = auth?.client, url = `https://${projectRef}.supabase.co`;
  if (typeof projectRef !== 'string' || !/^[a-z]{20}$/.test(projectRef) || projectRef === 'exdocjbmylgxssanymjk' ||
      typeof auth?.getSession !== 'function' || typeof client?.rpc !== 'function' ||
      typeof client?.auth?.getUser !== 'function' || typeof client?.auth?.onAuthStateChange !== 'function' ||
      typeof workspace?.active !== 'function' || typeof eventTarget?.addEventListener !== 'function' ||
      typeof eventTarget?.removeEventListener !== 'function' || typeof onClear !== 'function') throw error();
  let generation=0, closed=false, subscription, owner=null;
  const pending=new Set();
  const pinned=()=>{if(client!==auth.client || client.supabaseUrl!==url || client.auth.url!==url+'/auth/v1' || client.rest?.url!==url+'/rest/v1')throw error();};
  pinned();
  function close(){
    if(closed)return;closed=true;generation++;owner=null;
    for(const controller of pending)controller.abort();pending.clear();
    subscription?.unsubscribe?.();
    for(const name of ['staff-protected-clear','staff-access-denied','pagehide'])eventTarget.removeEventListener(name,close);
    onClear();
  }
  const check=g=>{pinned();if(closed || generation!==g || !workspace.active())throw error();};
  const verify=async g=>{
    check(g);const before=await auth.getSession();check(g);const captured=key(before);if(!captured)throw error();
    if(owner && owner!==captured)throw error();owner=captured;
    const result=await client.auth.getUser(before.access_token);check(g);
    const after=await auth.getSession();check(g);
    if(result?.error || result?.data?.user?.id!==before.user.id || !result.data.user.email_confirmed_at || result.data.user.is_anonymous || key(after)!==captured)throw error();
    return captured;
  };
  const rpc=async(name,args,g,signal)=>{
    check(g);let call=client.rpc(name,args);if(typeof call?.abortSignal==='function')call=call.abortSignal(signal);
    const result=await call;check(g);
    if(result?.error || [401,403].includes(result?.status) || result?.data===undefined || result.data===null)throw error();
    return result.data;
  };
  const directory=async(g,signal)=>{
    // Reject each failed sibling immediately; do not wait for a hung sibling.
    const load=async(...args)=>{try{return await rpc(...args,g,signal)}catch(e){close();throw e;}};
    const [staff,campaigns]=await Promise.all([load('staff_workspace_context',{}),load('outreach_registration_workspace',{p_action:'campaigns',p_campaign:null,p_payload:{}})]);
    check(g);
    if(!Array.isArray(staff.organizations)||!Array.isArray(staff.grants)||!Array.isArray(campaigns))throw error();
    if(staff.organizations.some(o=>!uuid(o?.id)) || campaigns.some(c=>!uuid(c?.id)) || staff.grants.some(p=>!uuid(p?.organization_id)||typeof p.permission!=='string'))throw error();
    const granted=(id,permission)=>staff.grants.some(p=>p.organization_id===id&&p.permission===permission&&!p.department_ids);
    const organizations=staff.organizations.map(o=>({id:o.id,name:label(o.name)}));
    return {
      church: organizations.filter(o=>granted(o.id,'people.read')),
      outreach: campaigns.map(c=>({id:c.id,name:label(c.name)})),
      // This is the EXISTING financial intake reviewer, not the proposed ministry portal.
      partnerIntakeReview: organizations.filter(o=>granted(o.id,'outreach.view')&&granted(o.id,'finance.read')),
      partnerAssignedPortal: {available:false,reason:'AUTHORITATIVE_ASSOCIATION_NOT_INSTALLED'}
    };
  };
  async function run(operation){
    const g=generation,controller=new AbortController();pending.add(controller);
    try{const identity=await verify(g);const result=await operation(g,controller.signal);if(await verify(g)!==identity)throw error();return result;}
    catch{close();throw error();}finally{pending.delete(controller);}
  }
  for(const name of ['staff-protected-clear','staff-access-denied','pagehide'])eventTarget.addEventListener(name,close);
  try{
    const response=client.auth.onAuthStateChange(event=>{if(['SIGNED_OUT','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED','PASSWORD_RECOVERY'].includes(event))close();});
    subscription=response?.data?.subscription??response?.subscription;
    if(typeof subscription?.unsubscribe!=='function')throw error();if(closed)subscription.unsubscribe();
  }catch{close();throw error();}
  return Object.freeze({
    close,
    active:()=>!closed&&workspace.active(),
    discover:()=>run((g,signal)=>directory(g,signal)),
    // Fixed read action only; consumer cannot inject an RPC name, action, identity,
    // permission, search, export, offset, or direct table request.
    async readPartnerIntakes(selection){
      if(!selection || Object.keys(selection).length!==1 || !Object.hasOwn(selection,'organizationId') || !uuid(selection.organizationId)){close();throw error();}
      const org=selection.organizationId;
      return run(async(g,signal)=>{
        const before=await directory(g,signal);
        if(!before.partnerIntakeReview.some(o=>o.id===org))throw error();
        const rows=await rpc('outreach_partner_workspace',{p_org:org,p_action:'list',p_data:{}},g,signal);
        const after=await directory(g,signal);
        if(JSON.stringify(canonical(before))!==JSON.stringify(canonical(after)) || !Array.isArray(rows))throw error();
        // Only return linked record metadata; never pass financial/contact fields to
        // the Partner navigation consumer, even though existing SQL returns them.
        const result=[];
        for(const r of rows){
          if(!uuid(r?.id)||!['new','reviewed','linked'].includes(r.status)||!['sowgo','champion_life'].includes(r.source_site)||!Number.isFinite(Date.parse(r.submitted_at))||(r.person_id!==null&&!uuid(r.person_id)))throw error();
          result.push(Object.freeze({id:r.id,organizationId:org,personId:r.person_id,status:r.status,sourceSite:r.source_site,submittedAt:r.submitted_at}));
        }
        return Object.freeze(result);
      });
    }
  });
}
