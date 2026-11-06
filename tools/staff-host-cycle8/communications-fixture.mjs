// Fictional HTTP responses only; actual pinned SDK/Auth/shell/module execute unchanged.
export const ids={a:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',b:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',o:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',p:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',c:'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',d:'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'};
export const session=id=>{const exp=Math.floor(Date.now()/1000)+3600,user={id,email:(id===ids.a?'first':'second')+'@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01'};return{access_token:[{alg:'HS256',typ:'JWT'},{sub:id,exp,aud:'authenticated',role:'authenticated'},'fictional-signature'].map((v,i)=>i===2?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.'),refresh_token:'fictional-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user}};
export function model(){
 const permissions=['communications.view','communications.send','communications.templates.view','communications.delivery.view'];
 const organizations=[{id:ids.o,name:'Fictional Church',permissions},{id:ids.p,name:'Other Fictional Church',permissions}],campaigns=[{id:ids.c,organization_id:ids.o,name:'Fictional Outreach',permissions},{id:ids.d,organization_id:ids.p,name:'Other Fictional Outreach',permissions}];
 const f={calls:[],unexpected:[],actor:ids.a,denied:false,missing:false,context:{organizations,campaigns,external_delivery_enabled:false},hold:null,release:null};
 f.backend=async route=>{
  const req=route.request(),u=new URL(req.url());let actor;try{actor=JSON.parse(Buffer.from(req.headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub}catch{}
  const respond=(json,status=200)=>route.fulfill({json,status});
  if(u.pathname==='/auth/v1/user')return actor===f.actor?respond(session(actor).user):respond({message:'Fictional expired identity'},401);
  if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
  if(!u.pathname.startsWith('/rest/v1/rpc/')){f.unexpected.push(u.pathname);return route.abort()}
  const name=u.pathname.split('/').at(-1),p=req.postDataJSON(),action=p.p_action||'context';f.calls.push({name,action,p,actor});
  if(f.hold===name+':'+action){f.hold=null;await new Promise(resolve=>f.release=()=>{f.release=null;resolve()})}
  if(name==='staff_workspace_context')return respond({organizations:[],grants:[]});
  if(name==='outreach_registration_workspace'&&action==='campaigns')return respond([]);
  if(name==='forms_workspace')return respond({code:'PGRST202',message:'Optional fixture module absent'},404);
  if(name==='communications_workspace'){
   if(f.denied)return respond({code:'42501',message:'Fictional communications denied'},403);
   if(f.missing)return respond({code:'PGRST202',message:'Optional fixture module absent'},404);
   if(action==='context')return respond(f.context);
   const scope=p.p_campaign?f.context.campaigns.find(c=>c.id===p.p_campaign&&c.organization_id===p.p_payload.organization_id):f.context.organizations.find(o=>o.id===p.p_payload.organization_id);
   if(!scope)return respond({code:'42501'},403);
   if(action==='senders')return respond([{id:'fictional-sender',display_name:'Fictional sender',channel:'email'}]);
   if(action==='templates')return respond([]);
   if(action==='overview')return respond({metrics:{queued:0,sent:0,delivered:0,failed:1,suppressed:0},delivery_mode:'disabled'});
   if(action==='activity')return respond([{id:'fictional-message',campaign_id:p.p_campaign,recipient_name:'Private Fictional Recipient',channel:'email',message_type:'operational',status:'failed',failure_class:'unknown',attempts:1,created_at:'2026-11-06T00:00:00Z'}]);
   if(action==='message')return respond({subject:'Private fictional subject',rendered_body:'Private fictional body'});
  }
  // No preview, queue, retry, cancellation or other mutation is modeled or allowed.
  f.unexpected.push({name,action});return respond({code:'42501',message:'Unexpected fictional operation'},403);
 };
 return f;
}
