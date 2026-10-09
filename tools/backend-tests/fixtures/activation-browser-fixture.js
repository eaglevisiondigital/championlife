// Local disconnected synthetic UI fixture. Never published. No credentials or live RPCs.
(()=>{const g=window.commFixture,org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',profile='ffffffff-ffff-4fff-8fff-ffffffffffa1';g.permissions.push('communications.providers.view','communications.providers.manage','communications.providers.test','communications.providers.enable');
const s=window.activationFixture={global:false,test:false,deny:false,profiles:[{profile_id:profile,provider_name:'Network Solutions SMTP · synthetic metadata',configured:true,credentials_verified:true,sender_approved:true,mode:'disabled',enabled:false,health:'disabled',allowed_classes:['transactional'],sender:{display_name:'Synthetic Champion Life',from_address:'office@example.test',reply_to:'reply@example.test',channel:'email'}}],allowlist:[{id:'synthetic-allowlist',channel:'email',recipient:'ada@example.test',enabled:true,expires_at:'2026-10-20T00:00:00Z'}],organization:{enabled:false,email_enabled:false,sms_enabled:false}};
const prior=window.ChampionLifeAuth.client.rpc;
window.ChampionLifeAuth.client.rpc=async(name,args={})=>{
 if(name==='communications_workspace'&&args.p_action==='context'){const r=await prior(name,args);r.data.external_delivery_enabled=s.global;return r;}
 if(name!=='communications_provider_workspace')return prior(name,args);
 g.calls.push({name,args});if(g.delay)await g.delay;const p=args.p_payload||{},a=args.p_action;
 if(a==='context')return{data:{super_admin:true,organizations:s.deny?[]:[{id:org,name:'Synthetic Champion Life',permissions:g.permissions.filter(k=>k.startsWith('communications.providers.'))}]}};
 if(s.deny)return{error:{code:'42501'},status:403};
 if(a==='overview')return{data:{global_enabled:s.global,environment:'acceptance',super_admin:true,organization:s.organization,profiles:s.profiles,allowlist:s.allowlist,sms_status:'NOT CONFIGURED / PROVIDER SELECTION REQUIRED'}};
 if(a==='enable'){s.profiles[0].mode='test_only';s.profiles[0].enabled=true;s.profiles[0].health='unknown';return{data:{updated:true}};}
 if(a==='disable'||a==='suspend'){s.profiles[0].enabled=false;s.profiles[0].mode=a==='disable'?'disabled':'suspended';return{data:{updated:true}};}
 if(a==='org_delivery'){s.organization={...s.organization,...p};return{data:{updated:true}};}
 if(a==='global_delivery'){s.global=p.enabled;return{data:{updated:true}};}
 if(a==='allowlist_remove'){s.allowlist[0].enabled=false;return{data:{updated:true}};}
 if(a==='test_recipients')return{data:[{id:'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',channel:'email',name:'Ada Synthetic',address:'ada@example.test'}]};
 if(a==='test_preview')return{data:{subject:'Synthetic Champion Life Communications Test',body:'This is an authorized test of the Global Propel Communications Core for Synthetic Champion Life. <script>literal test content</script>',recipient:'ada@example.test',mode:s.test?'test_only':'disabled',counts:{eligible:1,suppressed:0,invalid:0,held:s.test?0:1,would_send:s.test?1:0}}};
 if(a==='test_confirm')return{data:{message_id:'synthetic-test-record',status:'queued'}};
 if(a==='configure'||a==='allowlist_add')return{data:{updated:true}};
 return{data:{message_id:'synthetic-test-record',status:'sent',attempts:1,provider_message_id:'fake-only'}};
};window.ChampionLifeAuth.client.functions={invoke:async(name,args)=>{g.calls.push({name,args});return{data:{message_id:'synthetic-test-record',status:'sent',attempts:1,provider_message_id:'fake-only'}};}};
})();
