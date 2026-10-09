// Synthetic DOM/visual acceptance fixture. Excluded from the public site build.
(() => {const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',campaign='dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
 const permissions=['communications.view','communications.send','communications.bulk_send','communications.templates.view','communications.templates.manage','communications.delivery.view'];
 const state=window.commFixture={calls:[],user:{id:'synthetic-user'},deny:false,permissions:[...permissions],templates:[{id:'template-1',template_key:'event_reminder',version:1,channel:'email',message_type:'reminder',purpose:'event_updates',subject:'Your upcoming outreach',body:'Hello {{first_name}}, join {{campaign_name}}.',state:'published',active:true,revision:1},{id:'template-2',template_key:'welcome',version:2,channel:'email',message_type:'campaign',purpose:'event_updates',subject:'Welcome',body:'Hello {{first_name}}',state:'draft',active:false,revision:1}],activity:[{id:'message-1',campaign_id:campaign,recipient_name:'Ada Synthetic',recipient_key:'person:cccccccc-cccc-4ccc-8ccc-ccccccccccc1',channel:'email',message_type:'reminder',status:'delivered',attempts:1,provider_message_id:'sink:synthetic',created_at:'2026-10-09T12:00:00Z'},{id:'message-2',campaign_id:campaign,recipient_name:'Bert Synthetic',channel:'sms',message_type:'operational',status:'suppressed',attempts:0,failure_class:'consent_required',created_at:'2026-10-09T13:00:00Z'}],callbacks:[],recipients:[{key:'person:cccccccc-cccc-4ccc-8ccc-ccccccccccc1',name:'Ada Synthetic',address:'ada@example.test',subject:'Upcoming outreach',body:'Hello Ada, your outreach at Synthetic Hall is ready.',blocked:null},{key:'person:cccccccc-cccc-4ccc-8ccc-ccccccccccc2',name:'Bert Synthetic',address:'+15550000002',subject:'Upcoming outreach',body:'Hello Bert, your outreach at Synthetic Hall is ready.',blocked:'consent_required'}]};
 window.ChampionLifeAuth={getUser:async()=>state.user,signOut:async()=>{state.user=null;state.callbacks.forEach(fn=>fn('SIGNED_OUT',null));},client:{auth:{onAuthStateChange:fn=>state.callbacks.push(fn)},rpc:async(name,args={})=>{
  state.calls.push({name,args});if(state.delay)await state.delay;
  if(name==='staff_workspace_context')return{data:{organizations:[{id:org,name:'Synthetic Church'}],grants:[]}};
  if(name!=='communications_workspace')return{error:{code:'42501'},status:403};
  const p=args.p_payload||{},action=args.p_action;if(state.deny&&action!=='context')return{error:{code:'42501'},status:403};
  if(action==='context')return{data:{organizations:state.deny?[]:[{id:org,name:'Synthetic Church',permissions:state.permissions}],campaigns:state.deny?[]:[{id:campaign,organization_id:org,name:'Synthetic outreach',permissions:state.permissions}]}};
  if(action==='overview')return{data:{metrics:{queued:12,scheduled:4,sent:25,delivered:23,failed:2,suppressed:6},delivery_mode:'acceptance_sink'}};
  if(action==='senders')return{data:[{id:'sender-1',display_name:'Synthetic Church',channel:'email'},{id:'sender-2',display_name:'Synthetic Church',channel:'sms'}]};
  if(action==='templates')return{data:state.templates};
  if(action==='preview')return{data:{delivery_mode:'acceptance_sink',batch:{id:'batch-synthetic',state:'draft',channel:p.channel,purpose:p.purpose||'event_updates',recipients:state.recipients}}};
  if(action==='confirm')return{data:{id:p.id,state:'queued',count:2}};
  if(action==='external_history')return{data:[]};
  if(action==='batch')return{data:{messages:state.activity.map(m=>({name:m.recipient_name,status:m.status}))}};
  if(action==='activity'||action==='history')return{data:state.activity};
  if(action==='message')return{data:{subject:'Synthetic subject',rendered_body:'Synthetic message content.'}};
  if(action==='template_preview')return{data:{subject:'Preview subject',body:'Hello Sample recipient — Synthetic outreach.'}};
  return{data:{id:'synthetic-result',state:'draft'}};
 }}};
})();
