// Fictional SDK port only: actual auth facade, module and shells are Git-pinned inputs.
(() => {
 const O='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
 const user={id:'fictional-a',email:'fictional-a@example.invalid',email_confirmed_at:'2026-01-01'};
 const permissions=['communications.view','communications.send','communications.templates.view','communications.templates.manage','communications.delivery.view'];
 const organizations=[{id:O,name:'Fictional Church'},{id:P,name:'Fictional Outreach'}],campaigns=[{id:C,organization_id:O,name:'Fictional Campaign'}];
 const state=window.communicationComposition={user,sessionUser:user,callbacks:[],calls:[],events:[],sdkRequests:[],denied:false};
 window.addEventListener('error',event=>state.events.push({kind:'error',message:event.message}));
 window.addEventListener('unhandledrejection',event=>state.events.push({kind:'rejection',message:String(event.reason)}));
 const client={auth:{
  getSession:async()=>({data:{session:state.sessionUser?{user:state.sessionUser}:null},error:null}),
  getUser:async()=>({data:{user:state.user},error:null}),
  onAuthStateChange:callback=>{state.callbacks.push(callback);return{data:{subscription:{unsubscribe(){}}}}},
  signOut:async()=>{state.user=state.sessionUser=null;state.callbacks.forEach(fn=>fn('SIGNED_OUT',null));return{error:null}}
 },rpc:async(name,args={})=>{
  state.calls.push({name,args});state.events.push({kind:'rpc',name,action:args.p_action});
  if(state.hold===name+':'+(args.p_action||'')){state.hold=null;await new Promise(resolve=>state.release=resolve);}
  if(state.denied)return{error:{code:'42501'},status:403};
  if(name==='staff_workspace_context')return{data:{organizations,grants:organizations.flatMap(o=>[{organization_id:o.id,permission:'people.read',department_ids:null},...permissions.map(permission=>({organization_id:o.id,permission,department_ids:null}))])}};
  if(name==='outreach_registration_workspace')return{data:campaigns};
  if(name==='forms_workspace')return{data:{capabilities:{profile:'private_draft_v1'},organizations:[]}};
  if(name==='outreach_campaign_workspace')return{data:args.p_action==='context'?{organizations}:campaigns};
  if(['outreach_pre_event_workspace','outreach_prize_workspace','outreach_event_day_workspace','outreach_team_access'].includes(name))return{data:[]};
  if(name==='communications_workspace'){
   if(args.p_action==='context')return{data:{external_delivery_enabled:false,organizations:organizations.map(o=>({...o,permissions})),campaigns:campaigns.map(c=>({...c,permissions}))}};
   if(args.p_action==='senders')return{data:[{id:'fictional-sender',display_name:'Fictional sender',channel:'email'}]};
   if(args.p_action==='templates')return{data:[]};
   if(args.p_action==='activity')return{data:[{id:'fictional-message',campaign_id:C,recipient_name:'Fictional Recipient',channel:'email',message_type:'operational',status:'failed',failure_class:'unknown',attempts:1,created_at:'2026-11-06T00:00:00Z'}]};
   // A composition probe may discover/read, but never exercise sending/mutation.
   throw Error('UNEXPECTED_COMMUNICATIONS_OPERATION:'+args.p_action);
  }
  return{error:{code:'42501'},status:403};
 }};
 window.CHAMPION_LIFE_SUPABASE={url:'https://fictional-auth.invalid',publishableKey:'fictional-public-key'};
 window.supabase={createClient:()=>client};
})();
